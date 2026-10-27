import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAffiliatePortalUrl,
  getAuthUserDisplay,
  getRoleLabel,
  isAffiliateRole,
  readStoredAuthUser,
} from './authUser';

describe('readStoredAuthUser', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredAuthUser()).toBeNull();
  });

  it('prefers business_user over admin_user', () => {
    localStorage.setItem('business_user', JSON.stringify({ email: 'biz@x.com', role: 'BUSINESS' }));
    localStorage.setItem('admin_user', JSON.stringify({ email: 'admin@x.com', role: 'ADMIN' }));

    expect(readStoredAuthUser()?.email).toBe('biz@x.com');
  });

  it('falls back to admin_user', () => {
    localStorage.setItem('admin_user', JSON.stringify({ email: 'admin@x.com', role: 'ADMIN' }));

    expect(readStoredAuthUser()).toEqual({ email: 'admin@x.com', role: 'ADMIN' });
  });

  it('ignores malformed JSON', () => {
    localStorage.setItem('business_user', '{not json');

    expect(readStoredAuthUser()).toBeNull();
  });

  it('skips a stored record with no role', () => {
    localStorage.setItem('business_user', JSON.stringify({ email: 'biz@x.com' }));

    expect(readStoredAuthUser()?.email).toBe('biz@x.com');
  });
});

describe('getRoleLabel', () => {
  it('maps known roles to friendly labels', () => {
    expect(getRoleLabel('BUSINESS')).toBe('Business Owner');
    expect(getRoleLabel('customer')).toBe('Customer');
    expect(getRoleLabel('ADMIN')).toBe('Administrator');
    expect(getRoleLabel('ACCOUNT_MANAGER')).toBe('Account Manager');
  });

  it('falls back for unknown or missing roles', () => {
    expect(getRoleLabel('WHATEVER')).toBe('Member');
    expect(getRoleLabel(null)).toBe('Member');
  });
});

describe('getAuthUserDisplay', () => {
  it('returns null without a user', () => {
    expect(getAuthUserDisplay(null)).toBeNull();
  });

  it('prefers the business name for business accounts', () => {
    const display = getAuthUserDisplay({
      role: 'BUSINESS',
      firstName: 'Ada',
      lastName: 'Lovelace',
      businessProfile: { businessName: 'Acme Corp' },
    });

    expect(display?.name).toBe('Acme Corp');
    expect(display?.roleLabel).toBe('Business Owner');
    expect(display?.initials).toBe('AC');
  });

  it('builds the name from first and last name', () => {
    const display = getAuthUserDisplay({ role: 'CUSTOMER', firstName: 'Ada', lastName: 'Lovelace' });

    expect(display?.name).toBe('Ada Lovelace');
    expect(display?.initials).toBe('AL');
  });

  it('falls back to the email prefix', () => {
    const display = getAuthUserDisplay({ role: 'CUSTOMER', email: 'ada@example.com' });

    expect(display?.name).toBe('ada');
    expect(display?.email).toBe('ada@example.com');
  });

  it('limits initials to two characters', () => {
    const display = getAuthUserDisplay({ role: 'ADMIN', name: 'One Two Three' });

    expect(display?.initials).toBe('OT');
  });
});

describe('affiliate helpers', () => {
  it('detects affiliate roles case-insensitively', () => {
    expect(isAffiliateRole('AGENT')).toBe(true);
    expect(isAffiliateRole('consultant')).toBe(true);
    expect(isAffiliateRole('ACCOUNT_MANAGER')).toBe(true);
    expect(isAffiliateRole('BUSINESS')).toBe(false);
    expect(isAffiliateRole(undefined)).toBe(false);
  });

  it('points affiliate users at the portal dashboard', () => {
    expect(getAffiliatePortalUrl()).toMatch(/\/dashboard$/);
  });
});
