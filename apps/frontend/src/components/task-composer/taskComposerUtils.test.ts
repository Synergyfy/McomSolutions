import { describe, expect, it } from 'vitest';
import type { NearbyAffiliate } from '../../services/business';
import {
  buildMaterialsText,
  isHttpUrl,
  scoreAffiliates,
} from './taskComposerUtils';

const baseAffiliate: NearbyAffiliate = {
  userId: 'affiliate-1',
  profileId: 'profile-1',
  name: 'Alex Agent',
  email: 'alex@example.com',
  role: 'AGENT',
  specialisation: null,
  skills: ['Design', 'Copywriting'],
  languages: ['English'],
  postcode: 'M1 1AE',
  reputationScore: 4.5,
  experienceScore: 20,
  completedTasksCount: 10,
  assignedBusinesses: 1,
  proximity: {
    matchedLevel: 'postcode',
    score: 20,
    breakdown: {},
  },
  distance: {
    km: 2,
    miles: 1.2,
    label: '2 km (~1.2 mi) away',
    source: 'postcode',
    reason: null,
  },
};

describe('task composer utils', () => {
  it('combines notes, uploaded files and links into the materials text', () => {
    expect(
      buildMaterialsText(
        'Use the new logo',
        [{ name: 'logo.png', url: 'https://cdn.example/logo.png' }],
        ['https://drive.example/brand'],
      ),
    ).toBe(
      'Use the new logo\nFile: logo.png — https://cdn.example/logo.png\nLink: https://drive.example/brand',
    );
  });

  it('returns undefined when there are no materials', () => {
    expect(buildMaterialsText('   ', [], [])).toBeUndefined();
  });

  it('validates http links only', () => {
    expect(isHttpUrl('https://example.com/file')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('not-a-link')).toBe(false);
  });

  it('ranks skill matches above a generic nearby affiliate', () => {
    const generic = {
      ...baseAffiliate,
      userId: 'affiliate-2',
      name: 'Blair Builder',
      skills: ['Photography'],
      reputationScore: 3,
      completedTasksCount: 2,
    };

    const ranked = scoreAffiliates([generic, baseAffiliate], ['Design'], 'EXTERNAL');

    expect(ranked[0].affiliate.userId).toBe(baseAffiliate.userId);
    expect(ranked[0].skillMatches).toEqual(['Design']);
  });
});
