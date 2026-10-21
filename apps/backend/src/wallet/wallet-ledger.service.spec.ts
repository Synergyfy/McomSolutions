import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { WalletLedgerService } from './wallet-ledger.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WalletLedgerService', () => {
  let service: WalletLedgerService;
  let prisma: any;

  const txn = {
    id: 'txn-1',
    walletId: 'wallet-1',
    type: 'DEBIT',
    amount: new Decimal(12.5),
    balanceBefore: new Decimal(100),
    balanceAfter: new Decimal(87.5),
    currency: 'MCOM',
    platformClientId: 'mcom-mall',
    platformName: 'MCOM Mall',
    platformSlug: 'mall',
    category: 'PURCHASE',
    reference: 'order-1',
    description: 'Order',
    status: 'COMPLETED',
    initiatedBy: 'platform:mcom-mall',
    createdAt: new Date('2026-10-21T10:00:00Z'),
  };

  beforeEach(async () => {
    prisma = {
      walletTransaction: {
        findUnique: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [WalletLedgerService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<WalletLedgerService>(WalletLedgerService);
    jest.clearAllMocks();
  });

  describe('getTransactionById', () => {
    it('returns a transaction when the caller owns the wallet', async () => {
      prisma.walletTransaction.findUnique.mockResolvedValue(txn);

      const result = await service.getTransactionById('txn-1', 'wallet-1');

      expect(result.id).toBe('txn-1');
      expect(prisma.walletTransaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'txn-1' },
      });
    });

    it('does not leak another wallet’s transaction', async () => {
      prisma.walletTransaction.findUnique.mockResolvedValue(txn);

      await expect(service.getTransactionById('txn-1', 'wallet-other')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns not found for an unknown transaction', async () => {
      prisma.walletTransaction.findUnique.mockResolvedValue(null);

      await expect(service.getTransactionById('missing', 'wallet-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('preserves partner lookups without a wallet scope', async () => {
      prisma.walletTransaction.findUnique.mockResolvedValue(txn);

      const result = await service.getTransactionById('txn-1');

      expect(result.id).toBe('txn-1');
    });
  });
});
