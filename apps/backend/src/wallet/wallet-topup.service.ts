import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletTopUpRequest } from '@prisma/client';
import axios from 'axios';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { RedisService } from '../redis/redis.service';
import { TopUpInitiateDto, ConfirmTopUpDto } from './dto/wallet-operations.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type TopUpProvider = 'stripe' | 'paypal';

@Injectable()
export class WalletTopUpService {
  private readonly logger = new Logger(WalletTopUpService.name);
  private stripe?: Stripe;
  private readonly paypalBaseUrl: string;
  private paypalToken?: { value: string; expiresAt: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
    private readonly ledgerService: WalletLedgerService,
    private readonly lockUtil: WalletLockUtil,
    private readonly redis: RedisService,
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

  async initiateTopUp(userId: string, dto: TopUpInitiateDto) {
    const provider = ((dto.provider || 'stripe').toLowerCase()) as TopUpProvider;
    if (!['stripe', 'paypal'].includes(provider)) {
      throw new BadRequestException(
        `Unsupported top-up provider: ${provider}. Supported providers: stripe, paypal.`,
      );
    }
    if (provider === 'stripe' && !this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const wallet = await this.walletService.ensureWallet(userId);
    const exchangeRate = await this.getExchangeRate(dto.currency || 'GBP', wallet.currency);

    const topUp = await this.prisma.walletTopUpRequest.create({
      data: {
        walletId: wallet.id,
        userId,
        amount: dto.amount,
        currency: dto.currency || 'GBP',
        walletCurrency: wallet.currency,
        exchangeRate,
        provider,
        status: 'PENDING',
      },
    });

    if (provider === 'paypal') {
      try {
        return await this.initiatePaypalTopUp(topUp, dto);
      } catch (err) {
        await this.prisma.walletTopUpRequest
          .update({
            where: { id: topUp.id },
            data: { status: 'FAILED', providerStatus: this.errMessage(err) },
          })
          .catch(() => undefined);
        throw err;
      }
    }

    // Stripe PaymentIntent for the in-app Stripe Elements modal flow.
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(dto.amount * 100),
      currency: (dto.currency || 'GBP').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { topUpRequestId: topUp.id, userId },
      description: `MCOM Wallet Top-Up (${dto.currency || 'GBP'} ${dto.amount})`,
    });

    await this.prisma.walletTopUpRequest.update({
      where: { id: topUp.id },
      data: { providerRef: paymentIntent.id },
    });

    // Also create a Checkout Session as an alternative redirect fallback if returnUrl was explicitly supplied.
    let checkoutUrl: string | null = null;
    let sessionId: string | null = null;
    if (dto.returnUrl) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: (dto.currency || 'GBP').toLowerCase(),
                unit_amount: Math.round(dto.amount * 100),
                product_data: {
                  name: 'MCOM Wallet Top-Up',
                  description: `Credit ${dto.amount} ${dto.currency || 'GBP'} to your MCOM wallet`,
                },
              },
              quantity: 1,
            },
          ],
          metadata: { topUpRequestId: topUp.id, userId },
          success_url: dto.returnUrl,
          cancel_url: dto.cancelUrl || `${this.frontendUrl()}/dashboard/wallet?topup=cancelled`,
        });
        sessionId = session.id;
        checkoutUrl = session.url;
      } catch (err) {
        this.logger.warn(`Failed to create fallback Checkout session: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      provider: 'stripe',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      topUpRequestId: topUp.id,
      amount: dto.amount,
      currency: dto.currency || 'GBP',
      status: 'PENDING',
      sessionId,
      checkoutUrl,
    };
  }

  private async initiatePaypalTopUp(request: WalletTopUpRequest, dto: TopUpInitiateDto) {
    const token = await this.getPayPalAccessToken();
    const value = new Decimal(request.amount.toString()).toFixed(2);
    const { data } = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: request.currency.toUpperCase(), value },
            description: `MCOM Wallet Top-Up (${request.currency} ${value})`,
            custom_id: request.id,
          },
        ],
        application_context: {
          brand_name: 'MCOM',
          user_action: 'PAY_NOW',
          return_url: dto.returnUrl || `${this.frontendUrl()}/dashboard/wallet?topup=success`,
          cancel_url: dto.cancelUrl || `${this.frontendUrl()}/dashboard/wallet?topup=cancelled`,
        },
      },
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      },
    );

    const approvalUrl = (data?.links || []).find((l: any) => l.rel === 'approve')?.href ?? null;
    if (!data?.id || !approvalUrl) {
      throw new BadGatewayException('PayPal did not return an approval URL.');
    }

    await this.prisma.walletTopUpRequest.update({
      where: { id: request.id },
      data: { providerRef: data.id },
    });

    return {
      provider: 'paypal',
      topUpRequestId: request.id,
      orderId: data.id,
      approvalUrl,
      amount: request.amount.toNumber(),
      currency: request.currency,
      status: 'PENDING',
    };
  }

  /**
   * Provider dispatcher for the public confirm endpoint. Existing Stripe
   * clients keep sending `paymentIntentId`; PayPal clients send `orderId`.
   */
  async confirmTopUp(userId: string, dto: ConfirmTopUpDto) {
    const provider = (dto.provider || (dto.orderId ? 'paypal' : 'stripe')).toLowerCase();
    if (provider === 'paypal') {
      return this.confirmPaypalTopUp(userId, dto);
    }
    return this.confirmStripeTopUp(userId, dto);
  }

  async confirmStripeTopUp(userId: string, dto: ConfirmTopUpDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }
    if (!dto.paymentIntentId) {
      throw new BadRequestException('paymentIntentId is required for Stripe top-ups.');
    }

    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: dto.topUpRequestId },
    });
    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }
    if (request.userId !== userId) {
      throw new ForbiddenException('Top-up request does not belong to this user.');
    }
    if (request.provider !== 'stripe') {
      throw new BadRequestException('Top-up request is not a Stripe top-up.');
    }
    if (request.status === 'COMPLETED') {
      const wallet = await this.walletService.ensureWallet(request.userId);
      return { success: true, balance: wallet.balance.toNumber() };
    }
    if (!['PENDING', 'PROCESSING'].includes(request.status)) {
      throw new BadRequestException(`Top-up request is ${request.status} and cannot be confirmed.`);
    }

    const intent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
    }

    if (intent.metadata?.userId && intent.metadata.userId !== userId) {
      throw new BadRequestException('Payment intent does not belong to this user.');
    }

    if (intent.metadata?.topUpRequestId && intent.metadata.topUpRequestId !== dto.topUpRequestId) {
      throw new BadRequestException('Payment intent metadata does not match top-up request.');
    }

    const expectedMinor = new Decimal(request.amount).times(100).toNumber();
    if (
      intent.amount !== Math.round(expectedMinor) ||
      intent.currency?.toLowerCase() !== request.currency.toLowerCase()
    ) {
      throw new BadRequestException('Paid amount does not match the top-up request.');
    }

    return this.fulfillTopUp(dto.topUpRequestId, intent.id, intent.status, {
      paymentIntentId: intent.id,
    });
  }

  async confirmPaypalTopUp(userId: string, dto: ConfirmTopUpDto) {
    if (!dto.orderId) {
      throw new BadRequestException('orderId is required for PayPal top-ups.');
    }

    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: dto.topUpRequestId },
    });
    if (!request) {
      throw new NotFoundException('Top-up request not found');
    }
    if (request.userId !== userId) {
      throw new ForbiddenException('Top-up request does not belong to this user.');
    }
    if (request.provider !== 'paypal') {
      throw new BadRequestException('Top-up request is not a PayPal top-up.');
    }
    if (request.providerRef && request.providerRef !== dto.orderId) {
      throw new BadRequestException('PayPal order does not match this top-up request.');
    }
    if (!['PENDING', 'PROCESSING'].includes(request.status)) {
      if (request.status === 'COMPLETED') {
        const wallet = await this.walletService.ensureWallet(request.userId);
        return { success: true, balance: wallet.balance.toNumber() };
      }
      throw new BadRequestException(`Top-up request is ${request.status} and cannot be confirmed.`);
    }

    const order = await this.captureOrReadPaypalOrder(dto.orderId);
    const { captureId } = this.assertPaypalOrderMatches(request, order);

    return this.fulfillTopUp(
      request.id,
      dto.orderId,
      'CAPTURED',
      {
        provider: 'paypal',
        orderId: dto.orderId,
        captureId,
      },
      'paypal',
    );
  }

  /**
   * Resolves the FX rate for a base → wallet-currency pair. Prefers the DB
   * (FxRate table, admin-updatable); falls back to the MCOM_GBP_RATE env var
   * (default 1) so the conversion is never a silent hardcoded 1:1.
   */
  private async getExchangeRate(base: string, quote: string): Promise<number> {
    try {
      const rate = await this.prisma.fxRate.findUnique({
        where: { base_quote: { base: base.toUpperCase(), quote: quote.toUpperCase() } },
      });
      if (rate) return rate.rate.toNumber();
    } catch (err) {
      this.logger.warn(`FX rate lookup failed for ${base}→${quote}:`, err as any);
    }
    const envRate = this.config.get<string>('MCOM_GBP_RATE');
    const parsed = envRate ? parseFloat(envRate) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  async handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !webhookSecret) {
      this.logger.error('Stripe webhook received but Stripe is not configured');
      throw new InternalServerErrorException('Stripe is not configured — cannot process webhook');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
      throw new InternalServerErrorException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const topUpRequestId = session.metadata?.topUpRequestId;
        if (topUpRequestId) {
          await this.fulfillTopUp(topUpRequestId, session.id, session.payment_status || 'paid', {
            sessionId: session.id,
            paymentIntentId: session.payment_intent,
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const topUpRequestId = intent.metadata?.topUpRequestId;
        if (topUpRequestId) {
          await this.fulfillTopUp(topUpRequestId, intent.id, intent.status, {
            paymentIntentId: intent.id,
          });
        }
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * PayPal webhook fallback for close-tab-after-approval. The unique
   * `topup:<requestId>` ledger key keeps this idempotent with client confirm.
   */
  async handlePaypalWebhook(
    rawBody: string | Buffer,
    headers: Record<string, any>,
  ): Promise<{ received: boolean }> {
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
      const customId = event.resource?.custom_id as string | undefined;
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id as string | undefined;

      let request = customId
        ? await this.prisma.walletTopUpRequest.findUnique({ where: { id: customId } })
        : null;
      if (!request && orderId) {
        request = await this.prisma.walletTopUpRequest.findFirst({
          where: { provider: 'paypal', providerRef: orderId },
        });
      }

      if (request && request.provider === 'paypal' && request.status !== 'COMPLETED') {
        const resolvedOrderId = orderId || request.providerRef;
        if (resolvedOrderId) {
          const order = await this.readPaypalOrder(resolvedOrderId);
          const { captureId } = this.assertPaypalOrderMatches(request, order);
          await this.fulfillTopUp(
            request.id,
            resolvedOrderId,
            'CAPTURED',
            {
              provider: 'paypal',
              orderId: resolvedOrderId,
              captureId: event.resource?.id ?? captureId,
            },
            'paypal',
          );
        }
      }
    }

    return { received: true };
  }

  /**
   * Idempotent fulfillment of wallet top-up under the distributed wallet lock.
   */
  async fulfillTopUp(
    topUpRequestId: string,
    providerRef: string,
    paymentStatus: string,
    metadataExtra?: Record<string, any>,
    provider: TopUpProvider = 'stripe',
  ) {
    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: topUpRequestId },
    });
    if (!request) {
      this.logger.error(`Top-up request ${topUpRequestId} not found`);
      throw new NotFoundException(`Top-up request ${topUpRequestId} not found`);
    }

    // Idempotency: already processed → no-op
    if (request.status === 'COMPLETED') {
      this.logger.log(`Top-up request ${topUpRequestId} already completed — skipping`);
      const wallet = await this.walletService.ensureWallet(request.userId);
      return { success: true, balance: wallet.balance.toNumber() };
    }

    const wallet = await this.walletService.ensureWallet(request.userId);
    const creditAmount = new Decimal(request.amount).times(request.exchangeRate || 1);
    const providerLabel = provider === 'paypal' ? 'PayPal' : 'Stripe';

    // Balance read + ledger write MUST hold the wallet lock — otherwise a
    // concurrent partner debit between the read and the commit would produce a
    // wrong balanceBefore snapshot on the ledger entry (race condition).
    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const freshRequest = await this.prisma.walletTopUpRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
      if (freshRequest.status === 'COMPLETED') {
        this.logger.log(`Top-up request ${request.id} already completed (in lock) — skipping`);
        return { success: true, balance: fresh.balance.toNumber() };
      }

      const balanceBefore = fresh.balance;
      const balanceAfter = balanceBefore.plus(creditAmount);

      try {
        await this.prisma.$transaction([
          this.prisma.walletTopUpRequest.update({
            where: { id: request.id },
            data: { status: 'COMPLETED', completedAt: new Date(), providerStatus: paymentStatus, providerRef },
          }),
          this.prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: creditAmount,
              balanceBefore,
              balanceAfter,
              currency: fresh.currency,
              platformClientId: 'mcom-central',
              platformName: 'MCOM Central',
              platformSlug: 'system',
              category: 'TOP_UP',
              reference: providerRef,
              description: `Wallet top-up via ${providerLabel} (${request.currency} ${request.amount})`,
              metadata: {
                topUpRequestId: request.id,
                provider,
                providerRef,
                ...metadataExtra,
              } as Prisma.InputJsonValue,
              idempotencyKey: `topup:${request.id}`,
              status: 'COMPLETED',
              initiatedBy: `${provider}:${provider === 'stripe' ? 'payment_intent' : 'order'}`,
            },
          }),
          this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: balanceAfter, lastTransactionAt: new Date() },
          }),
        ]);
        await this.redis.del(`wallet:balance:${request.userId}`);
        this.logger.log(`Wallet credited ${creditAmount.toNumber()} MCOM for top-up ${request.id}`);
        return { success: true, balance: balanceAfter.toNumber() };
      } catch (err) {
        // Unique idempotency key collision → another confirmation or webhook already processed it
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.log(`Top-up ${request.id} already processed (duplicate) — skipping`);
          const latestWallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
          return { success: true, balance: latestWallet.balance.toNumber() };
        }
        throw err;
      }
    });
  }

  async listTopUpHistory(userId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.walletTopUpRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTopUpRequest.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: data.map((r) => ({
        id: r.id,
        amount: r.amount.toNumber(),
        currency: r.currency,
        walletCurrency: r.walletCurrency,
        provider: r.provider,
        status: r.status,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecentTopUpTransaction(walletId: string) {
    return this.ledgerService.getTransactions(walletId, {
      category: 'TOP_UP' as any,
      limit: 5,
      page: 1,
    });
  }

  // ─── PAYPAL HELPERS ────────────────────────────────────────────────────────

  private async captureOrReadPaypalOrder(orderId: string) {
    const token = await this.getPayPalAccessToken();
    try {
      const { data } = await axios.post(
        `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        },
      );
      return data;
    } catch (err: any) {
      // Already-captured replay: read the order back instead of failing.
      if (
        err?.response?.status === 422 &&
        /ORDER_ALREADY_CAPTURED/i.test(JSON.stringify(err?.response?.data ?? ''))
      ) {
        return this.readPaypalOrder(orderId);
      }
      throw new BadGatewayException(this.paypalError(err));
    }
  }

  private async readPaypalOrder(orderId: string) {
    const token = await this.getPayPalAccessToken();
    try {
      const { data } = await axios.get(`${this.paypalBaseUrl}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    } catch (err: any) {
      throw new BadGatewayException(this.paypalError(err));
    }
  }

  private assertPaypalOrderMatches(request: WalletTopUpRequest, order: any) {
    const unit = order?.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];

    if (unit?.custom_id && unit.custom_id !== request.id) {
      throw new ForbiddenException('PayPal order does not belong to this top-up request.');
    }

    const capturedValue = Number(capture?.amount?.value ?? unit?.amount?.value);
    const capturedCurrency = String(
      capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? '',
    ).toUpperCase();
    if (capturedCurrency !== request.currency.toUpperCase()) {
      throw new BadRequestException('PayPal currency does not match the top-up request.');
    }

    const expected = request.amount.toNumber();
    if (!Number.isFinite(capturedValue) || capturedValue + 0.000001 < expected) {
      throw new BadRequestException('Paid amount does not match the top-up request.');
    }

    const captureStatus = String(capture?.status ?? '').toUpperCase();
    const orderStatus = String(order?.status ?? '').toUpperCase();
    if (captureStatus !== 'COMPLETED' && orderStatus !== 'COMPLETED') {
      throw new BadRequestException(
        `PayPal payment not completed (status: ${captureStatus || orderStatus || 'UNKNOWN'}).`,
      );
    }

    return { captureId: capture?.id ?? null };
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

  private frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }
}
