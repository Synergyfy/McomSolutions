import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Wallet event hook — the documented extension point for user notifications.
 *
 * Emits real Notification records (business-scoped) for wallet events that
 * users care about:
 *  - Wallet top-up completed (CREDIT / TOP_UP) → confirmation notification
 *  - Large debits (>= WALLET_NOTIFY_DEBIT_THRESHOLD) → warning notification
 *
 * Invoked from WalletService after every successful transaction. Failures here
 * are logged but never thrown — the wallet core must not be blocked by
 * notification side-effects.
 */
@Injectable()
export class WalletEventsService {
  private readonly logger = new Logger(WalletEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onTransactionProcessed(input: {
    userId: string;
    walletId: string;
    transactionId: string;
    type: string;
    amount: number;
    category: string;
    platformName?: string | null;
    balanceAfter: number;
  }): Promise<void> {
    this.logger.log(
      `wallet-event type=${input.type} amount=${input.amount} category=${input.category} ` +
        `platform=${input.platformName ?? 'mcom-central'} userId=${input.userId} txn=${input.transactionId} ` +
        `balanceAfter=${input.balanceAfter}`,
    );

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
        select: { businessProfile: { select: { id: true } } },
      });
      if (!user?.businessProfile?.id) {
        return; // Notification model is business-scoped — nothing to target.
      }

      let title: string | null = null;
      let message = '';

      if (input.type === 'CREDIT' && input.category === 'TOP_UP') {
        title = 'Wallet Top-Up Successful';
        message = `Your wallet has been credited with ${input.amount} MCOM.`;
      } else if (input.type === 'DEBIT') {
        const rawThreshold = this.config.get<string>('WALLET_NOTIFY_DEBIT_THRESHOLD');
        const threshold = rawThreshold ? parseFloat(rawThreshold) : 0;
        if (Number.isFinite(threshold) && threshold > 0 && input.amount >= threshold) {
          title = 'Large Wallet Debit';
          message = `A debit of ${input.amount} MCOM was processed on your wallet.`;
        }
      }

      if (title) {
        await this.prisma.notification.create({
          data: {
            businessId: user.businessProfile.id,
            type: 'wallet',
            title,
            message,
            read: false,
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to emit wallet notification for user ${input.userId}:`, err as any);
    }
  }
}