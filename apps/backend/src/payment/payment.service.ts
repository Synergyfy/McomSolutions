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

@Injectable()
export class PaymentService {
  private stripe: Stripe;
  private paypalBaseUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private pricingService: PricingService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' });
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
}
