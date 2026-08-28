import { Decimal } from '@prisma/client/runtime/library';

/**
 * Financial arithmetic must ALWAYS use Prisma's Decimal type.
 * NEVER use JavaScript floating-point for money — float imprecision is a bug.
 */

export const toDecimal = (value: number | string | Decimal): Decimal =>
  value instanceof Decimal ? value : new Decimal(value);

export const safeAdd = (a: Decimal, b: Decimal): Decimal => a.plus(b);

export const safeSubtract = (a: Decimal, b: Decimal): Decimal => a.minus(b);

export const isGte = (a: Decimal, b: Decimal): boolean =>
  a.greaterThanOrEqualTo(b);

export const isPositive = (a: Decimal): boolean => a.greaterThan(0);