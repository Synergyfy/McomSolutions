/**
 * Pure proximity + performance scoring for affiliate matching.
 *
 * Businesses and affiliates (agents / account managers / consultants) both
 * carry the resolved UK location hierarchy (city → borough → high street →
 * local mall) plus a postcode. Account-manager assignment and the "nearby
 * affiliates" picker rank candidates by:
 *
 *   proximity  — shared hierarchy level, then shared postcode outward code
 *   reputation — validated ratings / reports (denormalised score on profile)
 *   experience — completed-task count derived experience score
 *   load       — account managers with fewer assigned businesses rank first
 *
 * The weights are deliberately centralised + pure so they can be unit tested
 * without Prisma.
 */

export interface AffinityLocation {
  cityId?: string | null;
  boroughId?: string | null;
  highStreetId?: string | null;
  localMallId?: string | null;
  postcode?: string | null;
}

export interface AffinityCandidate {
  id: string;
  userId: string;
  role: string;
  cityId?: string | null;
  boroughId?: string | null;
  highStreetId?: string | null;
  localMallId?: string | null;
  postcode?: string | null;
  reputationScore?: number | null;
  experienceScore?: number | null;
  completedTasksCount?: number | null;
  assignedBusinesses?: number | null;
}

export interface AffinityBreakdown {
  localMall: number;
  highStreet: number;
  borough: number;
  city: number;
  postcode: number;
  reputation: number;
  experience: number;
  load: number;
  total: number;
  matchedLevel:
    | 'local_mall'
    | 'high_street'
    | 'borough'
    | 'city'
    | 'postcode'
    | 'national';
}

export const AFFINITY_WEIGHTS = {
  localMall: 50,
  highStreet: 35,
  borough: 20,
  city: 10,
  postcodeOutward: 15,
  reputationPerPoint: 0.3,
  experiencePerCompletedTask: 2,
  experienceCap: 40,
  loadPenaltyPerBusiness: 0.5,
  loadCap: 15,
} as const;

/** UK postcode outward code, e.g. "SW1A 1AA" → "SW1A". */
export function postalOutwardCode(postcode?: string | null): string | null {
  if (!postcode) return null;
  const normalised = String(postcode).toUpperCase().replace(/\s+/g, ' ').trim();
  if (!normalised) return null;
  const outward = normalised.split(' ')[0];
  return outward || null;
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Score a single candidate against a business location. Returns a breakdown so
 * callers can explain why someone was chosen (useful for the business picker
 * and for admin auditing).
 */
export function scoreAffinity(
  business: AffinityLocation,
  candidate: AffinityCandidate,
): AffinityBreakdown {
  const localMall =
    business.localMallId && business.localMallId === candidate.localMallId
      ? AFFINITY_WEIGHTS.localMall
      : 0;
  const highStreet =
    business.highStreetId && business.highStreetId === candidate.highStreetId
      ? AFFINITY_WEIGHTS.highStreet
      : 0;
  const borough =
    business.boroughId && business.boroughId === candidate.boroughId
      ? AFFINITY_WEIGHTS.borough
      : 0;
  const city =
    business.cityId && business.cityId === candidate.cityId
      ? AFFINITY_WEIGHTS.city
      : 0;

  const businessOutward = postalOutwardCode(business.postcode);
  const candidateOutward = postalOutwardCode(candidate.postcode);
  const postcode =
    businessOutward && candidateOutward && businessOutward === candidateOutward
      ? AFFINITY_WEIGHTS.postcodeOutward
      : 0;

  const reputation = Math.max(0, num(candidate.reputationScore)) * AFFINITY_WEIGHTS.reputationPerPoint;
  const experience = Math.min(
    AFFINITY_WEIGHTS.experienceCap,
    Math.max(0, num(candidate.completedTasksCount)) * AFFINITY_WEIGHTS.experiencePerCompletedTask,
  );
  // Lower load = better. Only meaningful for account managers.
  const load = -Math.min(
    AFFINITY_WEIGHTS.loadCap,
    Math.max(0, num(candidate.assignedBusinesses)) * AFFINITY_WEIGHTS.loadPenaltyPerBusiness,
  );

  const total = localMall + highStreet + borough + city + postcode + reputation + experience + load;

  // Proximity specificity: report the narrowest shared level for UI labels.
  const matchedLevel = localMall
    ? 'local_mall'
    : highStreet
      ? 'high_street'
      : borough
        ? 'borough'
        : city
          ? 'city'
          : postcode
            ? 'postcode'
            : 'national';

  return {
    localMall,
    highStreet,
    borough,
    city,
    postcode,
    reputation,
    experience,
    load,
    total: Math.round(total * 100) / 100,
    matchedLevel,
  };
}

export function rankByAffinity<T extends AffinityCandidate>(
  business: AffinityLocation,
  candidates: T[],
): Array<{ candidate: T; score: AffinityBreakdown }> {
  return candidates
    .map((candidate) => ({ candidate, score: scoreAffinity(business, candidate) }))
    .sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total;
      // Stable tie-break: fewer assigned businesses, then id for determinism.
      const loadDelta = num(a.candidate.assignedBusinesses) - num(b.candidate.assignedBusinesses);
      if (loadDelta !== 0) return loadDelta;
      return a.candidate.id.localeCompare(b.candidate.id);
    });
}

/** Normalise a platform display name / slug to a stable comparison key. */
export function normalizePlatformKey(value?: string | null): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
