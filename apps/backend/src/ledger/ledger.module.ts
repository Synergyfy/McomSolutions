import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsoleAdminGuard } from '../console/guards/console-admin.guard';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { GlPostingService } from './gl-posting.service';
import { LedgerBackfillService } from './ledger-backfill.service';
import { LedgerReconciliationService } from './ledger-reconciliation.service';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerAnalyticsService } from './ledger-analytics.service';
import { LedgerAdminController } from './ledger-admin.controller';
import { PlatformSalesService } from './platform-sales.service';

/**
 * Central ledger. Exposes the posting primitives that every money-moving
 * feature must use, plus the backfill/reconciliation tooling that certifies
 * the books and the read-only admin surface.
 */
@Module({
  imports: [AuthModule],
  controllers: [LedgerAdminController],
  providers: [
    ChartOfAccountsService,
    GlPostingService,
    LedgerBackfillService,
    LedgerReconciliationService,
    LedgerQueryService,
    LedgerAnalyticsService,
    PlatformSalesService,
    ConsoleAdminGuard,
  ],
  exports: [
    ChartOfAccountsService,
    GlPostingService,
    LedgerBackfillService,
    LedgerReconciliationService,
    LedgerQueryService,
    LedgerAnalyticsService,
    PlatformSalesService,
  ],
})
export class LedgerModule {}
