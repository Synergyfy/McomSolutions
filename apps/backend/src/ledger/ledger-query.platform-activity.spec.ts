import { LedgerQueryService } from './ledger-query.service';

function buildHarness(transfers: any[], wallets: any[] = [], apps: any[] = [], charge: any = null) {
  const prisma: any = {
    glAccount: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'acc-platform',
        code: 'platform:wallet:GBP',
        balanceMinor: 121n,
        currency: 'GBP',
      }),
    },
    glTransfer: {
      findMany: jest.fn().mockResolvedValue(transfers),
    },
    wallet: { findMany: jest.fn().mockResolvedValue(wallets) },
    ssoClient: {
      findMany: jest.fn().mockResolvedValue(apps),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    appCharge: {
      findFirst: jest.fn().mockResolvedValue(charge),
      findMany: jest.fn().mockResolvedValue(charge ? [{ ...charge, _count: { splits: charge.splits?.length ?? 0 } }] : []),
    },
    user: {
      findMany: jest.fn().mockResolvedValue(
        (wallets as any[]).map((wallet) => ({
          id: wallet.id,
          email: null,
          firstName: wallet.user?.firstName ?? null,
          lastName: wallet.user?.lastName ?? null,
          businessProfile: wallet.user?.businessProfile ?? null,
        })),
      ),
    },
    programmeSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    walletTransaction: { findMany: jest.fn().mockResolvedValue([]) },
  };
  return { service: new LedgerQueryService(prisma), prisma };
}

function step(entries: any[]) {
  return {
    id: 'tx',
    amountMinor: entries.find((e) => e.direction === 'debit')?.amountMinor ?? 0n,
    currency: 'GBP',
    status: 'posted',
    postedAt: new Date('2026-11-20T23:39:42Z'),
    entries,
  };
}

function entry(account: any, direction: 'debit' | 'credit', amountMinor: bigint) {
  return { direction, amountMinor, currency: 'GBP', account };
}

const PLATFORM = { code: 'platform:wallet:GBP', type: 'PLATFORM_WALLET', ownerRef: null };
const BUYER = { code: 'wallet:buyer', type: 'LIABILITY_USER_WALLET', ownerRef: 'buyer' };
const MALL = { code: 'payable:app:mcom-mall', type: 'LIABILITY_APP_PAYABLE', ownerRef: 'mcom-mall' };

describe('LedgerQueryService.listEvents — one row per money event', () => {
  it('collapses the platform pass-through into debit and credit parties', async () => {
    const { service } = buildHarness(
      [
        {
          id: 'tr_settle',
          intent: 'ORDER',
          reference: 'order-1',
          description: 'MCOM Mall order',
          platformId: 'mcom-mall',
          initiatorType: 'app',
          createdAt: new Date('2026-11-20T23:39:42.665Z'),
          transactions: [step([entry(PLATFORM, 'debit', 3378n), entry(MALL, 'credit', 3378n)])],
        },
        {
          id: 'tr_fund',
          intent: 'ORDER',
          reference: 'order-1',
          description: 'MCOM Mall order',
          platformId: 'mcom-mall',
          initiatorType: 'app',
          createdAt: new Date('2026-11-20T23:39:42.623Z'),
          transactions: [step([entry(BUYER, 'debit', 3499n), entry(PLATFORM, 'credit', 3499n)])],
        },
      ],
      [
        {
          id: 'buyer',
          user: { firstName: 'Axel', lastName: 'Atkinsoo', businessProfile: { businessName: 'Test' } },
        },
      ],
      [{ clientId: 'mcom-mall', name: 'mcom mall' }],
    );

    const result = await service.listEvents({ page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      key: 'order-1',
      primaryIntent: 'ORDER',
      totalDebitMinor: '3499',
      totalCreditMinor: '3499',
      transfers: 2,
      debits: [{ account: 'wallet:buyer', label: 'Test · Axel Atkinsoo', amountMinor: '3499' }],
      credits: [
        { account: 'payable:app:mcom-mall', label: 'mcom mall', amountMinor: '3378' },
        { account: 'platform:wallet:GBP', label: 'Platform wallet', amountMinor: '121' },
      ],
    });
  });

  it('keeps separate events apart, newest first', async () => {
    const { service } = buildHarness([
      {
        id: 'tr_old',
        intent: 'TOP_UP',
        reference: 'topup-1',
        description: null,
        platformId: null,
        initiatorType: 'system',
        createdAt: new Date('2026-11-19T10:00:00Z'),
        transactions: [step([entry({ ...BUYER, code: 'wallet:b' }, 'debit', 500n), entry(PLATFORM, 'credit', 500n)])],
      },
      {
        id: 'tr_new',
        intent: 'ORDER',
        reference: 'order-2',
        description: null,
        platformId: 'mcom-mall',
        initiatorType: 'app',
        createdAt: new Date('2026-11-20T10:00:00Z'),
        transactions: [step([entry(PLATFORM, 'debit', 900n), entry(MALL, 'credit', 900n)])],
      },
    ], [], [{ clientId: 'mcom-mall', name: 'mcom mall' }]);

    const result = await service.listEvents({ page: 1, limit: 20 });

    expect(result.data.map((row) => row.key)).toEqual(['order-2', 'topup-1']);
    expect(result.data[0]).toMatchObject({
      debits: [{ label: 'Platform wallet', amountMinor: '900' }],
      credits: [{ label: 'mcom mall', amountMinor: '900' }],
    });
  });

  it('falls back to the transfer id when there is no reference', async () => {
    const { service } = buildHarness([
      {
        id: 'tr_solo',
        intent: 'ADJUSTMENT',
        reference: null,
        description: null,
        platformId: null,
        initiatorType: 'admin',
        createdAt: new Date('2026-11-20T10:00:00Z'),
        transactions: [step([entry(PLATFORM, 'debit', 200n), entry(MALL, 'credit', 200n)])],
      },
    ]);

    const result = await service.listEvents({ page: 1, limit: 20 });
    expect(result.data[0].key).toBe('tr_solo');
  });
});

describe('LedgerQueryService.getEvent — full detail', () => {
  it('returns parties, charge, splits, receipts and raw journal steps', async () => {
    const { service } = buildHarness(
      [
        {
          id: 'tr_1',
          intent: 'ORDER',
          reference: 'order-9',
          description: 'MCOM Mall order',
          platformId: 'mcom-mall',
          initiatorType: 'app',
          initiatorId: null,
          idempotencyKey: 'appcharge:ch_1:settle',
          reversalOfId: null,
          createdAt: new Date('2026-11-20T10:00:00Z'),
          transactions: [
            {
              id: 'tx_1',
              amountMinor: 9000n,
              currency: 'GBP',
              status: 'posted',
              postedAt: new Date('2026-11-20T10:00:00Z'),
              entries: [
                {
                  id: 'e1',
                  direction: 'debit',
                  amountMinor: 9000n,
                  currency: 'GBP',
                  walletTransactionId: 'wt_buyer',
                  account: BUYER,
                },
                {
                  id: 'e2',
                  direction: 'credit',
                  amountMinor: 8719n,
                  currency: 'GBP',
                  walletTransactionId: 'wt_seller',
                  account: { code: 'wallet:seller', type: 'LIABILITY_USER_WALLET', ownerRef: 'seller' },
                },
                {
                  id: 'e3',
                  direction: 'credit',
                  amountMinor: 281n,
                  currency: 'GBP',
                  walletTransactionId: null,
                  account: PLATFORM,
                },
              ],
            },
          ],
        },
      ],
      [
        { id: 'buyer', user: { firstName: 'Axel', lastName: 'Atkinsoo', businessProfile: { businessName: 'Test' } } },
        { id: 'seller', user: { firstName: 'Ada', lastName: 'Seller', businessProfile: { businessName: 'Acme' } } },
      ],
      [],
      {
        id: 'ch_1',
        appClientId: 'mcom-mall',
        method: 'wallet',
        status: 'paid',
        amountMinor: 9000n,
        feeMinor: 281n,
        netMinor: 8719n,
        refundedMinor: 0n,
        reference: 'order-9',
        mcomUserId: 'buyer-user',
        provider: 'wallet',
        providerRef: null,
        settlementState: 'SETTLED',
        paidAt: new Date('2026-11-20T10:00:00Z'),
        createdAt: new Date('2026-11-20T09:59:00Z'),
        splits: [
          {
            id: 'sp_1',
            payeeType: 'mcom_user',
            payeeUserId: 'seller-user',
            payeeExternalId: null,
            amountMinor: 9000n,
            feeMinor: 281n,
            netMinor: 8719n,
            status: 'credited',
            walletTransactionId: 'wt_seller',
            failureReason: null,
          },
        ],
      },
    );

    const result = await service.getEvent('order-9');

    expect(result.data.debits).toEqual([
      { account: 'wallet:buyer', label: 'Test · Axel Atkinsoo', amountMinor: '9000' },
    ]);
    expect(result.data.credits).toHaveLength(2);
    expect(result.data.charge).toMatchObject({
      id: 'ch_1',
      feeMinor: '281',
      netMinor: '8719',
      settlementState: 'SETTLED',
      splits: [expect.objectContaining({ status: 'credited', walletTransactionId: 'wt_seller' })],
    });
    expect(result.data.transfers[0].steps[0].entries[0]).toMatchObject({
      account: 'wallet:buyer',
      accountLabel: 'Test · Axel Atkinsoo',
      direction: 'debit',
      amountMinor: '9000',
    });
    expect(result.data.transfers[0].idempotencyKey).toBe('appcharge:ch_1:settle');
  });

  it('404s for an unknown event', async () => {
    const { service } = buildHarness([]);
    await expect(service.getEvent('nope')).rejects.toThrow(/not found/i);
  });

  it('names a guest buyer when the app supplied no Central Hub user', async () => {
    const { service } = buildHarness(
      [
        {
          id: 'tr_card',
          intent: 'ORDER',
          reference: 'order-guest',
          description: 'Card order',
          platformId: 'mcom-mall',
          initiatorType: 'app',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          transactions: [
            step([
              entry({ code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', ownerRef: 'stripe' }, 'debit', 4999n),
              entry(PLATFORM, 'credit', 4999n),
            ]),
          ],
        },
      ],
      [],
      [{ clientId: 'mcom-mall', name: 'mcom mall' }],
      {
        id: 'ch_guest',
        reference: 'order-guest',
        method: 'stripe',
        provider: 'stripe',
        mcomUserId: null,
        externalCustomerId: 'mall-customer-123',
        metadata: { userId: 'mall-customer-123' },
        splits: [],
        _count: { splits: 0 },
      },
    );

    const result = await service.listEvents({ page: 1, limit: 20 });

    expect(result.data[0].debits[0].label).toBe('Guest buyer (no MCOM account) · Stripe');
    expect(result.data[0].payer).toMatchObject({
      identified: false,
      mcomUserId: null,
      appCustomerRef: 'mall-customer-123',
    });
    expect(result.data[0].noPayee).toBe(true);
  });

  it('names the payer when a Central Hub user is supplied', async () => {
    const { service, prisma } = buildHarness(
      [
        {
          id: 'tr_card2',
          intent: 'ORDER',
          reference: 'order-known',
          description: null,
          platformId: 'mcom-mall',
          initiatorType: 'app',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          transactions: [
            step([
              entry({ code: 'gateway:stripe:GBP', type: 'ASSET_GATEWAY_CLEARING', ownerRef: 'stripe' }, 'debit', 1000n),
              entry(PLATFORM, 'credit', 1000n),
            ]),
          ],
        },
      ],
      [],
      [{ clientId: 'mcom-mall', name: 'mcom mall' }],
      {
        id: 'ch_known',
        reference: 'order-known',
        method: 'stripe',
        provider: 'stripe',
        mcomUserId: 'chs-user-1',
        externalCustomerId: null,
        metadata: null,
        splits: [{ id: 'sp' }],
        _count: { splits: 1 },
      },
    );
    prisma.user.findMany.mockResolvedValue([
      { id: 'chs-user-1', email: 'ada@example.com', firstName: 'Ada', lastName: 'Lovelace', businessProfile: null },
    ]);

    const result = await service.listEvents({ page: 1, limit: 20 });

    expect(result.data[0].debits[0].label).toBe('Ada Lovelace · paid by Stripe');
    expect(result.data[0].payer).toMatchObject({ identified: true, email: 'ada@example.com' });
    expect(result.data[0].noPayee).toBe(false);
  });
});
