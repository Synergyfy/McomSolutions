import { calculatePermissions } from './permissions.util';

describe('calculatePermissions', () => {
  it('should return all 5 legacy keys for every input (backward compat)', () => {
    const perms = calculatePermissions('BUSINESS', 'Bronze', 'inactive', []);
    expect(perms).toHaveProperty('canAccessMall', false);
    expect(perms).toHaveProperty('canAccessRewards', false);
    expect(perms).toHaveProperty('canAccessSpin', false);
    expect(perms).toHaveProperty('canAccessAudit', false);
    expect(perms).toHaveProperty('canAccessExpo', false);
  });

  it('should return canAccess_vcard true when vcard package is active', () => {
    const perms = calculatePermissions('BUSINESS', 'Bronze', 'active', [
      { platform: 'vcard', status: 'active' },
    ]);
    expect(perms.canAccess_vcard).toBe(true);
    // Legacy keys still present
    expect(perms.canAccessMall).toBe(false);
  });

  it('should return canAccess_vcard false when package is inactive', () => {
    const perms = calculatePermissions('BUSINESS', 'Bronze', 'active', [
      { platform: 'vcard', status: 'inactive' },
    ]);
    expect(perms.canAccess_vcard).toBeFalsy();
    expect(perms.canAccessMall).toBe(false);
  });

  it('should normalize platform names into slug keys', () => {
    const perms = calculatePermissions('BUSINESS', 'Silver', 'active', [
      { platform: 'MCOM vCard', status: 'active' },
    ]);
    expect(perms.canAccess_mcom_vcard).toBe(true);
  });

  it('should map legacy package names to legacy keys', () => {
    const perms = calculatePermissions('BUSINESS', 'Bronze', 'active', [
      { platform: 'mall', status: 'active' },
      { platform: 'rewards', status: 'active' },
    ]);
    expect(perms.canAccessMall).toBe(true);
    expect(perms.canAccessRewards).toBe(true);
    expect(perms.canAccessSpin).toBe(false);
  });

  it('should grant nothing when membership is inactive (even with active packages)', () => {
    const perms = calculatePermissions('BUSINESS', 'Gold', 'inactive', [
      { platform: 'vcard', status: 'active' },
      { platform: 'mall', status: 'active' },
    ]);
    expect(perms.canAccess_vcard).toBeFalsy();
    expect(perms.canAccessMall).toBe(false);
  });

  it('should grant all legacy keys for Platinum membership', () => {
    const perms = calculatePermissions('BUSINESS', 'Platinum', 'active', []);
    expect(perms.canAccessMall).toBe(true);
    expect(perms.canAccessRewards).toBe(true);
    expect(perms.canAccessSpin).toBe(true);
    expect(perms.canAccessAudit).toBe(true);
    expect(perms.canAccessExpo).toBe(true);
  });

  it('should grant all permissions to ADMIN (legacy + dynamic present)', () => {
    const perms = calculatePermissions('ADMIN', 'Bronze', 'inactive', []);
    expect(perms.canAccessMall).toBe(true);
    expect(perms.canAccessExpo).toBe(true);
  });
});