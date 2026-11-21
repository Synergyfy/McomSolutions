import { NotFoundException } from '@nestjs/common';
import { LedgerQueryService } from './ledger-query.service';

function buildHarness() {
  const prisma: any = {
    glAccount: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    glEntry: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amountMinor: 0n } }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    glTransfer: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    appCharge: { count: jest.fn().mockResolvedValue(0) },
    referralCommission: { count: jest.fn().mockResolvedValue(0) },
    wallet: { findMany: jest.fn().mockResolvedValue([]) },
    ssoClient: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([{ total: 0n }]),
  };

  return { service: new LedgerQueryService(prisma), prisma };
}

describe('LedgerQueryService', () => {
  it('summarises the balance sheet without mixing float and platform money', async () => {
    const { service, prisma } = buildHarness();
    prisma.glAccount.findMany.mockResolvedValue([
      { type: 'PLATFORM_WALLET', code: 'platform:wallet:GBP', balanceMinor: 2861854n, currency: 'GBP' },
      { type: 'LIABILITY_USER_WALLET', code: 'wallet:w1', balanceMinor: 409713n, currency: 'GBP' },
      { type: 'LIABILITY_APP_PAYABLE', code: 'payable:app:mcom-mall', balanceMinor: 45001n, currency: 'GBP' },
      { type: 'ASSET_GATEWAY_CLEARING', code: 'gateway:stripe:GBP', balanceMinor: 4414798n, currency: 'GBP' },
      { type: 'EQUITY_OPENING', code: 'equity:opening:GBP', balanceMinor: -230400n, currency: 'GBP' },
    ]);
    prisma.glAccount.findUnique.mockResolvedValue({ id: 'a1' });
    prisma.glEntry.aggregate
      .mockResolvedValueOnce({ _sum: { amountMinor: 10_000n } }) // inflow
      .mockResolvedValueOnce({ _sum: { amountMinor: 4_000n } }); // outflow

    const result = await service.overview();

    expect(result.data.platformWalletMinor).toBe('2861854');
    expect(result.data.userFloatMinor).toBe('409713');
    expect(result.data.owedToPartnersMinor).toBe('45001');
    expect(result.data.assetsMinor).toBe('4414798');
    expect(result.data.liabilitiesMinor).toBe('454714');
    expect(result.data.equityMinor).toBe('2631454');
    expect(result.data.inflow30dMinor).toBe('10000');
    expect(result.data.outflow30dMinor).toBe('4000');
    expect(result.data.net30dMinor).toBe('6000');
  });

  it('reports a missing platform wallet rather than inventing a balance', async () => {
    const { service } = buildHarness();
    const result = await service.platformWallet();
    expect(result.data.balanceMinor).toBe('0');
    expect(result.data.status).toBe('MISSING');
  });

  it('lists transfers with step/leg counts and the accounts they touch', async () => {
    const { service, prisma } = buildHarness();
    prisma.glTransfer.findMany.mockResolvedValue([
      {
        id: 'tr_1',
        intent: 'ORDER',
        platformId: 'mcom-mall',
        reference: 'order_1',
        description: 'Order',
        initiatorType: 'app',
        createdAt: new Date('2026-11-20T10:00:00Z'),
        transactions: [
          {
            entries: [
              { direction: 'debit', amountMinor: 9000n, account: { code: 'wallet:buyer' } },
              { direction: 'credit', amountMinor: 8719n, account: { code: 'wallet:seller' } },
              { direction: 'credit', amountMinor: 281n, account: { code: 'platform:wallet:GBP' } },
            ],
          },
        ],
      },
    ]);
    prisma.glTransfer.count.mockResolvedValue(1);

    const result = await service.listTransfers({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      id: 'tr_1',
      intent: 'ORDER',
      amountMinor: '9000',
      steps: 1,
      legs: 3,
      debitAccounts: ['wallet:buyer'],
    });
    expect(result.data[0].accounts).toEqual(
      expect.arrayContaining(['wallet:buyer', 'wallet:seller', 'platform:wallet:GBP']),
    );
  });

  it('returns the full trail and sibling transfers for a delegation', async () => {
    const { service, prisma } = buildHarness();
    prisma.glTransfer.findUnique.mockResolvedValue({
      id: 'tr_business',
      intent: 'DELEGATION',
      platformId: 'mcom-central',
      reference: 'affiliate-task:task_1:settle',
      description: 'Task',
      initiatorType: 'app',
      initiatorId: null,
      idempotencyKey: 'k1',
      reversalOfId: null,
      metadata: null,
      createdAt: new Date('2026-11-20T10:00:00Z'),
      transactions: [
        {
          id: 'tx_1',
          currency: 'GBP',
          amountMinor: 10000n,
          status: 'posted',
          postedAt: new Date('2026-11-20T10:00:00Z'),
          entries: [
            {
              id: 'e1',
              direction: 'debit',
              amountMinor: 10000n,
              currency: 'GBP',
              account: { code: 'wallet:business', type: 'LIABILITY_USER_WALLET', currency: 'GBP', ownerRef: 'w_biz' },
            },
            {
              id: 'e2',
              direction: 'credit',
              amountMinor: 10000n,
              currency: 'GBP',
              account: { code: 'platform:wallet:GBP', type: 'PLATFORM_WALLET', currency: 'GBP', ownerRef: null },
            },
          ],
        },
      ],
    });
    prisma.glTransfer.findMany.mockResolvedValue([
      {
        id: 'tr_affiliate',
        intent: 'DELEGATION',
        createdAt: new Date('2026-11-20T10:00:01Z'),
        transactions: [
          {
            entries: [
              { direction: 'debit', amountMinor: 8000n },
              { direction: 'credit', amountMinor: 8000n },
            ],
          },
        ],
      },
    ]);

    const result = await service.getTransfer('tr_business');

    expect(result.data.amountMinor).toBe('10000');
    expect(result.data.transactions[0].entries).toHaveLength(2);
    expect(result.data.siblings).toEqual([
      { id: 'tr_affiliate', intent: 'DELEGATION', createdAt: expect.any(String), amountMinor: '8000' },
    ]);
  });

  it('404s for an unknown transfer', async () => {
    const { service } = buildHarness();
    await expect(service.getTransfer('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('404s for entries on an unknown account', async () => {
    const { service } = buildHarness();
    await expect(service.accountEntries('wallet:nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
