import { GlIntent } from '@prisma/client';
import {
  planSettlement,
  planWalletTransaction,
  toMinorUnits,
  type BackfillContext,
} from './backfill.rules';

function context(overrides: Partial<BackfillContext> = {}): BackfillContext {
  return {
    chargeByWalletTxnId: new Map(),
    topUpProviderByWalletTxnId: new Map(),
    settledWalletTxnIds: new Set(),
    referralWalletTxnIds: new Set(),
    ...overrides,
  };
}

const txn = (overrides: Record<string, unknown> = {}) => ({
  id: 'wt_1',
  walletId: 'w_1',
  type: 'DEBIT' as const,
  amount: 10,
  category: 'PURCHASE',
  platformClientId: null,
  metadata: null,
  ...overrides,
});

describe('toMinorUnits', () => {
  it('converts pounds to exact integer pence', () => {
    expect(toMinorUnits(10)).toBe(1000n);
    expect(toMinorUnits('10.005')).toBe(1001n);
    expect(toMinorUnits(0.1)).toBe(10n);
  });

  it('throws on a non-numeric amount rather than silently booking zero', () => {
    expect(() => toMinorUnits('not-a-number')).toThrow(/minor units/i);
  });
});

describe('planWalletTransaction', () => {
  it('attributes a top-up to the payment provider', () => {
    const plan = planWalletTransaction(
      txn({ type: 'CREDIT', category: 'TOP_UP', amount: 50, platformClientId: 'mcom-central', metadata: { provider: 'paypal' } }),
      context(),
    )!;

    expect(plan.intent).toBe(GlIntent.TOP_UP);
    expect(plan.inferred).toBe(false);
    expect(plan.legs).toEqual(
      expect.arrayContaining([
        { account: 'wallet:w_1', direction: 'credit', amountMinor: 5000n },
        { account: 'gateway:paypal:GBP', direction: 'debit', amountMinor: 5000n },
      ]),
    );
  });

  it('prefers the top-up request provider when metadata is missing', () => {
    const plan = planWalletTransaction(
      txn({ type: 'CREDIT', category: 'TOP_UP', metadata: null }),
      context({ topUpProviderByWalletTxnId: new Map([['wt_1', 'stripe']]) }),
    )!;

    expect(plan.legs).toEqual(
      expect.arrayContaining([{ account: 'gateway:stripe:GBP', direction: 'debit', amountMinor: 1000n }]),
    );
  });

  it('rebuilds a wallet-paid app charge with the fee split', () => {
    const plan = planWalletTransaction(
      txn({ category: 'PURCHASE', amount: 90, platformClientId: 'mcom-mall' }),
      context({
        chargeByWalletTxnId: new Map([
          [
            'wt_1',
            { appClientId: 'mcom-mall', amountMinor: 9000n, feeMinor: 281n, netMinor: 8719n, intent: GlIntent.ORDER },
          ],
        ]),
      }),
    )!;

    expect(plan.intent).toBe(GlIntent.ORDER);
    expect(plan.inferred).toBe(false);
    expect(plan.legs).toEqual([
      { account: 'wallet:w_1', direction: 'debit', amountMinor: 9000n },
      { account: 'payable:app:mcom-mall', direction: 'credit', amountMinor: 8719n },
      { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 281n },
    ]);
  });

  it('omits the fee leg when the charge took no fee', () => {
    const plan = planWalletTransaction(
      txn({ amount: 20 }),
      context({
        chargeByWalletTxnId: new Map([
          ['wt_1', { appClientId: 'app', amountMinor: 2000n, feeMinor: 0n, netMinor: 2000n }],
        ]),
      }),
    )!;

    expect(plan.intent).toBe(GlIntent.ORDER);
    expect(plan.legs).toHaveLength(2);
  });

  it('never emits a zero-amount leg for a reward-funded charge', () => {
    const plan = planWalletTransaction(
      txn({ amount: 20 }),
      context({
        chargeByWalletTxnId: new Map([
          ['wt_1', { appClientId: 'mcom-vcards', amountMinor: 2000n, feeMinor: 2000n, netMinor: 0n }],
        ]),
      }),
    )!;

    expect(plan.legs).toEqual([
      { account: 'wallet:w_1', direction: 'debit', amountMinor: 2000n },
      { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 2000n },
    ]);
  });

  it('falls back to a whole-app-payable credit when the stored split does not reconcile', () => {
    const plan = planWalletTransaction(
      txn({ amount: 20 }),
      context({
        chargeByWalletTxnId: new Map([
          ['wt_1', { appClientId: 'app', amountMinor: 2000n, feeMinor: 100n, netMinor: 1000n }],
        ]),
      }),
    )!;

    expect(plan.inferred).toBe(true);
    expect(plan.legs).toEqual([
      { account: 'wallet:w_1', direction: 'debit', amountMinor: 2000n },
      { account: 'payable:app:app', direction: 'credit', amountMinor: 2000n },
    ]);
  });

  it('sends platform-bound wallet spending to the platform wallet', () => {
    const plan = planWalletTransaction(
      txn({ category: 'SUBSCRIPTION', amount: 29, platformClientId: 'mcom-central' }),
      context(),
    )!;

    expect(plan.intent).toBe(GlIntent.SUBSCRIPTION);
    expect(plan.legs).toEqual([
      { account: 'wallet:w_1', direction: 'debit', amountMinor: 2900n },
      { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 2900n },
    ]);
  });

  it('attributes partner debits and credits to that app payable', () => {
    const debit = planWalletTransaction(txn({ platformClientId: 'mcom-loyalty' }), context())!;
    expect(debit.legs).toEqual([
      { account: 'wallet:w_1', direction: 'debit', amountMinor: 1000n },
      { account: 'payable:app:mcom-loyalty', direction: 'credit', amountMinor: 1000n },
    ]);

    const credit = planWalletTransaction(
      txn({ type: 'CREDIT', platformClientId: 'mcom-loyalty' }),
      context(),
    )!;
    expect(credit.legs).toEqual([
      { account: 'wallet:w_1', direction: 'credit', amountMinor: 1000n },
      { account: 'payable:app:mcom-loyalty', direction: 'debit', amountMinor: 1000n },
    ]);
  });

  it('labels a referral reward and funds it from opening equity', () => {
    const plan = planWalletTransaction(
      txn({ type: 'CREDIT', category: 'REWARD', platformClientId: 'mcom-central' }),
      context({ referralWalletTxnIds: new Set(['wt_1']) }),
    )!;

    expect(plan.intent).toBe(GlIntent.REFERRAL_COMMISSION);
    expect(plan.inferred).toBe(true);
    expect(plan.legs).toEqual([
      { account: 'wallet:w_1', direction: 'credit', amountMinor: 1000n },
      { account: 'equity:opening:GBP', direction: 'debit', amountMinor: 1000n },
    ]);
  });

  it('falls back to opening equity for unattributable movements', () => {
    const plan = planWalletTransaction(
      txn({ type: 'CREDIT', category: 'ADMIN_CREDIT', platformClientId: 'mcom-central' }),
      context(),
    )!;

    expect(plan.intent).toBe(GlIntent.ADJUSTMENT);
    expect(plan.inferred).toBe(true);
    expect(plan.legs).toEqual(
      expect.arrayContaining([{ account: 'equity:opening:GBP', direction: 'debit', amountMinor: 1000n }]),
    );
  });

  it('skips transactions a settlement transfer already covers', () => {
    expect(
      planWalletTransaction(txn(), context({ settledWalletTxnIds: new Set(['wt_1']) })),
    ).toBeNull();
  });

  it('skips non-positive amounts', () => {
    expect(planWalletTransaction(txn({ amount: 0 }), context())).toBeNull();
  });
});

describe('planSettlement', () => {
  it('posts business debit, affiliate credit and platform retention', () => {
    const plan = planSettlement({
      id: 'set_1',
      businessWalletId: 'w_biz',
      affiliateWalletId: 'w_aff',
      businessChargeMinor: 10000n,
      affiliatePayoutMinor: 8000n,
      fundingSource: 'BUSINESS_WALLET',
    })!;

    expect(plan.intent).toBe(GlIntent.DELEGATION);
    expect(plan.legs).toEqual([
      { account: 'wallet:w_biz', direction: 'debit', amountMinor: 10000n },
      { account: 'wallet:w_aff', direction: 'credit', amountMinor: 8000n },
      { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 2000n },
    ]);
  });

  it('funds a platform payout from the platform wallet with no business leg', () => {
    const plan = planSettlement({
      id: 'set_2',
      businessWalletId: 'w_biz',
      affiliateWalletId: 'w_aff',
      businessChargeMinor: 0n,
      affiliatePayoutMinor: 8000n,
      fundingSource: 'PLATFORM',
    })!;

    expect(plan.legs).toEqual([
      { account: 'platform:wallet:GBP', direction: 'debit', amountMinor: 8000n },
      { account: 'wallet:w_aff', direction: 'credit', amountMinor: 8000n },
    ]);
  });

  it('parks an unknown affiliate on opening equity and flags it', () => {
    const plan = planSettlement({
      id: 'set_3',
      businessWalletId: 'w_biz',
      affiliateWalletId: null,
      businessChargeMinor: 10000n,
      affiliatePayoutMinor: 8000n,
      fundingSource: 'BUSINESS_WALLET',
    })!;

    expect(plan.inferred).toBe(true);
    expect(plan.legs).toEqual(
      expect.arrayContaining([{ account: 'equity:opening:GBP', direction: 'credit', amountMinor: 8000n }]),
    );
  });

  it('returns null when there is nothing to settle', () => {
    expect(
      planSettlement({
        id: 'set_4',
        businessWalletId: 'w_biz',
        affiliateWalletId: 'w_aff',
        businessChargeMinor: 0n,
        affiliatePayoutMinor: 0n,
        fundingSource: 'BUSINESS_WALLET',
      }),
    ).toBeNull();
  });
});
