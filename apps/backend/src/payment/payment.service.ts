import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import axios from 'axios';
import { PricingService, MEMBERSHIP_PLANS } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceConnectorsService } from '../service-connectors/service-connectors.service';

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private paypalBaseUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private pricingService: PricingService,
    private connectorsService: ServiceConnectorsService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2026-06-24.dahlia' }); // Updated to supported API version
    }

    const paypalEnv = this.config.get<string>('PAYPAL_ENV') || 'sandbox';
    this.paypalBaseUrl =
      paypalEnv === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────────

  private async getPayPalAccessToken(): Promise<string> {
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

    return response.data.access_token;
  }

  private resolvePlanPrice(
    level: string,
    tier: string,
    billing: 'monthly' | 'yearly',
  ): number {
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === level);
    if (!plan) throw new NotFoundException(`Plan '${level}' not found.`);

    const baseMonthly: number = (plan.price as any)[tier] ?? 0;
    if (billing === 'yearly') {
      return Math.floor(baseMonthly * 0.8) * 12; // 20% yearly discount
    }
    return baseMonthly;
  }

  // ─── STRIPE ───────────────────────────────────────────────────────────────────

  async stripeInitiate(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'yearly',
    isTrial: boolean,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const amountGBP = isTrial ? 0 : this.resolvePlanPrice(level, tier, billing);
    const amountPence = Math.round(amountGBP * 100);

    if (isTrial || amountPence === 0) {
      // For trials we use SetupIntent (authorize card, charge later)
      const setupIntent = await this.stripe.setupIntents.create({
        usage: 'off_session',
        metadata: { businessId, level, tier, billing, isTrial: 'true' },
      });
      return { clientSecret: setupIntent.client_secret, type: 'setup' };
    }

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
    billing: 'monthly' | 'yearly',
    paymentIntentId: string,
    isTrial: boolean,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }

    if (!isTrial) {
      // Verify the payment intent is succeeded before activating subscription
      const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      if (intent.status !== 'succeeded') {
        throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
      }
    }

    // Activate subscription in database
    return this.pricingService.subscribeMembership(businessId, level, tier, billing, isTrial);
  }

  // ─── PAYPAL ───────────────────────────────────────────────────────────────────

  async paypalInitiate(
    businessId: string,
    level: string,
    tier: string,
    billing: 'monthly' | 'yearly',
    returnUrl: string,
    cancelUrl: string,
    isTrial: boolean,
  ) {
    const token = await this.getPayPalAccessToken();
    const amountGBP = isTrial ? 1.00 : this.resolvePlanPrice(level, tier, billing); // £1 auth for trial

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
            description: `MCOM ${level} ${tier} Membership${isTrial ? ' (Trial Authorization)' : ` (${billing})`}`,
            custom_id: `${businessId}|${level}|${tier}|${billing}|${isTrial}`,
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

  async paypalCapture(orderId: string) {
    const token = await this.getPayPalAccessToken();

    const capture = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const unit = capture.data.purchase_units?.[0];
    const customId: string = unit?.custom_id || '';
    const [businessId, level, tier, billing, isTrialStr] = customId.split('|');

    if (!businessId || !level || !tier) {
      throw new BadRequestException('PayPal order metadata is missing. Cannot activate subscription.');
    }

    const isTrial = isTrialStr === 'true';
    return this.pricingService.subscribeMembership(
      businessId,
      level,
      tier,
      (billing as 'monthly' | 'yearly') || 'monthly',
      isTrial,
    );
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: true },
    });
    if (user?.businessProfile?.id) {
      return user.businessProfile.id;
    }
    // Create a minimal business profile if none exists (onboarding flow)
    const profile = await this.prisma.businessProfile.create({
      data: {
        user: { connect: { id: userId } },
        businessName: user?.email?.split('@')[0] || 'Business',
        email: user?.email || '',
        businessType: 'retail',
        country: 'United Kingdom',
        phone: '',
      },
    });
    return profile.id;
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
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);

    if (plan.type === 'TRIAL' || amountGBP === 0) {
      const setupIntent = await this.stripe.setupIntents.create({
        usage: 'off_session',
        metadata: { businessId, platform, externalPlanId, billingCycle, planType: plan.type || 'STANDARD' },
      });
      return { clientSecret: setupIntent.client_secret, type: 'setup', plan };
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
    paymentIntentId: string,
  ) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured.');
    }

    const businessId = await this.resolveBusinessId(userId);
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
    }

    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    const isTrial = plan.type === 'TRIAL';

    const package_ = await this.prisma.platformPackage.upsert({
      where: { businessId_platform: { businessId, platform } },
      update: {
        packageName: plan.name,
        externalPlanId,
        planName: plan.name,
        planType: plan.type || 'STANDARD',
        status: isTrial ? 'active' : 'active',
        expiresAt: isTrial && plan.trialDuration
          ? new Date(Date.now() + plan.trialDuration * 24 * 60 * 60 * 1000)
          : this.calculateExpiry(billingCycle),
        provider: 'stripe',
        providerSubscriptionId: paymentIntentId,
        amount: isTrial ? 0 : amountGBP,
        currency: 'GBP',
        billingCycle,
        limits: plan.configuration?.quotas || {},
      },
      create: {
        businessId,
        platform,
        packageName: plan.name,
        externalPlanId,
        planName: plan.name,
        planType: plan.type || 'STANDARD',
        status: 'active',
        expiresAt: isTrial && plan.trialDuration
          ? new Date(Date.now() + plan.trialDuration * 24 * 60 * 60 * 1000)
          : this.calculateExpiry(billingCycle),
        provider: 'stripe',
        providerSubscriptionId: paymentIntentId,
        amount: isTrial ? 0 : amountGBP,
        currency: 'GBP',
        billingCycle,
        limits: plan.configuration?.quotas || {},
      },
    });

    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: isTrial ? 0 : amountGBP,
        description: `MCOM ${platform} — ${plan.name} (${billingCycle})`,
        status: isTrial ? 'trial' : 'paid',
        platformPackageId: package_.id,
        provider: 'stripe',
        providerPaymentId: paymentIntentId,
      },
    });

    return package_;
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
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    const isTrial = plan.type === 'TRIAL';
    const finalAmount = isTrial ? 0.00 : amountGBP;

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

  async platformPaypalCapture(orderId: string) {
    const token = await this.getPayPalAccessToken();

    const capture = await axios.post(
      `${this.paypalBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const unit = capture.data.purchase_units?.[0];
    const customId: string = unit?.custom_id || '';
    const [businessId, platform, externalPlanId, billingCycle] = customId.split('|');

    if (!businessId || !platform || !externalPlanId) {
      throw new BadRequestException('PayPal order metadata is missing. Cannot activate platform subscription.');
    }

    const plan = await this.connectorsService.getPlanById(platform, externalPlanId);
    const amountGBP = this.resolvePlatformPlanPrice(plan.monthlyPrice, plan.quarterlyPrice, plan.annualPrice, billingCycle);
    const isTrial = plan.type === 'TRIAL';

    const package_ = await this.prisma.platformPackage.upsert({
      where: { businessId_platform: { businessId, platform } },
      update: {
        packageName: plan.name,
        externalPlanId,
        planName: plan.name,
        planType: plan.type || 'STANDARD',
        status: 'active',
        expiresAt: isTrial && plan.trialDuration
          ? new Date(Date.now() + plan.trialDuration * 24 * 60 * 60 * 1000)
          : this.calculateExpiry(billingCycle),
        provider: 'paypal',
        providerSubscriptionId: orderId,
        amount: isTrial ? 0 : amountGBP,
        currency: 'GBP',
        billingCycle,
        limits: plan.configuration?.quotas || {},
      },
      create: {
        businessId,
        platform,
        packageName: plan.name,
        externalPlanId,
        planName: plan.name,
        planType: plan.type || 'STANDARD',
        status: 'active',
        expiresAt: isTrial && plan.trialDuration
          ? new Date(Date.now() + plan.trialDuration * 24 * 60 * 60 * 1000)
          : this.calculateExpiry(billingCycle),
        provider: 'paypal',
        providerSubscriptionId: orderId,
        amount: isTrial ? 0 : amountGBP,
        currency: 'GBP',
        billingCycle,
        limits: plan.configuration?.quotas || {},
      },
    });

    await this.prisma.billingTransaction.create({
      data: {
        businessId,
        amount: isTrial ? 0 : amountGBP,
        description: `MCOM ${platform} — ${plan.name} (${billingCycle})`,
        status: isTrial ? 'trial' : 'paid',
        platformPackageId: package_.id,
        provider: 'paypal',
        providerPaymentId: orderId,
      },
    });

    return package_;
  }
}
