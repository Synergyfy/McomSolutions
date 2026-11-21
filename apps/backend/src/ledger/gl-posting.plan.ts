import { BadRequestException } from '@nestjs/common';
import { parseAccountCode } from './account-code';

export type GlDirection = 'debit' | 'credit';

export interface GlLegInput {
  /** Account code, e.g. 'wallet:clx…', 'platform:wallet:GBP'. */
  account: string;
  direction: GlDirection;
  /** Always positive. The direction carries the sign. */
  amountMinor: bigint;
}

export interface GlStepInput {
  legs: GlLegInput[];
}

export interface GlPlanStep {
  /** Σ debit legs, equal to Σ credit legs. */
  amountMinor: bigint;
  /** Per-account movement, reduced across duplicate accounts in the step. */
  movements: Map<string, { debit: bigint; credit: bigint }>;
}

export interface GlPlan {
  steps: GlPlanStep[];
  /** Every account the transfer touches, deduped, in deterministic order. */
  accounts: string[];
}

function addTo(map: Map<string, { debit: bigint; credit: bigint }>, code: string, direction: GlDirection, amount: bigint) {
  const entry = map.get(code) ?? { debit: 0n, credit: 0n };
  if (direction === 'debit') entry.debit += amount;
  else entry.credit += amount;
  map.set(code, entry);
}

/**
 * Validate a transfer and reduce it to per-account movements.
 *
 * Pure and synchronous on purpose: the money-shape rules (positive amounts,
 * balanced steps, no accidental self-netting bugs) are testable without a
 * database, and the posting service cannot write anything the plan rejected.
 */
export function planPosting(steps: GlStepInput[]): GlPlan {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new BadRequestException('A ledger transfer needs at least one transaction.');
  }

  const accounts = new Set<string>();
  const planned: GlPlanStep[] = [];

  for (const [index, step] of steps.entries()) {
    if (!step || !Array.isArray(step.legs) || step.legs.length === 0) {
      throw new BadRequestException(`Ledger transaction ${index + 1} has no legs.`);
    }

    const movements = new Map<string, { debit: bigint; credit: bigint }>();
    let debits = 0n;
    let credits = 0n;

    for (const leg of step.legs) {
      // Validates the prefix and throws on an unknown account code.
      const spec = parseAccountCode(leg.account);

      if (typeof leg.amountMinor !== 'bigint') {
        throw new BadRequestException('Ledger amounts must be integer minor units (bigint).');
      }
      if (leg.amountMinor <= 0n) {
        throw new BadRequestException(
          `Ledger leg amount must be positive (${leg.account} got ${leg.amountMinor}).`,
        );
      }
      if (leg.direction !== 'debit' && leg.direction !== 'credit') {
        throw new BadRequestException(`Invalid ledger direction "${leg.direction}".`);
      }
      if (spec.currency !== 'GBP') {
        throw new BadRequestException(
          `The ledger is GBP-only; ${leg.account} is ${spec.currency}.`,
        );
      }

      addTo(movements, leg.account, leg.direction, leg.amountMinor);
      accounts.add(leg.account);
      if (leg.direction === 'debit') debits += leg.amountMinor;
      else credits += leg.amountMinor;
    }

    if (debits !== credits) {
      throw new BadRequestException(
        `Ledger transaction ${index + 1} is unbalanced: debit ${debits} != credit ${credits}.`,
      );
    }

    planned.push({ amountMinor: debits, movements });
  }

  return { steps: planned, accounts: [...accounts].sort() };
}

/**
 * Signed change to an account's normal-side balance.
 *
 * `balanceMinor` is always expressed on the account's normal side, so a
 * credit-normal wallet grows on credits and an asset-clearing account grows on
 * debits. Keeping one convention prevents the classic sign bug where a refund
 * increases a liability.
 */
export function balanceDelta(
  normalSide: GlDirection,
  movement: { debit: bigint; credit: bigint },
): bigint {
  return normalSide === 'debit'
    ? movement.debit - movement.credit
    : movement.credit - movement.debit;
}
