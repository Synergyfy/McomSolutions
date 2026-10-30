import {
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';

/** Stable partner error codes shared with MCOM Rewards. */
export const PARTNER_ERRORS = {
  RECIPIENT_NOT_FOUND: 'RECIPIENT_NOT_FOUND',
  RECIPIENT_NOT_A_BUSINESS: 'RECIPIENT_NOT_A_BUSINESS',
  PLAN_NOT_AVAILABLE: 'PLAN_NOT_AVAILABLE',
  TIER_NOT_AVAILABLE: 'TIER_NOT_AVAILABLE',
  MEMBERSHIP_CONFLICT: 'MEMBERSHIP_CONFLICT',
  INVALID_DURATION: 'INVALID_DURATION',
  GRANT_NOT_FOUND: 'GRANT_NOT_FOUND',
  GRANT_NOT_REVOCABLE: 'GRANT_NOT_REVOCABLE',
  CODE_ALREADY_EXISTS: 'CODE_ALREADY_EXISTS',
  COUPON_NOT_FOUND: 'COUPON_NOT_FOUND',
  COUPON_ALREADY_REDEEMED: 'COUPON_ALREADY_REDEEMED',
  LOCKED_USER_NOT_FOUND: 'LOCKED_USER_NOT_FOUND',
  INVALID_RECIPIENT_LOOKUP: 'INVALID_RECIPIENT_LOOKUP',
  ACCESS_PASS_BUSINESS_ONLY: 'ACCESS_PASS_BUSINESS_ONLY',
} as const;

/**
 * Throws the Central error envelope with a stable `code` alongside `message`.
 * `AllExceptionsFilter` surfaces `code` when present.
 */
export function partnerError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): HttpException {
  return new HttpException({ code, message, ...(extra ?? {}) }, status);
}

export function unprocessable(code: string, message: string): HttpException {
  return new UnprocessableEntityException({ code, message });
}

export const PARTNER_HTTP = {
  BAD_REQUEST: HttpStatus.BAD_REQUEST,
  UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  UNPROCESSABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  SERVICE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
} as const;
