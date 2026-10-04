import { hashOtp, normalizeOtpEmail, otpCooldownKey, otpKey, verifyOtpHash } from './otp.util';

describe('otp.util', () => {
  it('should normalize emails for key building', () => {
    expect(normalizeOtpEmail('  TEST@Example.COM ')).toBe('test@example.com');
    expect(otpKey('OTP', 'TEST@Example.COM')).toBe('otp:OTP:test@example.com');
    expect(otpCooldownKey('PASSWORD_RESET', 'Test@Example.com')).toBe(
      'otp:cooldown:PASSWORD_RESET:test@example.com',
    );
  });

  it('should hash deterministically and verify with constant-time compare', () => {
    const pepper = 'test-pepper';
    const h1 = hashOtp('123456', pepper);
    expect(hashOtp('123456', pepper)).toBe(h1);
    expect(verifyOtpHash('123456', h1, pepper)).toBe(true);
    expect(verifyOtpHash('000000', h1, pepper)).toBe(false);
    expect(verifyOtpHash('123456', h1, 'wrong-pepper')).toBe(false);
  });

  it('should not leak the plaintext code in the hash', () => {
    const h = hashOtp('123456', 'test-pepper');
    expect(h).not.toContain('123456');
  });
});
