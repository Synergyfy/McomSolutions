import {
  normalizePlatformKey,
  postalOutwardCode,
  rankByAffinity,
  scoreAffinity,
  type AffinityCandidate,
} from './affiliate-affinity.util';

describe('affiliate-affinity.util', () => {
  const business = {
    cityId: 'city-1',
    boroughId: 'borough-1',
    highStreetId: 'hs-1',
    localMallId: 'mall-1',
    postcode: 'SW1A 1AA',
  };

  const baseCandidate: AffinityCandidate = {
    id: 'am-1',
    userId: 'user-1',
    role: 'ACCOUNT_MANAGER',
    cityId: null,
    boroughId: null,
    highStreetId: null,
    localMallId: null,
    postcode: null,
    reputationScore: 0,
    experienceScore: 0,
    completedTasksCount: 0,
    assignedBusinesses: 0,
  };

  it('prefers a shared local mall over a mere city match', () => {
    const mallMatch = scoreAffinity(business, { ...baseCandidate, localMallId: 'mall-1' });
    const cityMatch = scoreAffinity(business, { ...baseCandidate, cityId: 'city-1' });
    expect(mallMatch.total).toBeGreaterThan(cityMatch.total);
    expect(mallMatch.matchedLevel).toBe('local_mall');
    expect(cityMatch.matchedLevel).toBe('city');
  });

  it('matches only when the UK postcode outward code is identical', () => {
    const same = scoreAffinity(business, { ...baseCandidate, postcode: 'sw1a 9zz' });
    const different = scoreAffinity(business, { ...baseCandidate, postcode: 'E1 6AN' });
    expect(same.postcode).toBeGreaterThan(0);
    expect(different.postcode).toBe(0);
  });

  it('uses reputation and experience as tie-breakers at equal proximity', () => {
    const low = scoreAffinity(business, {
      ...baseCandidate,
      id: 'a',
      cityId: 'city-1',
      reputationScore: 2,
      completedTasksCount: 1,
    });
    const high = scoreAffinity(business, {
      ...baseCandidate,
      id: 'b',
      cityId: 'city-1',
      reputationScore: 40,
      completedTasksCount: 12,
    });
    expect(high.total).toBeGreaterThan(low.total);
  });

  it('penalises account managers with a heavy assigned-business load', () => {
    const free = scoreAffinity(business, { ...baseCandidate, cityId: 'city-1', assignedBusinesses: 1 });
    const busy = scoreAffinity(business, { ...baseCandidate, cityId: 'city-1', assignedBusinesses: 40 });
    expect(free.total).toBeGreaterThan(busy.total);
  });

  it('ranks candidates deterministically and picks the best match', () => {
    const ranked = rankByAffinity(business, [
      { ...baseCandidate, id: 'city', userId: 'u-city', cityId: 'city-1' },
      { ...baseCandidate, id: 'mall', userId: 'u-mall', localMallId: 'mall-1' },
      { ...baseCandidate, id: 'national', userId: 'u-national' },
    ]);
    expect(ranked[0].candidate.id).toBe('mall');
    expect(ranked[2].candidate.id).toBe('national');
  });

  it('normalises postcodes and platform keys', () => {
    expect(postalOutwardCode('  sw1a  1aa ')).toBe('SW1A');
    expect(postalOutwardCode(null)).toBeNull();
    expect(normalizePlatformKey('MCOM Mall')).toBe('mcom_mall');
    expect(normalizePlatformKey('247gbs-affiliate')).toBe('247gbs_affiliate');
  });
});
