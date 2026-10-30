import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SsoService } from '../auth/sso.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { WalletEventsService } from './wallet-events.service';

const PARTNER = { clientId: 'mcom-mall', name: 'MCOM Mall', platformSlug: 'mall' };

describe('WalletService', () => {
  let service: WalletService;
  let prisma: any;
  let redis: any;
  let sso: any;

  const wallet = {
    id: 'w1',
    userId: 'u1',
    balance: new Decimal(100),
    currency: 'MCOM',
    status: 'ACTIVE',
    dailyDebitLimit: null,
    monthlyDebitLimit: null,
    maxBalance: null,
    createdAt: new Date('2026-08-26T00:00:00Z'),
    lastTransactionAt: null,
  };

  const txn = {
    id: 't1',
    walletId: 'w1',
    type: 'DEBIT',
    amount: new Decimal(50),
    balanceBefore: new Decimal(100),
    balanceAfter: new Decimal(50),
    currency: 'MCOM',
    platformClientId: 'mcom-mall',
    reference: 'ref-1',
    idempotencyKey: 'key-1',
    createdAt: new Date('2026-08-26T11:15:00Z'),
  };

  const mockPrisma = {
    wallet: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    walletTransaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
    },
    walletHold: {
      aggregate: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    // Interactive transactions (callback) and the legacy array form.
    $transaction: jest.fn((arg: any) =>
      typeof arg === 'function' ? arg(mockPrisma) : Promise.all(arg),
    ),
    // Prisma has no typed FOR UPDATE — the service issues one raw statement.
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'w1' }]),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setNx: jest.fn(),
    compareAndDelete: jest.fn(),
  };

  const mockSso = {
    getClientByClientId: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'WALLET_MAX_SINGLE_TXN') return 10000;
      if (key === 'WALLET_HOLD_DEFAULT_TTL_HOURS') return 24;
      return undefined;
    }),
  };

  const mockWalletEvents = {
    onTransactionProcessed: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        WalletLockUtil,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: SsoService, useValue: mockSso },
        { provide: ConfigService, useValue: mockConfig },
        { provide: WalletEventsService, useValue: mockWalletEvents },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    prisma = module.get(PrismaService);
    redis = module.get(RedisService);
    sso = module.get(SsoService);

    jest.clearAllMocks();

    // Defaults
    mockPrisma.wallet.findUnique.mockResolvedValue(wallet);
    mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue(wallet);
    mockPrisma.walletHold.aggregate.mockResolvedValue({ _sum: { amount: new Decimal(0) } });
    mockPrisma.walletTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.walletTransaction.findUnique.mockResolvedValue(null);
    mockPrisma.walletTransaction.create.mockResolvedValue(txn);
    mockPrisma.wallet.update.mockResolvedValue({ ...wallet, balance: txn.balanceAfter });
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(true);
    mockRedis.del.mockResolvedValue(true);
    mockRedis.setNx.mockResolvedValue(true);
    mockRedis.compareAndDelete.mockResolvedValue(true);
    mockSso.getClientByClientId.mockResolvedValue({ name: 'MCOM Mall', platformSlug: 'mall' });
  });

  describe('debitWallet', () => {
    it('debits wallet and creates a ledger entry atomically', async () => {
      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'SUBSCRIPTION', description: 'Gold package', reference: 'ref-1' },
        'key-1',
      );

      expect(receipt.transactionId).toBe('t1');
      expect(receipt.balanceBefore).toBe(100);
      expect(receipt.balanceAfter).toBe(50);
      expect(mockPrisma.walletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            walletId: 'w1',
            type: 'DEBIT',
            amount: new Decimal(50),
            balanceBefore: new Decimal(100),
            balanceAfter: new Decimal(50),
            platformClientId: 'mcom-mall',
            platformSlug: 'mall',
            idempotencyKey: 'key-1',
            status: 'COMPLETED',
          }),
        }),
      );
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
      // balance cache invalidated
      expect(mockRedis.del).toHaveBeenCalledWith('wallet:balance:u1');
      // idempotency result cached alongside the originating platform
      expect(mockRedis.set).toHaveBeenCalledWith(
        'wallet:idempotency:key-1',
        expect.objectContaining({
          receipt: expect.objectContaining({ transactionId: 't1' }),
          platformClientId: 'mcom-mall',
        }),
        86400,
      );
    });

    it('rejects debit with insufficient balance → 422 INSUFFICIENT_BALANCE', async () => {
      mockPrisma.wallet.findUniqueOrThrow.mockResolvedValue({ ...wallet, balance: new Decimal(10) });

      await expect(
        service.debitWallet(
          PARTNER,
          { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'Big order' },
          'key-2',
        ),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('returns cached result on retry with same idempotency key (no double debit)', async () => {
      mockRedis.get.mockResolvedValue({
        receipt: {
          success: true,
          transactionId: 't1',
          type: 'DEBIT',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 50,
          currency: 'MCOM',
          reference: 'ref-1',
          idempotencyKey: 'key-1',
          processedAt: '2026-08-26T11:15:00.000Z',
        },
        platformClientId: 'mcom-mall',
      });

      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'SUBSCRIPTION', description: 'Gold package' },
        'key-1',
      );

      expect(receipt.transactionId).toBe('t1');
      // No DB writes happened
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('falls back to DB when Redis cache missed after a restart', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.walletTransaction.findUnique.mockResolvedValue({ ...txn, idempotencyKey: 'key-1' });

      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'SUBSCRIPTION', description: 'Gold package' },
        'key-1',
      );

      expect(receipt.transactionId).toBe('t1');
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects an idempotency key reused across platforms → 409 collision', async () => {
      // mcom-mall already used key-7; a different platform retries it.
      mockRedis.get.mockResolvedValue({
        receipt: {
          success: true,
          transactionId: 't1',
          type: 'DEBIT',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 50,
          currency: 'MCOM',
          idempotencyKey: 'key-7',
          processedAt: '2026-08-26T11:15:00.000Z',
        },
        platformClientId: 'mcom-mall',
      });

      await expect(
        service.debitWallet(
          { clientId: 'mcom-loyalty', name: 'MCOM Loyalty', platformSlug: 'rewards' },
          { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'x' },
          'key-7',
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects debit when wallet is frozen → 403 WALLET_FROZEN', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({ ...wallet, status: 'FROZEN' });

      await expect(
        service.debitWallet(
          PARTNER,
          { userId: 'u1', amount: 10, category: 'PURCHASE', description: 'x' },
          'key-3',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('wallet lock', () => {
    it('returns cached result on retry with same idempotency key', async () => {
      mockRedis.get.mockResolvedValue({
        receipt: {
          success: true,
          transactionId: 't1',
          type: 'DEBIT',
          amount: 50,
          balanceBefore: 100,
          balanceAfter: 50,
          currency: 'MCOM',
          reference: 'ref-1',
          idempotencyKey: 'key-1',
          processedAt: '2026-08-26T11:15:00.000Z',
        },
        platformClientId: 'mcom-mall',
      });

      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'SUBSCRIPTION', description: 'Gold package' },
        'key-1',
      );
      expect(receipt.transactionId).toBe('t1');
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
    });

    it('throws 409 when the wallet lock is already held', async () => {
      mockRedis.setNx.mockResolvedValue(false);

      await expect(
        service.debitWallet(
          PARTNER,
          { userId: 'u1', amount: 10, category: 'PURCHASE', description: 'x' },
          'key-4',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('creditWallet', () => {
    it('credits wallet and creates a ledger entry atomically', async () => {
      mockPrisma.walletTransaction.create.mockResolvedValue({
        ...txn,
        type: 'CREDIT',
        amount: new Decimal(50),
        balanceBefore: new Decimal(100),
        balanceAfter: new Decimal(150),
      });

      const receipt = await service.creditWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'REWARD', description: 'Cashback', reference: 'cb-1' },
        'key-5',
      );

      expect(receipt.type).toBe('CREDIT');
      expect(receipt.balanceAfter).toBe(150);
      expect(mockPrisma.walletTransaction.create).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('wallet:balance:u1');
    });
  });

  describe('atomicity', () => {
    it('takes a row lock and writes a relative balance, never a stale snapshot', async () => {
      await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'x' },
        'key-a',
      );

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { decrement: new Decimal(50) } }),
        }),
      );
    });

    it('credits with an increment rather than an absolute write', async () => {
      mockPrisma.walletTransaction.create.mockResolvedValue({
        ...txn,
        type: 'CREDIT',
        balanceBefore: new Decimal(100),
        balanceAfter: new Decimal(150),
      });

      await service.creditWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'REWARD', description: 'cb' },
        'key-b',
      );

      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { increment: new Decimal(50) } }),
        }),
      );
    });

    it('returns the committed transaction when the key appears inside the row lock', async () => {
      // A concurrent request committed between the fast-path miss and the lock.
      mockPrisma.walletTransaction.findUnique.mockResolvedValue({
        ...txn,
        idempotencyKey: 'key-c',
      });

      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'x' },
        'key-c',
      );

      expect(receipt.transactionId).toBe('t1');
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it('recovers a unique-index race by returning the winning receipt', async () => {
      const winner = { ...txn, idempotencyKey: 'key-d' };
      // 1: pre-check miss, 2: in-lock duplicate miss, 3: post-collision recovery.
      mockPrisma.walletTransaction.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner);
      mockPrisma.walletTransaction.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      const receipt = await service.debitWallet(
        PARTNER,
        { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'x' },
        'key-d',
      );

      expect(receipt.transactionId).toBe('t1');
      expect(receipt.balanceAfter).toBe(50);
    });

    it('refuses to leave the wallet negative even if validation passed', async () => {
      mockPrisma.wallet.update.mockResolvedValue({ ...wallet, balance: new Decimal(-1) });

      await expect(
        service.debitWallet(
          PARTNER,
          { userId: 'u1', amount: 50, category: 'PURCHASE', description: 'x' },
          'key-e',
        ),
      ).rejects.toThrow('would go negative');
    });

    it('captures a hold exactly once with a compare-and-set', async () => {
      const hold = {
        id: 'h1',
        walletId: 'w1',
        amount: new Decimal(10),
        status: 'ACTIVE',
        platformClientId: 'mcom-mall',
        reference: 'ref-h1',
        description: 'hold',
      };
      mockPrisma.walletHold.findUnique.mockResolvedValue(hold);
      mockPrisma.walletHold.findUniqueOrThrow.mockResolvedValue({ ...hold, status: 'CAPTURED' });
      mockPrisma.walletHold.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.walletTransaction.create.mockResolvedValue({
        ...txn,
        amount: new Decimal(10),
        balanceBefore: new Decimal(100),
        balanceAfter: new Decimal(90),
      });

      const receipt = await service.captureHold(PARTNER, 'h1', 'SUBSCRIPTION');

      expect(receipt.balanceAfter).toBe(90);
      expect(mockPrisma.walletHold.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'h1', status: 'ACTIVE' } }),
      );
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ balance: { decrement: new Decimal(10) } }),
        }),
      );
    });

    it('does not debit twice when the hold was already captured', async () => {
      const hold = {
        id: 'h1',
        walletId: 'w1',
        amount: new Decimal(10),
        status: 'ACTIVE',
        platformClientId: 'mcom-mall',
        reference: 'ref-h1',
        description: 'hold',
      };
      mockPrisma.walletHold.findUnique.mockResolvedValue(hold);
      mockPrisma.walletHold.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.walletTransaction.findFirst.mockResolvedValue({ ...txn, holdId: 'h1' });

      const receipt = await service.captureHold(PARTNER, 'h1', 'SUBSCRIPTION');

      expect(receipt.transactionId).toBe('t1');
      expect(mockPrisma.walletTransaction.create).not.toHaveBeenCalled();
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });
  });

  describe('ensureWallet', () => {    it('creates a zero-balance wallet for a user without one', async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue(null);
      mockPrisma.wallet.create.mockResolvedValue({ ...wallet, id: 'w-new', userId: 'u-new', balance: new Decimal(0) });

      const result = await service.ensureWallet('u-new');
      expect(mockPrisma.wallet.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'u-new', balance: 0, currency: 'MCOM', status: 'ACTIVE' }),
      });
      expect(result.userId).toBe('u-new');
    });
  });
});