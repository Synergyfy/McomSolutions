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

  it('documents payer attribution: CHS ids, intent-first and confirm-time matching', () => {
    const guide = generateWalletIntegrationGuide();

    expect(guide).toContain('every user id you send is a Central Hub Solution (CHS) user id');
    expect(guide).toContain('### B4.1a Who is paying?');
    expect(guide).toContain('Required for every method** (card, PayPal and wallet)');
    expect(guide).toContain('### B4.1b Intent first, then payment');
    expect(guide).toContain('`payeeUserId` is the **payee\'s CHS user id**');
    expect(guide).toContain('If any detail differs, confirmation fails with **403**');
    expect(guide).toContain('the same CHS user id the charge was created for');
    expect(guide).toContain('payer mismatch');
    expect(guide).toContain('mcomUserId: string; paymentIntentId?: string; orderId?: string');
  });

  it('opens with an unmistakable identity rule, worked example and common mistakes', () => {
    const guide = generateWalletIntegrationGuide();

    expect(guide).toContain('# ⚠️ READ THIS FIRST — the identity rule');
    expect(guide).toContain('Every user id you send to MCOM must be a Central Hub Solution (CHS) user id');
    expect(guide).toContain('## Where do I get the CHS id?');
    expect(guide).toContain('✅ **This works.**');
    expect(guide).toContain('❌ **Every one of these fails with 400 and no money moves:**');
    expect(guide).toContain('## The only correct order (MCOM Pay)');
    expect(guide).toContain('## Common mistakes (all of these fail)');
    expect(guide).toContain('already used for a different payer');
    expect(guide).toContain('If you remember only one sentence');
  });
});
