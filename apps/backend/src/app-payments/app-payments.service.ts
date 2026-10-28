import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppCharge,
  AppChargeMethod,
  AppChargeStatus,
  AppRefund,
  LedgerAccount,
  Prisma,
  SsoClient,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import Stripe from 'stripe';
import axios from 'axios';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { AppPaymentsLedgerService } from './app-payments-ledger.service';
import { CreateChargeDto } from './dto/create-charge.dto';
import { ConfirmChargeDto } from './dto/confirm-charge.dto';
import { RefundChargeDto } from './dto/refund-charge.dto';
import { FilterChargesDto } from './dto/filter-charges.dto';
import { AppChargeDto, AppRefundDto, RefundChargeResponseDto } from './dto/responses.dto';

export interface CreateChargeResult {
  charge: AppChargeDto;
  clientSecret?: string | null;
  approvalUrl?: string | null;
}

export type RefundChargeResult = RefundChargeResponseDto;

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
    const amountMinor = BigInt(dto.amountMinor);
    if (amountMinor <= 0n) {
      throw new BadRequestException('amountMinor must be greater than zero.');
    }
    const currency = (dto.currency || 'GBP').toUpperCase();
    const requestHash = this.hashChargeRequest(dto, currency);

    const existing = await this.findByKey(client.clientId, idempotencyKey);
    if (existing) {
      return this.replayCreate(client, existing, requestHash);
    }

    const feeConfig = await this.ledger.resolveFeeConfig(client);
    const feeMinor = this.ledger.computeFee(amountMinor, feeConfig);
    const netMinor = amountMinor - feeMinor;

    if (dto.method === AppChargeMethod.wallet) {
      return this.createWalletCharge(
        client,
        dto,
        idempotencyKey,
        requestHash,
        amountMinor,
        feeMinor,
        netMinor,
        currency,
        ipAddress,
      );
    }

    // The insert is the idempotency claim. A concurrent duplicate loses on the
    // unique key and must REPLAY the winner — never surface P2002 as a 500.
    const charge = await this.insertCharge({
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
      requestHash,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    });

    if (!charge) {
      const winner = await this.findByKey(client.clientId, idempotencyKey);
      if (winner) return this.replayCreate(client, winner, requestHash);
      throw new ConflictException(
        'A concurrent request is using this idempotency key. Retry with the same X-Idempotency-Key.',
      );
    }

    try {
      if (dto.method === AppChargeMethod.stripe) {
        return await this.initiateStripe(client, charge, dto);
      }
      if (dto.method === AppChargeMethod.paypal) {
        return await this.initiatePaypal(client, charge, dto);
      }
      throw new BadRequestException(`Unsupported payment method: ${dto.method}`);
    } catch (err) {
      await this.markFailed(charge, err);
      throw err;
    }
  }

  /**
   * Insert the charge row, tolerating a duplicate idempotency key.
   * Returns null when another request won the race — the caller replays it.
   */
  private async insertCharge(data: Prisma.AppChargeUncheckedCreateInput): Promise<AppCharge | null> {
    try {
      return await this.prisma.appCharge.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return null;
      }
      throw err;
    }
  }

  private findByKey(appClientId: string, idempotencyKey: string): Promise<AppCharge | null> {
    return this.prisma.appCharge.findUnique({
      where: { appClientId_idempotencyKey: { appClientId, idempotencyKey } },
    });
  }

  /**
   * Fingerprint of the economic intent behind an idempotency key. A replay with
   * the same key but a different amount/method/reference is a client bug, not a
   * retry — it must fail loudly instead of silently returning the old charge.
   */
  private hashChargeRequest(dto: CreateChargeDto, currency: string): string {
    return crypto
      .createHash('sha256')
      .update([dto.amountMinor, currency, dto.method, dto.reference].join('|'))
      .digest('hex');
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

    try {
      const updated = await this.prisma.appCharge.update({
        where: { id: charge.id },
        data: { provider: 'stripe', providerRef: intent.id },
      });
      return { charge: this.toChargeDto(updated), clientSecret: intent.client_secret };
    } catch (err) {
      // The intent is live and payable. Never leave it orphaned against a
      // charge we are about to mark failed — cancel it, or flag for reconcile.
      await this.cancelStripeIntent(intent.id, charge.id, err);
      throw err;
    }
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
    try {
      const updated = await this.prisma.appCharge.update({
        where: { id: charge.id },
        data: { provider: 'paypal', providerRef: data.id },
      });
      return { charge: this.toChargeDto(updated), approvalUrl };
    } catch (err) {
      await this.cancelPayPalOrder(data.id, charge.id, err);
      throw err;
    }
  }

  private async createWalletCharge(
    client: SsoClient,
    dto: CreateChargeDto,
    idempotencyKey: string,
    requestHash: string,
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

    const charge = await this.insertCharge({
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
      requestHash,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
    });

    if (!charge) {
      const winner = await this.findByKey(client.clientId, idempotencyKey);
      if (winner) return this.replayCreate(client, winner, requestHash);
      throw new ConflictException(
        'A concurrent request is using this idempotency key. Retry with the same X-Idempotency-Key.',
      );
    }

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
      await this.markFailed(charge, err);
      throw err;
    }

    const paid = await this.markPaid(charge, {
      provider: 'wallet',
      providerRef: null,
      walletDebitAmount: credits,
    });

    return { charge: this.toChargeDto(paid) };
  }

  /**
   * Idempotent create replay. Reconstructs the provider handle where possible.
   *
   * - Same key + different payload → 409 (never silently return the old charge).
   * - Terminal-failure charges → 409: the key is consumed and cannot be re-driven.
   * - Paid / refunding / refunded → return the current state.
   */
  private async replayCreate(client: SsoClient, charge: AppCharge, requestHash?: string) {
    // Defence in depth: keys are scoped per app, so this should be unreachable.
    if (charge.appClientId !== client.clientId) {
      throw new ConflictException('This idempotency key has already been used.');
    }
    if (requestHash && charge.requestHash && requestHash !== charge.requestHash) {
      throw new ConflictException(
        'This X-Idempotency-Key was already used with a different payload (amount, currency, method or reference).',
      );
    }
    if (charge.status === AppChargeStatus.failed || charge.status === AppChargeStatus.cancelled) {
      throw new ConflictException(
        `This X-Idempotency-Key was already used for a charge that is ${charge.status}. Use a new key to retry the payment.`,
      );
    }
    if (charge.status !== AppChargeStatus.pending) {
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

  /**
   * Refund a paid charge, fully or partially.
   *
   * Refunds are claimed at two levels:
   *
   *   1. `AppRefund` is the idempotency record. The (appClientId,
   *      idempotencyKey) unique index means a retried request replays the
   *      original refund instead of moving money twice.
   *   2. The charge is compare-and-set from `paid | partially_refunded` to
   *      `refunding`, guarded by the `refundedMinor` snapshot we read. Two
   *      concurrent refunds with different keys can therefore never both reach
   *      the provider: the loser gets a 409 and moves no money.
   *
   * Partial refunds accumulate on `AppCharge.refundedMinor`, which cannot exceed
   * `amountMinor` because every claim re-reads it under the guard.
   */
  async refundCharge(
    client: SsoClient,
    chargeId: string,
    dto: RefundChargeDto,
    idempotencyKey: string,
  ): Promise<RefundChargeResult> {
    const charge = await this.getOwnedCharge(client, chargeId);
    const requestHash = this.hashRefundRequest(chargeId, dto);

    // The replay check must run before any state validation: by the time a
    // client retries, the charge may already be fully refunded, and rejecting
    // that would make a successful refund look like a failure.
    const existing = await this.findRefundByKey(client.clientId, idempotencyKey);
    if (existing) {
      return this.replayRefund(client, charge, existing, requestHash);
    }

    return this.executeRefund(client, charge, dto, idempotencyKey, requestHash);
  }

  private async executeRefund(
    client: SsoClient,
    charge: AppCharge,
    dto: RefundChargeDto,
    idempotencyKey: string,
    requestHash: string,
    retryOf?: AppRefund,
  ): Promise<RefundChargeResult> {
    if (
      charge.status !== AppChargeStatus.paid &&
      charge.status !== AppChargeStatus.partially_refunded
    ) {
      throw new ConflictException(
        `Only paid or partially refunded charges can be refunded (charge is ${charge.status}).`,
      );
    }

    const remainingMinor = charge.amountMinor - charge.refundedMinor;
    const refundMinor = retryOf
      ? retryOf.amountMinor
      : dto.amountMinor
        ? BigInt(dto.amountMinor)
        : remainingMinor;

    if (refundMinor <= 0n) {
      throw new ConflictException('This charge has already been fully refunded.');
    }
    if (refundMinor > remainingMinor) {
      if (retryOf) {
        await this.failRefund(retryOf.id, 'Not enough refundable balance remains for this refund.');
        throw new ConflictException('Not enough refundable balance remains for this refund.');
      }
      throw new BadRequestException(
        `Refund amount must not exceed the remaining refundable amount (${remainingMinor.toString()} minor units).`,
      );
    }

    let feeRefundMinor: bigint;
    if (retryOf) {
      feeRefundMinor = retryOf.feeRefundMinor;
    } else {
      const feeRefundedSoFar = await this.sumFeeRefunded(charge.id);
      feeRefundMinor = this.ledger.computeRefundFee(
        { amountMinor: charge.amountMinor, feeMinor: charge.feeMinor },
        refundMinor,
        { refundedMinor: charge.refundedMinor, feeRefundedMinor: feeRefundedSoFar },
      );
    }
    const netRefundMinor = refundMinor - feeRefundMinor;

    // Claim the idempotency key before touching the charge: the insert is what
    // serialises identical retries, and it gives us the refund id that every
    // provider idempotency key and ledger row is derived from. A re-drive reuses
    // the existing row (and therefore the same provider idempotency key) — only
    // its status is reset, after the charge claim succeeds.
    let refund: AppRefund;
    if (retryOf) {
      refund = retryOf;
    } else {
      const inserted = await this.insertRefund({
        chargeId: charge.id,
        appClientId: charge.appClientId,
        amountMinor: refundMinor,
        feeRefundMinor,
        netRefundMinor,
        currency: charge.currency,
        provider: charge.method,
        providerRef: null,
        status: 'pending',
        idempotencyKey,
        requestHash,
        reason: dto.reason ?? null,
        createdBy: charge.appClientId,
      });

      if (!inserted) {
        const winner = await this.findRefundByKey(charge.appClientId, idempotencyKey);
        if (winner) return this.replayRefund(client, charge, winner, requestHash);
        throw new ConflictException(
          'A concurrent request is using this idempotency key. Retry with the same X-Idempotency-Key.',
        );
      }
      refund = inserted;
    }

    // Serialise refunds on the same charge. The loser moves no money at all.
    const claimed = await this.claimChargeForRefund(charge);
    if (!claimed) {
      await this.failRefund(refund.id, 'Another refund took the charge first.');
      throw new ConflictException(
        'Another refund is already in progress for this charge. Retry once it completes.',
      );
    }

    if (retryOf) {
      refund = await this.reopenRefund(retryOf);
    }

    let providerRef: string | null = null;
    try {
      if (charge.method === AppChargeMethod.stripe) {
        providerRef = await this.refundStripe(charge, refund, refundMinor);
      } else if (charge.method === AppChargeMethod.paypal) {
        providerRef = await this.refundPaypal(charge, refund, refundMinor);
      } else if (charge.method === AppChargeMethod.wallet) {
        await this.refundWallet(charge, refund, refundMinor);
      } else {
        throw new InternalServerErrorException(`Unsupported refund method: ${charge.method}`);
      }
    } catch (err) {
      await this.rollbackRefund(charge, refund, err);
      throw this.asRefundError(err);
    }

    try {
      return await this.settleRefund(charge, refund, providerRef, refundMinor, feeRefundMinor, netRefundMinor);
    } catch (err) {
      // The provider already moved the money. A hard failure here would invite a
      // duplicate retry, so park the refund as pending, queue the outbox row and
      // flag the charge for reconciliation instead.
      await this.parkRefundForReconciliation(charge, refund, providerRef, refundMinor, err);
      const current = await this.prisma.appCharge.findUnique({ where: { id: charge.id } }).catch(() => null);
      return {
        charge: current
          ? this.toChargeDto(current)
          : { ...this.toChargeDto(charge), status: AppChargeStatus.refunding, reconciliationNeeded: true },
        refund: this.toRefundDto({ ...refund, providerRef }),
      };
    }
  }

  private async settleRefund(
    charge: AppCharge,
    refund: AppRefund,
    providerRef: string | null,
    refundMinor: bigint,
    feeRefundMinor: bigint,
    netRefundMinor: bigint,
  ): Promise<RefundChargeResult> {
    const clearingAccount =
      charge.method === AppChargeMethod.wallet ? LedgerAccount.wallet_clearing : LedgerAccount.gateway_clearing;
    const totalRefunded = charge.refundedMinor + refundMinor;
    const isFinal = totalRefunded >= charge.amountMinor;

    const result = await this.prisma.$transaction(async (tx) => {
      // We hold the `refunding` claim, so this guard is about the snapshot moving
      // underneath us (admin tooling), not about other refunds.
      const applied = await tx.appCharge.updateMany({
        where: {
          id: charge.id,
          status: AppChargeStatus.refunding,
          refundedMinor: charge.refundedMinor,
        },
        data: {
          refundedMinor: { increment: refundMinor },
          status: isFinal ? AppChargeStatus.refunded : AppChargeStatus.partially_refunded,
          reconciliationNeeded: false,
          metadata: {
            ...((charge.metadata as Record<string, unknown>) ?? {}),
            lastRefund: {
              refundId: refund.id,
              amountMinor: refundMinor.toString(),
              reason: refund.reason ?? null,
              at: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });

      if (applied.count !== 1) {
        throw new InternalServerErrorException(
          `Charge ${charge.id} left the refunding state during refund ${refund.id}.`,
        );
      }

      await this.ledger.postRefundLedger(tx, {
        chargeId: charge.id,
        refundId: refund.id,
        appClientId: charge.appClientId,
        refundMinor,
        feeRefundMinor,
        netRefundMinor,
        currency: charge.currency,
        clearingAccount,
        mcomUserId: charge.mcomUserId,
        provider: charge.provider,
        providerRef: providerRef ?? charge.providerRef,
        reference: charge.reference,
        metadata: {
          refundId: refund.id,
          reason: refund.reason ?? null,
          partial: !isFinal,
        } as Prisma.InputJsonValue,
      });

      const updatedRefund = await tx.appRefund.update({
        where: { id: refund.id },
        data: { status: 'succeeded', providerRef, failureReason: null },
      });

      const updatedCharge = await tx.appCharge.findUniqueOrThrow({ where: { id: charge.id } });

      await tx.auditLog.create({
        data: {
          action: 'APP_PAYMENT_REFUNDED',
          adminName: `app:${charge.appClientId}`,
          targetType: 'AppCharge',
          targetName: charge.id,
          details: JSON.stringify({
            refundId: refund.id,
            amountMinor: refundMinor.toString(),
            feeRefundMinor: feeRefundMinor.toString(),
            netRefundMinor: netRefundMinor.toString(),
            provider: charge.provider,
            providerRef,
            status: updatedCharge.status,
            reason: refund.reason ?? null,
          }),
          category: 'Payments',
        },
      });

      return { charge: updatedCharge, refund: updatedRefund };
    });

    this.dispatchWebhook(result.charge, 'payment.refunded', {
      // `amountMinor` stays the refunded amount, as partners already receive it.
      amountMinor: refundMinor.toString(),
      chargeAmountMinor: result.charge.amountMinor.toString(),
      refundId: result.refund.id,
      refundAmountMinor: refundMinor.toString(),
      totalRefundedMinor: result.charge.refundedMinor.toString(),
    });

    return { charge: this.toChargeDto(result.charge), refund: this.toRefundDto(result.refund) };
  }

  /**
   * Atomically take the charge from refundable to `refunding`.
   *
   * The `refundedMinor` predicate is what makes partial refunds safe: a stale
   * snapshot (another refund landed between our read and this write) fails the
   * check instead of over-refunding the charge.
   */
  private async claimChargeForRefund(charge: AppCharge): Promise<boolean> {
    const claimed = await this.prisma.appCharge.updateMany({
      where: {
        id: charge.id,
        status: { in: [AppChargeStatus.paid, AppChargeStatus.partially_refunded] },
        refundedMinor: charge.refundedMinor,
      },
      data: { status: AppChargeStatus.refunding },
    });
    return claimed.count === 1;
  }

  /** Provider rejected the refund: release the charge claim, keep the key burned. */
  private async rollbackRefund(charge: AppCharge, refund: AppRefund, err: unknown): Promise<void> {
    const restoreTo =
      charge.refundedMinor > 0n ? AppChargeStatus.partially_refunded : AppChargeStatus.paid;
    const message = this.errMessage(err).slice(0, 500);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.appRefund.update({
          where: { id: refund.id },
          data: { status: 'failed', failureReason: message },
        });
        await tx.appCharge.updateMany({
          where: { id: charge.id, status: AppChargeStatus.refunding },
          data: { status: restoreTo },
        });
      });
    } catch (rollbackErr: any) {
      this.logger.error(
        `Could not roll refund ${refund.id} back on charge ${charge.id}: ${rollbackErr?.message}. Flagging for reconciliation.`,
      );
      await this.flagForReconciliation(charge.id, `Refund ${refund.id} rollback failed: ${message}`);
    }
  }

  /**
   * The provider succeeded but the local settlement did not. Money has moved, so
   * the refund stays `pending` (not `failed`), the charge stays `refunding` (so no
   * further refund can be attempted), and an outbox row records what to replay.
   */
  private async parkRefundForReconciliation(
    charge: AppCharge,
    refund: AppRefund,
    providerRef: string | null,
    refundMinor: bigint,
    cause: unknown,
  ): Promise<void> {
    const message = this.errMessage(cause).slice(0, 500);
    this.logger.error(
      `Refund ${refund.id} on charge ${charge.id} reached the provider but local settlement failed: ${message}. Parked for reconciliation.`,
    );

    await this.prisma.appRefund
      .update({ where: { id: refund.id }, data: { providerRef, failureReason: message } })
      .catch((err: any) =>
        this.logger.error(`Could not persist provider ref ${providerRef} on refund ${refund.id}: ${err?.message}`),
      );

    await this.prisma.appPaymentOutbox
      .create({
        data: {
          kind: 'refund_provider',
          appClientId: charge.appClientId,
          chargeId: charge.id,
          refundId: refund.id,
          event: 'payment.refunded',
          dedupeKey: `refund_provider:${refund.id}`,
          payload: {
            chargeId: charge.id,
            refundId: refund.id,
            amountMinor: refundMinor.toString(),
            providerRef,
            error: message,
          } as Prisma.InputJsonValue,
        },
      })
      .catch((err: any) =>
        this.logger.error(`Could not write outbox row for refund ${refund.id}: ${err?.message}`),
      );

    await this.flagForReconciliation(
      charge.id,
      `Refund ${refund.id} settlement failed after provider success: ${message}`,
    );
  }

  /**
   * Idempotent refund replay.
   *
   * - Same key, different charge or amount → 409, never a silent second refund.
   * - `succeeded` / `pending` → return the recorded state.
   * - `failed` → re-drive the same row. The provider idempotency key is derived
   *   from the refund id, so even a failure that actually reached Stripe/PayPal
   *   cannot charge the customer back twice.
   */
  private async replayRefund(
    client: SsoClient,
    charge: AppCharge,
    refund: AppRefund,
    requestHash: string,
  ): Promise<RefundChargeResult> {
    if (refund.appClientId !== client.clientId || refund.chargeId !== charge.id) {
      throw new ConflictException(
        'This X-Idempotency-Key was already used for a different refund (or a different charge).',
      );
    }
    if (requestHash && refund.requestHash && requestHash !== refund.requestHash) {
      throw new ConflictException(
        'This X-Idempotency-Key was already used with a different refund payload (amount).',
      );
    }
    if (refund.status === 'failed') {
      this.logger.warn(`Re-driving failed refund ${refund.id} for charge ${charge.id}.`);
      return this.executeRefund(client, charge, {}, refund.idempotencyKey, requestHash, refund);
    }
    return { charge: this.toChargeDto(charge), refund: this.toRefundDto(refund) };
  }

  private async refundStripe(charge: AppCharge, refund: AppRefund, refundMinor: bigint): Promise<string> {
    if (!this.stripe || !charge.providerRef) {
      throw new InternalServerErrorException('Stripe refund is unavailable for this charge.');
    }
    try {
      const created = await this.stripe.refunds.create(
        {
          payment_intent: charge.providerRef,
          amount: Number(refundMinor),
          metadata: { chargeId: charge.id, refundId: refund.id, appClientId: charge.appClientId },
        },
        // Per-refund, not per-charge: partial refunds each need their own key.
        { idempotencyKey: `apprefund:${refund.id}` },
      );
      return created.id;
    } catch (err: any) {
      throw new BadGatewayException(err?.raw?.message || err?.message || 'Stripe refund failed.');
    }
  }

  private async refundPaypal(charge: AppCharge, refund: AppRefund, refundMinor: bigint): Promise<string | null> {
    const captureId = (charge.metadata as any)?.paypalCaptureId;
    if (!captureId) {
      throw new InternalServerErrorException('PayPal capture id is missing — cannot refund automatically.');
    }
    const token = await this.getPayPalAccessToken();
    const value = new Decimal(refundMinor.toString()).dividedBy(100).toFixed(2);
    try {
      const { data } = await axios.post(
        `${this.paypalBaseUrl}/v2/payments/captures/${captureId}/refund`,
        { amount: { value, currency_code: charge.currency } },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': refund.id,
          },
        },
      );
      return data?.id ?? null;
    } catch (err: any) {
      throw new BadGatewayException(this.paypalError(err));
    }
  }

  private async refundWallet(charge: AppCharge, refund: AppRefund, refundMinor: bigint): Promise<void> {
    if (!charge.mcomUserId) {
      throw new BadRequestException('Cannot refund a wallet charge without a payer.');
    }
    const credits = await this.resolveWalletRefundCredits(charge, refundMinor);
    const partner = await this.walletService.resolvePartner(charge.appClientId);
    await this.walletService.creditWallet(
      partner,
      {
        userId: charge.mcomUserId,
        amount: credits.toNumber(),
        category: 'REFUND' as any,
        description: `Refund — MCOM Pay ${charge.reference ?? charge.id}`,
        reference: charge.reference ?? charge.id,
        metadata: { chargeId: charge.id, refundId: refund.id, appClientId: charge.appClientId },
      },
      `apprefund:${refund.id}`,
    );
  }

  /**
   * Credits to return for a wallet refund.
   *
   * The payer was debited `walletDebitAmount` credits for the full charge, so a
   * refund prorates that recorded amount — never a live FX rate, which would make
   * the refund drift from what was actually taken. The refund is gross (the fee
   * comes back too), mirroring the ledger.
   */
  private async resolveWalletRefundCredits(charge: AppCharge, refundMinor: bigint): Promise<Decimal> {
    if (charge.walletDebitAmount) {
      if (refundMinor >= charge.amountMinor) {
        return new Decimal(charge.walletDebitAmount.toString());
      }
      return new Decimal(charge.walletDebitAmount.toString())
        .times(refundMinor.toString())
        .dividedBy(charge.amountMinor.toString())
        .toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
    }
    this.logger.warn(
      `Charge ${charge.id} has no recorded wallet debit — falling back to live FX for the refund. The credited amount may differ from what was debited.`,
    );
    return this.resolveWalletCredits(refundMinor, charge.currency);
  }

  private findRefundByKey(appClientId: string, idempotencyKey: string): Promise<AppRefund | null> {
    return this.prisma.appRefund.findUnique({
      where: { appClientId_idempotencyKey: { appClientId, idempotencyKey } },
    });
  }

  private async insertRefund(data: Prisma.AppRefundUncheckedCreateInput): Promise<AppRefund | null> {
    try {
      return await this.prisma.appRefund.create({ data });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return null;
      }
      throw err;
    }
  }

  /** Reset a failed refund to pending so the same row can be re-driven. */
  private async reopenRefund(refund: AppRefund): Promise<AppRefund> {
    return this.prisma.appRefund.update({
      where: { id: refund.id },
      data: { status: 'pending', failureReason: null },
    });
  }

  private async failRefund(refundId: string, reason: string): Promise<void> {
    await this.prisma.appRefund
      .update({ where: { id: refundId }, data: { status: 'failed', failureReason: reason.slice(0, 500) } })
      .catch((err: any) => this.logger.error(`Could not mark refund ${refundId} failed: ${err?.message}`));
  }

  private async sumFeeRefunded(chargeId: string): Promise<bigint> {
    const agg = await this.prisma.appRefund.aggregate({
      where: { chargeId, status: 'succeeded' },
      _sum: { feeRefundMinor: true },
    });
    return agg._sum.feeRefundMinor ?? 0n;
  }

  /** Fingerprint of the economic intent behind a refund idempotency key. */
  private hashRefundRequest(chargeId: string, dto: RefundChargeDto): string {
    return crypto
      .createHash('sha256')
      .update([chargeId, dto.amountMinor ?? 'remaining'].join('|'))
      .digest('hex');
  }

  private asRefundError(err: unknown): HttpException {
    if (err instanceof HttpException) return err;
    return new BadGatewayException(this.errMessage(err) || 'Refund failed at the payment provider.');
  }

  toRefundDto(refund: AppRefund): AppRefundDto {
    return {
      id: refund.id,
      chargeId: refund.chargeId,
      amountMinor: refund.amountMinor.toString(),
      feeRefundMinor: refund.feeRefundMinor.toString(),
      netRefundMinor: refund.netRefundMinor.toString(),
      currency: refund.currency,
      provider: refund.provider,
      providerRef: refund.providerRef,
      status: refund.status,
      reason: refund.reason,
      failureReason: refund.failureReason,
      createdAt: refund.createdAt.toISOString(),
    };
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

  /** Every refund attempt on a charge, newest first — pending rows need ops eyes. */
  async listRefunds(client: SsoClient, chargeId: string) {
    await this.getOwnedCharge(client, chargeId);
    return this.listRefundsForCharge(chargeId);
  }

  async listRefundsForCharge(chargeId: string) {
    const rows = await this.prisma.appRefund.findMany({
      where: { chargeId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true as const, data: rows.map((r) => this.toRefundDto(r)) };
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

  /**
   * Settle a charge exactly once.
   *
   * The transition is a compare-and-set on `status = pending`: whichever caller
   * wins the race posts the ledger AND emits `payment.succeeded`; every other
   * caller (partner /confirm, Stripe webhook, PayPal webhook) becomes a replay
   * and emits nothing. Without this, a confirm arriving alongside a provider
   * webhook delivered the partner the same success event twice.
   */
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

    const result = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.appCharge.updateMany({
        where: { id: charge.id, status: AppChargeStatus.pending },
        data: {
          status: AppChargeStatus.paid,
          paidAt: new Date(),
          provider: opts.provider,
          ...(opts.providerRef ? { providerRef: opts.providerRef } : {}),
          ...(opts.walletDebitAmount ? { walletDebitAmount: opts.walletDebitAmount } : {}),
          reconciliationNeeded: false,
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

      if (claimed.count === 0) {
        const current = await tx.appCharge.findUnique({ where: { id: charge.id } });
        return { charge: current ?? charge, transitioned: false };
      }

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

      const updated = await tx.appCharge.findUniqueOrThrow({ where: { id: charge.id } });
      return { charge: updated, transitioned: true };
    });

    if (!result.transitioned) {
      this.logger.warn(
        `Settlement replay for charge ${charge.id}: already ${result.charge.status}. No ledger rows or webhook emitted.`,
      );
      return result.charge;
    }

    this.dispatchWebhook(result.charge, 'payment.succeeded', {});
    return result.charge;
  }

  /** Mark a pending charge failed without clobbering a concurrent settlement. */
  private async markFailed(charge: AppCharge, err: unknown): Promise<void> {
    const message = this.errMessage(err);
    try {
      await this.prisma.appCharge.updateMany({
        where: { id: charge.id, status: AppChargeStatus.pending },
        data: { status: AppChargeStatus.failed, failureReason: message },
      });
    } catch (updateErr: any) {
      this.logger.error(
        `Could not mark charge ${charge.id} failed (${message}): ${updateErr?.message}. Flagging for reconciliation.`,
      );
      await this.flagForReconciliation(charge.id, message);
    }
  }

  /** A provider object exists but we could not persist its handle — never lose it. */
  private async flagForReconciliation(chargeId: string, reason: string): Promise<void> {
    await this.prisma.appCharge
      .update({
        where: { id: chargeId },
        data: { reconciliationNeeded: true, failureReason: reason.slice(0, 500) },
      })
      .catch((err: any) =>
        this.logger.error(`Failed to flag charge ${chargeId} for reconciliation: ${err?.message}`),
      );
  }

  private async cancelStripeIntent(intentId: string, chargeId: string, cause: unknown): Promise<void> {
    try {
      await this.stripe!.paymentIntents.cancel(intentId);
      this.logger.warn(
        `Cancelled orphaned Stripe intent ${intentId} for charge ${chargeId} after persistence failure.`,
      );
    } catch (cancelErr: any) {
      this.logger.error(
        `Stripe intent ${intentId} for charge ${chargeId} could not be cancelled: ${cancelErr?.message}. Flagging for reconciliation.`,
      );
      await this.flagForReconciliation(chargeId, `Orphaned Stripe intent ${intentId}: ${this.errMessage(cause)}`);
    }
  }

  private async cancelPayPalOrder(orderId: string, chargeId: string, cause: unknown): Promise<void> {
    try {
      const token = await this.getPayPalAccessToken();
      await axios.post(
        `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      this.logger.warn(
        `Cancelled orphaned PayPal order ${orderId} for charge ${chargeId} after persistence failure.`,
      );
    } catch (cancelErr: any) {
      this.logger.error(
        `PayPal order ${orderId} for charge ${chargeId} could not be cancelled: ${cancelErr?.message}. Flagging for reconciliation.`,
      );
      await this.flagForReconciliation(chargeId, `Orphaned PayPal order ${orderId}: ${this.errMessage(cause)}`);
    }
  }

  /**
   * Queue the partner notification durably, then deliver it best-effort.
   *
   * The outbox row is written *before* the HTTP call, so a crash between the
   * money change and the partner being told cannot lose the event — the
   * reconciler picks up anything still PENDING and retries with backoff.
   */
  private dispatchWebhook(charge: AppCharge, event: string, extra: Record<string, unknown>) {
    const payload = {
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
    };

    // A charge can be refunded several times, so the refund id (when present) is
    // part of the key — otherwise the second `payment.refunded` would be dropped
    // as a duplicate of the first.
    const scope = typeof extra.refundId === 'string' ? extra.refundId : 'primary';
    const dedupeKey = `partner_webhook:${charge.id}:${event}:${scope}`;

    void this.enqueueAndDeliverWebhook(charge, event, payload, dedupeKey);
  }

  private async enqueueAndDeliverWebhook(
    charge: AppCharge,
    event: string,
    payload: Record<string, unknown>,
    dedupeKey: string,
  ): Promise<void> {
    let queued = false;
    try {
      const row = await this.prisma.appPaymentOutbox.upsert({
        where: { dedupeKey },
        create: {
          kind: 'partner_webhook',
          appClientId: charge.appClientId,
          chargeId: charge.id,
          event,
          dedupeKey,
          payload: payload as Prisma.InputJsonValue,
        },
        // Re-queuing the same logical event must not create a second row.
        update: {},
      });
      queued = true;
      if (row?.status === 'DONE') {
        // Already delivered (a refund settlement replay reaches this point again).
        // Re-sending would duplicate the partner's notification for no reason.
        return;
      }
    } catch (err: any) {
      this.logger.error(
        `Could not queue ${event} for charge ${charge.id} in the outbox: ${err?.message}. Delivering directly.`,
      );
    }

    try {
      const result = await this.webhookDispatcher.dispatch(charge.appClientId, event, payload);
      const nothingToDeliver =
        result.reason === 'NO_WEBHOOK_URL_CONFIGURED' || result.reason === 'APP_NOT_FOUND';
      if ((result.dispatched || nothingToDeliver) && queued) {
        await this.prisma.appPaymentOutbox
          .updateMany({ where: { dedupeKey, status: 'PENDING' }, data: { status: 'DONE' } })
          .catch(() => undefined);
      }
    } catch (err: any) {
      // Left PENDING on purpose: the reconciler retries it.
      this.logger.warn(`Failed to deliver ${event} for charge ${charge.id}: ${err?.message}`);
    }
  }

  // ─── RECONCILIATION (driven by AppPaymentsReconciliationService) ────────────

  /**
   * Finish a refund whose provider leg succeeded but whose local settlement did
   * not. The provider already moved the money, so only `settleRefund` is re-run —
   * never the provider call.
   */
  async reconcileParkedRefund(refundId: string): Promise<void> {
    const refund = await this.prisma.appRefund.findUnique({ where: { id: refundId } });
    if (!refund || refund.status === 'succeeded') return;

    const charge = await this.prisma.appCharge.findUnique({ where: { id: refund.chargeId } });
    if (!charge) {
      throw new Error(`Charge ${refund.chargeId} no longer exists for refund ${refundId}.`);
    }

    await this.settleRefund(
      charge,
      refund,
      refund.providerRef,
      refund.amountMinor,
      refund.feeRefundMinor,
      refund.netRefundMinor,
    );

    await this.prisma.appCharge
      .updateMany({
        where: { id: charge.id, status: { not: AppChargeStatus.refunding } },
        data: { reconciliationNeeded: false },
      })
      .catch(() => undefined);
  }

  /**
   * Re-check a charge flagged `reconciliationNeeded` against the provider.
   *
   * This is the last line of defence for "provider says paid, our write failed":
   * without it the customer is charged and the app is never told.
   */
  async reconcileCharge(chargeId: string): Promise<void> {
    const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
    if (!charge || !charge.reconciliationNeeded) return;

    const provider = charge.provider ?? charge.method;
    if (provider === 'stripe') {
      if (!this.stripe || !charge.providerRef) {
        throw new Error(`Stripe is not usable to reconcile charge ${charge.id}.`);
      }
      const intent = await this.stripe.paymentIntents.retrieve(charge.providerRef);
      if (intent.status === 'succeeded') {
        await this.settleStripeIntent(charge.id, intent);
        return;
      }
      if (intent.status === 'canceled' && charge.status === AppChargeStatus.pending) {
        await this.markFailed(charge, new Error('Stripe reports the payment intent was cancelled.'));
        return;
      }
      throw new Error(`Stripe intent ${charge.providerRef} is ${intent.status} — nothing to settle yet.`);
    }

    if (provider === 'paypal') {
      if (!charge.providerRef) {
        throw new Error(`PayPal order reference is missing on charge ${charge.id}.`);
      }
      const token = await this.getPayPalAccessToken();
      const { data } = await axios.get(
        `${this.paypalBaseUrl}/v2/checkout/orders/${charge.providerRef}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data?.status === 'COMPLETED') {
        const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
        const capturedMinor = capture?.amount?.value
          ? BigInt(new Decimal(capture.amount.value).times(100).toFixed(0))
          : charge.amountMinor;
        if (capturedMinor !== charge.amountMinor) {
          throw new Error(
            `PayPal captured ${capturedMinor.toString()} but charge ${charge.id} is ${charge.amountMinor.toString()}.`,
          );
        }
        await this.markPaid(charge, {
          provider: 'paypal',
          providerRef: charge.providerRef,
          metadataPatch: { paypalCaptureId: capture?.id ?? null },
        });
        return;
      }
      throw new Error(`PayPal order ${charge.providerRef} is ${data?.status ?? 'unknown'} — nothing to settle yet.`);
    }

    // Wallet charges settle locally; a flag here needs a human (money left the
    // wallet but the charge row did not move).
    throw new Error(`Charge ${charge.id} (${provider}) needs manual reconciliation.`);
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

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const chargeId = intent.metadata?.chargeId;
        if (chargeId) {
          await this.withWebhookDedupe('stripe', event.id, event.type, chargeId, () =>
            this.settleStripeIntent(chargeId, intent),
          );
        }
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const chargeId = intent.metadata?.chargeId;
        if (chargeId) {
          await this.withWebhookDedupe('stripe', event.id, event.type, chargeId, async () => {
            const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
            // Only a pending charge may fail: a settlement that already won must
            // never be overwritten by a late failure notification.
            if (!charge || charge.status !== AppChargeStatus.pending) return;
            const reason = intent.last_payment_error?.message ?? `Stripe reported ${intent.status}.`;
            await this.markFailed(charge, new Error(reason));
          });
        }
        break;
      }
      case 'charge.refunded': {
        const stripeCharge = event.data.object as Stripe.Charge;
        await this.withWebhookDedupe('stripe', event.id, event.type, null, () =>
          this.reconcileExternalStripeRefund(stripeCharge),
        );
        break;
      }
      default:
        // Unhandled types are acknowledged but never recorded, so if we add a
        // handler later the provider's retry of an old event still processes.
        break;
    }
    return { received: true };
  }

  /**
   * Run `handler` at most once per provider event.
   *
   * The claim is the insert into `processed_webhook_events`: the unique index on
   * (provider, eventId) is what serialises two concurrent deliveries of the same
   * event. A failure releases the claim, so a provider retry is processed again —
   * safe because every handler below is idempotent (compare-and-set on charge
   * status plus keyed ledger rows).
   */
  private async withWebhookDedupe(
    provider: 'stripe' | 'paypal',
    eventId: string | null | undefined,
    eventType: string,
    chargeId: string | null | undefined,
    handler: () => Promise<void>,
  ): Promise<void> {
    if (!eventId) {
      this.logger.warn(`${provider} webhook ${eventType} has no event id — processing without dedupe.`);
      await handler();
      return;
    }

    const claimed = await this.claimWebhookEvent({ provider, eventId, eventType, chargeId });
    if (!claimed) {
      this.logger.log(`Duplicate ${provider} webhook ${eventId} (${eventType}) — already processed.`);
      return;
    }

    try {
      await handler();
    } catch (err) {
      await this.releaseWebhookEvent(provider, eventId);
      throw err;
    }
  }

  /** @returns true when this caller owns the event and must process it. */
  private async claimWebhookEvent(input: {
    provider: string;
    eventId: string;
    eventType: string;
    chargeId?: string | null;
  }): Promise<boolean> {
    try {
      await this.prisma.processedWebhookEvent.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          chargeId: input.chargeId ?? null,
        },
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Give the claim back after a processing failure so the provider's retry is not
   * swallowed. Worst case the delete itself fails and we log loudly: silently
   * dropping a money event is the one outcome we refuse to accept.
   */
  private async releaseWebhookEvent(provider: string, eventId: string): Promise<void> {
    await this.prisma.processedWebhookEvent
      .delete({ where: { provider_eventId: { provider, eventId } } })
      .catch((err: any) =>
        this.logger.error(
          `Could not release ${provider} webhook claim ${eventId} after a processing failure (${err?.message}). ` +
            'A redelivery of this event will be acknowledged without being processed.',
        ),
      );
  }

  /**
   * A refund created outside MCOM Pay (Stripe dashboard, another service).
   *
   * The money has already left the gateway, so without a local `AppRefund` row
   * the app payable stays overstated and the ledger stops balancing against the
   * gateway. `amount_refunded` is the charge's *cumulative* total, so record only
   * the delta we have not seen yet.
   */
  private async reconcileExternalStripeRefund(stripeCharge: Stripe.Charge): Promise<void> {
    const intentId =
      typeof stripeCharge.payment_intent === 'string'
        ? stripeCharge.payment_intent
        : stripeCharge.payment_intent?.id;
    if (!intentId) {
      this.logger.warn('charge.refunded webhook carries no payment_intent — cannot match a charge.');
      return;
    }

    const charge = await this.prisma.appCharge.findUnique({ where: { providerRef: intentId } });
    if (!charge) {
      this.logger.error(
        `External Stripe refund for unknown payment intent ${intentId} — no local charge to update.`,
      );
      return;
    }

    // Stripe only expands `refunds` when asked; fall back to a stable synthetic
    // key derived from the cumulative amount so a redelivery still dedupes.
    const providerRef =
      stripeCharge.refunds?.data?.[0]?.id ??
      `pi:${intentId}:${BigInt(stripeCharge.amount_refunded ?? 0).toString()}`;

    await this.recordExternalRefund({
      provider: 'stripe',
      charge,
      refundMinor: BigInt(stripeCharge.amount_refunded ?? 0) - charge.refundedMinor,
      providerRef,
      idempotencyKey: `stripe:${providerRef}`,
    });
  }

  /**
   * PayPal reports one event per refund (not a cumulative total), so the amount
   * on the resource is exactly what to record. The refund id is the dedupe key.
   */
  private async reconcileExternalPaypalRefund(resource: any): Promise<void> {
    const captureId: string | undefined =
      resource?.supplementary_data?.related_ids?.capture_id ?? resource?.capture_id;
    const chargeId: string | undefined = resource?.custom_id;

    let charge: AppCharge | null = null;
    if (chargeId) {
      charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
    }
    if (!charge && captureId) {
      // Older captures only carry the PayPal capture id, which settlement stores
      // in metadata when the webhook (not confirm) is the first we hear of it.
      const candidates = await this.prisma.appCharge
        .findMany({
          where: { metadata: { path: ['paypalCaptureId'], equals: captureId } },
          take: 1,
        })
        .catch(() => [] as AppCharge[]);
      charge = candidates[0] ?? null;
    }
    if (!charge) {
      this.logger.warn(
        `External PayPal refund ${resource?.id ?? '(unknown)'} could not be matched to a charge.`,
      );
      return;
    }

    const value = resource?.amount?.value;
    const refundMinor = value ? BigInt(new Decimal(value).times(100).toFixed(0)) : 0n;
    if (refundMinor <= 0n) {
      this.logger.warn(`External PayPal refund ${resource?.id ?? '(unknown)'} has no amount — ignoring.`);
      return;
    }

    const providerRef = resource?.id ?? `paypal:${captureId ?? charge.id}`;
    await this.recordExternalRefund({
      provider: 'paypal',
      charge,
      refundMinor,
      providerRef,
      idempotencyKey: `paypal:${providerRef}`,
    });
  }

  /**
   * Record and settle a refund that already happened at the provider.
   *
   * Same claim order as `executeRefund` — refund row first (it is the idempotency
   * record), then compare-and-set on the charge — but no provider call: the money
   * is gone already, so the only job is to make the books match.
   */
  private async recordExternalRefund(input: {
    provider: string;
    charge: AppCharge;
    refundMinor: bigint;
    providerRef: string;
    idempotencyKey: string;
  }): Promise<void> {
    const { provider, charge, providerRef, idempotencyKey } = input;
    const remaining = charge.amountMinor - charge.refundedMinor;

    if (remaining <= 0n) {
      this.logger.log(`External ${provider} refund ${providerRef}: charge ${charge.id} is already fully refunded.`);
      return;
    }

    const refundMinor = input.refundMinor > remaining ? remaining : input.refundMinor;
    if (refundMinor <= 0n) return;
    if (input.refundMinor > remaining) {
      this.logger.error(
        `External ${provider} refund ${providerRef} exceeds the refundable balance of charge ${charge.id} ` +
          `(${input.refundMinor.toString()} > ${remaining.toString()}). Recording the remaining balance only.`,
      );
    }

    if (
      charge.status !== AppChargeStatus.paid &&
      charge.status !== AppChargeStatus.partially_refunded
    ) {
      // A local refund holds the `refunding` claim, or the charge is final. Do not
      // fight it — flag for a human/reconciler to reconcile against the provider.
      this.logger.error(
        `External ${provider} refund ${providerRef} arrived while charge ${charge.id} was ${charge.status}.`,
      );
      await this.flagForReconciliation(
        charge.id,
        `External ${provider} refund ${providerRef} arrived while the charge was ${charge.status}`,
      );
      return;
    }

    const feeRefundedSoFar = await this.sumFeeRefunded(charge.id);
    const feeRefundMinor = this.ledger.computeRefundFee(
      { amountMinor: charge.amountMinor, feeMinor: charge.feeMinor },
      refundMinor,
      { refundedMinor: charge.refundedMinor, feeRefundedMinor: feeRefundedSoFar },
    );
    const netRefundMinor = refundMinor - feeRefundMinor;

    const refund = await this.insertRefund({
      chargeId: charge.id,
      appClientId: charge.appClientId,
      amountMinor: refundMinor,
      feeRefundMinor,
      netRefundMinor,
      currency: charge.currency,
      provider: charge.method,
      providerRef,
      status: 'pending',
      idempotencyKey,
      requestHash: null,
      reason: `External ${provider} refund`,
      createdBy: `provider:${provider}`,
    });

    if (!refund) {
      const existing = await this.findRefundByKey(charge.appClientId, idempotencyKey);
      if (existing && existing.chargeId !== charge.id) {
        this.logger.error(
          `External ${provider} refund ${providerRef} is keyed to charge ${existing.chargeId}, not ${charge.id}.`,
        );
        await this.flagForReconciliation(
          charge.id,
          `External ${provider} refund ${providerRef} already recorded against charge ${existing.chargeId}`,
        );
      } else {
        this.logger.log(`External ${provider} refund ${providerRef} already recorded for charge ${charge.id}.`);
      }
      return;
    }

    const claimed = await this.claimChargeForRefund(charge);
    if (!claimed) {
      await this.failRefund(
        refund.id,
        'Charge left the refundable state before the external refund could be recorded.',
      );
      await this.flagForReconciliation(
        charge.id,
        `External ${provider} refund ${providerRef} could not claim the charge`,
      );
      return;
    }

    try {
      await this.settleRefund(charge, refund, providerRef, refundMinor, feeRefundMinor, netRefundMinor);
    } catch (err) {
      // The refund already happened at the provider; parking keeps the row
      // pending (not failed) and queues the outbox replay.
      await this.parkRefundForReconciliation(charge, refund, providerRef, refundMinor, err);
    }
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

    switch (event?.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const chargeId = event.resource?.custom_id;
        if (chargeId) {
          await this.withWebhookDedupe('paypal', event.id, event.event_type, chargeId, async () => {
            const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
            // `markPaid` is itself a compare-and-set, so a settlement that already
            // won is returned untouched.
            if (charge && charge.status === AppChargeStatus.pending) {
              await this.markPaid(charge, {
                provider: 'paypal',
                providerRef: charge.providerRef,
                metadataPatch: { paypalCaptureId: event.resource?.id ?? null },
              });
            }
          });
        }
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED': {
        const chargeId = event.resource?.custom_id;
        if (chargeId) {
          await this.withWebhookDedupe('paypal', event.id, event.event_type, chargeId, async () => {
            const charge = await this.prisma.appCharge.findUnique({ where: { id: chargeId } });
            if (!charge || charge.status !== AppChargeStatus.pending) return;
            const reason =
              event.resource?.status_details?.reason ?? 'PayPal reported the capture as denied.';
            await this.markFailed(charge, new Error(reason));
          });
        }
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        await this.withWebhookDedupe('paypal', event.id, event.event_type, event.resource?.custom_id ?? null, () =>
          this.reconcileExternalPaypalRefund(event.resource),
        );
        break;
      }
      default:
        break;
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
      refundedMinor: charge.refundedMinor.toString(),
      method: charge.method,
      status: charge.status,
      reference: charge.reference,
      description: charge.description,
      mcomUserId: charge.mcomUserId,
      externalCustomerId: charge.externalCustomerId,
      provider: charge.provider,
      providerRef: charge.providerRef,
      walletDebitAmount: charge.walletDebitAmount ? charge.walletDebitAmount.toFixed(4) : null,
      reconciliationNeeded: charge.reconciliationNeeded,
      paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
      createdAt: charge.createdAt.toISOString(),
    };
  }
}
