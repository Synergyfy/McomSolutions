export interface StoredAuthUser {
  id?: string;
  email?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  businessName?: string;
  businessProfile?: { businessName?: string | null } | null;
}

export interface AuthUserDisplay {
  name: string;
  roleLabel: string;
  initials: string;
  email: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  BUSINESS: 'Business Owner',
  BUSINESS_OWNER: 'Business Owner',
  CUSTOMER: 'Customer',
  ADMIN: 'Administrator',
  AGENT: 'Affiliate Agent',
  CONSULTANT: 'Consultant',
  ACCOUNT_MANAGER: 'Account Manager',
  PARTNER: 'Partner',
};

function parseStoredUser(raw: string | null): StoredAuthUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as StoredAuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user as stored by the auth flows.
 *
 * `business_user` is written by every password/OTP login (including admins who
 * sign in through `/login`), so it wins. `admin_user` is only written by the
 * dedicated `/admin/login` flow and is the fallback.
 */
export function readStoredAuthUser(): StoredAuthUser | null {
  if (typeof window === 'undefined') return null;

  const businessUser = parseStoredUser(localStorage.getItem('business_user'));
  if (businessUser?.role) return businessUser;

  const adminUser = parseStoredUser(localStorage.getItem('admin_user'));
  if (adminUser?.role) return adminUser;

  return businessUser ?? adminUser;
}

export function getRoleLabel(role?: string | null): string {
  if (!role) return 'Member';
  return ROLE_LABELS[role.toUpperCase()] || 'Member';
}

export function getAuthUserDisplay(user: StoredAuthUser | null): AuthUserDisplay | null {
  if (!user) return null;

  const role = (user.role || '').toUpperCase();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const businessName = user.businessName || user.businessProfile?.businessName || '';

  const name =
    (role === 'BUSINESS' ? businessName : '') ||
    fullName ||
    user.name ||
    businessName ||
    user.email?.split('@')[0] ||
    'Account';

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'AC';

  return {
    name,
    roleLabel: getRoleLabel(role),
    initials,
    email: user.email || null,
  };
}

export function isAffiliateRole(role?: string | null): boolean {
  const normalized = (role || '').toUpperCase();
  return normalized === 'AGENT' || normalized === 'CONSULTANT' || normalized === 'ACCOUNT_MANAGER';
}

export function getAffiliatePortalUrl(): string {
  const base =
    (import.meta.env.VITE_AFFILIATE_PORTAL_URL as string | undefined) ||
    'https://247gbsaffiliates.centralhubsolution.com';
  return `${base.replace(/\/$/, '')}/dashboard`;
}
