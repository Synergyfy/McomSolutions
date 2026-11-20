import { Role } from '@prisma/client';

/**
 * Roles that carry a syncable profile.
 *
 * `ADMIN` is intentionally excluded: admins are operators of the central hub,
 * not profile owners in downstream ecosystem apps.
 */
export const PROFILE_SYNC_ROLES: Role[] = [
  Role.BUSINESS,
  Role.CUSTOMER,
  Role.AGENT,
  Role.CONSULTANT,
  Role.ACCOUNT_MANAGER,
  Role.PARTNER,
];

/** Event name fanned out to apps that consume a role's profile updates. */
export const PROFILE_UPDATED_EVENT = 'profile.updated';

export function isProfileSyncRole(
  role: Role | string | null | undefined,
): role is Role {
  if (!role) return false;
  return PROFILE_SYNC_ROLES.includes(role as Role);
}

/**
 * Empty `supportedRoles` means "all profile-sync roles". This keeps apps
 * registered before the field existed fully backwards compatible.
 */
export function appSupportsRole(
  supportedRoles: Role[] | null | undefined,
  role: Role,
): boolean {
  if (!supportedRoles || supportedRoles.length === 0) return true;
  return supportedRoles.includes(role);
}
