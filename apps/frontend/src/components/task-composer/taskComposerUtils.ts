import type { NearbyAffiliate } from '../../services/business';

export type TaskCategory = 'EXTERNAL' | 'INTERNAL';

export type CompensationModel =
  | 'NONE'
  | 'FIXED'
  | 'HOURLY'
  | 'COMMISSION'
  | 'MEMBERSHIP_INCLUDED';

export type AffiliateRoleFilter =
  | 'RECOMMENDED'
  | 'CONSULTANT'
  | 'AGENT'
  | 'ACCOUNT_MANAGER'
  | 'ALL';

export interface UploadedMaterial {
  name: string;
  url: string;
}

export interface ScoredAffiliate {
  affiliate: NearbyAffiliate;
  score: number;
  skillMatches: string[];
}

export interface TaskTypeOption {
  value: TaskCategory;
  title: string;
  tagline: string;
  description: string;
  examples: string[];
  bestFor: string;
}

export const TASK_TYPE_OPTIONS: TaskTypeOption[] = [
  {
    value: 'EXTERNAL',
    title: 'External / professional',
    tagline: 'Expert output, delivered for you',
    description:
      'Bring in a specialist for work that needs professional craft — design, copywriting, marketing, websites or consulting. You describe the outcome, they make it happen.',
    examples: ['Brand & design', 'Copywriting', 'Paid ads', 'Consulting'],
    bestFor: 'When you need expert quality or a fresh perspective.',
  },
  {
    value: 'INTERNAL',
    title: 'Internal / platform',
    tagline: 'Set up and grow inside MCOM',
    description:
      'Get hands-on help inside the MCOM platforms you already use — building your mall storefront, loading rewards, configuring a spin campaign or tidying your product catalogue.',
    examples: ['Mall storefront', 'Rewards setup', 'Spin campaign', 'Product uploads'],
    bestFor: 'When the work happens inside your MCOM platform tools.',
  },
];

export const SKILL_SUGGESTIONS = [
  'Design',
  'Copywriting',
  'Social media',
  'SEO',
  'Photography',
  'Video editing',
  'Web development',
  'Branding',
  'Email marketing',
  'Paid ads',
  'Customer service',
  'Data analysis',
  'Product photography',
  'Content strategy',
];

export const ROLE_FILTERS: Array<{ value: AffiliateRoleFilter; label: string }> = [
  { value: 'RECOMMENDED', label: 'Recommended' },
  { value: 'CONSULTANT', label: 'Consultants' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'ACCOUNT_MANAGER', label: 'Account managers' },
  { value: 'ALL', label: 'All affiliates' },
];

export const ROLE_LABELS: Record<string, string> = {
  AGENT: 'Agent',
  ACCOUNT_MANAGER: 'Account manager',
  CONSULTANT: 'Consultant',
};

export const RADIUS_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: 'Any distance' },
  { value: 1, label: '1 mile' },
  { value: 3, label: '3 miles' },
  { value: 5, label: '5 miles' },
  { value: 10, label: '10 miles' },
  { value: 25, label: '25 miles' },
  { value: 50, label: '50 miles' },
];

export const COMPENSATION_OPTIONS: Array<{
  value: CompensationModel;
  label: string;
  helper: string;
}> = [
  {
    value: 'FIXED',
    label: 'Fixed fee',
    helper: 'One agreed amount for the whole outcome.',
  },
  {
    value: 'HOURLY',
    label: 'Hourly',
    helper: 'Pay for the time the work takes.',
  },
  {
    value: 'COMMISSION',
    label: 'Commission',
    helper: 'A share of the result or sales generated.',
  },
  {
    value: 'MEMBERSHIP_INCLUDED',
    label: 'Included in membership',
    helper: 'Use your membership allowance where available.',
  },
  {
    value: 'NONE',
    label: 'No reward',
    helper: 'A favour, internal swap or unpaid collaboration.',
  },
];

const normalise = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export function buildMaterialsText(
  note: string,
  files: UploadedMaterial[],
  links: string[],
): string | undefined {
  const lines: string[] = [];
  if (note.trim()) lines.push(note.trim());
  files.forEach((file) => lines.push(`File: ${file.name} — ${file.url}`));
  links.forEach((link) => lines.push(`Link: ${link}`));

  const value = lines.join('\n').trim();
  return value || undefined;
}

export function scoreAffiliates(
  affiliates: NearbyAffiliate[],
  requiredSkills: string[],
  category: TaskCategory,
): ScoredAffiliate[] {
  const required = requiredSkills.map((skill) => normalise(skill)).filter(Boolean);

  return affiliates
    .map((affiliate) => {
      const haystack = normalise(
        [
          affiliate.role,
          affiliate.specialisation ?? '',
          ...(affiliate.skills ?? []),
          ...(affiliate.languages ?? []),
        ].join(' '),
      );

      const skillMatches = requiredSkills.filter((skill) => {
        const needle = normalise(skill);
        return needle.length > 0 && haystack.includes(needle);
      });

      let score = affiliate.proximity?.score ?? 0;
      score += Math.max(0, affiliate.reputationScore ?? 0) * 0.6;
      score += Math.min(affiliate.completedTasksCount ?? 0, 25) * 1.2;
      score += skillMatches.length * 18;

      if (category === 'EXTERNAL' && affiliate.role === 'CONSULTANT') score += 10;
      if (category === 'INTERNAL' && affiliate.role === 'AGENT') score += 10;
      if (affiliate.role === 'ACCOUNT_MANAGER') score += 4;

      if (affiliate.distance?.miles != null) {
        score -= Math.min(affiliate.distance.miles, 50) * 0.15;
      }

      return { affiliate, score, skillMatches };
    })
    .sort((a, b) => b.score - a.score);
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'AF';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
