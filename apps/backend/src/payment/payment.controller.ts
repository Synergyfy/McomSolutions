import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  // ─── STRIPE ───────────────────────────────────────────────────────────────────

  /**
   * Initiates a Stripe payment.
   * Returns a clientSecret for the frontend Stripe Elements form.
   * For trials: returns a SetupIntent clientSecret (card auth only, no charge).
   * For full subscriptions: returns a PaymentIntent clientSecret.
   */
  @UseGuards(JwtAuthGuard)
  @Post('stripe/initiate')
  async stripeInitiate(
    @Request() req: any,
    @Body('level') level: string,
    @Body('tier') tier: string,
    @Body('billing') billing: 'monthly' | 'yearly',
    @Body('isTrial') isTrial: boolean,
  ) {
    if (!req.user.businessId) {
      throw new BadRequestException('No active business profile found for this user.');
    }
    return this.paymentService.stripeInitiate(
      req.user.businessId,
      level,
      tier,
      billing || 'monthly',
      !!isTrial,
    );
  }

  /**
   * Confirms a Stripe payment after the frontend completes the Elements form.
   * Verifies the PaymentIntent status and activates the subscription.
   */
  @UseGuards(JwtAuthGuard)
  @Post('stripe/confirm')
  async stripeConfirm(
    @Request() req: any,
    @Body('level') level: string,
    @Body('tier') tier: string,
    @Body('billing') billing: 'monthly' | 'yearly',
    @Body('paymentIntentId') paymentIntentId: string,
    @Body('isTrial') isTrial: boolean,
  ) {
    if (!req.user.businessId) {
      throw new BadRequestException('No active business profile found for this user.');
    }
    return this.paymentService.stripeConfirm(
      req.user.businessId,
      level,
      tier,
      billing || 'monthly',
      paymentIntentId,
      !!isTrial,
    );
  }

  // ─── PAYPAL ───────────────────────────────────────────────────────────────────

  /**
   * Creates a PayPal order and returns the approval URL.
   * Frontend redirects the user to this URL to authorize payment.
   */
  @UseGuards(JwtAuthGuard)
  @Post('paypal/initiate')
  async paypalInitiate(
    @Request() req: any,
    @Body('level') level: string,
    @Body('tier') tier: string,
    @Body('billing') billing: 'monthly' | 'yearly',
    @Body('returnUrl') returnUrl: string,
    @Body('cancelUrl') cancelUrl: string,
    @Body('isTrial') isTrial: boolean,
  ) {
    if (!req.user.businessId) {
      throw new BadRequestException('No active business profile found for this user.');
    }
    return this.paymentService.paypalInitiate(
      req.user.businessId,
      level,
      tier,
      billing || 'monthly',
      returnUrl,
      cancelUrl,
      !!isTrial,
    );
  }

  /**
   * Captures a PayPal order after the user approves it on PayPal.
   * Activates the subscription and returns the updated business profile.
   */
  @Post('paypal/capture')
  async paypalCapture(@Body('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    return this.paymentService.paypalCapture(orderId);
  }
}
