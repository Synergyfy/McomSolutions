import { verifyHmac } from './hmac.util';
import * as crypto from 'crypto';

function sign(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyHmac', () => {
  const secret = 'hm_test_secret';
  const body = '{"hello":"world"}';

  it('should return true for a correct signature', () => {
    expect(verifyHmac(body, sign(body, secret), secret)).toBe(true);
  });

  it('should return false for a wrong signature (not throw)', () => {
    expect(verifyHmac(body, sign(body, 'wrong-secret'), secret)).toBe(false);
  });

  it('should return false for a tampered body', () => {
    const sig = sign(body, secret);
    expect(verifyHmac(body + 'x', sig, secret)).toBe(false);
  });

  it('should return false for garbage signature', () => {
    expect(verifyHmac(body, 'sha256=deadbeef', secret)).toBe(false);
  });

  it('should accept a Buffer body', () => {
    expect(verifyHmac(Buffer.from(body, 'utf8'), sign(body, secret), secret)).toBe(true);
  });
});