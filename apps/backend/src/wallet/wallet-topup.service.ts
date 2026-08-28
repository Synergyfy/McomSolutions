import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { RedisService } from '../redis/redis.service';
import { TopUpInitiateDto } from './dto/wallet-operations.dto';
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
      this.stripe = new Stripe(stripeKey, { apiVersion: '2026-07-29.dahlia' });
    }
  }

  async initiateTopUp(userId: string, dto: TopUpInitiateDto) {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured on this server.');
    }

    const wallet = await this.walletService.ensureWallet(userId);
    const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const topUp = await this.prisma.walletTopUpRequest.create({
      data: {
        walletId: wallet.id,
        userId,
        amount: dto.amount,
        currency: dto.currency || 'GBP',
        walletCurrency: wallet.currency,
        exchangeRate: 1,
        provider: 'stripe',
        status: 'PENDING',
      },
    });

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: undefined, // resolved from the authenticated user in the success page
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
      success_url: dto.returnUrl || `${frontendUrl}/dashboard/wallet?topup=success`,
      cancel_url: dto.cancelUrl || `${frontendUrl}/dashboard/wallet?topup=cancelled`,
    });

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
      status: 'PENDING',
    };
  }

  async handleStripeWebhook(rawBody: string | Buffer, signature: string): Promise<{ received: boolean }> {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!this.stripe || !webhookSecret) {
      this.logger.error('Stripe webhook received but Stripe is not configured');
      return { received: true };
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
        await this.handleCheckoutCompleted(session);
        break;
      }
      default:
        this.logger.debug(`Ignoring unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const topUpRequestId = session.metadata?.topUpRequestId;
    if (!topUpRequestId) {
      this.logger.warn(`Checkout session ${session.id} has no topUpRequestId metadata`);
      return;
    }

    const request = await this.prisma.walletTopUpRequest.findUnique({
      where: { id: topUpRequestId },
    });
    if (!request) {
      this.logger.error(`Top-up request ${topUpRequestId} not found for session ${session.id}`);
      return;
    }

    // Idempotency: already processed → no-op
    if (request.status === 'COMPLETED') {
      this.logger.log(`Top-up request ${topUpRequestId} already completed — skipping`);
      return;
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
        return;
      }

      const balanceBefore = fresh.balance;
      const balanceAfter = balanceBefore.plus(creditAmount);

      try {
        await this.prisma.$transaction([
          this.prisma.walletTopUpRequest.update({
            where: { id: request.id },
            data: { status: 'COMPLETED', completedAt: new Date(), providerStatus: session.payment_status, providerRef: session.id },
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
              reference: session.id,
              description: `Wallet top-up via Stripe (${request.currency} ${request.amount})`,
              metadata: {
                topUpRequestId: request.id,
                provider: 'stripe',
                sessionId: session.id,
                paymentIntentId: session.payment_intent,
              } as Prisma.InputJsonValue,
              idempotencyKey: `topup:${request.id}`,
              status: 'COMPLETED',
              initiatedBy: 'webhook:stripe',
            },
          }),
          this.prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: balanceAfter, lastTransactionAt: new Date() },
          }),
        ]);
        await this.redis.del(`wallet:balance:${request.userId}`);
        this.logger.log(`Wallet credited ${creditAmount.toNumber()} MCOM for top-up ${request.id}`);
      } catch (err) {
        // Unique idempotency key collision → another webhook delivery already processed it
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.log(`Top-up ${request.id} already processed (duplicate webhook) — skipping`);
          return;
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