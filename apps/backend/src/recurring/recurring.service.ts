import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import axios from 'axios';
import {
  MembershipLevel,
  MembershipStatus,
  MembershipTier,
  Prisma,
  RecurringChargeStatus,
  RecurringProvider,
  RecurringScope,
  RecurringStatus,
  TransactionCategory,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from '../wallet/wallet.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { NotificationService } from '../notification/notification.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';
import { PricingService } from '../pricing/pricing.service';
import { normalizePlanTier } from '../pricing/payment-option.util';
import {
  ChargeEvidence,
  MandatePeriod,
  MembershipRecurringInput,
  PayPalMandateResult,
  PlatformRecurringInput,
  StripeMandateResult,
} from './recurring.types';

const INTERNAL_WALLET_PARTNER = {
  clientId: 'mcom-central',
  name: 'MCOM Central',
  platformSlug: 'mcom-central',
};

/**
 * Central recurring-billing engine.
 *
 * Stripe and PayPal charge at the provider; this service mirrors the mandate
 * locally and extends entitlements from verified webhooks (with a reconciler
 * as the safety net). Wallet mandates are charged here because MCOM owns the
 * balance.
 */
@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);
  private stripe?: Stripe;
  private paypalBaseUrl: string;
  private paypalToken?: { value: string; expiresAt: number };

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly webhookDispatcher: WebhookDispatcherService,
    private readonly notificationService: NotificationService,
    private readonly connectorsService: ServiceConnectorsService,
    private readonly pricingService: PricingService,
    @Optional() private readonly redis?: RedisService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }

    const paypalEnv = this.config.get<string>('PAYPAL_ENV');
    this.paypalBaseUrl =
      paypalEnv === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  private isEnabled(): boolean {
    return this.config.get<string>('RECURRING_PAYMENTS_ENABLED') !== 'false';
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured on this server.');
    }
    return this.stripe;
  }

  private async getPayPalToken(): Promise<string> {
    if (this.paypalToken && this.paypalToken.expiresAt > Date.now()) {
      return this.paypalToken.value;
    }
    const clientId = this.config.get<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.get<string>('PAYPAL_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException('PayPal credentials are not configured.');
    }
    const response = await axios.post(
      `${this.paypalBaseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    const ttlSeconds = Number(response.data?.expires_in || 3600);
    this.paypalToken = {
      value: response.data.access_token,
      expiresAt: Date.now() + Math.max(60, ttlSeconds - 300) * 1000,
    };
    return this.paypalToken.value;
  }

  private paypalHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };
  }

  private addInterval(from: Date, unit: string, count: number): Date {
    const d = new Date(from.getTime());
    if (unit === 'year') {
      d.setUTCFullYear(d.getUTCFullYear() + count);
    } else if (unit === 'week') {
      d.setUTCDate(d.getUTCDate() + count * 7);
    } else if (unit === 'day') {
      d.setUTCDate(d.getUTCDate() + count);
    } else {
      d.setUTCMonth(d.getUTCMonth() + count);
    }
    return d;
  }

  private intervalForDays(days: number): { unit: string; count: number } {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 30;
    if (safeDays >= 360) return { unit: 'year', count: 1 };
    if (safeDays % 30 === 0) return { unit: 'month', count: Math.max(1, safeDays / 30) };
    return { unit: 'month', count: Math.max(1, Math.ceil(safeDays / 30)) };
  }

  private intervalForBillingCycle(cycle: string): { unit: string; count: number } {
    switch ((cycle || '').toLowerCase()) {
      case 'quarterly':
        return { unit: 'month', count: 3 };
      case 'annual':
      case 'yearly':
        return { unit: 'year', count: 1 };
      default:
        return { unit: 'month', count: 1 };
    }
  }

  private membershipScopeKey(businessId: string, _planId?: string, _tier?: string): string {
    // A business can only hold one active membership, so the mandate is keyed
    // by business. This also makes plan upgrades reuse/replace the mandate.
    return `membership:${businessId}`;
  }

  private platformScopeKey(businessId: string, platform: string): string {
    return `platform:${businessId}:${platform}`;
  }

  private canonicalTier(tier: string): MembershipTier {
    const normalized = normalizePlanTier(tier);
    if (normalized === 'Pro') return MembershipTier.Pro;
    if (normalized === 'ProPlus') return MembershipTier.ProPlus;
    return MembershipTier.Normal;
  }

  private tierLabel(tier: string): string {
    const normalized = normalizePlanTier(tier);
    if (normalized === 'Pro') return 'Pro';
    if (normalized === 'ProPlus') return 'Pro+';
    return 'Standard';
  }

  private membershipLevel(level: string): MembershipLevel {
    const values = Object.values(MembershipLevel) as string[];
    return (values.includes(level) ? level : MembershipLevel.Bronze) as MembershipLevel;
  }

  /** Reuse an admin-configured provider price/plan id when one exists. */
  private async membershipProviderOption(planId: string, tier: string) {
    if (!planId) return null;
    return this.prisma.membershipPaymentOption.findFirst({
      where: {
        paymentPlan: 'full',
        isActive: true,
        tier: { planId, tier: normalizePlanTier(tier) },
      },
      select: { id: true, stripePriceId: true, paypalPlanId: true },
    });
  }

  private toDate(unixSeconds: unknown): Date | null {
    const n = Number(unixSeconds);
    return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : null;
  }

  /**
   * Resolve the period a PayPal event belongs to.
   *
   * For the very first activation the mandate is INCOMPLETE and the creation
   * timestamp is used as the period start — both ACTIVATED and the first
   * PAYMENT.SALE.COMPLETED then resolve to the same (subscriptionId,
   * periodStart) charge row, so the user is never extended twice. Later sales
   * start at the previous period end.
   */
  private paypalPeriod(mandate: any, nextBilling?: Date | null): MandatePeriod {
    const now = new Date();
    if (mandate.status === RecurringStatus.INCOMPLETE) {
      const periodStart = mandate.currentPeriodStart ?? now;
      const periodEnd =
        nextBilling ??
        mandate.currentPeriodEnd ??
        this.addInterval(periodStart, mandate.intervalUnit, mandate.intervalCount);
      return { periodStart, periodEnd };
    }
    const periodStart =
      mandate.currentPeriodEnd && mandate.currentPeriodEnd <= now
        ? mandate.currentPeriodEnd
        : now;
    const periodEnd =
      nextBilling ?? this.addInterval(periodStart, mandate.intervalUnit, mandate.intervalCount);
    return { periodStart, periodEnd };
  }

  // ─── Stripe: customer / price / subscription creation ──────────────────────

  async ensureStripeCustomer(businessId: string, email?: string): Promise<string> {
    const stripe = this.requireStripe();
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    if (business.stripeCustomerId) return business.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: email || business.email || business.user?.email || undefined,
      name: business.businessName,
      metadata: { businessId },
    });
    await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private async ensureStripePrice(params: {
    amount: number;
    name: string;
    unit: string;
    count: number;
    metadata: Record<string, string>;
    existingPriceId?: string;
  }): Promise<string> {
    if (params.existingPriceId) return params.existingPriceId;
    const stripe = this.requireStripe();
    const price = await stripe.prices.create({
      currency: 'gbp',
      unit_amount: Math.round(params.amount * 100),
      recurring: {
        interval: (params.unit === 'year' ? 'year' : params.unit === 'week' ? 'week' : params.unit === 'day' ? 'day' : 'month') as Stripe.PriceCreateParams.Recurring.Interval,
        interval_count: params.count,
      },
      product_data: { name: params.name },
      metadata: params.metadata,
    });
    return price.id;
  }

  private async createStripeSubscription(params: {
    customerId: string;
    priceId: string;
    metadata: Record<string, string>;
  }): Promise<{ subscription: Stripe.Subscription; paymentIntent?: Stripe.PaymentIntent }> {
    const stripe = this.requireStripe();
    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: params.metadata,
      expand: ['latest_invoice.payment_intent'],
    });

    const invoice = subscription.latest_invoice as any;
    const paymentIntent = (invoice?.payment_intent as Stripe.PaymentIntent | undefined) || undefined;

    if (paymentIntent) {
      await stripe.paymentIntents
        .update(paymentIntent.id, {
          metadata: { ...params.metadata, kind: 'recurring' },
        })
        .catch((err) => this.logger.warn(`Could not tag recurring PaymentIntent ${paymentIntent.id}: ${err.message}`));
    }

    return { subscription, paymentIntent };
  }

  async createMembershipStripeSubscription(input: MembershipRecurringInput): Promise<StripeMandateResult> {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    const scopeKey = this.membershipScopeKey(input.businessId, input.planId, input.tier);
    await this.cancelStaleMandate(scopeKey);
    const interval = this.intervalForDays(input.durationDays);
    const customerId = await this.ensureStripeCustomer(input.businessId, input.email);
    const providerOption = await this.membershipProviderOption(input.planId, input.tier);
    const priceId = await this.ensureStripePrice({
      amount: input.amount,
      name: `MCOM ${input.level} ${input.tier} Membership`,
      unit: interval.unit,
      count: interval.count,
      metadata: { scope: 'MEMBERSHIP', businessId: input.businessId },
      existingPriceId: providerOption?.stripePriceId ?? undefined,
    });
    if (providerOption?.id && !providerOption.stripePriceId) {
      await this.prisma.membershipPaymentOption
        .update({ where: { id: providerOption.id }, data: { stripePriceId: priceId } })
        .catch((err) => this.logger.warn(`Could not cache Stripe price id: ${err.message}`));
    }

    const { subscription, paymentIntent } = await this.createStripeSubscription({
      customerId,
      priceId,
      metadata: {
        scope: 'MEMBERSHIP',
        businessId: input.businessId,
        level: input.level,
        tier: input.tier,
        planId: input.planId,
        planName: input.planName,
      },
    });

    const now = new Date();
    await this.upsertMandate({
      scopeKey: this.membershipScopeKey(input.businessId, input.planId, input.tier),
      scope: RecurringScope.MEMBERSHIP,
      businessId: input.businessId,
      userId: input.userId,
      membershipPlanId: input.planId,
      membershipPlanName: input.planName,
      membershipTier: this.tierLabel(input.tier),
      level: input.level,
      provider: RecurringProvider.stripe,      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      providerPriceId: priceId,
      providerPaymentIntentId: paymentIntent?.id,
      planName: input.planName,
      billingCycle: input.billingCycle,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      amount: input.amount,
      status: RecurringStatus.INCOMPLETE,
      currentPeriodStart: now,
      currentPeriodEnd: this.addInterval(now, interval.unit, interval.count),
      nextChargeAt: this.addInterval(now, interval.unit, interval.count),
    });

    return {
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent?.id,
      clientSecret: paymentIntent?.client_secret ?? undefined,
    };
  }

  async createPlatformStripeSubscription(input: PlatformRecurringInput): Promise<StripeMandateResult> {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    await this.cancelStaleMandate(this.platformScopeKey(input.businessId, input.platform));
    const interval = input.durationDays
      ? this.intervalForDays(input.durationDays)
      : this.intervalForBillingCycle(input.billingCycle);
    const customerId = await this.ensureStripeCustomer(input.businessId, input.email);
    const priceId = await this.ensureStripePrice({
      amount: input.amount,
      name: `MCOM ${input.platform} — ${input.planName}`,
      unit: interval.unit,
      count: interval.count,
      metadata: { scope: 'PLATFORM', businessId: input.businessId, platform: input.platform },
      existingPriceId: input.stripePriceId,
    });

    const { subscription, paymentIntent } = await this.createStripeSubscription({
      customerId,
      priceId,
      metadata: {
        scope: 'PLATFORM',
        businessId: input.businessId,
        platform: input.platform,
        externalPlanId: input.externalPlanId,
        planName: input.planName,
      },
    });

    const now = new Date();
    await this.upsertMandate({
      scopeKey: this.platformScopeKey(input.businessId, input.platform),
      scope: RecurringScope.PLATFORM,
      businessId: input.businessId,
      userId: input.userId,
      platform: input.platform,
      externalPlanId: input.externalPlanId,
      provider: RecurringProvider.stripe,
      providerCustomerId: customerId,
      providerSubscriptionId: subscription.id,
      providerPriceId: priceId,
      providerPaymentIntentId: paymentIntent?.id,
      planName: input.planName,
      billingCycle: input.billingCycle,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      amount: input.amount,
      status: RecurringStatus.INCOMPLETE,
      currentPeriodStart: now,
      currentPeriodEnd: this.addInterval(now, interval.unit, interval.count),
      nextChargeAt: this.addInterval(now, interval.unit, interval.count),
    });

    return {
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent?.id,
      clientSecret: paymentIntent?.client_secret ?? undefined,
    };
  }

  // ─── PayPal: product / plan / subscription creation ────────────────────────

  private async ensurePayPalPlan(params: {
    productName: string;
    amount: number;
    unit: string;
    count: number;
    metadata: Record<string, string>;
    existingPlanId?: string;
  }): Promise<string> {
    if (params.existingPlanId) return params.existingPlanId;
    const token = await this.getPayPalToken();
    const headers = this.paypalHeaders(token);

    const product = await axios.post(
      `${this.paypalBaseUrl}/v1/catalog/products`,
      {
        name: params.productName.slice(0, 127),
        type: 'SERVICE',
        description: `MCOM recurring plan for ${params.productName}`.slice(0, 256),
      },
      { headers },
    );

    const unit = (params.unit === 'year' ? 'YEAR' : params.unit === 'week' ? 'WEEK' : params.unit === 'day' ? 'DAY' : 'MONTH') as 'YEAR' | 'MONTH' | 'WEEK' | 'DAY';
    const plan = await axios.post(
      `${this.paypalBaseUrl}/v1/billing/plans`,
      {
        product_id: product.data.id,
        name: params.productName.slice(0, 127),
        status: 'ACTIVE',
        billing_cycles: [
          {
            frequency: { interval_unit: unit, interval_count: params.count },
            tenure_type: 'REGULAR',
            sequence: 1,
            total_cycles: 0,
            pricing_scheme: {
              fixed_price: { value: params.amount.toFixed(2), currency_code: 'GBP' },
            },
          },
        ],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 2,
        },
      },
      { headers },
    );
    return plan.data.id;
  }

  private async createPayPalSubscription(params: {
    planId: string;
    returnUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    email?: string;
  }): Promise<{ subscriptionId: string; approvalUrl?: string }> {
    const token = await this.getPayPalToken();
    const response = await axios.post(
      `${this.paypalBaseUrl}/v1/billing/subscriptions`,
      {
        plan_id: params.planId,
        custom_id: JSON.stringify(params.metadata).slice(0, 127),
        application_context: {
          brand_name: 'MCOM Solutions',
          locale: 'en-GB',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl,
        },
        ...(params.email ? { subscriber: { email_address: params.email } } : {}),
      },
      { headers: this.paypalHeaders(token) },
    );

    const approvalUrl = response.data?.links?.find((l: any) => l.rel === 'approve')?.href;
    return { subscriptionId: response.data.id, approvalUrl };
  }

  async createMembershipPayPalSubscription(
    input: MembershipRecurringInput & { returnUrl: string; cancelUrl: string },
  ): Promise<PayPalMandateResult> {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    await this.cancelStaleMandate(this.membershipScopeKey(input.businessId, input.planId, input.tier));
    const interval = this.intervalForDays(input.durationDays);
    const providerOption = await this.membershipProviderOption(input.planId, input.tier);
    const planId = await this.ensurePayPalPlan({
      productName: `MCOM ${input.level} ${input.tier} Membership`,
      amount: input.amount,
      unit: interval.unit,
      count: interval.count,
      metadata: { scope: 'MEMBERSHIP', businessId: input.businessId },
      existingPlanId: providerOption?.paypalPlanId ?? undefined,
    });
    if (providerOption?.id && !providerOption.paypalPlanId) {
      await this.prisma.membershipPaymentOption
        .update({ where: { id: providerOption.id }, data: { paypalPlanId: planId } })
        .catch((err) => this.logger.warn(`Could not cache PayPal plan id: ${err.message}`));
    }

    const { subscriptionId, approvalUrl } = await this.createPayPalSubscription({
      planId,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      email: input.email,
      metadata: {
        scope: 'MEMBERSHIP',
        businessId: input.businessId,
        level: input.level,
        tier: input.tier,
        planId: input.planId,
      },
    });

    const now = new Date();
    await this.upsertMandate({
      scopeKey: this.membershipScopeKey(input.businessId, input.planId, input.tier),
      scope: RecurringScope.MEMBERSHIP,
      businessId: input.businessId,
      userId: input.userId,
      membershipPlanId: input.planId,
      membershipPlanName: input.planName,
      membershipTier: this.tierLabel(input.tier),
      level: input.level,
      provider: RecurringProvider.paypal,
      providerSubscriptionId: subscriptionId,
      providerPriceId: planId,
      planName: input.planName,
      billingCycle: input.billingCycle,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      amount: input.amount,
      status: RecurringStatus.INCOMPLETE,
      currentPeriodStart: now,
      currentPeriodEnd: this.addInterval(now, interval.unit, interval.count),
      nextChargeAt: this.addInterval(now, interval.unit, interval.count),
    });

    return { subscriptionId, approvalUrl };
  }

  async createPlatformPayPalSubscription(
    input: PlatformRecurringInput & { returnUrl: string; cancelUrl: string },
  ): Promise<PayPalMandateResult> {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    await this.cancelStaleMandate(this.platformScopeKey(input.businessId, input.platform));
    const interval = input.durationDays
      ? this.intervalForDays(input.durationDays)
      : this.intervalForBillingCycle(input.billingCycle);
    const planId = await this.ensurePayPalPlan({
      productName: `MCOM ${input.platform} — ${input.planName}`,
      amount: input.amount,
      unit: interval.unit,
      count: interval.count,
      metadata: { scope: 'PLATFORM', businessId: input.businessId, platform: input.platform },
      existingPlanId: input.paypalPlanId,
    });

    const { subscriptionId, approvalUrl } = await this.createPayPalSubscription({
      planId,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      email: input.email,
      metadata: {
        scope: 'PLATFORM',
        businessId: input.businessId,
        platform: input.platform,
        externalPlanId: input.externalPlanId,
      },
    });

    const now = new Date();
    await this.upsertMandate({
      scopeKey: this.platformScopeKey(input.businessId, input.platform),
      scope: RecurringScope.PLATFORM,
      businessId: input.businessId,
      userId: input.userId,
      platform: input.platform,
      externalPlanId: input.externalPlanId,
      provider: RecurringProvider.paypal,
      providerSubscriptionId: subscriptionId,
      providerPriceId: planId,
      planName: input.planName,
      billingCycle: input.billingCycle,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      amount: input.amount,
      status: RecurringStatus.INCOMPLETE,
      currentPeriodStart: now,
      currentPeriodEnd: this.addInterval(now, interval.unit, interval.count),
      nextChargeAt: this.addInterval(now, interval.unit, interval.count),
    });

    return { subscriptionId, approvalUrl };
  }

  // ─── Wallet mandate ────────────────────────────────────────────────────────

  async createWalletMandate(input: {
    scope: RecurringScope;
    businessId: string;
    userId?: string;
    membershipPlanId?: string;
    membershipPlanName?: string;
    membershipTier?: string;
    level?: string;
    platform?: string;
    externalPlanId?: string;
    planName: string;
    amount: number;
    billingCycle: string;
    durationDays: number;
    nextChargeAt?: Date;
  }): Promise<{ mandateId: string }> {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    const interval = this.intervalForDays(input.durationDays);
    const scopeKey =
      input.scope === RecurringScope.MEMBERSHIP
        ? this.membershipScopeKey(input.businessId, input.membershipPlanId || '', input.membershipTier || 'Standard')
        : this.platformScopeKey(input.businessId, input.platform || '');
    await this.cancelStaleMandate(scopeKey);
    const now = new Date();
    const currentPeriodEnd = input.nextChargeAt ?? this.addInterval(now, interval.unit, interval.count);
    const mandate = await this.upsertMandate({
      scopeKey,
      scope: input.scope,
      businessId: input.businessId,
      userId: input.userId,
      membershipPlanId: input.membershipPlanId,
      membershipPlanName: input.membershipPlanName,
      membershipTier: input.membershipTier,
      level: input.level,
      platform: input.platform,
      externalPlanId: input.externalPlanId,
      provider: RecurringProvider.wallet,
      planName: input.planName,
      billingCycle: input.billingCycle,
      intervalUnit: interval.unit,
      intervalCount: interval.count,
      amount: input.amount,
      status: RecurringStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd,
      nextChargeAt: currentPeriodEnd,
    });
    return { mandateId: mandate.id };
  }

  // ─── Mandate persistence ───────────────────────────────────────────────────

  /**
   * A new checkout for the same target replaces the old mandate. Cancel any
   * still-active provider subscription first so the user is never double-billed.
   */
  private async cancelStaleMandate(scopeKey: string): Promise<void> {
    const existing = await this.prisma.recurringSubscription.findUnique({ where: { scopeKey } });
    if (!existing) return;
    if (
      existing.status !== RecurringStatus.ACTIVE &&
      existing.status !== RecurringStatus.PAST_DUE &&
      existing.status !== RecurringStatus.INCOMPLETE
    ) {
      return;
    }
    if (existing.provider === RecurringProvider.stripe && existing.providerSubscriptionId) {
      await this.requireStripe()
        .subscriptions.cancel(existing.providerSubscriptionId)
        .catch((err) => this.logger.warn(`Could not cancel stale Stripe mandate ${existing.id}: ${err.message}`));
    } else if (existing.provider === RecurringProvider.paypal && existing.providerSubscriptionId) {
      const token = await this.getPayPalToken().catch(() => null);
      if (token) {
        await axios
          .post(
            `${this.paypalBaseUrl}/v1/billing/subscriptions/${existing.providerSubscriptionId}/cancel`,
            { reason: 'Replaced by a new checkout' },
            { headers: this.paypalHeaders(token) },
          )
          .catch((err) => this.logger.warn(`Could not cancel stale PayPal mandate ${existing.id}: ${err.message}`));
      }
    }
  }

  private async upsertMandate(
    data: Prisma.RecurringSubscriptionUncheckedCreateInput,
  ) {
    const graceDays = Number(this.config.get<string>('RENEWAL_GRACE_DAYS') ?? 3) || 3;
    return this.prisma.recurringSubscription.upsert({
      where: { scopeKey: data.scopeKey },
      create: { ...data, graceDays },
      update: {
        graceDays,
        provider: data.provider,
        providerCustomerId: data.providerCustomerId ?? undefined,
        providerSubscriptionId: data.providerSubscriptionId ?? undefined,
        providerPriceId: data.providerPriceId ?? undefined,
        providerPaymentIntentId: data.providerPaymentIntentId ?? undefined,
        planName: data.planName,
        billingCycle: data.billingCycle,
        intervalUnit: data.intervalUnit,
        intervalCount: data.intervalCount,
        amount: data.amount,
        status: data.status,
        autoRenew: true,
        cancelAtPeriodEnd: false,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        nextChargeAt: data.nextChargeAt,
        lastError: null,
        retryCount: 0,
        userId: data.userId ?? undefined,
      },
    });
  }

  async findByPaymentIntent(paymentIntentId: string) {
    if (!paymentIntentId) return null;
    return this.prisma.recurringSubscription.findUnique({
      where: { providerPaymentIntentId: paymentIntentId },
    });
  }

  async findByProviderSubscription(providerSubscriptionId: string) {
    if (!providerSubscriptionId) return null;
    return this.prisma.recurringSubscription.findUnique({
      where: { providerSubscriptionId },
    });
  }

  // ─── Activation + entitlement extension ────────────────────────────────────

  async confirmStripeSubscription(
    paymentIntentId: string,
    businessId: string,
    expected?: { scope?: RecurringScope; platform?: string; externalPlanId?: string },
  ) {
    const mandate = await this.findByPaymentIntent(paymentIntentId);
    if (!mandate) return null;
    if (mandate.businessId !== businessId) {
      throw new ForbiddenException('This subscription belongs to a different business.');
    }
    if (expected?.scope && mandate.scope !== expected.scope) {
      throw new BadRequestException('Subscription scope does not match this payment.');
    }
    if (
      expected?.platform &&
      mandate.platform &&
      expected.platform.toLowerCase() !== mandate.platform.toLowerCase()
    ) {
      throw new BadRequestException('Subscription platform does not match this payment.');
    }
    if (
      expected?.externalPlanId &&
      mandate.externalPlanId &&
      expected.externalPlanId !== mandate.externalPlanId
    ) {
      throw new BadRequestException('Subscription plan does not match this payment.');
    }

    const subscription = await this.requireStripe().subscriptions.retrieve(
      mandate.providerSubscriptionId!,
    );
    const status = String(subscription.status);
    if (status === 'incomplete' || status === 'incomplete_expired' || status === 'past_due') {
      throw new BadRequestException(`Subscription payment not completed. Status: ${status}`);
    }

    const periodStart = this.toDate((subscription as any).current_period_start) || new Date();
    const periodEnd =
      this.toDate((subscription as any).current_period_end) ||
      this.addInterval(periodStart, mandate.intervalUnit, mandate.intervalCount);

    const invoice = subscription.latest_invoice as any;
    const evidence: ChargeEvidence = {
      amount: invoice?.amount_paid ? Number(invoice.amount_paid) / 100 : mandate.amount,
      providerInvoiceId: invoice?.id ?? null,
      providerPaymentId:
        (typeof invoice?.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice?.payment_intent?.id) ?? paymentIntentId,
    };

    await this.activateMandate(mandate, { periodStart, periodEnd }, evidence);
    return this.resultForMandate(mandate);
  }

  async confirmPayPalSubscription(subscriptionId: string, businessId?: string) {
    const mandate = await this.findByProviderSubscription(subscriptionId);
    if (!mandate) return null;
    if (businessId && mandate.businessId !== businessId) {
      throw new ForbiddenException('This subscription belongs to a different business.');
    }

    const token = await this.getPayPalToken();
    const response = await axios.get(
      `${this.paypalBaseUrl}/v1/billing/subscriptions/${subscriptionId}`,
      { headers: this.paypalHeaders(token) },
    );
    const status = String(response.data?.status || '').toUpperCase();
    if (status !== 'ACTIVE') {
      if (status === 'APPROVAL_PENDING' || status === 'APPROVED') {
        // PayPal will flip this to ACTIVE and send BILLING.SUBSCRIPTION.ACTIVATED.
        return {
          pending: true,
          subscriptionId,
          status,
          message: 'PayPal is still activating this subscription. Access will update shortly.',
        };
      }
      throw new BadRequestException(`PayPal subscription is not active (status: ${status || 'unknown'}).`);
    }

    const now = new Date();
    const nextBilling = response.data?.billing_info?.next_billing_time
      ? new Date(response.data.billing_info.next_billing_time)
      : null;
    const period = this.paypalPeriod(mandate, nextBilling);

    await this.activateMandate(
      mandate,
      period,
      {
        amount: mandate.amount,
        providerInvoiceId: `paypal:${subscriptionId}:${period.periodEnd.toISOString()}`,
        providerPaymentId: `paypal:${subscriptionId}:${period.periodEnd.toISOString()}`,
      },
    );

    return this.resultForMandate(mandate);
  }

  /**
   * Preserve the existing activation response shape: a business profile for
   * memberships, the platform package for platform purchases.
   */
  private async resultForMandate(mandate: Record<string, any>) {
    if (mandate.scope === RecurringScope.MEMBERSHIP) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { id: mandate.businessId, deletedAt: null },
      });
      return { ...(business ?? { id: mandate.businessId }), recurring: true };
    }
    if (mandate.platform) {
      const pkg = await this.prisma.platformPackage.findUnique({
        where: {
          businessId_platform: { businessId: mandate.businessId, platform: mandate.platform },
        },
      });
      return { ...(pkg ?? { businessId: mandate.businessId, platform: mandate.platform }), recurring: true };
    }
    return this.prisma.recurringSubscription.findUnique({ where: { id: mandate.id } });
  }

  /**
   * Idempotently mark a period as paid and extend the entitlement.
   * Idempotency is guaranteed by BillingTransaction.providerPaymentId and the
   * RecurringCharge (subscriptionId, periodStart) unique constraint.
   */
  async activateMandate(
    mandate: any,
    period: MandatePeriod,
    evidence: ChargeEvidence,
  ) {
    const fresh = await this.prisma.recurringSubscription.findUnique({ where: { id: mandate.id } });
    if (!fresh) throw new NotFoundException('Recurring subscription not found');

    const wasActive = fresh.status === RecurringStatus.ACTIVE || fresh.status === RecurringStatus.PAST_DUE;
    const periodStart = period.periodStart;
    const periodEnd = period.periodEnd;
    const providerPaymentId =
      evidence.providerPaymentId ||
      `${fresh.provider}:${fresh.providerSubscriptionId || fresh.id}:${periodStart.toISOString()}`;

    const existingCharge = await this.prisma.recurringCharge.findUnique({
      where: {
        subscriptionId_periodStart: {
          subscriptionId: fresh.id,
          periodStart,
        },
      },
    });
    const alreadyApplied =
      existingCharge?.status === RecurringChargeStatus.PAID ||
      (await this.prisma.billingTransaction.findUnique({ where: { providerPaymentId } }));

    if (!alreadyApplied) {
      if (fresh.scope === RecurringScope.MEMBERSHIP) {
        await this.extendMembership(fresh, periodStart, periodEnd, evidence.amount, providerPaymentId);
      } else {
        await this.extendPlatform(fresh, periodStart, periodEnd, evidence.amount, providerPaymentId);
      }
    }

    await this.prisma.recurringCharge.upsert({
      where: {
        subscriptionId_periodStart: { subscriptionId: fresh.id, periodStart },
      },
      create: {
        subscriptionId: fresh.id,
        periodStart,
        periodEnd,
        amount: evidence.amount,
        currency: fresh.currency,
        status: RecurringChargeStatus.PAID,
        idempotencyKey: `renewal:${fresh.id}:${periodStart.toISOString()}`,
        providerInvoiceId: evidence.providerInvoiceId ?? null,
        providerPaymentId,
        paidAt: new Date(),
      },
      update: {
        periodEnd,
        amount: evidence.amount,
        status: RecurringChargeStatus.PAID,
        providerInvoiceId: evidence.providerInvoiceId ?? undefined,
        providerPaymentId,
        error: null,
        paidAt: new Date(),
      },
    });

    await this.prisma.recurringSubscription.update({
      where: { id: fresh.id },
      data: {
        status: RecurringStatus.ACTIVE,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        nextChargeAt: periodEnd,
        retryCount: 0,
        lastError: null,
        lastAttemptAt: new Date(),
      },
    });

    if (fresh.scope === RecurringScope.MEMBERSHIP) {
      await this.prisma.businessProfile.updateMany({
        where: { id: fresh.businessId },
        data: { membershipStatus: MembershipStatus.active },
      });
    } else if (fresh.platform) {
      await this.prisma.platformPackage.updateMany({
        where: { businessId: fresh.businessId, platform: fresh.platform },
        data: {
          status: 'active',
          autoRenew: true,
          expiresAt: periodEnd,
          nextChargeAt: periodEnd,
          provider: fresh.provider,
          providerSubscriptionId: fresh.providerSubscriptionId ?? undefined,
          amount: evidence.amount,
        },
      });
      await this.dispatchPlatformEvent(wasActive ? 'package.renewed' : 'package.created', fresh);
    }

    return fresh;
  }

  private async extendMembership(
    mandate: Record<string, any>,
    periodStart: Date,
    periodEnd: Date,
    amount: number,
    providerPaymentId: string,
  ) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: mandate.businessId, deletedAt: null },
      include: { user: { select: { id: true } } },
    });
    if (!business) throw new NotFoundException('Business profile not found');

    const level = this.membershipLevel(String(mandate.level || 'Bronze'));
    const tier = this.canonicalTier(String(mandate.membershipTier || 'Standard'));
    const expiresAt =
      business.membershipExpiresAt && business.membershipExpiresAt > periodEnd
        ? business.membershipExpiresAt
        : periodEnd;

    await this.prisma.$transaction(async (tx) => {
      const already = await tx.billingTransaction.findUnique({ where: { providerPaymentId } });
      if (already) return;

      await tx.businessProfile.update({
        where: { id: business.id },
        data: {
          membershipLevel: level,
          membershipTier: tier,
          membershipStatus: MembershipStatus.active,
          membershipPlanName: mandate.membershipPlanName || business.membershipPlanName,
          membershipExpiresAt: expiresAt,
          membershipRecurringId: mandate.id,
        },
      });

      await tx.ecosystemSubscription.create({
        data: {
          businessId: business.id,
          businessName: business.businessName,
          type: 'Membership',
          itemName: `${mandate.membershipPlanName || mandate.planName} (${mandate.membershipTier || 'Standard'})`,
          status: 'Active',
          startDate: periodStart,
          endDate: periodEnd,
          amount,
          billingCycle: mandate.billingCycle,
        },
      });

      await tx.billingTransaction.create({
        data: {
          businessId: business.id,
          amount,
          description: `MCOM ${mandate.membershipPlanName || mandate.planName} — auto-renewal`,
          status: 'paid',
          provider: mandate.provider,
          providerPaymentId,
        },
      });
    });
  }

  private async extendPlatform(
    mandate: Record<string, any>,
    periodStart: Date,
    periodEnd: Date,
    amount: number,
    providerPaymentId: string,
  ) {
    const existing = await this.prisma.platformPackage.findUnique({
      where: {
        businessId_platform: { businessId: mandate.businessId, platform: mandate.platform },
      },
    });

    let planLimits: any = existing?.limits ?? {};
    let planType = existing?.planType ?? 'STANDARD';
    try {
      const plan = await this.connectorsService.getPlanById(
        mandate.platform,
        mandate.externalPlanId,
      );
      if (plan) {
        planLimits = plan.configuration?.quotas ?? planLimits;
        planType = plan.type || planType;
      }
    } catch (err) {
      this.logger.warn(
        `Could not refresh external plan ${mandate.platform}/${mandate.externalPlanId} during renewal: ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const already = await tx.billingTransaction.findUnique({ where: { providerPaymentId } });
      if (already) return;

      const pkg = await tx.platformPackage.upsert({
        where: {
          businessId_platform: { businessId: mandate.businessId, platform: mandate.platform },
        },
        create: {
          businessId: mandate.businessId,
          platform: mandate.platform,
          packageName: mandate.planName,
          status: 'active',
          externalPlanId: mandate.externalPlanId,
          planName: mandate.planName,
          planType,
          expiresAt: periodEnd,
          provider: mandate.provider,
          providerSubscriptionId: mandate.providerSubscriptionId ?? undefined,
          autoRenew: true,
          nextChargeAt: periodEnd,
          amount,
          currency: mandate.currency || 'GBP',
          billingCycle: mandate.billingCycle,
          limits: planLimits,
        },
        update: {
          packageName: mandate.planName,
          status: 'active',
          externalPlanId: mandate.externalPlanId,
          planName: mandate.planName,
          planType,
          expiresAt: periodEnd,
          provider: mandate.provider,
          providerSubscriptionId: mandate.providerSubscriptionId ?? undefined,
          autoRenew: true,
          nextChargeAt: periodEnd,
          amount,
          billingCycle: mandate.billingCycle,
          limits: planLimits,
        },
      });

      await tx.billingTransaction.create({
        data: {
          businessId: mandate.businessId,
          amount,
          description: `MCOM ${mandate.platform} — ${mandate.planName} (auto-renewal)`,
          status: 'paid',
          provider: mandate.provider,
          providerPaymentId,
          platformPackageId: pkg.id,
        },
      });
    });
  }

  // ─── Wallet charging ───────────────────────────────────────────────────────

  async attemptWalletRenewal(mandateId: string): Promise<{ charged: boolean; reason?: string }> {
    const mandate = await this.prisma.recurringSubscription.findUnique({
      where: { id: mandateId },
    });
    if (!mandate) throw new NotFoundException('Recurring subscription not found');
    if (mandate.provider !== RecurringProvider.wallet) {
      throw new BadRequestException('Only wallet mandates can be charged locally.');
    }
    if (!mandate.autoRenew || mandate.status === RecurringStatus.CANCELED || mandate.status === RecurringStatus.EXPIRED) {
      return { charged: false, reason: 'MANDATE_INACTIVE' };
    }

    const userId =
      mandate.userId ||
      (
        await this.prisma.businessProfile.findUnique({
          where: { id: mandate.businessId },
          select: { userId: true },
        })
      )?.userId;
    if (!userId) {
      await this.markPastDue(mandate.id, 'No user linked to this business');
      return { charged: false, reason: 'NO_USER' };
    }

    const periodStart = mandate.currentPeriodEnd ?? new Date();
    const periodEnd = this.addInterval(periodStart, mandate.intervalUnit, mandate.intervalCount);
    const key = `renewal:${mandate.id}:${periodStart.toISOString()}`;

    try {
      const receipt = await this.walletService.debitWallet(
        INTERNAL_WALLET_PARTNER,
        {
          userId,
          amount: mandate.amount,
          category: TransactionCategory.SUBSCRIPTION,
          description: `${mandate.planName} — auto-renewal`,
          reference: mandate.id,
          metadata: { subscriptionId: mandate.id, scope: mandate.scope },
        },
        key,
      );

      await this.activateMandate(mandate, { periodStart, periodEnd }, {
        amount: mandate.amount,
        providerInvoiceId: `wallet:${mandate.id}:${periodStart.toISOString()}`,
        providerPaymentId: receipt.transactionId,
      });
      return { charged: true };
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Wallet debit failed';
      await this.markPastDue(mandate.id, message);
      await this.notify(
        mandate,
        'Auto-renewal failed',
        `We could not charge your MCOM wallet for ${mandate.planName}. Top up to keep your subscription active.`,
      );
      return { charged: false, reason: message };
    }
  }

  private async markPastDue(mandateId: string, error: string) {
    await this.prisma.recurringSubscription.update({
      where: { id: mandateId },
      data: {
        status: RecurringStatus.PAST_DUE,
        retryCount: { increment: 1 },
        lastAttemptAt: new Date(),
        lastError: error.slice(0, 500),
        nextChargeAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id: mandateId } });
    if (mandate?.scope === RecurringScope.MEMBERSHIP) {
      await this.prisma.businessProfile.updateMany({
        where: { id: mandate.businessId, membershipRecurringId: mandate.id },
        data: { membershipStatus: MembershipStatus.past_due },
      });
    }
  }

  // ─── Scheduler entry points ────────────────────────────────────────────────

  /** Wallet mandates due now are charged; provider mandates are reconciled. */
  async processDueRenewals(): Promise<void> {
    if (!this.isEnabled()) return;
    const now = new Date();
    const lookahead = new Date(now.getTime() + 5 * 60_000);

    const due = await this.prisma.recurringSubscription.findMany({
      where: {
        autoRenew: true,
        status: { in: [RecurringStatus.ACTIVE, RecurringStatus.PAST_DUE] },
        nextChargeAt: { lte: lookahead },
      },
      orderBy: { nextChargeAt: 'asc' },
      take: 100,
    });

    for (const mandate of due) {
      try {
        if (mandate.provider === RecurringProvider.wallet) {
          await this.attemptWalletRenewal(mandate.id);
        } else {
          await this.reconcileProviderMandate(mandate.id);
        }
      } catch (err) {
        this.logger.error(
          `Renewal processing failed for ${mandate.id}: ${err instanceof Error ? err.message : err}`,
        );
        await this.prisma.recurringSubscription
          .update({
            where: { id: mandate.id },
            data: {
              lastAttemptAt: new Date(),
              lastError: (err instanceof Error ? err.message : String(err)).slice(0, 500),
            },
          })
          .catch(() => undefined);
      }
    }
  }

  async reconcileProviderMandate(mandateId: string): Promise<void> {
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id: mandateId } });
    if (!mandate) return;
    if (mandate.provider === RecurringProvider.stripe) return this.reconcileStripe(mandate);
    if (mandate.provider === RecurringProvider.paypal) return this.reconcilePayPal(mandate);
  }

  /** Cron helper: ids of provider-backed mandates that should be reconciled. */
  async listProviderMandateIds(limit = 500): Promise<string[]> {
    const rows = await this.prisma.recurringSubscription.findMany({
      where: {
        autoRenew: true,
        status: { in: [RecurringStatus.ACTIVE, RecurringStatus.PAST_DUE] },
        provider: { in: [RecurringProvider.stripe, RecurringProvider.paypal] },
      },
      select: { id: true },
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  private async reconcileStripe(mandate: Record<string, any>) {
    if (!mandate.providerSubscriptionId) return;
    const subscription: any = await this.requireStripe().subscriptions.retrieve(
      mandate.providerSubscriptionId,
    );
    const status = String(subscription.status);
    const periodEnd = this.toDate(subscription.current_period_end);

    if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
      await this.expireMandate(mandate.id, `Stripe subscription ${status}`);
      return;
    }
    if (status === 'past_due' || status === 'incomplete') {
      await this.markPastDue(mandate.id, `Stripe subscription ${status}`);
      return;
    }

    if (periodEnd && periodEnd.getTime() > (mandate.currentPeriodEnd?.getTime() ?? 0)) {
      const invoice = subscription.latest_invoice;
      const invoiceObj = typeof invoice === 'string' ? null : invoice;
      const invoicePaid = invoiceObj?.status === 'paid';
      if (!invoicePaid) {
        // Provider is still collecting this cycle; do not grant access yet.
        if (mandate.currentPeriodEnd && mandate.currentPeriodEnd < new Date()) {
          await this.markPastDue(mandate.id, 'Invoice not paid yet');
        }
        return;
      }
      const periodStart = this.toDate(subscription.current_period_start) || mandate.currentPeriodEnd || new Date();
      await this.activateMandate(mandate, { periodStart, periodEnd }, {
        amount: invoiceObj?.amount_paid ? Number(invoiceObj.amount_paid) / 100 : mandate.amount,
        providerInvoiceId: invoiceObj?.id ?? null,
        providerPaymentId:
          (typeof invoiceObj?.payment_intent === 'string'
            ? invoiceObj.payment_intent
            : invoiceObj?.payment_intent?.id) ?? `stripe:${mandate.providerSubscriptionId}:${periodEnd.toISOString()}`,
      });
      return;
    }

    await this.prisma.recurringSubscription.update({
      where: { id: mandate.id },
      data: {
        status: RecurringStatus.ACTIVE,
        nextChargeAt: periodEnd ?? mandate.nextChargeAt,
        lastError: null,
      },
    });
  }

  private async reconcilePayPal(mandate: Record<string, any>) {
    if (!mandate.providerSubscriptionId) return;
    const token = await this.getPayPalToken();
    const response = await axios.get(
      `${this.paypalBaseUrl}/v1/billing/subscriptions/${mandate.providerSubscriptionId}`,
      { headers: this.paypalHeaders(token) },
    );
    const status = String(response.data?.status || '').toUpperCase();
    const nextBilling = response.data?.billing_info?.next_billing_time
      ? new Date(response.data.billing_info.next_billing_time)
      : null;

    if (['CANCELLED', 'EXPIRED'].includes(status)) {
      await this.expireMandate(mandate.id, `PayPal subscription ${status}`);
      return;
    }
    if (status === 'SUSPENDED') {
      await this.markPastDue(mandate.id, 'PayPal subscription SUSPENDED');
      return;
    }
    if (status !== 'ACTIVE') {
      await this.markPastDue(mandate.id, `PayPal subscription ${status || 'unknown'}`);
      return;
    }

    if (nextBilling && nextBilling.getTime() > (mandate.currentPeriodEnd?.getTime() ?? 0)) {
      const periodStart = mandate.currentPeriodEnd ?? new Date();
      const periodEnd = nextBilling;
      await this.activateMandate(mandate, { periodStart, periodEnd }, {
        amount: mandate.amount,
        providerInvoiceId: `paypal:${mandate.providerSubscriptionId}:${periodEnd.toISOString()}`,
        providerPaymentId: `paypal:${mandate.providerSubscriptionId}:${periodEnd.toISOString()}`,
      });
      return;
    }

    await this.prisma.recurringSubscription.update({
      where: { id: mandate.id },
      data: {
        status: RecurringStatus.ACTIVE,
        nextChargeAt: nextBilling ?? mandate.nextChargeAt,
        lastError: null,
      },
    });
  }

  async expireLapsedSubscriptions(): Promise<void> {
    if (!this.isEnabled()) return;
    const now = new Date();
    const candidates = await this.prisma.recurringSubscription.findMany({
      where: {
        status: { in: [RecurringStatus.ACTIVE, RecurringStatus.PAST_DUE] },
        currentPeriodEnd: { lt: now },
      },
      take: 100,
    });

    for (const mandate of candidates) {
      // Non-charging mirrors created by the backfill script must never revoke
      // access — they are display-only.
      if ((mandate.metadata as any)?.nonCharging) continue;
      const graceEnds = new Date(
        (mandate.currentPeriodEnd?.getTime() ?? now.getTime()) + mandate.graceDays * 24 * 3600_000,
      );
      if (graceEnds > now) continue;

      if (mandate.provider !== RecurringProvider.wallet) {
        try {
          await this.reconcileProviderMandate(mandate.id);
        } catch (err) {
          this.logger.warn(
            `Reconcile before expiry failed for ${mandate.id}: ${err instanceof Error ? err.message : err}`,
          );
        }
        const fresh = await this.prisma.recurringSubscription.findUnique({ where: { id: mandate.id } });
        if (!fresh || !fresh.currentPeriodEnd || fresh.currentPeriodEnd.getTime() > now.getTime()) {
          continue;
        }
      }

      await this.expireMandate(mandate.id, 'Term ended without a successful renewal');
    }
  }

  async expireMandate(mandateId: string, reason: string): Promise<void> {
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id: mandateId } });
    if (!mandate || mandate.status === RecurringStatus.EXPIRED) return;

    await this.prisma.recurringSubscription.update({
      where: { id: mandate.id },
      data: {
        status: RecurringStatus.EXPIRED,
        autoRenew: false,
        lastError: reason.slice(0, 500),
      },
    });

    if (mandate.scope === RecurringScope.MEMBERSHIP) {
      await this.prisma.businessProfile.updateMany({
        where: { id: mandate.businessId, membershipRecurringId: mandate.id },
        data: { membershipStatus: MembershipStatus.inactive },
      });
      await this.notify(
        mandate,
        'Subscription expired',
        `${mandate.planName} has expired. Renew from your dashboard to restore access.`,
      );
    } else if (mandate.platform) {
      await this.prisma.platformPackage.updateMany({
        where: { businessId: mandate.businessId, platform: mandate.platform },
        data: { status: 'expired', autoRenew: false },
      });
      await this.dispatchPlatformEvent('package.expired', mandate);
    }
  }

  private async dispatchPlatformEvent(
    event: 'package.created' | 'package.renewed' | 'package.expired' | 'package.cancelled',
    mandate: Record<string, any>,
  ) {
    try {
      const business = await this.prisma.businessProfile.findUnique({
        where: { id: mandate.businessId },
        select: { userId: true },
      });
      const pkg = await this.prisma.platformPackage.findUnique({
        where: { businessId_platform: { businessId: mandate.businessId, platform: mandate.platform } },
      });
      if (!pkg || !mandate.platform) return;
      await this.webhookDispatcher.dispatchPackageEvent(event, {
        platform: mandate.platform,
        userId: business?.userId ?? '',
        package: pkg,
      });
    } catch (err) {
      this.logger.warn(
        `Could not dispatch ${event} for ${mandate.platform}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async notify(mandate: Record<string, any>, title: string, message: string) {
    try {
      const business = await this.prisma.businessProfile.findUnique({
        where: { id: mandate.businessId },
        select: { userId: true },
      });
      await this.notificationService.createNotification({
        businessId: mandate.businessId,
        userId: business?.userId ?? undefined,
        type: 'payment',
        title,
        message,
      });
    } catch (err) {
      this.logger.warn(`Could not create renewal notification: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── Webhooks ──────────────────────────────────────────────────────────────

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    if (event.type === 'invoice.paid') {
      const invoice: any = event.data.object;
      const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) return;
      const mandate = await this.findByProviderSubscription(subscriptionId);
      if (!mandate) return;
      const periodStart = this.toDate(invoice.period_start) || mandate.currentPeriodEnd || new Date();
      const periodEnd =
        this.toDate(invoice.period_end) ||
        this.addInterval(periodStart, mandate.intervalUnit, mandate.intervalCount);
      const paymentIntentId =
        typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent?.id;
      await this.activateMandate(mandate, { periodStart, periodEnd }, {
        amount: Number(invoice.amount_paid || 0) / 100 || mandate.amount,
        providerInvoiceId: invoice.id,
        providerPaymentId: paymentIntentId || invoice.id,
      });
      return;
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice: any = event.data.object;
      const subscriptionId =
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) return;
      const mandate = await this.findByProviderSubscription(subscriptionId);
      if (!mandate) return;
      await this.markPastDue(
        mandate.id,
        invoice.last_finalization_error?.message || 'Stripe invoice payment failed',
      );
      await this.notify(
        mandate,
        'Payment failed',
        `We could not renew ${mandate.planName}. Please update your payment method.`,
      );
      return;
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription: any = event.data.object;
      const mandate = await this.findByProviderSubscription(subscription.id);
      if (!mandate) return;
      const status = String(subscription.status);
      if (status === 'past_due' || status === 'unpaid') {
        await this.markPastDue(mandate.id, `Stripe subscription ${status}`);
        return;
      }
      if (status === 'canceled') {
        await this.expireMandate(mandate.id, 'Stripe subscription canceled');
        return;
      }
      await this.prisma.recurringSubscription.update({
        where: { id: mandate.id },
        data: {
          cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
          status: status === 'active' ? RecurringStatus.ACTIVE : mandate.status,
          currentPeriodStart: this.toDate(subscription.current_period_start) ?? mandate.currentPeriodStart,
          currentPeriodEnd: this.toDate(subscription.current_period_end) ?? mandate.currentPeriodEnd,
          nextChargeAt: this.toDate(subscription.current_period_end) ?? mandate.nextChargeAt,
        },
      });
      return;
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription: any = event.data.object;
      const mandate = await this.findByProviderSubscription(subscription.id);
      if (!mandate) return;
      await this.expireMandate(mandate.id, 'Stripe subscription deleted');
    }
  }

  async handlePayPalWebhook(rawBody: string | Buffer, headers: Record<string, any>): Promise<{ received: boolean }> {
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    let event: any;
    try {
      event = JSON.parse(body);
    } catch {
      throw new BadRequestException('Invalid PayPal webhook body.');
    }

    const verified = await this.verifyPayPalWebhook(headers, event);
    if (!verified) {
      throw new UnauthorizedException('Invalid PayPal webhook signature.');
    }

    const type = String(event.event_type || '');
    const resource = event.resource || {};

    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const mandate = await this.findByProviderSubscription(resource.id);
      if (!mandate) return { received: true };
      const nextBilling = resource.billing_info?.next_billing_time
        ? new Date(resource.billing_info.next_billing_time)
        : null;
      const period = this.paypalPeriod(mandate, nextBilling);
      await this.activateMandate(mandate, period, {
        amount: mandate.amount,
        providerInvoiceId: `paypal:${resource.id}:${period.periodEnd.toISOString()}`,
        providerPaymentId: `paypal:${resource.id}:${period.periodEnd.toISOString()}`,
      });
      return { received: true };
    }

    if (type === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = resource.billing_agreement_id;
      if (!subscriptionId) return { received: true };
      const mandate = await this.findByProviderSubscription(subscriptionId);
      if (!mandate) return { received: true };
      const period = this.paypalPeriod(mandate);
      const amount = Number(resource.amount?.total ?? mandate.amount);
      await this.activateMandate(mandate, period, {
        amount: Number.isFinite(amount) ? amount : mandate.amount,
        providerInvoiceId: `paypal:${subscriptionId}:${period.periodEnd.toISOString()}`,
        providerPaymentId: resource.id || `paypal:${subscriptionId}:${period.periodEnd.toISOString()}`,
      });
      return { received: true };
    }

    if (type === 'PAYMENT.SALE.DENIED' || type === 'PAYMENT.SALE.REFUNDED') {
      const subscriptionId = resource.billing_agreement_id;
      if (!subscriptionId) return { received: true };
      const mandate = await this.findByProviderSubscription(subscriptionId);
      if (!mandate) return { received: true };
      await this.markPastDue(mandate.id, `PayPal payment ${type}`);
      await this.notify(
        mandate,
        'Payment failed',
        `We could not renew ${mandate.planName}. Please update your payment method.`,
      );
      return { received: true };
    }

    if (
      ['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED'].includes(type)
    ) {
      const mandate = await this.findByProviderSubscription(resource.id);
      if (!mandate) return { received: true };
      await this.expireMandate(mandate.id, `PayPal ${type}`);
    }

    if (type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      const mandate = await this.findByProviderSubscription(resource.id);
      if (!mandate) return { received: true };
      await this.markPastDue(mandate.id, 'PayPal subscription suspended');
    }

    return { received: true };
  }

  private async verifyPayPalWebhook(headers: Record<string, any>, event: any): Promise<boolean> {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        this.logger.error('PAYPAL_WEBHOOK_ID is not configured — rejecting PayPal webhook.');
        return false;
      }
      this.logger.warn('PAYPAL_WEBHOOK_ID not set — skipping signature verification in development.');
      return true;
    }

    try {
      const token = await this.getPayPalToken();
      const response = await axios.post(
        `${this.paypalBaseUrl}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: event,
        },
        { headers: this.paypalHeaders(token) },
      );
      return response.data?.verification_status === 'SUCCESS';
    } catch (err: any) {
      this.logger.warn(`PayPal webhook verification failed: ${err?.message}`);
      return false;
    }
  }

  // ─── User / admin operations ───────────────────────────────────────────────

  /**
   * Enable wallet auto-debit for an existing membership or platform package.
   * No upfront charge: the first debit happens at the current expiry.
   */
  async enableWalletAutoRenew(
    businessId: string,
    userId: string | undefined,
    input: {
      scope: RecurringScope;
      billingCycle: string;
      platform?: string;
    },
  ) {
    if (!this.isEnabled()) throw new BadRequestException('Recurring payments are not enabled.');
    const now = new Date();
    const billingCycle = String(input.billingCycle || 'monthly').toLowerCase();
    if (!['monthly', 'quarterly', 'annual', 'yearly'].includes(billingCycle)) {
      throw new BadRequestException('billingCycle must be monthly, quarterly or annual.');
    }

    let periodEnd: Date | null = null;
    let planId: string | undefined;
    let planName: string;
    let amount: number;
    let durationDays: number;
    let level: string | undefined;
    let tier: string | undefined;
    let platform: string | undefined;
    let externalPlanId: string | undefined;

    if (input.scope === RecurringScope.MEMBERSHIP) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { id: businessId, deletedAt: null },
        select: {
          membershipExpiresAt: true,
          membershipPlanName: true,
          membershipTier: true,
        },
      });
      if (!business?.membershipPlanName) {
        throw new BadRequestException('No active membership to enable auto-renew on.');
      }
      if (!business.membershipExpiresAt || business.membershipExpiresAt <= now) {
        throw new BadRequestException(
          'Your membership has expired. Start a new checkout to renew.',
        );
      }
      // Price is always resolved server-side — never trust a client amount.
      const quote = await this.pricingService.resolveMembershipCharge(
        business.membershipPlanName,
        business.membershipTier || 'Standard',
        billingCycle === 'quarterly'
          ? 'quarterly'
          : billingCycle === 'annual' || billingCycle === 'yearly'
            ? 'yearly'
            : 'monthly',
        'full',
      );
      periodEnd = business.membershipExpiresAt;
      planId = quote.planId;
      planName = quote.planName;
      amount = quote.finalAmount;
      durationDays = quote.sliceDays;
      level = quote.planName;
      tier = quote.tier;
    } else {
      if (!input.platform) throw new BadRequestException('platform is required for platform auto-renew.');
      const pkg = await this.prisma.platformPackage.findUnique({
        where: { businessId_platform: { businessId, platform: input.platform } },
      });
      if (!pkg || pkg.status !== 'active') {
        throw new BadRequestException('No active platform package to enable auto-renew on.');
      }
      if (!pkg.expiresAt || pkg.expiresAt <= now) {
        throw new BadRequestException('This platform package has expired. Start a new checkout to renew.');
      }
      if (!pkg.externalPlanId) {
        throw new BadRequestException('This package has no external plan id; cannot set up auto-renew.');
      }
      platform = pkg.platform;
      externalPlanId = pkg.externalPlanId;
      periodEnd = pkg.expiresAt;
      planName = pkg.planName || pkg.packageName;
      amount = Number(pkg.amount || 0);
      const effectiveCycle = (pkg.billingCycle || billingCycle).toLowerCase();
      durationDays = effectiveCycle === 'quarterly' ? 90 : effectiveCycle.startsWith('annual') || effectiveCycle === 'yearly' ? 365 : 30;

      try {
        const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
        const serverPrice =
          effectiveCycle === 'monthly'
            ? plan.monthlyPrice
            : effectiveCycle === 'quarterly'
              ? plan.quarterlyPrice
              : plan.annualPrice;
        if (serverPrice != null && Number(serverPrice) > 0) amount = Number(serverPrice);
        planName = plan.name || planName;
      } catch (err) {
        this.logger.warn(
          `Could not refresh platform plan ${platform}/${externalPlanId} for wallet auto-renew: ${
            err instanceof Error ? err.message : err
          }`,
        );
        if (!(amount > 0)) {
          throw new BadRequestException('This package has no renewal price configured.');
        }
      }
    }

    if (!(amount > 0)) {
      throw new BadRequestException('This plan has no renewable price.');
    }

    const effectiveEnd = periodEnd;
    const result = await this.createWalletMandate({
      scope: input.scope,
      businessId,
      userId,
      membershipPlanId: planId,
      membershipPlanName: planName,
      membershipTier: tier,
      level,
      platform,
      externalPlanId,
      planName,
      amount,
      billingCycle,
      durationDays,
      nextChargeAt: effectiveEnd,
    });

    if (input.scope === RecurringScope.MEMBERSHIP) {
      await this.prisma.businessProfile.updateMany({
        where: { id: businessId },
        data: { membershipRecurringId: result.mandateId },
      });
    } else if (platform) {
      await this.prisma.platformPackage.updateMany({
        where: { businessId, platform },
        data: { autoRenew: true, nextChargeAt: effectiveEnd },
      });
    }

    return result;
  }

  async listForBusiness(businessId: string) {
    const mandates = await this.prisma.recurringSubscription.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        charges: { orderBy: { periodStart: 'desc' }, take: 6 },
      },
    });
    return mandates.map((m) => this.serialize(m));
  }

  async listForAdmin(query: { status?: string; provider?: string; take?: number } = {}) {
    const status = query.status
      ? (Object.values(RecurringStatus).includes(query.status.toUpperCase() as RecurringStatus)
          ? (query.status.toUpperCase() as RecurringStatus)
          : undefined)
      : undefined;
    const provider = query.provider
      ? (Object.values(RecurringProvider).includes(query.provider.toLowerCase() as RecurringProvider)
          ? (query.provider.toLowerCase() as RecurringProvider)
          : undefined)
      : undefined;

    const rows = await this.prisma.recurringSubscription.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(provider ? { provider } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(Number(query.take) || 100, 1), 250),
      include: {
        charges: { orderBy: { periodStart: 'desc' }, take: 3 },
      },
    });
    return rows.map((m) => this.serialize(m));
  }

  async metrics() {
    const [active, pastDue, canceled, expired, activeRows] = await Promise.all([
      this.prisma.recurringSubscription.count({ where: { status: RecurringStatus.ACTIVE } }),
      this.prisma.recurringSubscription.count({ where: { status: RecurringStatus.PAST_DUE } }),
      this.prisma.recurringSubscription.count({ where: { status: RecurringStatus.CANCELED } }),
      this.prisma.recurringSubscription.count({ where: { status: RecurringStatus.EXPIRED } }),
      this.prisma.recurringSubscription.findMany({
        where: { status: RecurringStatus.ACTIVE },
        select: { amount: true, intervalUnit: true, intervalCount: true },
      }),
    ]);

    const monthlyRecurringRevenue = activeRows.reduce((sum, row) => {
      const months = row.intervalUnit === 'year' ? row.intervalCount * 12 : row.intervalUnit === 'week' ? row.intervalCount / 4 : row.intervalUnit === 'day' ? row.intervalCount / 30 : row.intervalCount;
      return sum + row.amount / Math.max(months, 1);
    }, 0);

    return {
      active,
      pastDue,
      canceled,
      expired,
      monthlyRecurringRevenue: Math.round(monthlyRecurringRevenue * 100) / 100,
    };
  }

  async getForBusiness(id: string, businessId: string) {
    const mandate = await this.prisma.recurringSubscription.findFirst({
      where: { id, businessId },
      include: { charges: { orderBy: { periodStart: 'desc' } } },
    });
    if (!mandate) throw new NotFoundException('Recurring subscription not found');
    return this.serialize(mandate);
  }

  async cancel(id: string, businessId: string | undefined, immediate = false, isAdmin = false) {
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id } });
    if (!mandate) throw new NotFoundException('Recurring subscription not found');
    if (!isAdmin && mandate.businessId !== businessId) {
      throw new ForbiddenException('This subscription belongs to a different business.');
    }

    if (mandate.provider === RecurringProvider.stripe) {
      if (immediate) {
        await this.requireStripe()
          .subscriptions.cancel(mandate.providerSubscriptionId!)
          .catch((err) => this.logger.warn(`Stripe immediate cancel failed for ${mandate.id}: ${err.message}`));
      } else {
        await this.requireStripe().subscriptions.update(mandate.providerSubscriptionId!, {
          cancel_at_period_end: true,
        });
      }
    } else if (mandate.provider === RecurringProvider.paypal && mandate.providerSubscriptionId) {
      const token = await this.getPayPalToken();
      await axios
        .post(
          `${this.paypalBaseUrl}/v1/billing/subscriptions/${mandate.providerSubscriptionId}/cancel`,
          { reason: 'Customer requested cancellation' },
          { headers: this.paypalHeaders(token) },
        )
        .catch((err) => {
          this.logger.warn(`PayPal cancel failed for ${mandate.id}: ${err?.message}`);
        });
    }

    const status = immediate ? RecurringStatus.CANCELED : mandate.status;
    const updated = await this.prisma.recurringSubscription.update({
      where: { id },
      data: {
        autoRenew: false,
        cancelAtPeriodEnd: !immediate,
        status,
      },
    });

    if (immediate) {
      await this.expireMandate(mandate.id, 'Canceled by request');
    } else {
      if (mandate.scope === RecurringScope.PLATFORM && mandate.platform) {
        await this.prisma.platformPackage.updateMany({
          where: { businessId: mandate.businessId, platform: mandate.platform },
          data: { autoRenew: false },
        });
        await this.dispatchPlatformEvent('package.cancelled', mandate);
      }
      if (mandate.provider === RecurringProvider.wallet && mandate.currentPeriodEnd) {
        await this.prisma.businessProfile.updateMany({
          where: { id: mandate.businessId, membershipRecurringId: mandate.id },
          data: { membershipStatus: MembershipStatus.active },
        });
      }
    }

    return this.serialize(updated);
  }

  async resume(id: string, businessId: string | undefined, isAdmin = false) {
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id } });
    if (!mandate) throw new NotFoundException('Recurring subscription not found');
    if (!isAdmin && mandate.businessId !== businessId) {
      throw new ForbiddenException('This subscription belongs to a different business.');
    }
    if (mandate.status === RecurringStatus.EXPIRED || mandate.status === RecurringStatus.CANCELED) {
      throw new BadRequestException('This subscription has ended. Please start a new checkout to renew.');
    }
    if (mandate.provider === RecurringProvider.paypal && mandate.cancelAtPeriodEnd) {
      throw new BadRequestException(
        'PayPal cancellations cannot be undone. Please start a new checkout to renew.',
      );
    }

    if (mandate.provider === RecurringProvider.stripe && mandate.providerSubscriptionId) {
      await this.requireStripe().subscriptions.update(mandate.providerSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    return this.serialize(
      await this.prisma.recurringSubscription.update({
        where: { id },
        data: { autoRenew: true, cancelAtPeriodEnd: false },
      }),
    );
  }

  async setAutoRenew(id: string, businessId: string | undefined, enabled: boolean, isAdmin = false) {
    if (!enabled) return this.cancel(id, businessId, false, isAdmin);
    return this.resume(id, businessId, isAdmin);
  }

  async retry(id: string) {
    const mandate = await this.prisma.recurringSubscription.findUnique({ where: { id } });
    if (!mandate) throw new NotFoundException('Recurring subscription not found');
    if (mandate.provider === RecurringProvider.wallet) {
      return this.attemptWalletRenewal(id);
    }
    await this.reconcileProviderMandate(id);
    return { retried: true };
  }

  /** Backfill: every existing active subscription becomes a non-charging mirror. */
  async backfillExistingSubscriptions(): Promise<{ created: number }> {
    const businesses = await this.prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        membershipPlanName: { not: null },
        membershipExpiresAt: { not: null },
      },
      select: {
        id: true,
        userId: true,
        membershipPlanName: true,
        membershipTier: true,
        membershipLevel: true,
        membershipExpiresAt: true,
      },
    });

    let created = 0;
    for (const business of businesses) {
      const scopeKey = `membership:${business.id}`;
      const existing = await this.prisma.recurringSubscription.findUnique({ where: { scopeKey } });
      if (existing) continue;
      await this.prisma.recurringSubscription.create({
        data: {
          scopeKey,
          scope: RecurringScope.MEMBERSHIP,
          businessId: business.id,
          userId: business.userId,
          membershipPlanName: business.membershipPlanName,
          membershipTier: business.membershipTier || 'Standard',
          level: business.membershipLevel,
          provider: RecurringProvider.wallet,
          planName: business.membershipPlanName || 'Membership',
          billingCycle: 'legacy',
          intervalUnit: 'day',
          intervalCount: 1,
          amount: 0,
          status: RecurringStatus.ACTIVE,
          autoRenew: false,
          currentPeriodStart: new Date(),
          currentPeriodEnd: business.membershipExpiresAt,
          nextChargeAt: business.membershipExpiresAt,
          metadata: { backfilled: true, nonCharging: true },
        },
      });
      created += 1;
    }
    return { created };
  }

  private serialize(m: any) {
    return {
      id: m.id,
      scope: m.scope,
      businessId: m.businessId,
      provider: m.provider,
      planName: m.planName,
      level: m.level,
      tier: m.membershipTier,
      platform: m.platform,
      externalPlanId: m.externalPlanId,
      billingCycle: m.billingCycle,
      interval: { unit: m.intervalUnit, count: m.intervalCount },
      amount: m.amount,
      currency: m.currency,
      status: m.status,
      autoRenew: m.autoRenew,
      cancelAtPeriodEnd: m.cancelAtPeriodEnd,
      currentPeriodStart: m.currentPeriodStart,
      currentPeriodEnd: m.currentPeriodEnd,
      nextChargeAt: m.nextChargeAt,
      retryCount: m.retryCount,
      lastError: m.lastError,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      charges: m.charges?.map((c: any) => ({
        id: c.id,
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        amount: c.amount,
        status: c.status,
        error: c.error,
        paidAt: c.paidAt,
      })),
    };
  }
}
