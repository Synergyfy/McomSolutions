import { isPeerAllowed, normalizePeerList, SERVICE_PEER_WILDCARD } from './policy.util';

describe('policy.util', () => {
  describe('isPeerAllowed (deny by default)', () => {
    it('denies when the list is empty', () => {
      expect(isPeerAllowed([], 'mcom-reward')).toBe(false);
    });

    it('denies when the list is null/undefined', () => {
      expect(isPeerAllowed(null, 'mcom-reward')).toBe(false);
      expect(isPeerAllowed(undefined, 'mcom-reward')).toBe(false);
    });

    it('allows any peer when the wildcard is present', () => {
      expect(isPeerAllowed([SERVICE_PEER_WILDCARD], 'mcom-reward')).toBe(true);
      expect(isPeerAllowed(['mcom-mall', '*'], 'anything')).toBe(true);
    });

    it('allows only listed peers', () => {
      expect(isPeerAllowed(['mcom-reward'], 'mcom-reward')).toBe(true);
      expect(isPeerAllowed(['mcom-reward'], 'fundordonate')).toBe(false);
    });

    it('denies when peer is missing and no wildcard', () => {
      expect(isPeerAllowed(['mcom-reward'], null)).toBe(false);
      expect(isPeerAllowed(['mcom-reward'], undefined)).toBe(false);
    });

    it('trims and de-duplicates entries', () => {
      expect(isPeerAllowed([' mcom-reward ', 'mcom-reward'], 'mcom-reward')).toBe(true);
    });
  });

  describe('normalizePeerList', () => {
    it('trims, drops blanks, and de-duplicates', () => {
      expect(normalizePeerList([' a ', '', 'b', 'a', null as unknown as string])).toEqual(['a', 'b']);
    });

    it('returns [] for non-arrays', () => {
      expect(normalizePeerList(null)).toEqual([]);
      expect(normalizePeerList(undefined)).toEqual([]);
    });
  });
});
