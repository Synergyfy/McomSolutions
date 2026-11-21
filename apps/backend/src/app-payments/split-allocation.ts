import { BadRequestException } from '@nestjs/common';

export interface SplitInput {
  payeeType: 'mcom_user' | 'external';
  payeeUserId?: string | null;
  payeeExternalId?: string | null;
  /** Gross share of the charge, in pence. */
  amountMinor: bigint;
}

export interface AllocatedSplit extends SplitInput {
  feeMinor: bigint;
  netMinor: bigint;
}

/**
 * Apportion a charge across payees.
 *
 * `Σ splits.amountMinor` must equal the charge gross — a split that does not
 * reconcile is a client bug, not something to guess around. The fee is
 * apportioned by weight using **largest remainder**, so the parts always sum to
 * exactly `feeMinor`: no penny is invented or lost.
 */
export function allocateSplits(
  amountMinor: bigint,
  feeMinor: bigint,
  splits: SplitInput[],
): AllocatedSplit[] {
  if (amountMinor <= 0n) {
    throw new BadRequestException('Charge amount must be greater than zero.');
  }
  if (!Array.isArray(splits) || splits.length === 0) {
    return [];
  }

  let total = 0n;
  for (const [index, split] of splits.entries()) {
    if (split.amountMinor <= 0n) {
      throw new BadRequestException(`Split ${index + 1} amount must be greater than zero.`);
    }
    if (split.payeeType === 'mcom_user' && !split.payeeUserId) {
      throw new BadRequestException(`Split ${index + 1} needs a payeeUserId.`);
    }
    if (split.payeeType === 'external' && !split.payeeExternalId) {
      throw new BadRequestException(`Split ${index + 1} needs a payeeExternalId.`);
    }
    total += split.amountMinor;
  }

  if (total !== amountMinor) {
    throw new BadRequestException(
      `Splits must sum to the charge amount: got ${total}, expected ${amountMinor}.`,
    );
  }

  const fees = allocateByWeight(feeMinor, splits.map((split) => split.amountMinor), amountMinor);

  return splits.map((split, index) => ({
    ...split,
    feeMinor: fees[index],
    netMinor: split.amountMinor - fees[index],
  }));
}

/**
 * Split `total` across weights so the parts sum exactly to `total`.
 * Classic largest-remainder: floor each share, then hand the leftover pence to
 * the largest fractional parts (ties broken by index, deterministically).
 */
export function allocateByWeight(total: bigint, weights: bigint[], weightSum: bigint): bigint[] {
  if (total === 0n) return weights.map(() => 0n);
  if (weightSum <= 0n) {
    throw new BadRequestException('Cannot allocate across a zero weight.');
  }

  const shares: bigint[] = [];
  const remainders: Array<{ index: number; remainder: bigint }> = [];
  let assigned = 0n;

  for (const [index, weight] of weights.entries()) {
    const numerator = total * weight;
    const share = numerator / weightSum;
    shares.push(share);
    remainders.push({ index, remainder: numerator % weightSum });
    assigned += share;
  }

  let leftover = total - assigned;
  if (leftover > 0n) {
    remainders.sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
    for (const item of remainders) {
      if (leftover === 0n) break;
      shares[item.index] += 1n;
      leftover -= 1n;
    }
  }

  return shares;
}
