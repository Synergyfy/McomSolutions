import { encrypt, decrypt } from './crypto.util';

const KEY = '86d3b8c8ad1519806cd90234050daebe4d2dc95f1ea9d83d780cc73ebed00a3b';
const OTHER_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

describe('crypto.util (AES-256-GCM)', () => {
  it('should round-trip a plaintext value', () => {
    const plain = 'hm_test_secret_value_123';
    const encoded = encrypt(plain, KEY);
    expect(encoded).not.toBe(plain);
    expect(decrypt(encoded, KEY)).toBe(plain);
  });

  it('should produce a unique ciphertext per call (random IV)', () => {
    const plain = 'same-value';
    const a = encrypt(plain, KEY);
    const b = encrypt(plain, KEY);
    expect(a).not.toBe(b);
  });

  it('should throw when decrypted with the wrong key', () => {
    const encoded = encrypt('secret', KEY);
    expect(() => decrypt(encoded, OTHER_KEY)).toThrow();
  });

  it('should preserve format iv(24) + tag(32) + ciphertext', () => {
    const encoded = encrypt('hello', KEY);
    const ivLen = 24;
    const tagLen = 32;
    expect(encoded.length).toBeGreaterThan(ivLen + tagLen);
    expect(encoded.slice(0, ivLen)).toMatch(/^[0-9a-f]+$/);
  });
});