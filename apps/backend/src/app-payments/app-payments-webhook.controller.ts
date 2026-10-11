import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppPaymentsService } from './app-payments.service';

/**
 * Provider webhooks for MCOM Pay. These are server-truth fallbacks for
 * close-tab-after-charge: the ledger's unique keys keep confirm + webhook
 * idempotent. Hidden from Swagger per payment rules.
 *
 * Nest is bootstrapped with `rawBody: true` (main.ts) so `req.rawBody` is
 * available for signature verification — no extra middleware needed.
 */
@Controller('app-payments/webhook')
export class AppPaymentsWebhookController {
  constructor(private readonly service: AppPaymentsService) {}

  @Post('stripe')
  @ApiExcludeEndpoint()
  async stripe(@Req() req: any, @Headers('stripe-signature') signature: string) {
    const rawBody = req.rawBody as string | Buffer | undefined;
    if (!rawBody) throw new BadRequestException('Missing request body');
    if (!signature) throw new BadRequestException('Missing stripe-signature header');
    return this.service.handleStripeWebhook(rawBody, signature);
  }

  @Post('paypal')
  @ApiExcludeEndpoint()
  async paypal(@Req() req: any, @Headers() headers: Record<string, any>) {
    const rawBody = req.rawBody as string | Buffer | undefined;
    if (!rawBody) throw new BadRequestException('Missing request body');
    return this.service.handlePaypalWebhook(rawBody, headers);
  }
}
