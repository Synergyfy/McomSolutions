import {
  appendQueryParam,
  generateTrackingCode,
  generateVoucherCode,
  hashIp,
  identityKey,
  isHttpUrl,
  minorToMajor,
  nextAffiliateCode,
  roundUnits,
  slugify,
  uniqueSlug,
} from './local-affiliate.util';
import { formatAffiliateCode } from './local-affiliate.constants';
import { Prisma } from '@prisma/client';

describe('local-affiliate utilities', () => {
  describe('formatAffiliateCode', () => {
    it('zero-pads to six digits with the LAF prefix', () => {
      expect(formatAffiliateCode(125)).toBe('LAF-000125');
      expect(formatAffiliateCode(1)).toBe('LAF-000001');
      expect(formatAffiliateCode(1234567)).toBe('LAF-1234567');
    });
  });

  describe('nextAffiliateCode', () => {
    it('formats the sequence value from Postgres (bigint-safe)', async () => {
      const client = {
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ nextval: BigInt(125) }]),
      };
      await expect(nextAffiliateCode(client as any)).resolves.toBe('LAF-000125');
      expect(client.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('local_affiliate_code_seq'),
      );
    });

    it('rejects a non-numeric sequence response instead of producing a broken code', async () => {
      const client = {
        $queryRawUnsafe: jest.fn().mockResolvedValue([{ nextval: null }]),
      };
      await expect(nextAffiliateCode(client as any)).rejects.toThrow();
    });
  });

  describe('generateTrackingCode', () => {
    it('is 10 url-safe base62 characters with no affiliate/offer identifiers', () => {
      const code = generateTrackingCode();
      expect(code).toHaveLength(10);
      expect(code).toMatch(/^[0-9a-zA-Z]{10}$/);
      expect(code).not.toContain('LAF');
    });

    it('does not collide across 2000 generations', () => {
      const codes = new Set(Array.from({ length: 2000 }, () => generateTrackingCode()));
      expect(codes.size).toBe(2000);
    });
  });

  describe('generateVoucherCode', () => {
    it('uses the unambiguous alphabet and an XXXX-XXXX shape', () => {
      const code = generateVoucherCode();
      expect(code).toMatch(/^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
    });

    it('never emits ambiguous characters 0/O/1/I/L', () => {
      for (let i = 0; i < 500; i++) {
        expect(generateVoucherCode()).not.toMatch(/[0O1IL]/);
      }
    });

    it('does not collide across 10000 generations', () => {
      const codes = new Set(Array.from({ length: 10000 }, () => generateVoucherCode()));
      expect(codes.size).toBe(10000);
    });
  });

  describe('hashIp', () => {
    it('hashes rather than storing the raw address', () => {
      const hashed = hashIp('203.0.113.7');
      expect(hashed).toHaveLength(32);
      expect(hashed).not.toContain('203.0.113.7');
    });

    it('returns null for an absent address', () => {
      expect(hashIp(undefined)).toBeNull();
      expect(hashIp('   ')).toBeNull();
    });

    it('is stable for the same input', () => {
      expect(hashIp('1.2.3.4')).toBe(hashIp('1.2.3.4'));
    });
  });

  describe('identityKey', () => {
    it('is stable and case-insensitive', () => {
      expect(identityKey('Customer@Example.com')).toBe(
        identityKey('customer@example.com'),
      );
    });

    it('generates a distinct anonymous key when no reference is supplied', () => {
      expect(identityKey(undefined)).not.toBe(identityKey(undefined));
      expect(identityKey(undefined)).toMatch(/^anon:/);
    });
  });

  describe('minorToMajor / roundUnits', () => {
    it('converts pence to pounds', () => {
      expect(minorToMajor(5000).toNumber()).toBe(50);
      expect(minorToMajor(null).toNumber()).toBe(0);
    });

    it('rounds points to whole units and credits to 2dp', () => {
      expect(roundUnits(new Prisma.Decimal(24.6), 'POINTS').toNumber()).toBe(25);
      expect(roundUnits(new Prisma.Decimal(2.456), 'CREDIT').toNumber()).toBe(2.46);
    });
  });

  describe('appendQueryParam', () => {
    it('appends to a URL without a query string', () => {
      expect(appendQueryParam('https://x.test/p', 'laf', 'abc')).toBe(
        'https://x.test/p?laf=abc',
      );
    });

    it('preserves existing query params and encodes brackets', () => {
      expect(
        appendQueryParam('https://x.test/p?a=1', 'passthrough[la_tracking_id]', 'abc'),
      ).toBe('https://x.test/p?a=1&passthrough%5Bla_tracking_id%5D=abc');
    });

    it('keeps the hash fragment at the end', () => {
      expect(appendQueryParam('https://x.test/p#frag', 'laf', 'abc')).toBe(
        'https://x.test/p?laf=abc#frag',
      );
    });
  });

  describe('slug helpers', () => {
    it('slugifies titles', () => {
      expect(slugify('Restaurant Meal — 20% off')).toBe('restaurant-meal-20-off');
    });

    it('falls back when the title has no usable characters', () => {
      expect(slugify('!!!')).toBe('offer');
    });

    it('adds a random suffix so slugs stay unique without a round-trip', () => {
      const a = uniqueSlug('Barber');
      const b = uniqueSlug('Barber');
      expect(a).not.toBe(b);
      expect(a.startsWith('barber-')).toBe(true);
    });
  });

  describe('isHttpUrl', () => {
    it('accepts absolute http(s) urls only', () => {
      expect(isHttpUrl('https://x.test/a')).toBe(true);
      expect(isHttpUrl('http://x.test')).toBe(true);
      expect(isHttpUrl('javascript:alert(1)')).toBe(false);
      expect(isHttpUrl('/relative')).toBe(false);
      expect(isHttpUrl('not a url')).toBe(false);
    });
  });
});
