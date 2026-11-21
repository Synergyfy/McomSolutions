import { BadRequestException } from '@nestjs/common';
import { parseAccountCode } from './account-code';
import { balanceDelta, planPosting } from './gl-posting.plan';

describe('parseAccountCode', () => {
  it('derives the account type from the code prefix', () => {
    expect(parseAccountCode('wallet:w1')).toMatchObject({
      type: 'LIABILITY_USER_WALLET',
      scope: 'wallet',
      ownerRef: 'w1',
      normalSide: 'credit',
      currency: 'GBP',
    });

    expect(parseAccountCode('platform:wallet:GBP')).toMatchObject({
      type: 'PLATFORM_WALLET',
      normalSide: 'credit',
    });

    expect(parseAccountCode('gateway:stripe:GBP')).toMatchObject({
      type: 'ASSET_GATEWAY_CLEARING',
      scope: 'gateway',
      ownerRef: 'stripe',
      normalSide: 'debit',
    });

    expect(parseAccountCode('payable:app:mcom-mall')).toMatchObject({
      type: 'LIABILITY_APP_PAYABLE',
      ownerRef: 'mcom-mall',
    });

    expect(parseAccountCode('equity:opening:GBP')).toMatchObject({
      type: 'EQUITY_OPENING',
      normalSide: 'credit',
    });
  });

  it('rejects unknown codes instead of inventing an account', () => {
    expect(() => parseAccountCode('revenue:fee:GBP')).toThrow(BadRequestException);
    expect(() => parseAccountCode('wallet:')).toThrow(BadRequestException);
    expect(() => parseAccountCode('')).toThrow(BadRequestException);
  });

  it('treats a non-GBP suffix as a different currency', () => {
    expect(parseAccountCode('platform:wallet:USD').currency).toBe('USD');
  });
});

describe('planPosting', () => {
  it('plans a balanced three-leg wallet transfer', () => {
    const plan = planPosting([
      {
        legs: [
          { account: 'wallet:buyer', direction: 'debit', amountMinor: 9000n },
          { account: 'wallet:seller', direction: 'credit', amountMinor: 8719n },
          { account: 'platform:wallet:GBP', direction: 'credit', amountMinor: 281n },
        ],
      },
    ]);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].amountMinor).toBe(9000n);
    expect(plan.accounts).toEqual(['platform:wallet:GBP', 'wallet:buyer', 'wallet:seller']);
    expect(plan.steps[0].movements.get('wallet:buyer')).toEqual({ debit: 9000n, credit: 0n });
  });

  it('rejects an unbalanced step', () => {
    expect(() =>
      planPosting([
        {
          legs: [
            { account: 'wallet:buyer', direction: 'debit', amountMinor: 9000n },
            { account: 'wallet:seller', direction: 'credit', amountMinor: 8719n },
          ],
        },
      ]),
    ).toThrow(/unbalanced/i);
  });

  it('rejects zero, negative and non-integer amounts', () => {
    const legs = (amountMinor: any) => [
      { account: 'wallet:a', direction: 'debit' as const, amountMinor },
      { account: 'wallet:b', direction: 'credit' as const, amountMinor },
    ];

    expect(() => planPosting([{ legs: legs(0n) }])).toThrow(/positive/i);
    expect(() => planPosting([{ legs: legs(-100n) }])).toThrow(/positive/i);
    expect(() => planPosting([{ legs: legs(10.5 as any) }])).toThrow(/bigint/i);
  });

  it('rejects an empty transfer and an empty step', () => {
    expect(() => planPosting([])).toThrow(/at least one transaction/i);
    expect(() => planPosting([{ legs: [] }])).toThrow(/no legs/i);
  });

  it('rejects a non-GBP account', () => {
    expect(() =>
      planPosting([
        {
          legs: [
            { account: 'wallet:a', direction: 'debit', amountMinor: 100n },
            { account: 'platform:wallet:USD', direction: 'credit', amountMinor: 100n },
          ],
        },
      ]),
    ).toThrow(/GBP-only/i);
  });

  it('nets duplicate accounts inside one step', () => {
    const plan = planPosting([
      {
        legs: [
          { account: 'wallet:a', direction: 'debit', amountMinor: 500n },
          { account: 'wallet:a', direction: 'credit', amountMinor: 200n },
          { account: 'wallet:b', direction: 'credit', amountMinor: 300n },
        ],
      },
    ]);

    expect(plan.steps[0].movements.get('wallet:a')).toEqual({ debit: 500n, credit: 200n });
    expect(plan.steps[0].amountMinor).toBe(500n);
  });

  it('supports a multi-step transfer (gateway → platform → seller)', () => {
    const plan = planPosting([
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
    ]);

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[1].amountMinor).toBe(8719n);
  });
});

describe('balanceDelta', () => {
  it('grows credit-normal accounts on credits', () => {
    expect(balanceDelta('credit', { debit: 0n, credit: 500n })).toBe(500n);
    expect(balanceDelta('credit', { debit: 500n, credit: 0n })).toBe(-500n);
  });

  it('grows debit-normal accounts on debits', () => {
    expect(balanceDelta('debit', { debit: 500n, credit: 0n })).toBe(500n);
    expect(balanceDelta('debit', { debit: 0n, credit: 500n })).toBe(-500n);
  });
});
