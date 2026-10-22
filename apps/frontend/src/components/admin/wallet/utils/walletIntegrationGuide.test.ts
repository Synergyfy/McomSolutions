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
});
