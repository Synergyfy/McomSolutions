import { describe, expect, it } from 'vitest';
import { generateWalletIntegrationGuide } from './walletIntegrationGuide';

describe('generateWalletIntegrationGuide', () => {
  it('documents recurring billing and partner responsibilities', () => {
    const guide = generateWalletIntegrationGuide();

    expect(guide).toContain('# Part C — Recurring Billing (Subscriptions)');
    expect(guide).toContain('MCOM does not store a card or wallet mandate for partner charges');
    expect(guide).toContain('new charge each billing period');
    expect(guide).toContain('category: "SUBSCRIPTION"');
    expect(guide).toContain('${CLIENT_ID}-sub-${sub.id}-${period}');
    expect(guide).toContain('## C2. Dunning (recommended)');
  });

  it('documents payee splits: request, rules, settlement and fee bearer', () => {
    const guide = generateWalletIntegrationGuide();

    expect(guide).toContain('# Part G — Payee Splits: paying another user or business');
    expect(guide).toContain('"splits"');
    expect(guide).toContain('"payeeType": "mcom_user"');
    expect(guide).toContain('sum(splits[].amountMinor) === amountMinor');
    expect(guide).toContain('GET /api/v1/app-payments/charges/:id/splits');
    expect(guide).toContain('settlementState');
    expect(guide).toContain('GET /api/v1/app-payments/balance');
    expect(guide).toContain('Who pays the fee');
    expect(guide).toContain('largest-remainder');
  });

  it('documents the central ledger and the legacy migration path', () => {
    const guide = generateWalletIntegrationGuide();

    expect(guide).toContain('# Part H — What MCOM records (the central ledger)');
    expect(guide).toContain('sum(debits) === sum(credits)');
    expect(guide).toContain('never updated or deleted');
    expect(guide).toContain('Migrating from');
    expect(guide).toContain('/wallet/partner/debit');
    expect(guide).toContain('does **not** move on its own');
  });
});
