import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WalletModule } from '../wallet/wallet.module';
import { WebhookDispatcherModule } from '../webhook-dispatcher/webhook-dispatcher.module';
import { AppPaymentsController } from './app-payments.controller';
import { AppPaymentsAdminController } from './app-payments-admin.controller';
import { AppPaymentsWebhookController } from './app-payments-webhook.controller';
import { AppPaymentsService } from './app-payments.service';
import { AppPaymentsLedgerService } from './app-payments-ledger.service';

@Module({
  imports: [AuthModule, PrismaModule, WalletModule, WebhookDispatcherModule],
  controllers: [
    AppPaymentsController,
    AppPaymentsWebhookController,
    AppPaymentsAdminController,
  ],
  providers: [AppPaymentsService, AppPaymentsLedgerService],
  exports: [AppPaymentsService, AppPaymentsLedgerService],
})
export class AppPaymentsModule {}
