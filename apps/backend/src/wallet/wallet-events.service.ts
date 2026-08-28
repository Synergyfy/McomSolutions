import { Injectable, Logger } from '@nestjs/common';

/**
 * Wallet event hook — the documented extension point for user notifications.
 *
 * Currently logs structured info events (audit trail). Wire real channels here
 * (email / push via the Notification module, WebSocket, etc.) without touching
 * the wallet core. Invoked from WalletService after every successful transaction.
 *
 * Future rules to implement:
 *  - Large debits (>= WALLET_NOTIFY_DEBIT_THRESHOLD) → notify user
 *  - Wallet topped up → confirmation notification
 *  - Balance below threshold → low-balance warning
 */
@Injectable()
export class WalletEventsService {
  private readonly logger = new Logger(WalletEventsService.name);

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
    // TODO: emit notification events here (email/push) — see rules above.
  }
}