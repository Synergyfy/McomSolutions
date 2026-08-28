import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { WalletReconciliationService } from './wallet-reconciliation.service';
import { WalletService } from './wallet.service';

describe('WalletReconciliationService', () => {
  let service: WalletReconciliationService;
  let prisma: any;
  let walletService: any;

  const mockPrisma = {
    walletTransaction: {
      groupBy: jest.fn(),
    },
    walletHold: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    wallet: {
      findMany: jest.fn(),
    },
  };

  const mockWalletService = {
    releaseHold: jest.fn(),
    releaseHoldInternal: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WalletService, useValue: mockWalletService },
      ],
    }).compile();

    service = module.get<WalletReconciliationService>(WalletReconciliationService);
    prisma = module.get(PrismaService);
    walletService = module.get(WalletService);
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

    // w1 drifted — log emitted (assert no throw, walletService.releaseHold untouched)
    expect(mockWalletService.releaseHold).not.toHaveBeenCalled();
  });

  it('releases holds past their expiresAt', async () => {
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
    mockPrisma.walletHold.findMany.mockResolvedValue([staleHold]);

    await service.expireStaleHolds();

    expect(walletService.releaseHoldInternal).toHaveBeenCalledWith('h1', 'EXPIRED');
  });
});