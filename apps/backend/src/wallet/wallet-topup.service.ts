import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { RedisService } from '../redis/redis.service';
import { TopUpInitiateDto, ConfirmTopUpDto } from './dto/wallet-operations.dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class WalletTopUpService {
  private readonly logger = new Logger(WalletTopUpService.name);
  private stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly walletService: WalletService,
    private readonly ledgerService: WalletLedgerService,
    private readonly lockUtil: WalletLockUtil,
    private readonly redis: RedisService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey);
    }
  }

  async initiateTopUp(userId: string, dto: TopUpInitiateDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const wallet = await this.walletService.ensureWallet(userId);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const exchangeRate = await this.getExchangeRate(dto.currency || 'GBP', wallet.currency);

    const topUp = await this.prisma.walletTopUpRequest.create({
      data: {
        walletId: wallet.id,
        userId,
        amount: dto.amount,
        currency: dto.currency || 'GBP',
        walletCurrency: wallet.currency,
        exchangeRate,
        provider: dto.provider || 'stripe',
        status: 'PENDING',
      },
    });

    // Create a Stripe PaymentIntent for the in-app Stripe Elements modal flow
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(dto.amount * 100),
      currency: (dto.currency || 'GBP').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: { topUpRequestId: topUp.id, userId },
      description: `MCOM Wallet Top-Up (${dto.currency || 'GBP'} ${dto.amount})`,
    });

    await this.prisma.walletTopUpRequest.update({
      where: { id: topUp.id },
      data: { providerRef: paymentIntent.id },
    });

    // Also create a Checkout Session as an alternative redirect fallback if returnUrl was explicitly supplied
    let checkoutUrl: string | null = null;
    let sessionId: string | null = null;
    if (dto.returnUrl) {
      try {
        const session = await this.stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: (dto.currency || 'GBP').toLowerCase(),
                unit_amount: Math.round(dto.amount * 100),
                product_data: {
                  name: 'MCOM Wallet Top-Up',
                  description: `Credit ${dto.amount} ${dto.currency || 'GBP'} to your MCOM wallet`,
                },
              },
              quantity: 1,
            },
          ],
          metadata: { topUpRequestId: topUp.id, userId },
          success_url: dto.returnUrl,
          cancel_url: dto.cancelUrl || `${frontendUrl}/dashboard/wallet?topup=cancelled`,
        });
        sessionId = session.id;
        checkoutUrl = session.url;
      } catch (err) {
        this.logger.warn(`Failed to create fallback Checkout session: ${err instanceof Error ? err.message : err}`);
      }
    }

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      topUpRequestId: topUp.id,
      amount: dto.amount,
      currency: dto.currency || 'GBP',
      status: 'PENDING',
      sessionId,
      checkoutUrl,
    };
  }

  async confirmStripeTopUp(userId: string, dto: ConfirmTopUpDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const intent = await this.stripe.paymentIntents.retrieve(dto.paymentIntentId);
    if (intent.status !== 'succeeded') {
      throw new BadRequestException(`Payment not completed. Status: ${intent.status}`);
    }

    if (intent.metadata?.userId && intent.metadata.userId !== userId) {
      throw new BadRequestException('Payment intent does not belong to this user.');
    }

    if (intent.metadata?.topUpRequestId && intent.metadata.topUpRequestId !== dto.topUpRequestId) {
      throw new BadRequestException('Payment intent metadata does not match top-up request.');
    }

    return this.fulfillTopUp(dto.topUpRequestId, intent.id, intent.status, {
      paymentIntentId: intent.id,
    });
  }

  /**
   * Resolves the FX rate for a base → wallet-currency pair. Prefers the DB
   * (FxRate table, admin-updatable); falls back to the MCOM_GBP_RATE env var
   * (default 1) so the conversion is never a silent hardcoded 1:1.
   */
  private async getExchangeRate(base: string, quote: string): Promise<number> {
    try {
      const rate = await this.prisma.fxRate.findUnique({
        where: { base_quote: { base: base.toUpperCase(), quote: quote.toUpperCase() } },
      });
      if (rate) return rate.rate.toNumber();
    } catch (err) {
      this.logger.warn(`FX rate lookup failed for ${base}→${quote}:`, err as any);
    }
    const envRate = this.config.get<string>('MCOM_GBP_RATE');
    const parsed = envRate ? parseFloat(envRate) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  async handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !webhookSecret) {
      this.logger.error('Stripe webhook received but Stripe is not configured');
      throw new InternalServerErrorException('Stripe is not configured — cannot process webhook');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${err.message}`);
      throw new InternalServerErrorException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const topUpRequestId = session.metadata?.topUpRequestId;
        if (topUpRequestId) {
          await this.fulfillTopUp(topUpRequestId, session.id, session.payment_status || 'paid', {
            sessionId: session.id,
            paymentIntentId: session.payment_intent,
          });
        }
        break;
      }
      case 'payment_intent.succeeded': {
        const intent = event.data.object as Stripe.PaymentIntent;
        const topUpRequestId = intent.metadata?.topUpRequestId;
        if (topUpRequestId) {
          await this.fulfillTopUp(topUpRequestId, intent.id, intent.status, {
            paymentIntentId: intent.id,
          });
        }
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Idempotent fulfillment of wallet top-up under the distributed wallet lock.
   */
  async fulfillTopUp(
    topUpRequestId: string,
    providerRef: string,
    paymentStatus: string,
    metadataExtra?: Record<string, any>,
  ) {
    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: topUpRequestId },
    });
    if (!request) {
      this.logger.error(`Top-up request ${topUpRequestId} not found`);
      throw new NotFoundException(`Top-up request ${topUpRequestId} not found`);
    }

    // Idempotency: already processed → no-op
    if (request.status === 'COMPLETED') {
      this.logger.log(`Top-up request ${topUpRequestId} already completed — skipping`);
      const wallet = await this.walletService.ensureWallet(request.userId);
      return { success: true, balance: wallet.balance.toNumber() };
    }

    const wallet = await this.walletService.ensureWallet(request.userId);
    const creditAmount = new Decimal(request.amount).times(request.exchangeRate || 1);

    // Balance read + ledger write MUST hold the wallet lock — otherwise a
    // concurrent partner debit between the read and the commit would produce a
    // wrong balanceBefore snapshot on the ledger entry (race condition).
    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const freshRequest = await this.prisma.walletTopUpRequest.findUniqueOrThrow({
        where: { id: request.id },
      });
      if (freshRequest.status === 'COMPLETED') {
        this.logger.log(`Top-up request ${request.id} already completed (in lock) — skipping`);
        return { success: true, balance: fresh.balance.toNumber() };
      }

      const balanceBefore = fresh.balance;
      const balanceAfter = balanceBefore.plus(creditAmount);

      try {
        await this.prisma.$transaction([
          this.prisma.walletTopUpRequest.update({
            where: { id: request.id },
            data: { status: 'COMPLETED', completedAt: new Date(), providerStatus: paymentStatus, providerRef },
          }),
          this.prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              type: 'CREDIT',
              amount: creditAmount,
              balanceBefore,
              balanceAfter,
              currency: fresh.currency,
              platformClientId: 'mcom-central',
              platformName: 'MCOM Central',
              platformSlug: 'system',
              category: 'TOP_UP',
              reference: providerRef,
              description: `Wallet top-up via Stripe (${request.currency} ${request.amount})`,
              metadata: {
                topUpRequestId: request.id,
                provider: 'stripe',
                providerRef,
                ...metadataExtra,
              } as Prisma.InputJsonValue,
              idempotencyKey: `topup:${request.id}`,
              status: 'COMPLETED',
              initiatedBy: 'stripe:payment_intent',
            },
          }),
          this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: balanceAfter, lastTransactionAt: new Date() },
          }),
        ]);
        await this.redis.del(`wallet:balance:${request.userId}`);
        this.logger.log(`Wallet credited ${creditAmount.toNumber()} MCOM for top-up ${request.id}`);
        return { success: true, balance: balanceAfter.toNumber() };
      } catch (err) {
        // Unique idempotency key collision → another confirmation or webhook already processed it
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.log(`Top-up ${request.id} already processed (duplicate) — skipping`);
          const latestWallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
          return { success: true, balance: latestWallet.balance.toNumber() };
        }
        throw err;
      }
    });
  }

  async listTopUpHistory(userId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.prisma.walletTopUpRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletTopUpRequest.count({ where: { userId } }),
    ]);

    return {
      success: true,
      data: data.map((r) => ({
        id: r.id,
        amount: r.amount.toNumber(),
        currency: r.currency,
        walletCurrency: r.walletCurrency,
        provider: r.provider,
        status: r.status,
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getRecentTopUpTransaction(walletId: string) {
    return this.ledgerService.getTransactions(walletId, {
      category: 'TOP_UP' as any,
      limit: 5,
      page: 1,
    });
  }
}