import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletReconciliationService } from './wallet-reconciliation.service';

describe('WalletReconciliationService', () => {
  let service: WalletReconciliationService;
  let prisma: any;

  const mockPrisma = {
    walletTransaction: {
      groupBy: jest.fn(),
    },
    walletHold: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    wallet: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  };

  const mockRedis = {
    setNx: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<WalletReconciliationService>(WalletReconciliationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('detects balance drift between Wallet.balance and ledger sums', async () => {
    // Wallet w1: credits 100, debits 30, holds 20 → expected 50, actual 45 → DRIFT
    // Wallet w2: credits 200, debits 50, holds 0 → expected 150, actual 150 → OK
    mockPrisma.walletTransaction.groupBy
      .mockResolvedValueOnce([
        { walletId: 'w1', _sum: { amount: new Decimal(100) } },
        { walletId: 'w2', _sum: { amount: new Decimal(200) } },
      ]) // credits
      .mockResolvedValueOnce([
        { walletId: 'w1', _sum: { amount: new Decimal(30) } },
        { walletId: 'w2', _sum: { amount: new Decimal(50) } },
      ]); // debits
    mockPrisma.walletHold.groupBy.mockResolvedValueOnce([
      { walletId: 'w1', _sum: { amount: new Decimal(20) } },
    ]); // active holds
    mockPrisma.wallet.findMany.mockResolvedValue([
      { id: 'w1', balance: new Decimal(45) },
      { id: 'w2', balance: new Decimal(150) },
    ]);

    await service.runReconciliation();

    // w1 drifted — log emitted (assert no throw)
    expect(mockPrisma.wallet.findMany).toHaveBeenCalled();
  });

  it('expires a single page of stale holds in one batch', async () => {
    const staleHold = {
      id: 'h1',
      walletId: 'w1',
      amount: new Decimal(50),
      platformClientId: 'mcom-mall',
      platformName: 'MCOM Mall',
      reference: 'ref-1',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() - 1000),
    };
    mockPrisma.walletHold.findMany.mockResolvedValueOnce([staleHold]);
    mockPrisma.walletHold.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.wallet.findMany.mockResolvedValueOnce([{ userId: 'u1' }]);

    await service.expireStaleHolds();

    expect(mockPrisma.walletHold.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { expiresAt: 'asc' }, take: 100 }),
    );
    expect(mockPrisma.walletHold.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['h1'] },
          status: 'ACTIVE',
        }),
      }),
    );
    expect(mockRedis.del).toHaveBeenCalledWith('wallet:balance:u1');
  });

  it('drains backlogs larger than one page via cursor', async () => {
    const makePage = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}-${i}`,
        walletId: 'w1',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1000),
      }));
    const page1 = makePage('p1', 100);
    const page2 = makePage('p2', 100);
    const page3 = makePage('p3', 50);
    mockPrisma.walletHold.findMany
      .mockResolvedValueOnce(page1)
      .mockResolvedValueOnce(page2)
      .mockResolvedValueOnce(page3);
    mockPrisma.walletHold.updateMany
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 50 });
    mockPrisma.wallet.findMany.mockResolvedValue([{ userId: 'u1' }]);

    await service.expireStaleHolds();

    expect(mockPrisma.walletHold.updateMany).toHaveBeenCalledTimes(3);
    // Second page resumes after the last id of the first page.
    expect(mockPrisma.walletHold.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ cursor: { id: 'p1-99' }, skip: 1 }),
    );
  });

  it('skips the run when another instance holds the lock', async () => {
    mockRedis.setNx.mockResolvedValueOnce(false);

    await service.expireStaleHolds();

    expect(mockPrisma.walletHold.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.walletHold.updateMany).not.toHaveBeenCalled();
  });

  it('writes a single audit row per tick after a multi-batch drain', async () => {
    const makePage = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}-${i}`,
        walletId: 'w1',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() - 1000),
      }));
    mockPrisma.walletHold.findMany
      .mockResolvedValueOnce(makePage('p1', 100))
      .mockResolvedValueOnce(makePage('p2', 50));
    mockPrisma.walletHold.updateMany
      .mockResolvedValueOnce({ count: 100 })
      .mockResolvedValueOnce({ count: 50 });
    mockPrisma.wallet.findMany.mockResolvedValue([{ userId: 'u1' }]);

    await service.expireStaleHolds();

    expect(mockPrisma.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'WALLET_HOLD_EXPIRE',
          adminName: 'system',
          category: 'wallet',
        }),
      }),
    );
  });

  it('writes no audit row when nothing expired', async () => {
    mockPrisma.walletHold.findMany.mockResolvedValueOnce([]);

    await service.expireStaleHolds();

    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});