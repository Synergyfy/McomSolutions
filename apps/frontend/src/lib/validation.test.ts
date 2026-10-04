import { describe, expect, it } from 'vitest';
import {
  isValidEmail,
  validateEmailAddress,
  validateFullName,
  validatePassword,
  validateSignup,
} from './validation';

describe('auth validation (Phase 7 frontend smoke)', () => {
  describe('isValidEmail', () => {
    it('accepts well-formed addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('a.b+tag@sub.domain.co')).toBe(true);
    });

    it('rejects malformed addresses', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@domain')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('validateEmailAddress', () => {
    it('returns null for valid input', () => {
      expect(validateEmailAddress('user@example.com')).toBeNull();
    });

    it('returns the registration copy for invalid input', () => {
      expect(validateEmailAddress('')).toBe('Please enter a valid email address.');
      expect(validateEmailAddress('bad')).toBe('Please enter a valid email address.');
    });
  });

  describe('validatePassword', () => {
    it('returns null for 8+ chars', () => {
      expect(validatePassword('StrongP@ss1')).toBeNull();
    });

    it('rejects short passwords', () => {
      expect(validatePassword('short')).toBe('Password must be at least 8 characters long.');
      expect(validatePassword('')).toBe('Password must be at least 8 characters long.');
    });
  });

  describe('validateSignup', () => {
    const valid = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'StrongP@ss1',
    };

    it('returns null for a valid form', () => {
      expect(validateSignup(valid)).toBeNull();
    });

    it('reports name first, then email, then password', () => {
      expect(validateSignup({ ...valid, firstName: '' })).toBe(
        'Please provide your first and last name.',
      );
      expect(validateSignup({ ...valid, email: 'bad' })).toBe(
        'Please enter a valid email address.',
      );
      expect(validateSignup({ ...valid, password: 'short' })).toBe(
        'Password must be at least 8 characters long.',
      );
    });
  });

  describe('validateFullName', () => {
    it('requires both names', () => {
      expect(validateFullName('Ada', 'Lovelace')).toBeNull();
      expect(validateFullName('', 'Lovelace')).toBe('Please provide your first and last name.');
      expect(validateFullName('Ada', '')).toBe('Please provide your first and last name.');
    });
  });
});
