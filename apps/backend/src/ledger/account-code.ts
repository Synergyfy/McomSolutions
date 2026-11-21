import { BadRequestException } from '@nestjs/common';
import { GlAccountType } from '@prisma/client';

/**
 * Account codes are the ledger's public identity and are fully derivable from
 * their prefix, so the posting service can create a missing account without a
 * registry lookup. Adding an account kind means adding a branch here — that is
 * deliberate: a typo in a code must fail loudly, never become a new account.
 */
export interface AccountCodeSpec {
  code: string;
  type: GlAccountType;
  scope: 'platform' | 'wallet' | 'app' | 'payee' | 'gateway';
  ownerRef: string | null;
  /** Which side increases this account's balance. */
  normalSide: 'debit' | 'credit';
  currency: string;
}

const KNOWN_PREFIXES = [
  'wallet:',
  'platform:wallet:',
  'gateway:',
  'bank:',
  'payable:app:',
  'payable:payee:',
  'suspense:',
  'equity:opening',
] as const;

export const PLATFORM_WALLET_CODE = 'platform:wallet:GBP';
export const EQUITY_OPENING_CODE = 'equity:opening:GBP';
export const SUSPENSE_CODE = 'suspense:GBP';
export const BANK_CODE = 'bank:GBP';

export const walletAccountCode = (walletId: string) => `wallet:${walletId}`;
export const gatewayAccountCode = (provider: string) =>
  `gateway:${provider.toLowerCase()}:GBP`;
export const appPayableAccountCode = (clientId: string) => `payable:app:${clientId}`;
export const payeeAccountCode = (ref: string) => `payable:payee:${ref}`;

function currencyOf(code: string): string {
  const parts = code.split(':');
  const last = parts[parts.length - 1];
  return /^[A-Z]{3}$/.test(last) ? last : 'GBP';
}

/**
 * Parse and validate an account code. Throws `BadRequestException` for any
 * code that is not one of the known shapes — a typo must not silently create
 * a new account and unbalance the books.
 */
export function parseAccountCode(code: string): AccountCodeSpec {
  if (!code || typeof code !== 'string') {
    throw new BadRequestException('Ledger account code is required.');
  }

  if (!KNOWN_PREFIXES.some((p) => code.startsWith(p))) {
    throw new BadRequestException(
      `Unknown ledger account code "${code}". Expected one of: ${KNOWN_PREFIXES.join(', ')}`,
    );
  }

  let spec: AccountCodeSpec;

  if (code.startsWith('platform:wallet:')) {
    spec = { code, type: GlAccountType.PLATFORM_WALLET, scope: 'platform', ownerRef: null, normalSide: 'credit', currency: currencyOf(code) };
  } else if (code.startsWith('wallet:')) {
    const walletId = code.slice('wallet:'.length);
    if (!walletId) throw new BadRequestException('wallet: account codes need a wallet id.');
    spec = { code, type: GlAccountType.LIABILITY_USER_WALLET, scope: 'wallet', ownerRef: walletId, normalSide: 'credit', currency: currencyOf(code) };
  } else if (code.startsWith('gateway:')) {
    const provider = code.split(':')[1];
    if (!provider) throw new BadRequestException('gateway: account codes need a provider.');
    spec = { code, type: GlAccountType.ASSET_GATEWAY_CLEARING, scope: 'gateway', ownerRef: provider, normalSide: 'debit', currency: currencyOf(code) };
  } else if (code.startsWith('bank:')) {
    spec = { code, type: GlAccountType.ASSET_BANK, scope: 'platform', ownerRef: null, normalSide: 'debit', currency: currencyOf(code) };
  } else if (code.startsWith('payable:app:')) {
    const clientId = code.slice('payable:app:'.length);
    if (!clientId) throw new BadRequestException('payable:app: account codes need a client id.');
    spec = { code, type: GlAccountType.LIABILITY_APP_PAYABLE, scope: 'app', ownerRef: clientId, normalSide: 'credit', currency: currencyOf(code) };
  } else if (code.startsWith('payable:payee:')) {
    const ref = code.slice('payable:payee:'.length);
    if (!ref) throw new BadRequestException('payable:payee: account codes need a payee ref.');
    spec = { code, type: GlAccountType.LIABILITY_PAYABLE, scope: 'payee', ownerRef: ref, normalSide: 'credit', currency: currencyOf(code) };
  } else if (code.startsWith('suspense:')) {
    spec = { code, type: GlAccountType.SUSPENSE, scope: 'platform', ownerRef: null, normalSide: 'credit', currency: currencyOf(code) };
  } else {
    // equity:opening
    spec = { code, type: GlAccountType.EQUITY_OPENING, scope: 'platform', ownerRef: null, normalSide: 'credit', currency: currencyOf(code) };
  }

  return spec;
}
