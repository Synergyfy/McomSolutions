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
import { RecurringService } from '../recurring/recurring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SsoUserGuard } from '../auth/guards/sso-user.guard';
import { CreatePlatformPurchaseDto } from './dto/create-platform-purchase.dto';
import { MembershipInitiateDto, PaypalInitiateDto, PlatformConfirmDto, StripeConfirmDto } from './dto/membership-payment.dto';
import {
  AccessInitiateDto,
  AccessPaypalCaptureDto,
  AccessPaypalInitiateDto,
  AccessStripeConfirmDto,
} from './dto/access-payment.dto';
import { AccessWalletPurchaseDto } from '../access/dto/access.dto';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payment')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private recurringService: RecurringService,
  ) {}

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
      dto.paymentPlan || 'full',
      dto.couponCode,
      req.user?.userId,
      dto.autoRenew ?? false,
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
      dto.paymentPlan || 'full',
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
      dto.paymentPlan || 'full',
      dto.couponCode,
      req.user?.userId,
      dto.autoRenew ?? false,
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

  // ─── ACCESS PASS PAYMENTS ───────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('access/stripe/initiate')
  @ApiOperation({ summary: 'Initiate Stripe access-pass payment (one-time)' })
  @ApiBody({ type: AccessInitiateDto })
  async accessStripeInitiate(@Request() req: any, @Body() dto: AccessInitiateDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.accessStripeInitiate(
      businessId,
      dto.accessPlanId,
      dto.couponCode,
      req.user?.userId,
      dto.purchaseMode,
      dto.recipientEmail,
      dto.entitlementChoice,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('access/stripe/confirm')
  @ApiOperation({ summary: 'Confirm Stripe access-pass payment' })
  @ApiBody({ type: AccessStripeConfirmDto })
  async accessStripeConfirm(@Request() req: any, @Body() dto: AccessStripeConfirmDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.accessStripeConfirm(
      businessId,
      dto.accessPlanId,
      dto.paymentIntentId,
      req.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('access/paypal/initiate')
  @ApiOperation({ summary: 'Initiate PayPal access-pass payment (one-time)' })
  @ApiBody({ type: AccessPaypalInitiateDto })
  async accessPaypalInitiate(@Request() req: any, @Body() dto: AccessPaypalInitiateDto) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.accessPaypalInitiate(
      businessId,
      dto.accessPlanId,
      dto.returnUrl,
      dto.cancelUrl,
      dto.couponCode,
      req.user?.userId,
      dto.purchaseMode,
      dto.recipientEmail,
      dto.entitlementChoice,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('access/paypal/capture')
  @ApiOperation({ summary: 'Capture PayPal access-pass payment' })
  @ApiBody({ type: AccessPaypalCaptureDto })
  async accessPaypalCapture(@Request() req: any, @Body() dto: AccessPaypalCaptureDto) {
    return this.paymentService.accessPaypalCapture(dto.orderId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('access/wallet')
  @ApiOperation({
    summary: 'Pay for an access pass with the MCOM Wallet (requires X-Idempotency-Key header)',
  })
  @ApiBody({ type: AccessWalletPurchaseDto })
  async accessWalletPurchase(
    @Request() req: any,
    @Body() dto: AccessWalletPurchaseDto,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.accessWalletPurchase(
      businessId,
      req.user.userId,
      dto.accessPlanId,
      dto.couponCode,
      idempotencyKey,
      dto.purchaseMode,
      dto.recipientEmail,
      dto.entitlementChoice,
    );
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
      dto.autoRenew ?? false,
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
      dto.autoRenew ?? false,
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

  /**
   * PayPal webhook: subscription lifecycle + recurring sale events.
   * Verified with PAYPAL_WEBHOOK_ID; hidden from Swagger.
   */
  @Post('paypal/webhook')
  @ApiExcludeEndpoint()
  async paypalWebhook(@Req() req: any, @Headers() headers: Record<string, string>) {
    const rawBody = req.rawBody as string | Buffer | undefined;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    return this.recurringService.handlePayPalWebhook(rawBody, headers);
  }

  // ─── VERIFICATION FEE (£1.00) ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('verification-fee/stripe/initiate')
  @ApiOperation({ summary: 'Initiate Stripe payment for £1 verification fee' })
  async verificationStripeInitiate(@Request() req: any) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.verificationStripeInitiate(businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verification-fee/stripe/confirm')
  @ApiOperation({ summary: 'Confirm Stripe payment for £1 verification fee' })
  async verificationStripeConfirm(
    @Request() req: any,
    @Body('paymentIntentId') paymentIntentId: string,
  ) {
    const businessId = await this.getBusinessId(req);
    return this.paymentService.verificationStripeConfirm(businessId, paymentIntentId, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verification-fee/paypal/initiate')
  @ApiOperation({ summary: 'Initiate PayPal payment for £1 verification fee' })
  async verificationPaypalInitiate(
    @Request() req: any,
    @Body('returnUrl') returnUrl: string,
    @Body('cancelUrl') cancelUrl: string,
  ) {
    const businessId = await this.getBusinessId(req);
    const ret = returnUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment/paypal/return?type=verification`;
    const can = cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/payment/paypal/cancel`;
    return this.paymentService.verificationPaypalInitiate(businessId, ret, can);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verification-fee/paypal/capture')
  @ApiOperation({ summary: 'Capture PayPal payment for £1 verification fee' })
  async verificationPaypalCapture(@Request() req: any, @Body('orderId') orderId: string) {
    if (!orderId) {
      throw new BadRequestException('orderId is required.');
    }
    return this.paymentService.verificationPaypalCapture(orderId, req.user);
  }

}
