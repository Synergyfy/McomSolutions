/**
 * Shared client-side auth validation (Phase 7 frontend smoke).
 * Messages mirror the backend DTO errors so users see consistent copy.
 * Pure functions — covered by `validation.test.ts`.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export function isValidUkPostcode(postcode: string): boolean {
  return UK_POSTCODE_REGEX.test((postcode || '').trim());
}

export function normalizeUkPostcode(postcode: string): string {
  const clean = (postcode || '').toUpperCase().replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const compact = clean.replace(/\s+/g, '');
  return `${compact.slice(0, compact.length - 3)} ${compact.slice(-3)}`;
}

/** Returns an error message, or null when valid. */
export function validatePostcode(postcode: string, required: boolean): string | null {
  const value = (postcode || '').trim();
  if (!value) {
    return required ? 'Please enter your UK postcode.' : null;
  }
  if (!isValidUkPostcode(value)) {
    return 'Please enter a valid UK postcode (e.g. SW1A 1AA).';
  }
  return null;
}

/** Returns an error message, or null when valid. */
export function validateEmailAddress(email: string): string | null {
  if (!email || !isValidEmail(email)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

/** Backend requires min 8 chars with uppercase, number, and special char. */
export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }
  return null;
}

export function validateFullName(firstName: string, lastName: string): string | null {
  if (!firstName || !lastName) {
    return 'Please provide your first and last name.';
  }
  return null;
}

export interface SignupInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * Registration gate in submit order: name → email → password.
 * Returns the first error message, or null when the form may submit.
 */
export function validateSignup(input: SignupInput): string | null {
  return (
    validateFullName(input.firstName, input.lastName) ??
    validateEmailAddress(input.email) ??
    validatePassword(input.password)
  );
}
