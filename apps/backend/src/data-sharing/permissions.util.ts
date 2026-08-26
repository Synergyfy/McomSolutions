export interface PlatformPackageLike {
  platform?: string;
  status?: string;
}

/**
 * Calculates platform access permissions.
 *
 * Returns the exact same 5 legacy keys (`canAccessMall`, ... `canAccessExpo`)
 * that all existing consumers expect, PLUS new dynamic keys
 * (`canAccess_<slug>`, e.g. `canAccess_vcard`) for Console-registered apps.
 *
 * New keys are derived from each active package's `platform` field
 * (`canAccess_${platform.toLowerCase().replace(/[^a-z0-9]/g, '_')}`).
 */
export function calculatePermissions(
  role: string,
  membershipLevel: string,
  membershipStatus: string,
  packages: PlatformPackageLike[],
): Record<string, boolean> {
  // Admin shortcut — identical to today
  if (role === 'ADMIN') {
    return {
      canAccessMall: true,
      canAccessRewards: true,
      canAccessSpin: true,
      canAccessAudit: true,
      canAccessExpo: true,
    };
  }

  // Build dynamic map from packages (new — no old consumer sees this key format)
  const dynamic: Record<string, boolean> = {};
  if (membershipStatus === 'active') {
    packages.forEach((pkg) => {
      if (pkg.status === 'active' && pkg.platform) {
        dynamic[`canAccess_${pkg.platform.toLowerCase().replace(/[^a-z0-9]/g, '_')}`] = true;
      }
    });
    if (membershipLevel === 'Platinum') {
      // Platinum still grants everything as before
      ['mall', 'rewards', 'spin', 'audit', 'expo'].forEach((p) => {
        dynamic[`canAccess_${p}`] = true;
      });
    }
  }

  // BACKWARD-COMPAT ALIASES — always present, always match old key names
  return {
    canAccessMall: dynamic['canAccess_mall'] ?? false,
    canAccessRewards: dynamic['canAccess_rewards'] ?? false,
    canAccessSpin: dynamic['canAccess_spin'] ?? false,
    canAccessAudit: dynamic['canAccess_audit'] ?? false,
    canAccessExpo: dynamic['canAccess_expo'] ?? false,
    ...dynamic,
  };
}