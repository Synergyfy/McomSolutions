import type { CompensationModel, TaskCategory } from '../../task-composer/taskComposerUtils';

export type AdminAssigneeRole = 'ACCOUNT_MANAGER' | 'AGENT' | 'CONSULTANT';

export interface AdminAssignee {
  userId: string;
  name: string;
  email: string;
  role: AdminAssigneeRole;
}

export const ADMIN_ROLE_LABELS: Record<AdminAssigneeRole, string> = {
  ACCOUNT_MANAGER: 'Account manager',
  AGENT: 'Agent',
  CONSULTANT: 'Consultant',
};

export const ADMIN_ROLE_STYLES: Record<AdminAssigneeRole, string> = {
  ACCOUNT_MANAGER: 'bg-violet-50 text-violet-700 border-violet-100',
  AGENT: 'bg-sky-50 text-sky-700 border-sky-100',
  CONSULTANT: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

export const ADMIN_ROLE_FILTERS: Array<{ value: 'ALL' | AdminAssigneeRole; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'ACCOUNT_MANAGER', label: 'Account managers' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'CONSULTANT', label: 'Consultants' },
];

/** Compensation models that need a numeric amount from the admin. */
export function amountNeededFor(model: CompensationModel): boolean {
  return model === 'FIXED' || model === 'HOURLY' || model === 'COMMISSION';
}

/** Formats a raw platform key (e.g. `mcom_mall`) for display. */
export function platformLabel(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function categoryLabel(category: TaskCategory): string {
  return category === 'EXTERNAL' ? 'External / professional' : 'Internal / platform';
}

export function formatGbp(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
