import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { WalletController } from './wallet.controller';
import { WalletPartnerController } from './wallet-partner.controller';
import { WalletAdminController } from './wallet-admin.controller';
import { WalletWebhookController } from './wallet-webhook.controller';
import { WalletService } from './wallet.service';
import { WalletLedgerService } from './wallet-ledger.service';
import { WalletTopUpService } from './wallet-topup.service';
import { WalletReconciliationService } from './wallet-reconciliation.service';
import { WalletAdminService } from './wallet-admin.service';
import { WalletEventsService } from './wallet-events.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { WalletHmacGuard } from './guards/wallet-hmac.guard';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    AuthModule,
    ScheduleModule.forRoot(),
    LedgerModule,
  ],
  controllers: [
    WalletController,
    WalletPartnerController,
    WalletAdminController,
    WalletWebhookController,
  ],
  providers: [
    WalletService,
    WalletLedgerService,
    WalletTopUpService,
    WalletReconciliationService,
    WalletAdminService,
    WalletEventsService,
    WalletLockUtil,
    WalletHmacGuard,
  ],
  exports: [WalletService, WalletLedgerService, WalletHmacGuard],
})
export class WalletModule {}