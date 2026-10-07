import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SsoUserGuard } from '../auth/guards/sso-user.guard';
import { CreatePlatformPurchaseDto } from './dto/create-platform-purchase.dto';
import { MembershipInitiateDto, PaypalInitiateDto, PlatformConfirmDto, StripeConfirmDto } from './dto/membership-payment.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  private async getBusinessId(req: any): Promise<string> {
    if (req.user?.businessId) return req.user.businessId;
    if (req.user?.userId) {
      const profile = await this.paymentService.getBusinessProfileByUserId(req.user.userId);
      if (profile?.id) return profile.id;
    }
    throw new BadRequestException('No active business profile found for this user.');
  }

  // ─── STRIPE (Membership) ─────────────────────────────────────────────────────

  /**
   * Initiates a Stripe payment.
   * Returns a clientSecret for the frontend Stripe Elements form.
   * Phase 2: trials removed — every initiation is a real charge.
   */
  @UseGuards(JwtAuthGuard)
  @Post('stripe/initiate')
  @ApiOperation({ summary: 'Initiate Stripe membership payment (trials discontinued)' })
  @ApiBody({ type: MembershipInitiateDto })
  async stripeInitiate(@Request() req: any, @Body() dto: MembershipInitiateDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.stripeInitiate(
      businessId,
      dto.level,
      dto.tier,
      dto.billing || 'monthly',
    );
  }

  /**
   * Confirms a Stripe payment after the frontend completes the Elements form.
   * Verifies the PaymentIntent status and activates the subscription.
   */
  @UseGuards(JwtAuthGuard)
  @Post('stripe/confirm')
  @ApiOperation({ summary: 'Confirm Stripe membership payment' })
  @ApiBody({ type: StripeConfirmDto })
  async stripeConfirm(@Request() req: any, @Body() dto: StripeConfirmDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.stripeConfirm(
      businessId,
      dto.level,
      dto.tier,
      dto.billing || 'monthly',
      dto.paymentIntentId,
      req.user,
    );
  }

  // ─── PAYPAL (Membership) ─────────────────────────────────────────────────────

  /**
   * Creates a PayPal order and returns the approval URL.
   * Frontend redirects the user to this URL to authorize payment.
   */
  @UseGuards(JwtAuthGuard)
  @Post('paypal/initiate')
  @ApiOperation({ summary: 'Initiate PayPal membership payment (trials discontinued)' })
  @ApiBody({ type: PaypalInitiateDto })
  async paypalInitiate(@Request() req: any, @Body() dto: PaypalInitiateDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.paypalInitiate(
      businessId,
      dto.level,
      dto.tier,
      dto.billing || 'monthly',
      dto.returnUrl,
      dto.cancelUrl,
    );
  }

  /**
   * Captures a PayPal order after the user approves it on PayPal.
   * Phase 2: authenticated + ownership-checked. Replays return current
   * state (200); cross-business/amount replays are 409.
   * Activates the subscription and returns the updated business profile.
   */
  @UseGuards(JwtAuthGuard)
  @Post('paypal/capture')
  async paypalCapture(@Request() req: any, @Body('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    return this.paymentService.paypalCapture(orderId, req.user);
  }

  // ─── PLATFORM PLAN PURCHASES (Stripe) ────────────────────────────────────────

  @UseGuards(SsoUserGuard)
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

  @UseGuards(SsoUserGuard)
  @Post('platform/stripe/confirm')
  @ApiOperation({ summary: 'Confirm Stripe payment and activate platform plan' })
  @ApiBody({ type: PlatformConfirmDto })
  async platformStripeConfirm(@Request() req: any, @Body() dto: PlatformConfirmDto) {
    return this.paymentService.platformStripeConfirm(
      req.user.userId,
      dto.platform,
      dto.externalPlanId,
      dto.billingCycle,
      dto.paymentIntentId || dto.setupIntentId,
      req.user,
    );
  }

  // ─── PLATFORM PLAN PURCHASES (PayPal) ────────────────────────────────────────

  @UseGuards(SsoUserGuard)
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

  @UseGuards(SsoUserGuard)
  @Post('platform/paypal/capture')
  @ApiOperation({ summary: 'Capture PayPal order and activate platform plan' })
  async platformPaypalCapture(@Request() req: any, @Body('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    return this.paymentService.platformPaypalCapture(orderId, req.user);
  }

  /**
   * Phase 2: inbound Stripe webhook for membership + platform activations
   * (close-tab-after-charge reconciliation). Verified with
   * STRIPE_WEBHOOK_SECRET; hidden from Swagger per payment-rules.
   */
  @Post('stripe/webhook')
  @ApiExcludeEndpoint()
  async stripeWebhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    const rawBody = req.rawBody as string | Buffer | undefined;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    return this.paymentService.handleStripeWebhook(rawBody, signature);
  }
}
