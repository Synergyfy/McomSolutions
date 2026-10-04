import {
  Injectable,
  BadRequestException,
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Stripe from 'stripe';
import axios from 'axios';
import { Role, Prisma } from '@prisma/client';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { ExternalPlan } from '../service-connectors/connectors/connector.interface';

/** Authenticated caller attempting a payment operation. */
export interface PaymentCaller {
  userId: string;
  businessId?: string;
  role?: Role;
}

/** Parse a PayPal custom_id of `businessId|level|tier|billing`. */
function parseMembershipCustomId(customId: string): {
  businessId: string;
  level: string;
  tier: string;
  billing: 'monthly' | 'quarterly' | 'yearly';
} {
  const parts = (customId || '').split('|');
  if (parts.length === 5) {
    // Legacy 5-segment references carried a trial flag — trials are discontinued.
    throw new BadRequestException('Trial orders are no longer supported. Please create a new paid order.');
  }
  const [businessId, level, tier, billing] = parts;
  if (!businessId || !level || !tier) {
    throw new BadRequestException('PayPal order metadata is missing. Cannot activate subscription.');
  }
  const cycle = (['monthly', 'quarterly', 'yearly'].includes(billing) ? billing : 'monthly') as
    'monthly' | 'quarterly' | 'yearly';
  return { businessId, level, tier, billing: cycle };
}

function parsePlatformCustomId(customId: string): {
  businessId: string;
  platform: string;
  externalPlanId: string;
  billingCycle: string;
} {
  const [businessId, platform, externalPlanId, billingCycle] = (customId || '').split('|');
  if (!businessId || !platform || !externalPlanId) {
    throw new BadRequestException('PayPal order metadata is missing. Cannot activate platform subscription.');
  }
  return { businessId, platform, externalPlanId, billingCycle: billingCycle || 'monthly' };
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;
  private paypalBaseUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private pricingService: PricingService,
    private connectorsService: ServiceConnectorsService,
    private webhookDispatcher: WebhookDispatcherService,
    @Optional() private redis?: RedisService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }

    const paypalEnv = this.config.get<string>('PAYPAL_ENV');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    // Fail fast in production: never silently run against PayPal sandbox.
    if (isProduction && paypalEnv !== 'live') {
      throw new Error('PAYPAL_ENV must be "live" in production — refusing to run against PayPal sandbox.');
    }
    if (paypalEnv && !['sandbox', 'live'].includes(paypalEnv)) {
      throw new Error(`Invalid PAYPAL_ENV "${paypalEnv}" — expected "sandbox" or "live".`);
    }
    if (!paypalEnv && !isProduction) {
      this.logger.warn('PAYPAL_ENV not set — defaulting to sandbox (development only).');
    }
    this.paypalBaseUrl =
      paypalEnv === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  private async getPayPalAccessToken(): Promise<string> {
    const cacheKey = 'paypal:access_token';
    if (this.redis) {
      try {
        const cached = await this.redis.get<string>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (err: any) {
        this.logger.warn(`Redis error retrieving PayPal access token: ${err.message}`);
      }
    }

    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('PayPal credentials are not configured.');
    }

    const response = await axios.post(
      `${this.paypalBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );

    const accessToken = response.data?.access_token;
    const expiresIn = response.data?.expires_in || 3600;
    if (accessToken && this.redis) {
      try {
        const ttl = Math.max(60, expiresIn - 300);
        await this.redis.set(cacheKey, accessToken, ttl);
      } catch (err: any) {
        this.logger.warn(`Redis error caching PayPal access token: ${err.message}`);
      }
    }

    return accessToken;
  }

  async getBusinessProfileByUserId(userId: string) {
    return this.prisma.businessProfile.findFirst({
      where: { userId, deletedAt: null },
    });
  }

  /**
   * Phase 2: captures bind to the caller's business. An order approved for one
   * business can never be captured into another — mismatch is 403 + security log.
   */
  private assertCaptureOwnership(orderBusinessId: string, caller: PaymentCaller | undefined, providerRef: string): void {
    const isOwner = !!caller && caller.businessId === orderBusinessId;
    const isAdmin = caller?.role === Role.ADMIN;
    if (!isOwner && !isAdmin) {
      this.logger.warn(
        `Payment capture forbidden: user ${caller?.userId ?? 'anonymous'} attempted to capture ${providerRef} for business ${orderBusinessId}`,
      );
      throw new ForbiddenException('This order belongs to a different business.');
    }
  }

  private async resolvePlanPrice(
    level: string,
    tier: string,
    billing: 'monthly' | 'quarterly' | 'yearly',
  ): Promise<number> {
    return this.pricingService.resolveMembershipPrice(level, tier, billing);
  }

  // ─── G1: PayPal capture outbox (PayPal-success/DB-fail reconciliation) ──

  /** True when PayPal refuses capture because the order was already captured. */
  private isAlreadyCapturedError(err: any): boolean {
    if (err?.response?.status !== 422) return false;
    const body = JSON.stringify(err?.response?.data ?? '');
    return /ORDER_ALREADY_CAPTURED/i.test(body);
  }

  /**
   * Park a captured-but-unactivated payment for cron retry. The ledger row
   * does not exist yet, so a later replay would 404 — the outbox is the
   * source of truth until the cron drains it to DONE.
   */
  private async parkForReconcile(
    kind: 'membership' | 'platform',
    providerPaymentId: string,
    businessId: string,
    payload: Record<string, unknown>,
    err: unknown,
  ): Promise<never> {
    const message = err instanceof Error ? err.message : 'Activation write failed';
    await this.prisma.paymentOutbox.upsert({
      where: { providerPaymentId },
      create: {
        kind,
        providerPaymentId,
        businessId,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
        lastError: message,
      },
      update: { status: 'PENDING', lastError: message },
    });
    this.logger.error(
      `PayPal capture ${providerPaymentId} succeeded upstream but activation failed — parked for reconcile: ${message}`,
    );
    throw new ServiceUnavailableException(
      'Payment captured upstream; activation pending reconciliation. Please retry in a minute.',
    );
  }

  // ─── STRIPE ───────────────────────────────────────────────────────────────────

  async stripeInitiate(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'quarterly' | 'yearly',
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    // Phase 2: trials removed — every initiation is a real charge.
    const amountGBP = await this.resolvePlanPrice(level, tier, billing);
    const amountPence = Math.round(amountGBP * 100);

    // Full payment
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { businessId, level, tier, billing },
      description: `MCOM ${level} ${tier} Membership (${billing})`,
    });

    return { clientSecret: paymentIntent.client_secret, type: 'payment' };
  }

  async stripeConfirm(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'quarterly' | 'yearly',
    paymentIntentId: string,
    caller?: PaymentCaller,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }

    // Verify the payment intent is succeeded before activating subscription
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
    }

    // Phase 2: bind the intent to this business + expected amount (fail closed).
    if (intent.metadata?.businessId && intent.metadata.businessId !== businessId) {
      this.logger.warn(
        `Stripe confirm forbidden: intent ${paymentIntentId} belongs to business ${intent.metadata.businessId}, confirm attempted for ${businessId}`,
      );
      throw new ForbiddenException('This payment belongs to a different business.');
    }
    if (!intent.metadata?.businessId) {
      throw new BadRequestException('Payment is missing business metadata. Cannot activate subscription.');
    }
    const expectedPence = Math.round((await this.resolvePlanPrice(level, tier, billing)) * 100);
    if (intent.currency?.toLowerCase() !== 'gbp' || intent.amount !== expectedPence) {
      this.logger.warn(
        `Stripe confirm amount mismatch: intent ${paymentIntentId} is ${intent.amount} ${intent.currency}, expected ${expectedPence} gbp`,
      );
      throw new BadRequestException('Paid amount does not match the plan price. Cannot activate subscription.');
    }
    if (caller) {
      this.assertCaptureOwnership(businessId, caller, paymentIntentId);
    }

    // Activate subscription in database (idempotent on paymentIntentId)
    return this.pricingService.subscribeMembership(businessId, level, tier, billing, {
      provider: 'stripe',
      providerPaymentId: paymentIntentId,
    });
  }

  // ─── PAYPAL ───────────────────────────────────────────────────────────────────

  async paypalInitiate(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'quarterly' | 'yearly',
    returnUrl: string,
    cancelUrl: string,
  ) {
    const token = await this.getPayPalAccessToken();
    // Phase 2: trials removed — always the full plan price.
    const amountGBP = await this.resolvePlanPrice(level, tier, billing);

    const order = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'GBP',
              value: amountGBP.toFixed(2),
            },
            description: `MCOM ${level} ${tier} Membership (${billing})`,
            custom_id: `${businessId}|${level}|${tier}|${billing}`,
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: 'MCOM Solutions',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const approveLink = order.data.links?.find((l: any) => l.rel === 'approve')?.href;

    return {
      orderId: order.data.id,
      approvalUrl: approveLink,
    };
  }

  /**
   * Phase 2: authenticated, ownership-checked, amount-validated, idempotent.
   * - Order details are read BEFORE capture so a foreign order is never captured.
   * - Same orderId replay → current state (200); different business/amount → 409.
   */
  async paypalCapture(orderId: string, caller?: PaymentCaller) {
    // Fast path: already processed (DB is the source of truth — survives Redis flush).
    const replay = await this.findMembershipReplay(orderId);
    if (replay) {
      return this.resolvePaypalReplay(replay, caller);
    }

    const token = await this.getPayPalAccessToken();

    // Read-before-capture: verify ownership + amount without moving money.
    let order: any;
    try {
      const res = await axios.get(`${this.paypalBaseUrl}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      order = res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new BadRequestException(`PayPal order ${orderId} does not exist.`);
      }
      throw err;
    }

    const unit = order.purchase_units?.[0];
    const { businessId, level, tier, billing } = parseMembershipCustomId(unit?.custom_id || '');
    this.assertCaptureOwnership(businessId, caller, orderId);

    // Re-validate the approved amount against the server-side plan price.
    const expectedGBP = await this.resolvePlanPrice(level, tier, billing);
    const approvedValue = Number(unit?.amount?.value);
    const approvedCurrency = (unit?.amount?.currency_code || '').toUpperCase();
    if (approvedCurrency !== 'GBP' || !Number.isFinite(approvedValue) || Math.abs(approvedValue - expectedGBP) > 0.005) {
      this.logger.warn(
        `PayPal capture amount mismatch: order ${orderId} approved ${unit?.amount?.value} ${approvedCurrency}, expected ${expectedGBP.toFixed(2)} GBP`,
      );
      throw new BadRequestException('Approved amount does not match the plan price. Cannot activate subscription.');
    }

    const capture = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    ).catch(async (err: any) => {
      // A retry after a crash lands here: money already moved, no ledger row
      // yet. The pre-capture GET above already verified ownership + amount,
      // so attempt activation directly instead of failing the customer.
      if (this.isAlreadyCapturedError(err)) {
        this.logger.warn(`PayPal order ${orderId} already captured upstream — activating from read data`);
        return { data: { purchase_units: [{ custom_id: unit?.custom_id }] } };
      }
      throw err;
    });

    const capturedUnit = capture.data.purchase_units?.[0];
    if (capturedUnit?.custom_id && capturedUnit.custom_id !== unit?.custom_id) {
      this.logger.warn(`PayPal capture metadata drift on order ${orderId} — refusing to activate.`);
      throw new BadRequestException('PayPal order metadata changed during capture. Cannot activate subscription.');
    }

    const membershipPayload = { level, tier, billing, expectedGBP };
    let result: Awaited<ReturnType<PricingService['subscribeMembership']>>;
    try {
      result = await this.pricingService.subscribeMembership(businessId, level, tier, billing, {
        provider: 'paypal',
        providerPaymentId: orderId,
      });
    } catch (dbErr) {
      await this.parkForReconcile('membership', orderId, businessId, membershipPayload, dbErr);
    }

    if (this.redis) {
      try {
        await this.redis.set(`paypal:captured:${orderId}`, true, 86400 * 7);
      } catch (err: any) {
        this.logger.warn(`Redis error flagging captured order ${orderId}: ${err.message}`);
      }
    }

    return result;
  }

  /** DB idempotency pre-check shared by membership capture paths. */
  private async findMembershipReplay(providerPaymentId: string) {
    return this.prisma.billingTransaction.findUnique({
      where: { providerPaymentId },
    });
  }

  /**
   * Resolve a replayed reference: same business → current state (200);
   * different business → 409 Conflict + security log (per Phase 2 decision).
   */
  private async resolvePaypalReplay(
    existing: { businessId: string; amount: number },
    caller: PaymentCaller | undefined,
  ) {
    const isOwner = !!caller && caller.businessId === existing.businessId;
    if (!isOwner && caller?.role !== Role.ADMIN) {
      this.logger.warn(
        `Payment replay conflict: processed reference for business ${existing.businessId} replayed by user ${caller?.userId ?? 'anonymous'}`,
      );
      throw new ConflictException('This payment has already been processed for a different business.');
    }
    const current = await this.prisma.businessProfile.findFirst({
      where: { id: existing.businessId, deletedAt: null },
    });
    return { ...(current ?? { id: existing.businessId }), replayed: true, price: existing.amount };
  }

  // ─── PLATFORM PLAN PURCHASES ──────────────────────────────────────────────────

  private resolvePlatformPlanPrice(
    monthlyPrice?: any,
    quarterlyPrice?: any,
    annualPrice?: any,
    billingCycle: string = 'monthly',
  ): number {
    let price: any = 0;
    switch (billingCycle) {
      case 'monthly':
        price = monthlyPrice ?? 0;
        break;
      case 'quarterly':
        price = quarterlyPrice ?? 0;
        break;
      case 'annual':
        price = annualPrice ?? 0;
        break;
      default:
        price = monthlyPrice ?? 0;
        break;
    }
    return typeof price === 'string' ? parseFloat(price) : Number(price);
  }

  private calculateExpiry(billingCycle: string): Date {
    const now = new Date();
    switch (billingCycle) {
      case 'monthly':
        now.setMonth(now.getMonth() + 1);
        break;
      case 'quarterly':
        now.setMonth(now.getMonth() + 3);
        break;
      case 'annual':
        now.setFullYear(now.getFullYear() + 1);
        break;
    }
    return now;
  }

  private async resolveBusinessId(userId: string): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        businessProfile: { select: { id: true, deletedAt: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }
    if (!user.businessProfile?.id || user.businessProfile.deletedAt) {
      throw new UnprocessableEntityException('Business profile is required before initiating payments.');
    }
    return user.businessProfile.id;
  }

  private validatePlatformPlan(plan: any, platform: string) {
    if (!plan || typeof plan !== 'object' || !plan.id || !plan.name) {
      throw new BadGatewayException(
        `Received invalid plan details from ${platform}. Missing required plan information.`,
      );
    }
  }

  async platformStripeInitiate(
    userId: string,
    platform: string,
    externalPlanId: string,
    billingCycle: string,
    returnUrl?: string,
    cancelUrl?: string,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const businessId = await this.resolveBusinessId(userId);
    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    this.validatePlatformPlan(plan, platform);
    // Phase 2: trials removed — TRIAL plans cannot be purchased.
    if (plan.type === 'TRIAL') {
      throw new BadRequestException('Trial plans are no longer supported. Please choose a paid plan.');
    }
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    if (!Number.isFinite(amountGBP) || amountGBP <= 0) {
      throw new BadRequestException('This plan has no chargeable price. Cannot initiate payment.');
    }

    const amountPence = Math.round(amountGBP * 100);
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountPence,
      currency: 'gbp',
      automatic_payment_methods: { enabled: true },
      metadata: { businessId, platform, externalPlanId, billingCycle, planType: plan.type || 'STANDARD' },
      description: `MCOM ${platform} — ${plan.name} (${billingCycle})`,
    });

    return { clientSecret: paymentIntent.client_secret, type: 'payment', plan };
  }

  async platformStripeConfirm(
    userId: string,
    platform: string,
    externalPlanId: string,
    billingCycle: string,
    intentId: string,
    caller?: PaymentCaller,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }

    if (!intentId) {
      throw new BadRequestException('paymentIntentId or setupIntentId is required.');
    }

    const businessId = await this.resolveBusinessId(userId);
    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    this.validatePlatformPlan(plan, platform);
    // Phase 2: trials removed.
    if (plan.type === 'TRIAL') {
      throw new BadRequestException('Trial plans are no longer supported. Please choose a paid plan.');
    }
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    if (!Number.isFinite(amountGBP) || amountGBP <= 0) {
      throw new BadRequestException('This plan has no chargeable price. Cannot activate.');
    }

    // Verify SetupIntent or PaymentIntent depending on ID format
    if (intentId.startsWith('seti_')) {
      const setupIntent = await this.stripe.setupIntents.retrieve(intentId);
      if (setupIntent.status !== 'succeeded') {
        throw new BadRequestException(`Card setup not completed. Status: ${setupIntent.status}`);
      }
    } else {
      const intent = await this.stripe.paymentIntents.retrieve(intentId);
      if (intent.status !== 'succeeded') {
        throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
      }
      // Phase 2: bind the intent to this business + expected amount.
      if (intent.metadata?.businessId && intent.metadata.businessId !== businessId) {
        this.logger.warn(
          `Platform Stripe confirm forbidden: intent ${intentId} belongs to business ${intent.metadata.businessId}, confirm attempted for ${businessId}`,
        );
        throw new ForbiddenException('This payment belongs to a different business.');
      }
      const expectedPence = Math.round(amountGBP * 100);
      if (intent.currency?.toLowerCase() !== 'gbp' || intent.amount !== expectedPence) {
        this.logger.warn(
          `Platform Stripe confirm amount mismatch: intent ${intentId} is ${intent.amount} ${intent.currency}, expected ${expectedPence} gbp`,
        );
        throw new BadRequestException('Paid amount does not match the plan price. Cannot activate.');
      }
    }
    if (caller) {
      this.assertCaptureOwnership(businessId, caller, intentId);
    }

    return this.activatePlatformPackage({
      businessId,
      platform,
      externalPlanId,
      plan,
      billingCycle,
      amountGBP,
      provider: 'stripe',
      providerPaymentId: intentId,
      userId,
    });
  }

  async platformPaypalInitiate(
    userId: string,
    platform: string,
    externalPlanId: string,
    billingCycle: string,
    returnUrl: string,
    cancelUrl: string,
  ) {
    const token = await this.getPayPalAccessToken();
    const businessId = await this.resolveBusinessId(userId);
    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    this.validatePlatformPlan(plan, platform);
    // Phase 2: trials removed.
    if (plan.type === 'TRIAL') {
      throw new BadRequestException('Trial plans are no longer supported. Please choose a paid plan.');
    }
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    if (!Number.isFinite(amountGBP) || amountGBP <= 0) {
      throw new BadRequestException('This plan has no chargeable price. Cannot initiate payment.');
    }
    const finalAmount = amountGBP;

    const order = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'GBP',
              value: finalAmount.toFixed(2),
            },
            description: `MCOM ${platform} — ${plan.name} (${billingCycle})`,
            custom_id: `${businessId}|${platform}|${externalPlanId}|${billingCycle}`,
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: 'MCOM Solutions',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const approveLink = order.data.links?.find((l: any) => l.rel === 'approve')?.href;

    return {
      orderId: order.data.id,
      approvalUrl: approveLink,
      plan,
    };
  }

  /**
   * Phase 2: authenticated, ownership-checked, amount-validated, idempotent.
   * Same orderId replay → current package (200); different business/amount → 409.
   */
  async platformPaypalCapture(orderId: string, caller?: PaymentCaller) {
    // Fast path: already processed (DB is the source of truth).
    const replay = await this.prisma.billingTransaction.findUnique({
      where: { providerPaymentId: orderId },
    });
    if (replay) {
      return this.resolvePlatformReplay(replay, caller);
    }

    const token = await this.getPayPalAccessToken();

    // Read-before-capture: verify ownership + amount without moving money.
    let order: any;
    try {
      const res = await axios.get(`${this.paypalBaseUrl}/v2/checkout/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      order = res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        throw new BadRequestException(`PayPal order ${orderId} does not exist.`);
      }
      throw err;
    }

    const unit = order.purchase_units?.[0];
    const { businessId, platform, externalPlanId, billingCycle } = parsePlatformCustomId(unit?.custom_id || '');
    this.assertCaptureOwnership(businessId, caller, orderId);

    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    this.validatePlatformPlan(plan, platform);
    if (plan.type === 'TRIAL') {
      throw new BadRequestException('Trial plans are no longer supported. Please choose a paid plan.');
    }
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    if (!Number.isFinite(amountGBP) || amountGBP <= 0) {
      throw new BadRequestException('This plan has no chargeable price. Cannot activate.');
    }
    const approvedValue = Number(unit?.amount?.value);
    const approvedCurrency = (unit?.amount?.currency_code || '').toUpperCase();
    if (approvedCurrency !== 'GBP' || !Number.isFinite(approvedValue) || Math.abs(approvedValue - amountGBP) > 0.005) {
      this.logger.warn(
        `Platform PayPal capture amount mismatch: order ${orderId} approved ${unit?.amount?.value} ${approvedCurrency}, expected ${amountGBP.toFixed(2)} GBP`,
      );
      throw new BadRequestException('Approved amount does not match the plan price. Cannot activate.');
    }

    const capture = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    ).catch(async (err: any) => {
      if (this.isAlreadyCapturedError(err)) {
        this.logger.warn(`Platform PayPal order ${orderId} already captured upstream — activating from read data`);
        return { data: { purchase_units: [{ custom_id: unit?.custom_id, payments: { captures: [] } }] } };
      }
      throw err;
    });

    // Validate the captured amount too — the order may have changed between read and capture.
    const capturedAmount = capture.data.purchase_units?.[0]?.payments?.captures?.[0]?.amount;
    const capturedValue = Number(capturedAmount?.value);
    const capturedCurrency = (capturedAmount?.currency_code || '').toUpperCase();
    // Skipped when the capture response is reconstructed from an
    // ORDER_ALREADY_CAPTURED retry (no captures array to re-validate —
    // the approved amount was already validated against the plan price above).
    if (capturedAmount) {
      if (capturedCurrency !== 'GBP' || !Number.isFinite(capturedValue) || Math.abs(capturedValue - amountGBP) > 0.005) {
        this.logger.warn(
          `Platform PayPal captured amount mismatch: order ${orderId} captured ${capturedAmount?.value} ${capturedCurrency}, expected ${amountGBP.toFixed(2)} GBP`,
        );
        throw new BadRequestException('Captured amount does not match the plan price. Manual reconciliation required.');
      }
    }

    const platformPayload = { platform, externalPlanId, billingCycle, amountGBP };
    let result: Awaited<ReturnType<PaymentService['activatePlatformPackage']>>;
    try {
      result = await this.activatePlatformPackage({
        businessId,
        platform,
        externalPlanId,
        plan,
        billingCycle,
        amountGBP,
        provider: 'paypal',
        providerPaymentId: orderId,
      });
    } catch (dbErr) {
      await this.parkForReconcile('platform', orderId, businessId, platformPayload, dbErr);
    }

    if (this.redis) {
      try {
        await this.redis.set(`paypal:captured:${orderId}`, true, 86400 * 7);
      } catch (err: any) {
        this.logger.warn(`Redis error flagging captured order ${orderId}: ${err.message}`);
      }
    }

    return result;
  }

  /**
   * Resolve a replayed platform payment reference: same business → current
   * package (200); different business → 409 Conflict + security log.
   */
  private async resolvePlatformReplay(
    existing: { businessId: string; amount: number },
    caller: PaymentCaller | undefined,
  ) {
    const isOwner = !!caller && caller.businessId === existing.businessId;
    if (!isOwner && caller?.role !== Role.ADMIN) {
      this.logger.warn(
        `Platform payment replay conflict: processed reference for business ${existing.businessId} replayed by user ${caller?.userId ?? 'anonymous'}`,
      );
      throw new ConflictException('This payment has already been processed for a different business.');
    }
    const pkg = await this.prisma.platformPackage.findFirst({
      where: { businessId: existing.businessId },
      orderBy: { createdAt: 'desc' },
    });
    return { ...(pkg ?? { businessId: existing.businessId }), replayed: true };
  }

  // ─── G1: outbox drain cron ─────────────────────────────────────────────
  // Retries parked PayPal activations until the ledger row exists. Skips rows
  // whose ledger row appeared via another path (marks DONE without double
  // activation). Failures stay PENDING with attempts/lastError; after
  // MAX_ATTEMPTS they flip to FAILED for manual triage (never silently dropped).
  @Cron(CronExpression.EVERY_5_MINUTES)
  async drainPaymentOutbox(): Promise<void> {
    const lockKey = 'cron:payment-outbox';
    let acquired = false;
    if (this.redis) {
      try {
        acquired = await this.redis.setNx(lockKey, '1', 280);
      } catch {
        acquired = true; // Redis down — single-instance drain still progresses.
      }
      if (!acquired) {
        this.logger.debug('Payment outbox drain already running elsewhere — skipping');
        return;
      }
    }

    const MAX_ATTEMPTS = 25;
    try {
      const pending = await this.prisma.paymentOutbox.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const row of pending) {
        const ledger = await this.prisma.billingTransaction.findUnique({
          where: { providerPaymentId: row.providerPaymentId },
        });
        if (ledger) {
          await this.prisma.paymentOutbox.update({
            where: { id: row.id },
            data: { status: 'DONE', lastError: null },
          });
          continue;
        }
        try {
          await this.activateOutboxRow(row as {
            kind: string;
            providerPaymentId: string;
            businessId: string;
            payload: Record<string, unknown>;
          });
          await this.prisma.paymentOutbox.update({
            where: { id: row.id },
            data: { status: 'DONE', attempts: { increment: 1 }, lastError: null },
          });
          this.logger.log(`Payment outbox reconciled ${row.providerPaymentId} (${row.kind})`);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Reconcile failed';
          const attempts = row.attempts + 1;
          await this.prisma.paymentOutbox.update({
            where: { id: row.id },
            data: {
              attempts,
              lastError: message.slice(0, 500),
              ...(attempts >= MAX_ATTEMPTS ? { status: 'FAILED' } : {}),
            },
          });
          this.logger.warn(`Payment outbox retry ${row.providerPaymentId} failed (attempt ${attempts}): ${message}`);
        }
      }
    } finally {
      if (this.redis && acquired) {
        await this.redis.del(lockKey).catch(() => {});
      }
    }
  }

  private async activateOutboxRow(row: {
    kind: string;
    providerPaymentId: string;
    businessId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    if (row.kind === 'membership') {
      const { level, tier, billing } = row.payload as {
        level: string;
        tier: string;
        billing: 'monthly' | 'quarterly' | 'yearly';
      };
      await this.pricingService.subscribeMembership(
        row.businessId,
        String(level),
        String(tier),
        String(billing) as 'monthly' | 'quarterly' | 'yearly',
        { provider: 'paypal', providerPaymentId: row.providerPaymentId },
      );
      return;
    }
    const { platform, externalPlanId, billingCycle, amountGBP } = row.payload as {
      platform: string;
      externalPlanId: string;
      billingCycle: string;
      amountGBP: number;
    };
    const plan = await this.connectorsService.getPlanById(String(platform), String(externalPlanId));
    this.validatePlatformPlan(plan, String(platform));
    await this.activatePlatformPackage({
      businessId: row.businessId,
      platform: String(platform),
      externalPlanId: String(externalPlanId),
      plan,
      billingCycle: String(billingCycle || 'monthly'),
      amountGBP: Number(amountGBP),
      provider: 'paypal',
      providerPaymentId: row.providerPaymentId,
    });
  }

  // ─── SHARED PACKAGE ACTIVATION HELPER ─────────────────────────────────────────
  // Phase 2: idempotent on providerPaymentId (unique). Package upsert + ledger
  // write run in one transaction; P2002 races resolve to replay (200) / 409.

  private async activatePlatformPackage(params: {
    businessId: string;
    platform: string;
    externalPlanId: string;
    plan: ExternalPlan;
    billingCycle: string;
    amountGBP: number;
    provider: 'stripe' | 'paypal';
    providerPaymentId: string;
    userId?: string;
  }) {
    const {
      businessId,
      platform,
      externalPlanId,
      plan,
      billingCycle,
      amountGBP,
      provider,
      providerPaymentId,
    } = params;

    const replayLedger = await this.prisma.billingTransaction.findUnique({
      where: { providerPaymentId },
    });
    if (replayLedger) {
      // Internal pre-check (caller already ownership-verified upstream):
      // same business → current package (200); anything else → 409.
      if (replayLedger.businessId !== businessId) {
        this.logger.warn(
          `Platform activation conflict: reference ${providerPaymentId} already processed for business ${replayLedger.businessId}, attempted for ${businessId}`,
        );
        throw new ConflictException('This payment has already been processed for a different business.');
      }
      if (Math.abs(replayLedger.amount - amountGBP) > 0.005) {
        this.logger.warn(
          `Platform activation conflict: reference ${providerPaymentId} amount ${replayLedger.amount} does not match ${amountGBP}`,
        );
        throw new ConflictException('This payment has already been processed for a different amount.');
      }
      const current = await this.prisma.platformPackage.findUnique({
        where: { businessId_platform: { businessId, platform } },
      });
      return { ...(current ?? { businessId, platform }), replayed: true };
    }

    const existingPackage = await this.prisma.platformPackage.findUnique({
      where: { businessId_platform: { businessId, platform } },
    });
    const eventType =
      existingPackage && existingPackage.status === 'active'
        ? 'package.renewed'
        : 'package.created';

    const expiresAt = this.calculateExpiry(billingCycle);

    const packageData = {
      packageName: plan.name,
      externalPlanId,
      planName: plan.name,
      planType: plan.type || 'STANDARD',
      status: 'active',
      expiresAt,
      provider,
      providerSubscriptionId: providerPaymentId,
      amount: amountGBP,
      currency: 'GBP',
      billingCycle,
      limits: plan.configuration?.quotas || {},
    };

    let package_: any;
    try {
      const [pkg] = await this.prisma.$transaction([
        this.prisma.platformPackage.upsert({
          where: { businessId_platform: { businessId, platform } },
          update: packageData,
          create: {
            businessId,
            platform,
            ...packageData,
          },
        }),
        this.prisma.billingTransaction.create({
          data: {
            businessId,
            amount: amountGBP,
            description: `MCOM ${platform} — ${plan.name} (${billingCycle})`,
            status: 'paid',
            provider,
            providerPaymentId,
          },
        }),
      ]);
      package_ = pkg;
    } catch (err) {
      // Lost a race with a concurrent activation on the same reference.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.billingTransaction.findUnique({
          where: { providerPaymentId },
        });
        if (existing) {
          if (existing.businessId !== businessId) {
            throw new ConflictException('This payment has already been processed for a different business.');
          }
          const current = await this.prisma.platformPackage.findUnique({
            where: { businessId_platform: { businessId, platform } },
          });
          return { ...(current ?? { businessId, platform }), replayed: true };
        }
      }
      throw err;
    }

    // Link the ledger row to the package (best-effort; activation is already committed).
    try {
      await this.prisma.billingTransaction.updateMany({
        where: { providerPaymentId, platformPackageId: null },
        data: { platformPackageId: package_.id },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to link ledger row for ${providerPaymentId}: ${err.message}`);
    }

    // Resolve mcomUserId to dispatch package lifecycle webhook
    let resolvedUserId = params.userId;
    if (!resolvedUserId) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { id: businessId, deletedAt: null },
        select: { userId: true },
      });
      resolvedUserId = business?.userId || '';
    }

    if (resolvedUserId) {
      this.webhookDispatcher.dispatchPackageEvent(eventType, {
        platform,
        userId: resolvedUserId,
        package: package_,
      });
    }

    return package_;
  }

  // ─── STRIPE WEBHOOK (memberships + platform) ────────────────────────────────
  // Phase 2: server-truth activation for close-tab-after-charge. The frontend
  // `confirm` endpoints remain as fallback; the ledger unique key keeps both
  // paths idempotent. Hidden from Swagger per payment-rules.

  async handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      this.logger.error('STRIPE_WEBHOOK_SECRET is not configured — refusing to process Stripe webhook.');
      throw new ServiceUnavailableException('Stripe webhook is not configured.');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.warn(`Invalid Stripe webhook signature: ${err?.message}`);
      throw new BadRequestException('Invalid webhook signature.');
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        await this.handleSucceededPaymentIntent(event.data.object as Stripe.PaymentIntent);
      }
      // setup_intent.succeeded and all other types: no trials exist, so card
      // setups alone never activate anything — acknowledge and ignore.
    } catch (err) {
      // Poison events (bad metadata, unknown business, hijack conflicts) are
      // acked + logged so Stripe stops retrying them; transient failures
      // rethrow so Stripe redelivers.
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ConflictException ||
        err instanceof ForbiddenException
      ) {
        this.logger.warn(`Stripe webhook ${event.id} (${event.type}) ignored: ${(err as Error).message}`);
        return { received: true };
      }
      throw err;
    }
    return { received: true };
  }

  private async handleSucceededPaymentIntent(intent: Stripe.PaymentIntent): Promise<void> {
    const meta = intent.metadata || {};
    const businessId = meta.businessId;
    if (!businessId) {
      throw new BadRequestException('Payment intent is missing business metadata.');
    }

    if (meta.platform) {
      // Platform purchase.
      const platform = meta.platform;
      const externalPlanId = meta.externalPlanId;
      const billingCycle = meta.billingCycle || 'monthly';
      if (!externalPlanId) {
        throw new BadRequestException('Payment intent is missing platform plan metadata.');
      }
      const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
      this.validatePlatformPlan(plan, platform);
      if (plan.type === 'TRIAL') {
        throw new BadRequestException('Trial plans are no longer supported.');
      }
      const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
      this.assertStripeIntentAmount(intent, amountGBP);
      await this.activatePlatformPackage({
        businessId,
        platform,
        externalPlanId,
        plan,
        billingCycle,
        amountGBP,
        provider: 'stripe',
        providerPaymentId: intent.id,
      });
      return;
    }

    // Membership purchase.
    const { level, tier, billing } = meta;
    if (!level || !tier) {
      throw new BadRequestException('Payment intent is missing membership metadata.');
    }
    const cycle = (['monthly', 'quarterly', 'yearly'].includes(billing) ? billing : 'monthly') as
      'monthly' | 'quarterly' | 'yearly';
    const expectedGBP = await this.resolvePlanPrice(level, tier, cycle);
    this.assertStripeIntentAmount(intent, expectedGBP);
    await this.pricingService.subscribeMembership(businessId, level, tier, cycle, {
      provider: 'stripe',
      providerPaymentId: intent.id,
    });
  }

  private assertStripeIntentAmount(intent: Stripe.PaymentIntent, expectedGBP: number): void {
    const expectedPence = Math.round(expectedGBP * 100);
    if (intent.currency?.toLowerCase() !== 'gbp' || intent.amount !== expectedPence) {
      this.logger.warn(
        `Stripe webhook amount mismatch: intent ${intent.id} is ${intent.amount} ${intent.currency}, expected ${expectedPence} gbp`,
      );
      throw new BadRequestException('Paid amount does not match the plan price.');
    }
  }
}
