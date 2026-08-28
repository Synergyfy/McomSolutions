import * as crypto from 'crypto';

/**
 * Verify an `X-Mcom-Signature: sha256=<hmac-hex>` style body signature.
 * Uses `timingSafeEqual` to prevent timing attacks. Returns false (never throws)
 * on any mismatch.
 */
export function verifyHmac(
  body: string | Buffer,
  receivedSig: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(receivedSig.replace(/^sha256=/, ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}