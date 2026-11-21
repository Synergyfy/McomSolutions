import { BadRequestException } from '@nestjs/common';
import { allocateByWeight, allocateSplits } from './split-allocation';

describe('allocateByWeight', () => {
  it('splits evenly when it divides exactly', () => {
    expect(allocateByWeight(300n, [100n, 100n, 100n], 300n)).toEqual([100n, 100n, 100n]);
  });

  it('never loses or invents a penny', () => {
    const parts = allocateByWeight(100n, [1n, 1n, 1n], 3n);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(100n);
    expect(parts).toEqual([34n, 33n, 33n]);
  });

  it('gives leftover pence to the largest remainders', () => {
    // 10 across 1:1:1 -> floor 3,3,3 leftover 1 -> first (tie broken by index)
    const parts = allocateByWeight(10n, [1n, 1n, 1n], 3n);
    expect(parts).toEqual([4n, 3n, 3n]);
  });

  it('is proportional for uneven weights', () => {
    // 1000 across 70:30
    expect(allocateByWeight(1000n, [70n, 30n], 100n)).toEqual([700n, 300n]);
  });

  it('returns zeros for a zero total', () => {
    expect(allocateByWeight(0n, [5n, 5n], 10n)).toEqual([0n, 0n]);
  });
});

describe('allocateSplits', () => {
  const fee = 281n; // 2.9% + 20p on £90

  it('apportions the fee and net per payee, summing exactly', () => {
    const result = allocateSplits(9000n, fee, [
      { payeeType: 'mcom_user', payeeUserId: 'seller-a', amountMinor: 6000n },
      { payeeType: 'mcom_user', payeeUserId: 'seller-b', amountMinor: 3000n },
    ]);

    expect(result.map((s) => s.feeMinor)).toEqual([187n, 94n]);
    expect(result.map((s) => s.netMinor)).toEqual([5813n, 2906n]);
    expect(result.reduce((sum, s) => sum + s.feeMinor, 0n)).toBe(fee);
    expect(result.reduce((sum, s) => sum + s.netMinor, 0n)).toBe(9000n - fee);
  });

  it('handles an awkward three-way split without drift', () => {
    const result = allocateSplits(100n, 7n, [
      { payeeType: 'mcom_user', payeeUserId: 'a', amountMinor: 34n },
      { payeeType: 'mcom_user', payeeUserId: 'b', amountMinor: 33n },
      { payeeType: 'external', payeeExternalId: 'c', amountMinor: 33n },
    ]);

    expect(result.reduce((sum, s) => sum + s.feeMinor, 0n)).toBe(7n);
    expect(result.reduce((sum, s) => sum + s.netMinor, 0n)).toBe(93n);
  });

  it('rejects splits that do not sum to the charge', () => {
    expect(() =>
      allocateSplits(9000n, fee, [
        { payeeType: 'mcom_user', payeeUserId: 'a', amountMinor: 5000n },
      ]),
    ).toThrow(/must sum to the charge amount/i);
  });

  it('rejects a zero or missing payee', () => {
    expect(() =>
      allocateSplits(100n, 0n, [{ payeeType: 'mcom_user', amountMinor: 100n }]),
    ).toThrow(/payeeUserId/i);

    expect(() =>
      allocateSplits(100n, 0n, [{ payeeType: 'external', amountMinor: 100n }]),
    ).toThrow(/payeeExternalId/i);

    expect(() =>
      allocateSplits(100n, 0n, [{ payeeType: 'mcom_user', payeeUserId: 'a', amountMinor: 0n }]),
    ).toThrow(/greater than zero/i);
  });

  it('returns no splits when none were supplied (legacy behaviour)', () => {
    expect(allocateSplits(9000n, fee, [])).toEqual([]);
  });
});
