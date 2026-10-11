import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Decimal } from '@prisma/client/runtime/library';
import { LedgerAccount } from '@prisma/client';
import { AppPaymentsLedgerService } from './app-payments-ledger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppPaymentsLedgerService', () => {
  let service: AppPaymentsLedgerService;
  let prisma: any;

  const mockConfig = {
    get: jest.fn((key: string) => {
      const cfg: Record<string, any> = {
        MCOM_PAY_FEE_PERCENT: '0.029',
        MCOM_PAY_FEE_FIXED_MINOR: '20',
      };
      return cfg[key] ?? null;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      programmeSetting: { findUnique: jest.fn().mockResolvedValue(null) },
      appPaymentLedgerEntry: { createMany: jest.fn().mockResolvedValue({ count: 3 }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppPaymentsLedgerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AppPaymentsLedgerService);
  });

  describe('resolveFeeConfig', () => {
    it('uses the platform default when the app has no override', async () => {
      const cfg = await service.resolveFeeConfig({ feePercent: null, feeFixedMinor: null });
      expect(cfg.feePercent.toString()).toBe('0.029');
      expect(cfg.feeFixedMinor).toBe(20n);
    });

    it('honours a per-app override', async () => {
      const cfg = await service.resolveFeeConfig({
        feePercent: new Decimal('0.05'),
        feeFixedMinor: 50n,
      });
      expect(cfg.feePercent.toString()).toBe('0.05');
      expect(cfg.feeFixedMinor).toBe(50n);
    });
  });

  describe('computeFee', () => {
    const cfg = { feePercent: new Decimal('0.029'), feeFixedMinor: 20n };

    it('computes 2.9% + 20p in integer minor units', () => {
      // 10270 * 0.029 = 297.83 -> 298 ; + 20 = 318
      expect(service.computeFee(10270n, cfg)).toBe(318n);
    });

    it('never exceeds the gross amount', () => {
      expect(service.computeFee(10n, { feePercent: new Decimal('0.5'), feeFixedMinor: 1000n })).toBe(10n);
    });

    it('is zero for zero percent and zero fixed', () => {
      expect(service.computeFee(5000n, { feePercent: new Decimal(0), feeFixedMinor: 0n })).toBe(0n);
    });
  });

  describe('computeRefundFee', () => {
    it('returns the full fee for a full refund', () => {
      expect(service.computeRefundFee({ amountMinor: 10270n, feeMinor: 318n }, 10270n)).toBe(318n);
    });

    it('prorates the fee for a partial refund', () => {
      // 318 * 5000 / 10270 = 154.82 -> 155
      expect(service.computeRefundFee({ amountMinor: 10270n, feeMinor: 318n }, 5000n)).toBe(155n);
    });
  });

  describe('postChargeLedger', () => {
    it('posts balanced double-entry rows (clearing debit = payable + revenue credits)', async () => {
      const tx = prisma;
      await service.postChargeLedger(tx, {
        chargeId: 'ch_1',
        appClientId: 'mcom-mall',
        amountMinor: 10270n,
        feeMinor: 318n,
        netMinor: 9952n,
        currency: 'GBP',
        clearingAccount: LedgerAccount.gateway_clearing,
      });

      const rows = prisma.appPaymentLedgerEntry.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(3);

      const debit = rows.filter((r: any) => r.direction === 'debit').reduce((s: bigint, r: any) => s + r.amountMinor, 0n);
      const credit = rows.filter((r: any) => r.direction === 'credit').reduce((s: bigint, r: any) => s + r.amountMinor, 0n);
      expect(debit).toBe(credit);
      expect(debit).toBe(10270n);
      expect(rows.every((r: any) => r.idempotencyKey.startsWith('ch_1:'))).toBe(true);
    });

    it('omits the revenue row when the fee is zero', async () => {
      await service.postChargeLedger(prisma, {
        chargeId: 'ch_2',
        appClientId: 'app',
        amountMinor: 5000n,
        feeMinor: 0n,
        netMinor: 5000n,
        currency: 'GBP',
        clearingAccount: LedgerAccount.wallet_clearing,
      });
      const rows = prisma.appPaymentLedgerEntry.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(2);
    });
  });
});
