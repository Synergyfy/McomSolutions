import { GlPostingService } from './gl-posting.service';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { GlIntent, type GlAccount } from '@prisma/client';

function account(overrides: Partial<GlAccount> & { code: string }): GlAccount {
  return {
    id: `glacct_${overrides.code}`,
    type: 'LIABILITY_USER_WALLET',
    currency: 'GBP',
    scope: 'wallet',
    ownerRef: null,
    balanceMinor: 0n,
    status: 'ACTIVE',
    isSystem: false,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as GlAccount;
}

function buildHarness(accounts: GlAccount[]) {
  const byCode = new Map(accounts.map((a) => [a.code, a]));

  const tx: any = {
    glTransfer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'tr_1' }),
    },
    glTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'gt_1' }),
    },
    glEntry: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    glAccount: {
      findMany: jest.fn().mockImplementation(async ({ where }: any) => {
        const codes: string[] = where?.code?.in ?? [];
        return codes.map((c) => byCode.get(c)).filter(Boolean);
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };

  const chart = {
    ensureAccounts: jest.fn().mockImplementation(async (_tx: any, codes: string[]) => {
      const map = new Map<string, GlAccount>();
      for (const code of codes) {
        const found = byCode.get(code);
        if (!found) throw new Error(`test: unregistered account ${code}`);
        map.set(code, found);
      }
      return map;
    }),
  };

  const prisma: any = {};
  const service = new GlPostingService(prisma, chart as unknown as ChartOfAccountsService);

  return { service, tx, chart, byCode };
}

const baseInput = {
  intent: GlIntent.ORDER,
  platformId: 'mcom-mall',
  reference: 'order_1',
  initiatorType: 'app' as const,
  idempotencyKey: 'settle:order_1',
};

describe('GlPostingService', () => {
  it('posts a balanced three-leg transfer and moves each balance once', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 20_000n }),
      account({ code: 'wallet:seller', balanceMinor: 0n }),
      account({ code: 'platform:wallet:GBP', type: 'PLATFORM_WALLET', scope: 'platform', balanceMinor: 0n }),
    ]);

    const result = await service.post(tx, {
      ...baseInput,
      transactions: [
        {
          legs: [
            { account: 'wallet:buyer', direction: 'debit', amountMinor: 9000n },
            { account: 'wallet:seller', direction: 'credit', amountMinor: 8719n },
            { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 281n },
          ],
        },
      ],
    });

    expect(result).toEqual({ transferId: 'tr_1', replayed: false });
    expect(tx.glTransfer.create).toHaveBeenCalledTimes(1);
    expect(tx.glTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.glEntry.createMany).toHaveBeenCalledTimes(1);

    const entries = tx.glEntry.createMany.mock.calls[0][0].data;
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: 'glacct_wallet:buyer', direction: 'debit', amountMinor: 9000n }),
        expect.objectContaining({ accountId: 'glacct_wallet:seller', direction: 'credit', amountMinor: 8719n }),
        expect.objectContaining({ accountId: 'glacct_platform:wallet:GBP', direction: 'credit', amountMinor: 281n }),
      ]),
    );

    // Wallet balance is credit-normal: a debit reduces it.
    expect(tx.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'wallet:buyer' },
      data: { balanceMinor: { increment: -9000n } },
    });
    expect(tx.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'wallet:seller' },
      data: { balanceMinor: { increment: 8719n } },
    });
    expect(tx.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'platform:wallet:GBP' },
      data: { balanceMinor: { increment: 281n } },
    });
  });

  it('refuses to write anything when the transfer is unbalanced', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 20_000n }),
      account({ code: 'wallet:seller' }),
    ]);

    await expect(
      service.post(tx, {
        ...baseInput,
        transactions: [
          {
            legs: [
              { account: 'wallet:buyer', direction: 'debit', amountMinor: 9000n },
              { account: 'wallet:seller', direction: 'credit', amountMinor: 8000n },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/unbalanced/i);

    expect(tx.glTransfer.create).not.toHaveBeenCalled();
    expect(tx.glEntry.createMany).not.toHaveBeenCalled();
    expect(tx.glAccount.update).not.toHaveBeenCalled();
  });

  it('replays an existing transfer for the same idempotency key', async () => {
    const { service, tx } = buildHarness([]);
    tx.glTransfer.findUnique.mockResolvedValue({ id: 'tr_existing' });

    const result = await service.post(tx, {
      ...baseInput,
      transactions: [
        {
          legs: [
            { account: 'wallet:a', direction: 'debit', amountMinor: 1n },
            { account: 'wallet:b', direction: 'credit', amountMinor: 1n },
          ],
        },
      ],
    });

    expect(result).toEqual({ transferId: 'tr_existing', replayed: true });
    expect(tx.glTransfer.create).not.toHaveBeenCalled();
  });

  it('adopts the winner when a concurrent request claims the same key', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:a', balanceMinor: 100n }),
      account({ code: 'wallet:b' }),
    ]);

    const { Prisma } = jest.requireActual('@prisma/client');
    tx.glTransfer.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    tx.glTransfer.findUnique
      .mockResolvedValueOnce(null) // pre-check
      .mockResolvedValueOnce({ id: 'tr_winner' }); // after the race

    const result = await service.post(tx, {
      ...baseInput,
      transactions: [
        {
          legs: [
            { account: 'wallet:a', direction: 'debit', amountMinor: 50n },
            { account: 'wallet:b', direction: 'credit', amountMinor: 50n },
          ],
        },
      ],
    });

    expect(result).toEqual({ transferId: 'tr_winner', replayed: true });
    expect(tx.glEntry.createMany).not.toHaveBeenCalled();
  });

  it('blocks a wallet debit that would overdraw', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 100n }),
      account({ code: 'wallet:seller' }),
    ]);

    await expect(
      service.post(tx, {
        ...baseInput,
        transactions: [
          {
            legs: [
              { account: 'wallet:buyer', direction: 'debit', amountMinor: 9000n },
              { account: 'wallet:seller', direction: 'credit', amountMinor: 9000n },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'INSUFFICIENT_BALANCE' } });

    expect(tx.glTransfer.create).not.toHaveBeenCalled();
    expect(tx.glAccount.update).not.toHaveBeenCalled();
  });

  it('blocks the platform wallet from funding beyond its balance', async () => {
    const { service, tx } = buildHarness([
      account({
        code: 'platform:wallet:GBP',
        type: 'PLATFORM_WALLET',
        scope: 'platform',
        balanceMinor: 100n,
      }),
      account({ code: 'wallet:referrer' }),
    ]);

    await expect(
      service.post(tx, {
        ...baseInput,
        intent: GlIntent.REFERRAL_COMMISSION,
        initiatorType: 'system',
        transactions: [
          {
            legs: [
              { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 500n },
              { account: 'wallet:referrer', direction: 'credit', amountMinor: 500n },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ response: { error: 'INSUFFICIENT_PLATFORM_BALANCE' } });
  });

  it('allows an explicitly whitelisted negative balance (backfill only)', async () => {
    const { service, tx } = buildHarness([
      account({
        code: 'platform:wallet:GBP',
        type: 'PLATFORM_WALLET',
        scope: 'platform',
        balanceMinor: 0n,
      }),
      account({ code: 'wallet:referrer' }),
    ]);

    const result = await service.post(tx, {
      ...baseInput,
      initiatorType: 'system',
      idempotencyKey: 'backfill:1',
      allowNegative: ['platform:wallet:GBP'],
      transactions: [
        {
          legs: [
            { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 500n },
            { account: 'wallet:referrer', direction: 'credit', amountMinor: 500n },
          ],
        },
      ],
    });

    expect(result.replayed).toBe(false);
    expect(tx.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'platform:wallet:GBP' },
      data: { balanceMinor: { increment: -500n } },
    });
  });

  it('attaches the wallet receipt to exactly one ledger entry', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 20_000n }),
      account({ code: 'wallet:seller' }),
    ]);

    await service.post(tx, {
      ...baseInput,
      provenance: { walletTransactionId: 'wt_1' },
      transactions: [
        {
          legs: [
            { account: 'wallet:buyer', direction: 'debit', amountMinor: 100n },
            { account: 'wallet:seller', direction: 'credit', amountMinor: 100n },
          ],
        },
      ],
    });

    // Two wallet legs: a single receipt id cannot describe both, so neither
    // carries it (the caller writes one receipt per wallet).
    const entries = tx.glEntry.createMany.mock.calls[0][0].data;
    expect(entries.every((e: any) => e.walletTransactionId === null)).toBe(true);
  });

  it('links a receipt when the transfer has exactly one wallet leg', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 20_000n }),
      account({ code: 'platform:wallet:GBP', type: 'PLATFORM_WALLET', scope: 'platform' }),
    ]);

    await service.post(tx, {
      ...baseInput,
      intent: GlIntent.SUBSCRIPTION,
      provenance: { walletTransactionId: 'wt_1' },
      transactions: [
        {
          legs: [
            { account: 'wallet:buyer', direction: 'debit', amountMinor: 100n },
            { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 100n },
          ],
        },
      ],
    });

    const entries = tx.glEntry.createMany.mock.calls[0][0].data;
    const walletEntry = entries.find((e: any) => e.accountId === 'glacct_wallet:buyer');
    const platformEntry = entries.find((e: any) => e.accountId === 'glacct_platform:wallet:GBP');
    expect(walletEntry.walletTransactionId).toBe('wt_1');
    expect(platformEntry.walletTransactionId).toBeNull();
  });

  it('refuses to move money on a frozen account', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'wallet:buyer', balanceMinor: 20_000n, status: 'FROZEN' }),
      account({ code: 'wallet:seller' }),
    ]);

    await expect(
      service.post(tx, {
        ...baseInput,
        transactions: [
          {
            legs: [
              { account: 'wallet:buyer', direction: 'debit', amountMinor: 100n },
              { account: 'wallet:seller', direction: 'credit', amountMinor: 100n },
            ],
          },
        ],
      }),
    ).rejects.toThrow(/FROZEN/);

    expect(tx.glTransfer.create).not.toHaveBeenCalled();
  });

  it('posts multi-step transfers as separate balanced transactions', async () => {
    const { service, tx } = buildHarness([
      account({ code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', scope: 'gateway', balanceMinor: 0n }),
      account({ code: 'platform:wallet:GBP', type: 'PLATFORM_WALLET', scope: 'platform', balanceMinor: 0n }),
      account({ code: 'wallet:seller' }),
    ]);

    await service.post(tx, {
      ...baseInput,
      transactions: [
        {
          legs: [
            { account: 'gateway:stripe:GBP', direction: 'debit', amountMinor: 9000n },
            { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 9000n },
          ],
        },
        {
          legs: [
            { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 8719n },
            { account: 'wallet:seller', direction: 'credit', amountMinor: 8719n },
          ],
        },
      ],
    });

    expect(tx.glTransaction.create).toHaveBeenCalledTimes(2);
    expect(tx.glEntry.createMany).toHaveBeenCalledTimes(2);

    // Net across both steps: gateway +9000 (asset), platform +281 (net fee).
    expect(tx.glAccount.update).toHaveBeenCalledWith({
      where: { code: 'platform:wallet:GBP' },
      data: { balanceMinor: { increment: 281n } },
    });
  });
});
