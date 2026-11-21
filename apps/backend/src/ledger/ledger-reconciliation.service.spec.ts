import { LedgerReconciliationService } from './ledger-reconciliation.service';

type AccountRow = {
  id: string;
  code: string;
  type: string;
  ownerRef: string | null;
  balanceMinor: bigint;
};

function account(overrides: Partial<AccountRow> & { code: string; id: string }): AccountRow {
  return {
    type: 'LIABILITY_USER_WALLET',
    ownerRef: null,
    balanceMinor: 0n,
    ...overrides,
  };
}

function buildHarness(accounts: AccountRow[], sums: any[], wallets: any[]) {
  const prisma: any = {
    glAccount: {
      findMany: jest.fn(async () => accounts.map((a) => ({ ...a }))),
      update: jest.fn(async ({ where, data }: any) => {
        const target = accounts.find((a) => a.code === where.code)!;
        target.balanceMinor = data.balanceMinor;
        return target;
      }),
    },
    glEntry: { groupBy: jest.fn(async () => sums) },
    wallet: { findMany: jest.fn(async () => wallets) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };

  return { service: new LedgerReconciliationService(prisma), prisma };
}

describe('LedgerReconciliationService', () => {
  it('reports healthy when balances match entries and the identity holds', async () => {
    const { service } = buildHarness(
      [
        account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 10000n }),
        account({ id: 'a2', code: 'wallet:w1', ownerRef: 'w1', balanceMinor: 10000n }),
      ],
      [
        { accountId: 'a1', direction: 'debit', _sum: { amountMinor: 10000n } },
        { accountId: 'a2', direction: 'credit', _sum: { amountMinor: 10000n } },
      ],
      [{ id: 'w1', userId: 'u1', balance: 100 }],
    );

    const report = await service.getReport();

    expect(report.healthy).toBe(true);
    expect(report.accountDrift).toEqual([]);
    expect(report.walletDrift).toEqual([]);
    expect(report.assetTotalMinor).toBe('10000');
    expect(report.liabilityTotalMinor).toBe('10000');
    expect(report.equityTotalMinor).toBe('0');
    expect(report.identityHolds).toBe(true);
  });

  it('detects a materialised balance that drifted from the journal', async () => {
    const { service } = buildHarness(
      [
        account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 9000n }),
        account({ id: 'a2', code: 'wallet:w1', ownerRef: 'w1', balanceMinor: 10000n }),
      ],
      [
        { accountId: 'a1', direction: 'debit', _sum: { amountMinor: 10000n } },
        { accountId: 'a2', direction: 'credit', _sum: { amountMinor: 10000n } },
      ],
      [{ id: 'w1', userId: 'u1', balance: 100 }],
    );

    const report = await service.getReport();

    expect(report.healthy).toBe(false);
    expect(report.accountDrift).toHaveLength(1);
    expect(report.accountDrift[0]).toMatchObject({
      code: 'gateway:stripe:GBP',
      storedMinor: '9000',
      expectedMinor: '10000',
      differenceMinor: '-1000',
    });
    // Assets (10000) != liabilities (10000) + equity (0) is unaffected here:
    // the identity uses the journal, not the stored cache.
    expect(report.identityHolds).toBe(true);
  });

  it('detects a wallet whose balance disagrees with its ledger account', async () => {
    const { service } = buildHarness(
      [
        account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 5000n }),
        account({ id: 'a2', code: 'wallet:w1', ownerRef: 'w1', balanceMinor: 5000n }),
      ],
      [
        { accountId: 'a1', direction: 'debit', _sum: { amountMinor: 5000n } },
        { accountId: 'a2', direction: 'credit', _sum: { amountMinor: 5000n } },
      ],
      [{ id: 'w1', userId: 'u1', balance: 42 }],
    );

    const report = await service.getReport();

    expect(report.walletDrift).toHaveLength(1);
    expect(report.walletDrift[0]).toMatchObject({
      walletId: 'w1',
      walletBalanceMinor: '4200',
      ledgerBalanceMinor: '5000',
      differenceMinor: '-800',
    });
    expect(report.healthy).toBe(false);
  });

  it('counts wallets that were never backfilled', async () => {
    const { service } = buildHarness(
      [account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 0n })],
      [],
      [{ id: 'w_missing', userId: 'u9', balance: 0 }],
    );

    const report = await service.getReport();

    expect(report.walletsWithoutAccount).toBe(1);
    expect(report.healthy).toBe(false);
  });

  it('rebuilds drifted balances from the journal and leaves entries untouched', async () => {
    const accounts = [
      account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 0n }),
      account({ id: 'a2', code: 'wallet:w1', ownerRef: 'w1', balanceMinor: 10000n }),
    ];
    const { service, prisma } = buildHarness(
      accounts,
      [
        { accountId: 'a1', direction: 'debit', _sum: { amountMinor: 10000n } },
        { accountId: 'a2', direction: 'credit', _sum: { amountMinor: 10000n } },
      ],
      [{ id: 'w1', userId: 'u1', balance: 100 }],
    );

    const result = await service.rebuildBalances();

    expect(result).toEqual({ repaired: 1, remainingDrift: 0 });
    expect(prisma.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'gateway:stripe:GBP' },
      data: { balanceMinor: 10000n },
    });
    expect(prisma.glEntry.groupBy).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the books already agree', async () => {
    const { service, prisma } = buildHarness(
      [account({ id: 'a1', code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', balanceMinor: 0n })],
      [],
      [],
    );

    const result = await service.rebuildBalances();

    expect(result).toEqual({ repaired: 0, remainingDrift: 0 });
    expect(prisma.glAccount.update).not.toHaveBeenCalled();
  });
});
