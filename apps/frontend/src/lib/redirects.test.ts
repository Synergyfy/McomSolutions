import { describe, it, expect } from 'vitest';
import { isAuthOrOnboardingRedirect } from './redirects';

describe('isAuthOrOnboardingRedirect', () => {
  it('treats the onboarding funnel as a self-referential redirect', () => {
    expect(isAuthOrOnboardingRedirect('/getstarted/business')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/getstarted/business?source=mcommall')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/getstarted')).toBe(true);
  });

  it('treats auth and signup routes as unsafe destinations', () => {
    expect(isAuthOrOnboardingRedirect('/login')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/login?redirect=%2Fdashboard')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/register')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/register/customer')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/signup?role=business')).toBe(true);
    expect(isAuthOrOnboardingRedirect('/admin/login')).toBe(true);
  });

  it('keeps real in-app destinations', () => {
    expect(isAuthOrOnboardingRedirect('/dashboard')).toBe(false);
    expect(isAuthOrOnboardingRedirect('/dashboard/billing')).toBe(false);
    expect(isAuthOrOnboardingRedirect('/customer')).toBe(false);
  });

  it('keeps external redirects and drops same-origin auth/onboarding ones', () => {
    expect(isAuthOrOnboardingRedirect('https://partner.example.com/callback')).toBe(false);
    expect(isAuthOrOnboardingRedirect(`${window.location.origin}/getstarted/business`)).toBe(true);
  });

  it('returns false for empty values', () => {
    expect(isAuthOrOnboardingRedirect(null)).toBe(false);
    expect(isAuthOrOnboardingRedirect(undefined)).toBe(false);
    expect(isAuthOrOnboardingRedirect('')).toBe(false);
  });
});
