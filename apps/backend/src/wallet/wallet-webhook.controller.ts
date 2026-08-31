import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { WalletTopUpService } from './wallet-topup.service';

/**
 * Stripe webhook for wallet top-ups.
 *
 * Endpoints here need the RAW request body for signature verification. Nest is
 * bootstrapped with `rawBody: true` (main.ts) so `req.rawBody` is available —
 * no `express.raw()` middleware is required.
 *
 * Hidden from Swagger (`@ApiExcludeEndpoint`) per security rules.
 */
@Controller('wallet/webhook')
export class WalletWebhookController {
  constructor(private readonly topUpService: WalletTopUpService) {}

  @Post('stripe')
  @ApiExcludeEndpoint()
  async stripeWebhook(@Req() req: any, @Headers('stripe-signature') signature: string) {
    const rawBody = req.rawBody as string | Buffer | undefined;
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    await this.topUpService.handleStripeWebhook(rawBody, signature);
    return { received: true };
  }
}