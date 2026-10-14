import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppCharge, AppChargeMethod, AppChargeStatus, LedgerAccount, Prisma, SsoClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { AppPaymentsLedgerService } from './app-payments-ledger.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { RefundChargeDto } from './dto/refund-charge.dto';
import { FilterChargesDto } from './dto/filter-charges.dto';
import { AppChargeDto } from './dto/responses.dto';

export interface CreateChargeResult {
  charge: AppChargeDto;
  clientSecret?: string | null;
  approvalUrl?: string | null;
}

@Injectable()
export class AppPaymentsService {
  private readonly logger = new Logger(AppPaymentsService.name);
  private stripe?: Stripe;
  private paypalBaseUrl: string;
  private paypalToken?: { value: string; expiresAt: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
    private readonly ledger: AppPaymentsLedgerService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }

    const paypalEnv = this.config.get<string>('PAYPAL_ENV');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    if (isProduction && paypalEnv !== 'live') {
      throw new Error('PAYPAL_ENV must be "live" in production — refusing to run against PayPal sandbox.');
    }
    this.paypalBaseUrl =
      paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  }

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async createCharge(
    client: SsoClient,
    dto: CreateChargeDto,
    idempotencyKey: string,
    ipAddress?: string,
  ): Promise<CreateChargeResult> {
    const existing = await this.prisma.appCharge.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.appClientId !== client.clientId) {
        // Idempotency keys are globally unique; never leak another app's charge.
        throw new ConflictException('This idempotency key has already been used.');
      }
      return this.replayCreate(client, existing);
    }

    const amountMinor = BigInt(dto.amountMinor);
    if (amountMinor <= 0n) {
      throw new BadRequestException('amountMinor must be greater than zero.');
    }
    const currency = (dto.currency || 'GBP').toUpperCase();
    const feeConfig = await this.ledger.resolveFeeConfig(client);
    const feeMinor = this.ledger.computeFee(amountMinor, feeConfig);
    const netMinor = amountMinor - feeMinor;

    if (dto.method === AppChargeMethod.wallet) {
      return this.createWalletCharge(client, dto, idempotencyKey, amountMinor, feeMinor, netMinor, currency, ipAddress);
    }

    const charge = await this.prisma.appCharge.create({
      data: {
        appClientId: client.clientId,
        amountMinor,
        currency,
        feeMinor,
        netMinor,
        method: dto.method,
        status: AppChargeStatus.pending,
        reference: dto.reference,
        description: dto.description ?? null,
        mcomUserId: dto.mcomUserId ?? null,
        externalCustomerId: dto.externalCustomerId ?? null,
        idempotencyKey,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    try {
      if (dto.method === AppChargeMethod.stripe) {
        return await this.initiateStripe(client, charge, dto);
      }
      if (dto.method === AppChargeMethod.paypal) {
        return await this.initiatePaypal(client, charge, dto);
      }
      throw new BadRequestException(`Unsupported payment method: ${dto.method}`);
    } catch (err) {
      await this.prisma.appCharge
        .update({
          where: { id: charge.id },
          data: { status: AppChargeStatus.failed, failureReason: this.errMessage(err) },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  private async initiateStripe(client: SsoClient, charge: AppCharge, dto: CreateChargeDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }
    const intent = await this.stripe.paymentIntents.create({
      amount: Number(charge.amountMinor),
      currency: charge.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      description: dto.description || `MCOM Pay — ${client.name}`,
      metadata: { chargeId: charge.id, appClientId: client.clientId, reference: dto.reference },
    });

    const updated = await this.prisma.appCharge.update({
      where: { id: charge.id },
      data: { provider: 'stripe', providerRef: intent.id },
    });

    return { charge: this.toChargeDto(updated), clientSecret: intent.client_secret };
  }

  private async initiatePaypal(client: SsoClient, charge: AppCharge, dto: CreateChargeDto) {
    const token = await this.getPayPalAccessToken();
    const value = new Decimal(charge.amountMinor.toString()).dividedBy(100).toFixed(2);
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';

    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: charge.currency, value },
            description: dto.description || `MCOM Pay — ${client.name}`,
            custom_id: charge.id,
          },
        ],
        application_context: {
          brand_name: client.name,
          user_action: 'PAY_NOW',
          return_url: `${appUrl}/payment/success`,
          cancel_url: `${appUrl}/payment/cancel`,
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );

    const approvalUrl = (data?.links || []).find((l: any) => l.rel === 'approve')?.href ?? null;
    const updated = await this.prisma.appCharge.update({
      where: { id: charge.id },
      data: { provider: 'paypal', providerRef: data.id },
    });

    return { charge: this.toChargeDto(updated), approvalUrl };
  }

  private async createWalletCharge(
    client: SsoClient,
    dto: CreateChargeDto,
    idempotencyKey: string,
    amountMinor: bigint,
    feeMinor: bigint,
    netMinor: bigint,
    currency: string,
    ipAddress?: string,
  ) {
    if (!dto.mcomUserId) {
      throw new BadRequestException('mcomUserId is required for the wallet payment method.');
    }
    if (currency !== 'GBP') {
      throw new BadRequestException('Wallet payments are currently only supported for GBP charges.');
    }

    const charge = await this.prisma.appCharge.create({
      data: {
        appClientId: client.clientId,
        amountMinor,
        currency,
        feeMinor,
        netMinor,
        method: AppChargeMethod.wallet,
        status: AppChargeStatus.pending,
        reference: dto.reference,
        description: dto.description ?? null,
        mcomUserId: dto.mcomUserId,
        externalCustomerId: dto.externalCustomerId ?? null,
        idempotencyKey,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const credits = await this.resolveWalletCredits(amountMinor, currency);
    const partner = await this.walletService.resolvePartner(client.clientId);

    try {
      await this.walletService.debitWallet(
        partner,
        {
          userId: dto.mcomUserId,
          amount: credits.toNumber(),
          category: 'PURCHASE' as any,
          description: dto.description || `MCOM Pay — ${client.name}`,
          reference: dto.reference,
          metadata: { chargeId: charge.id, appClientId: client.clientId },
        },
        `appcharge:${charge.id}:wallet`,
        ipAddress,
      );
    } catch (err) {
      await this.prisma.appCharge.update({
        where: { id: charge.id },
        data: { status: AppChargeStatus.failed, failureReason: this.errMessage(err) },
      });
      throw err;
    }

    const paid = await this.markPaid(charge, {
      provider: 'wallet',
      providerRef: null,
      walletDebitAmount: credits,
    });

    return { charge: this.toChargeDto(paid) };
  }

  /** Idempotent create replay — reconstructs the provider handle where possible. */
  private async replayCreate(client: SsoClient, charge: AppCharge) {
    if (charge.status !== AppChargeStatus.pending || charge.appClientId !== client.clientId) {
      return { charge: this.toChargeDto(charge) };
    }
    try {
      if (charge.method === AppChargeMethod.stripe && charge.providerRef && this.stripe) {
        const intent = await this.stripe.paymentIntents.retrieve(charge.providerRef);
        return { charge: this.toChargeDto(charge), clientSecret: intent.client_secret };
      }
      if (charge.method === AppChargeMethod.paypal && charge.providerRef) {
        const token = await this.getPayPalAccessToken();
        const { data } = await axios.get(
          `${this.paypalBaseUrl}/v2/checkout/orders/${charge.providerRef}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const approvalUrl = (data?.links || []).find((l: any) => l.rel === 'approve')?.href ?? null;
        return { charge: this.toChargeDto(charge), approvalUrl };
      }
    } catch (err: any) {
      this.logger.warn(`Replay provider handle lookup failed for charge ${charge.id}: ${err?.message}`);
    }
    return { charge: this.toChargeDto(charge) };
  }

  // ─── CONFIRM ───────────────────────────────────────────────────────────────

  async confirmCharge(client: SsoClient, chargeId: string, dto: ConfirmChargeDto) {
    const charge = await this.getOwnedCharge(client, chargeId);

    if (charge.status === AppChargeStatus.paid) {
      return { charge: this.toChargeDto(charge), replayed: true };
    }
    if (charge.status !== AppChargeStatus.pending) {
      throw new ConflictException(`Charge is ${charge.status} and cannot be confirmed.`);
    }

    if (charge.method === AppChargeMethod.stripe) {
      return this.confirmStripe(client, charge, dto);
    }
    if (charge.method === AppChargeMethod.paypal) {
      return this.confirmPaypal(client, charge, dto);
    }
    // wallet charges are settled at create time
    return { charge: this.toChargeDto(charge) };
  }

  private async confirmStripe(client: SsoClient, charge: AppCharge, dto: ConfirmChargeDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }
    const intentId = dto.paymentIntentId || charge.providerRef;
    if (!intentId) {
      throw new BadRequestException('paymentIntentId is required.');
    }
    if (charge.providerRef && charge.providerRef !== intentId) {
      throw new BadRequestException('paymentIntentId does not match this charge.');
    }

    const intent = await this.stripe.paymentIntents.retrieve(intentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
    }
    if (intent.metadata?.chargeId && intent.metadata.chargeId !== charge.id) {
      throw new ForbiddenException('This payment belongs to a different charge.');
    }
    if (intent.currency?.toLowerCase() !== charge.currency.toLowerCase() || BigInt(intent.amount) !== charge.amountMinor) {
      throw new BadRequestException('Paid amount does not match the charge amount.');
    }

    const paid = await this.markPaid(charge, { provider: 'stripe', providerRef: intentId });
    return { charge: this.toChargeDto(paid) };
  }

  private async confirmPaypal(client: SsoClient, charge: AppCharge, dto: ConfirmChargeDto) {
    const orderId = dto.orderId || charge.providerRef;
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    if (charge.providerRef && charge.providerRef !== orderId) {
      throw new BadRequestException('orderId does not match this charge.');
    }

    const token = await this.getPayPalAccessToken();
    let capture: any;
    try {
      const { data } = await axios.post(
        `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      capture = data;
    } catch (err: any) {
      // Already-captured replay: read the order back instead of failing.
      if (err?.response?.status === 422 && /ORDER_ALREADY_CAPTURED/i.test(JSON.stringify(err?.response?.data ?? ''))) {
        const { data } = await axios.get(
          `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        capture = data;
      } else {
        throw new BadGatewayException(this.paypalError(err));
      }
    }

    const captureInfo = capture?.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedValue = Number(captureInfo?.amount?.value);
    const expectedValue = Number(new Decimal(charge.amountMinor.toString()).dividedBy(100).toFixed(2));
    if (!Number.isFinite(capturedValue) || Math.abs(capturedValue - expectedValue) > 0.005) {
      throw new BadRequestException('Captured amount does not match the charge amount.');
    }

    const paid = await this.markPaid(charge, {
      provider: 'paypal',
      providerRef: orderId,
      metadataPatch: { paypalCaptureId: captureInfo?.id ?? null },
    });
    return { charge: this.toChargeDto(paid) };
  }

  // ─── REFUND ────────────────────────────────────────────────────────────────

  async refundCharge(client: SsoClient, chargeId: string, dto: RefundChargeDto) {
    const charge = await this.getOwnedCharge(client, chargeId);
    if (charge.status !== AppChargeStatus.paid) {
      throw new ConflictException(`Only paid charges can be refunded (charge is ${charge.status}).`);
    }

    const refundMinor = dto.amountMinor ? BigInt(dto.amountMinor) : charge.amountMinor;
    if (refundMinor <= 0n || refundMinor > charge.amountMinor) {
      throw new BadRequestException('Refund amount must be between 1 and the charge amount.');
    }
    const feeRefundMinor = this.ledger.computeRefundFee(
      { amountMinor: charge.amountMinor, feeMinor: charge.feeMinor },
      refundMinor,
    );
    const netRefundMinor = refundMinor - feeRefundMinor;
    const isFullRefund = refundMinor === charge.amountMinor;

    if (charge.method === AppChargeMethod.stripe) {
      await this.refundStripe(charge, refundMinor);
    } else if (charge.method === AppChargeMethod.paypal) {
      await this.refundPaypal(charge, refundMinor);
    } else if (charge.method === AppChargeMethod.wallet) {
      await this.refundWallet(client, charge, netRefundMinor);
    }

    const clearingAccount =
      charge.method === AppChargeMethod.wallet ? LedgerAccount.wallet_clearing : LedgerAccount.gateway_clearing;

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ledger.postRefundLedger(tx, {
        chargeId: charge.id,
        appClientId: charge.appClientId,
        refundMinor,
        feeRefundMinor,
        netRefundMinor,
        currency: charge.currency,
        clearingAccount,
        mcomUserId: charge.mcomUserId,
        provider: charge.provider,
        providerRef: charge.providerRef,
        reference: charge.reference,
        metadata: { reason: dto.reason ?? null, partial: !isFullRefund } as Prisma.InputJsonValue,
      });

      return tx.appCharge.update({
        where: { id: charge.id },
        data: {
          status: isFullRefund ? AppChargeStatus.refunded : charge.status,
          metadata: {
            ...((charge.metadata as Record<string, unknown>) ?? {}),
            lastRefund: { amountMinor: refundMinor.toString(), reason: dto.reason ?? null, at: new Date().toISOString() },
          } as Prisma.InputJsonValue,
        },
      });
    });

    this.dispatchWebhook(updated, 'payment.refunded', { amountMinor: refundMinor.toString() });
    return { charge: this.toChargeDto(updated) };
  }

  private async refundStripe(charge: AppCharge, refundMinor: bigint) {
    if (!this.stripe || !charge.providerRef) {
      throw new InternalServerErrorException('Stripe refund is unavailable for this charge.');
    }
    await this.stripe.refunds.create({
      payment_intent: charge.providerRef,
      amount: Number(refundMinor),
    });
  }

  private async refundPaypal(charge: AppCharge, refundMinor: bigint) {
    const captureId = (charge.metadata as any)?.paypalCaptureId;
    if (!captureId) {
      throw new InternalServerErrorException('PayPal capture id is missing — cannot refund automatically.');
    }
    const token = await this.getPayPalAccessToken();
    const value = new Decimal(refundMinor.toString()).dividedBy(100).toFixed(2);
    try {
      await axios.post(
        `${this.paypalBaseUrl}/v2/payments/captures/${captureId}/refund`,
        { amount: { value, currency_code: charge.currency } },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
    } catch (err: any) {
      throw new BadGatewayException(this.paypalError(err));
    }
  }

  private async refundWallet(client: SsoClient, charge: AppCharge, netRefundMinor: bigint) {
    if (!charge.mcomUserId) {
      throw new BadRequestException('Cannot refund a wallet charge without a payer.');
    }
    const credits = await this.resolveWalletCredits(netRefundMinor, charge.currency);
    const partner = await this.walletService.resolvePartner(client.clientId);
    await this.walletService.creditWallet(
      partner,
      {
        userId: charge.mcomUserId,
        amount: credits.toNumber(),
        category: 'REFUND' as any,
        description: `Refund — MCOM Pay ${charge.reference ?? charge.id}`,
        reference: charge.reference ?? charge.id,
        metadata: { chargeId: charge.id, appClientId: client.clientId },
      },
      `appcharge:${charge.id}:refund`,
    );
  }

  // ─── QUERIES ───────────────────────────────────────────────────────────────

  async getCharge(client: SsoClient, chargeId: string) {
    const charge = await this.getOwnedCharge(client, chargeId);
    return this.toChargeDto(charge);
  }

  async listCharges(client: SsoClient, filters: FilterChargesDto) {
    return this.paginateCharges({ appClientId: client.clientId }, filters);
  }

  async listAllCharges(filters: FilterChargesDto & { appClientId?: string; search?: string }) {
    return this.paginateCharges(
      filters.appClientId ? { appClientId: filters.appClientId } : {},
      filters,
    );
  }

  async getLedgerForCharge(chargeId: string) {
    return this.ledger.getEntriesForCharge(chargeId);
  }

  async getChargeAsAdmin(chargeId: string) {
    const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Charge not found.');
    return this.toChargeDto(charge);
  }

  private async paginateCharges(
    scope: Prisma.AppChargeWhereInput,
    filters: FilterChargesDto & { search?: string },
  ) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const search = filters.search?.trim();
    const where: Prisma.AppChargeWhereInput = {
      ...scope,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.mcomUserId ? { mcomUserId: filters.mcomUserId } : {}),
      ...(filters.reference ? { reference: filters.reference } : {}),
      ...(search
        ? {
            OR: [
              { id: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { mcomUserId: { contains: search, mode: 'insensitive' } },
              { externalCustomerId: { contains: search, mode: 'insensitive' } },
              { providerRef: { contains: search, mode: 'insensitive' } },
              { appClientId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...((filters.dateFrom || filters.dateTo)
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.appCharge.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appCharge.count({ where }),
    ]);

    return {
      success: true,
      data: rows.map((r) => this.toChargeDto(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async getOwnedCharge(client: SsoClient, chargeId: string): Promise<AppCharge> {
    const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
    if (!charge) throw new NotFoundException('Charge not found.');
    if (charge.appClientId !== client.clientId) {
      throw new ForbiddenException('This charge does not belong to your app.');
    }
    return charge;
  }

  // ─── PAID TRANSITION + LEDGER ──────────────────────────────────────────────

  private async markPaid(
    charge: AppCharge,
    opts: {
      provider: string;
      providerRef: string | null;
      walletDebitAmount?: Decimal;
      metadataPatch?: Record<string, unknown>;
    },
  ): Promise<AppCharge> {
    const clearingAccount =
      charge.method === AppChargeMethod.wallet ? LedgerAccount.wallet_clearing : LedgerAccount.gateway_clearing;

    const paid = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.appCharge.update({
        where: { id: charge.id },
        data: {
          status: AppChargeStatus.paid,
          paidAt: new Date(),
          provider: opts.provider,
          ...(opts.providerRef ? { providerRef: opts.providerRef } : {}),
          ...(opts.walletDebitAmount ? { walletDebitAmount: opts.walletDebitAmount } : {}),
          ...(opts.metadataPatch
            ? {
                metadata: {
                  ...((charge.metadata as Record<string, unknown>) ?? {}),
                  ...opts.metadataPatch,
                } as Prisma.InputJsonValue,
              }
            : {}),
        },
      });

      await this.ledger.postChargeLedger(tx, {
        chargeId: charge.id,
        appClientId: charge.appClientId,
        amountMinor: charge.amountMinor,
        feeMinor: charge.feeMinor,
        netMinor: charge.netMinor,
        currency: charge.currency,
        clearingAccount,
        mcomUserId: charge.mcomUserId,
        provider: opts.provider,
        providerRef: opts.providerRef,
        reference: charge.reference,
        metadata: (charge.metadata as Prisma.InputJsonValue) ?? undefined,
      });

      return updated;
    });

    this.dispatchWebhook(paid, 'payment.succeeded', {});
    return paid;
  }

  private dispatchWebhook(charge: AppCharge, event: string, extra: Record<string, unknown>) {
    try {
      this.webhookDispatcher.dispatchAsync(charge.appClientId, event, {
        chargeId: charge.id,
        amountMinor: charge.amountMinor.toString(),
        feeMinor: charge.feeMinor.toString(),
        netMinor: charge.netMinor.toString(),
        currency: charge.currency,
        method: charge.method,
        status: charge.status,
        reference: charge.reference,
        mcomUserId: charge.mcomUserId,
        externalCustomerId: charge.externalCustomerId,
        provider: charge.provider,
        providerRef: charge.providerRef,
        paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
        ...extra,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch ${event} for charge ${charge.id}: ${err?.message}`);
    }
  }

  // ─── WEBHOOKS ──────────────────────────────────────────────────────────────

  async handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new InternalServerErrorException('STRIPE_WEBHOOK_SECRET is not configured.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Invalid Stripe webhook signature: ${err?.message}`);
      throw new BadRequestException('Invalid webhook signature.');
    }

    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const chargeId = intent.metadata?.chargeId;
      if (chargeId) {
        await this.settleStripeIntent(chargeId, intent);
      }
    }
    return { received: true };
  }

  private async settleStripeIntent(chargeId: string, intent: Stripe.PaymentIntent) {
    const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
    if (!charge || charge.status === AppChargeStatus.paid) return;
    if (charge.status !== AppChargeStatus.pending) return;
    if (BigInt(intent.amount) !== charge.amountMinor) {
      this.logger.error(
        `Stripe webhook amount mismatch for charge ${chargeId}: ${intent.amount} vs ${charge.amountMinor}`,
      );
      return;
    }
    await this.markPaid(charge, { provider: 'stripe', providerRef: intent.id });
  }

  async handlePaypalWebhook(rawBody: string | Buffer, headers: Record<string, any>): Promise<{ received: boolean }> {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    const token = await this.getPayPalAccessToken();

    const verified = await this.verifyPaypalSignature(token, webhookId, rawBody, headers);
    if (!verified) {
      throw new UnauthorizedException('Invalid PayPal webhook signature.');
    }

    let event: any;
    try {
      event = JSON.parse(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid webhook payload.');
    }

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const chargeId = event.resource?.custom_id;
      if (chargeId) {
        const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
        if (charge && charge.status === AppChargeStatus.pending) {
          await this.markPaid(charge, {
            provider: 'paypal',
            providerRef: charge.providerRef,
            metadataPatch: { paypalCaptureId: event.resource?.id ?? null },
          });
        }
      }
    }
    return { received: true };
  }

  private async verifyPaypalSignature(
    token: string,
    webhookId: string | undefined,
    rawBody: string | Buffer,
    headers: Record<string, any>,
  ): Promise<boolean> {
    if (!webhookId) {
      this.logger.error('PAYPAL_WEBHOOK_ID is not configured — rejecting PayPal webhook.');
      return false;
    }
    try {
      const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const { data } = await axios.post(
        `${this.paypalBaseUrl}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: JSON.parse(body),
        },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      return data?.verification_status === 'SUCCESS';
    } catch (err: any) {
      this.logger.error(`PayPal webhook verification failed: ${err?.message}`);
      return false;
    }
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  private async resolveWalletCredits(amountMinor: bigint, currency: string): Promise<Decimal> {
    const major = new Decimal(amountMinor.toString()).dividedBy(100);
    let rate = new Decimal(1);
    try {
      const fx = await this.prisma.fxRate.findUnique({
        where: { base_quote: { base: currency.toUpperCase(), quote: 'MCOM' } },
      });
      if (fx) rate = new Decimal(fx.rate.toString());
    } catch (err: any) {
      this.logger.warn(`FX lookup failed for ${currency}→MCOM: ${err?.message}`);
    }
    return major.times(rate);
  }

  private async getPayPalAccessToken(): Promise<string> {
    if (this.paypalToken && this.paypalToken.expiresAt > Date.now()) {
      return this.paypalToken.value;
    }
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('PayPal credentials are not configured.');
    }
    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    const value = data?.access_token;
    const ttl = Math.max(60, (data?.expires_in || 3600) - 300);
    this.paypalToken = { value, expiresAt: Date.now() + ttl * 1000 };
    return value;
  }

  private paypalError(err: any): string {
    return err?.response?.data?.message || err?.message || 'PayPal request failed.';
  }

  private errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      return String((err as any).message);
    }
    return String(err);
  }

  toChargeDto(charge: AppCharge): AppChargeDto {
    return {
      id: charge.id,
      appClientId: charge.appClientId,
      amountMinor: charge.amountMinor.toString(),
      currency: charge.currency,
      feeMinor: charge.feeMinor.toString(),
      netMinor: charge.netMinor.toString(),
      method: charge.method,
      status: charge.status,
      reference: charge.reference,
      description: charge.description,
      mcomUserId: charge.mcomUserId,
      externalCustomerId: charge.externalCustomerId,
      provider: charge.provider,
      providerRef: charge.providerRef,
      walletDebitAmount: charge.walletDebitAmount ? charge.walletDebitAmount.toFixed(4) : null,
      paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
      createdAt: charge.createdAt.toISOString(),
    };
  }
}
