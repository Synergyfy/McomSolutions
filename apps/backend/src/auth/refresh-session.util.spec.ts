import { accessTtlSeconds, hashRefreshToken, parseTtlSeconds, refreshTtlSeconds } from './refresh-session.util';

describe('refresh-session.util (Phase 3)', () => {
  it('should hash tokens deterministically without exposing the raw value', () => {
    const h1 = hashRefreshToken('token-abc');
    expect(h1).toBe(hashRefreshToken('token-abc'));
    expect(h1).not.toContain('token-abc');
    expect(h1).toHaveLength(64);
  });

  it.each([
    ['900', 3600, 900],
    ['15m', 3600, 900],
    ['1h', 3600, 3600],
    ['7d', 3600, 604800],
    ['60s', 3600, 60],
  ])('should parse %s to %i seconds', (raw, fallback, expected) => {
    expect(parseTtlSeconds(raw, fallback)).toBe(expected);
  });

  it.each([[''], ['0'], ['-5'], ['soon'], ['1y'], [undefined]])(
    'should fall back safely on %p',
    (raw) => {
      expect(parseTtlSeconds(raw as string | undefined, 3600)).toBe(3600);
    },
  );

  it('should default access to 15m (spec) and refresh to 7d', () => {
    expect(accessTtlSeconds({})).toBe(900);
    expect(refreshTtlSeconds({})).toBe(604800);
    expect(accessTtlSeconds({ JWT_ACCESS_TTL: '1h' })).toBe(3600);
  });
});
