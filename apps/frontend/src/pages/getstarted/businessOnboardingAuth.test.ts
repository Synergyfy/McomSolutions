import { describe, expect, it, vi } from 'vitest';
import {
  assertSignupEmailAvailable,
  isDuplicateSignupError,
  signupErrorMessage,
} from './businessOnboardingAuth';

describe('business onboarding signup guards', () => {
  it('continues only when the email check succeeds and the account is absent', async () => {
    const checkEmail = vi.fn().mockResolvedValue({ exists: false });

    await expect(assertSignupEmailAvailable(checkEmail, 'owner@example.test')).resolves.toBeUndefined();
    expect(checkEmail).toHaveBeenCalledWith('owner@example.test');
  });

  it('stops signup with a clear message when the email is already registered', async () => {
    await expect(assertSignupEmailAvailable(async () => ({ exists: true }), 'owner@example.test'))
      .rejects.toThrow('An account with this email already exists. Please log in instead.');
  });

  it('propagates email-check failures so signup cannot proceed', async () => {
    const unavailable = new Error('request failed');
    await expect(assertSignupEmailAvailable(async () => { throw unavailable; }, 'owner@example.test'))
      .rejects.toBe(unavailable);
  });

  it('recognizes duplicate registration responses and surfaces API messages', () => {
    expect(isDuplicateSignupError({ response: { status: 409 } })).toBe(true);
    expect(isDuplicateSignupError({ response: { data: { message: 'Email already registered' } } })).toBe(true);
    expect(signupErrorMessage(
      { response: { data: { message: 'Verification service is unavailable' } } },
      'Signup failed',
    )).toBe('Verification service is unavailable');
  });
});
