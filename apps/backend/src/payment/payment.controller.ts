import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePlatformPurchaseDto } from './dto/create-platform-purchase.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  // ─── STRIPE (Membership) ─────────────────────────────────────────────────────

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

  // ─── PAYPAL (Membership) ─────────────────────────────────────────────────────

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

  // ─── PLATFORM PLAN PURCHASES (Stripe) ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('platform/stripe/initiate')
  @ApiOperation({ summary: 'Initiate Stripe payment for a platform plan (Mall/Rewards)' })
  async platformStripeInitiate(
    @Request() req: any,
    @Body() dto: CreatePlatformPurchaseDto,
  ) {
    return this.paymentService.platformStripeInitiate(
      req.user.userId,
      dto.platform,
      dto.externalPlanId,
      dto.billingCycle,
      dto.returnUrl,
      dto.cancelUrl,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('platform/stripe/confirm')
  @ApiOperation({ summary: 'Confirm Stripe payment and activate platform plan' })
  async platformStripeConfirm(
    @Request() req: any,
    @Body('platform') platform: string,
    @Body('externalPlanId') externalPlanId: string,
    @Body('billingCycle') billingCycle: string,
    @Body('paymentIntentId') paymentIntentId: string,
  ) {
    return this.paymentService.platformStripeConfirm(
      req.user.userId,
      platform,
      externalPlanId,
      billingCycle,
      paymentIntentId,
    );
  }

  // ─── PLATFORM PLAN PURCHASES (PayPal) ────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('platform/paypal/initiate')
  @ApiOperation({ summary: 'Initiate PayPal payment for a platform plan (Mall/Rewards)' })
  async platformPaypalInitiate(
    @Request() req: any,
    @Body() dto: CreatePlatformPurchaseDto,
  ) {
    return this.paymentService.platformPaypalInitiate(
      req.user.userId,
      dto.platform,
      dto.externalPlanId,
      dto.billingCycle,
      dto.returnUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment/success`,
      dto.cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment/cancel`,
    );
  }

  @Post('platform/paypal/capture')
  @ApiOperation({ summary: 'Capture PayPal order and activate platform plan' })
  async platformPaypalCapture(@Body('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    return this.paymentService.platformPaypalCapture(orderId);
  }
}
