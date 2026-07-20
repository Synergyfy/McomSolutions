import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DataSharingService {
  constructor(private prisma: PrismaService) {}

  async getUserContext(email?: string, userId?: string) {
    if (!email && !userId) {
      throw new Error('Either email or userId must be provided');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          email ? { email: email.toLowerCase().trim() } : undefined,
          userId ? { id: userId } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        businessProfile: {
          include: {
            packages: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
    const membershipLevel = user.businessProfile?.membershipLevel || 'Bronze';
    const membershipStatus = user.businessProfile?.membershipStatus || 'active';
    const membershipTier = user.businessProfile?.membershipTier || 'Normal';

    const packages = user.businessProfile?.packages || [];
    const permissions = this.calculatePermissions(user.role, membershipLevel, membershipStatus, packages);

    return {
      userId: user.id,
      email: user.email,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
      role: user.role,
      businessId: user.businessProfile?.id || null,
      businessName: user.businessProfile?.businessName || null,
      membershipLevel,
      membershipTier,
      membershipStatus,
      phone: user.businessProfile?.phone || null,
      address: user.businessProfile?.address || null,
      postcode: user.businessProfile?.postcode || null,
      packages: packages.map(pkg => ({
        packageId: pkg.id,
        platformName: pkg.platform,
        packageName: pkg.packageName,
        status: pkg.status,
        externalPlanId: pkg.externalPlanId,
      })),
      permissions,
      createdAt: user.createdAt,
    };
  }

  async getUserMembership(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      userId: user.id,
      membershipLevel: user.businessProfile?.membershipLevel || 'Bronze',
      membershipTier: user.businessProfile?.membershipTier || 'Normal',
      membershipStatus: user.businessProfile?.membershipStatus || 'active',
    };
  }

  async getUserPackages(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: { include: { packages: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user.businessProfile?.packages.map(pkg => ({
      packageId: pkg.id,
      platformName: pkg.platform,
      packageName: pkg.packageName,
      status: pkg.status,
      externalPlanId: pkg.externalPlanId,
    })) || [];
  }

  async getUserPermissions(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { businessProfile: { include: { packages: true } } },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const membershipLevel = user.businessProfile?.membershipLevel || 'Bronze';
    const membershipStatus = user.businessProfile?.membershipStatus || 'active';
    const packages = user.businessProfile?.packages || [];

    return this.calculatePermissions(user.role, membershipLevel, membershipStatus, packages);
  }

  async getBulkUserContexts(emailsOrIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { in: emailsOrIds.map(e => e.toLowerCase().trim()) } },
          { id: { in: emailsOrIds } },
        ],
      },
      include: {
        businessProfile: {
          include: {
            packages: true,
          },
        },
      },
    });

    return users.map(user => {
      const name = user.businessProfile?.businessName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
      const membershipLevel = user.businessProfile?.membershipLevel || 'Bronze';
      const membershipStatus = user.businessProfile?.membershipStatus || 'active';
      const membershipTier = user.businessProfile?.membershipTier || 'Normal';
      const packages = user.businessProfile?.packages || [];
      const permissions = this.calculatePermissions(user.role, membershipLevel, membershipStatus, packages);

      return {
        userId: user.id,
        email: user.email,
        firstName: user.firstName || null,
        lastName: user.lastName || null,
        role: user.role,
        businessId: user.businessProfile?.id || null,
        businessName: user.businessProfile?.businessName || null,
        membershipLevel,
        membershipTier,
        membershipStatus,
        packages: packages.map(pkg => ({
          packageId: pkg.id,
          platformName: pkg.platform,
          packageName: pkg.packageName,
          status: pkg.status,
          externalPlanId: pkg.externalPlanId,
        })),
        permissions,
      };
    });
  }

  private calculatePermissions(role: string, membershipLevel: string, membershipStatus: string, packages: any[]) {
    // If they are admin, they have all permissions
    if (role === 'ADMIN') {
      return {
        canAccessMall: true,
        canAccessRewards: true,
        canAccessSpin: true,
        canAccessAudit: true,
        canAccessExpo: true,
      };
    }

    // Default permissions
    const permissions = {
      canAccessMall: false,
      canAccessRewards: false,
      canAccessSpin: false,
      canAccessAudit: false,
      canAccessExpo: false,
    };

    // If membership is inactive, they don't have access to paid platforms unless specified
    if (membershipStatus !== 'active') {
      return permissions;
    }

    // Check packages for explicit access
    packages.forEach(pkg => {
      if (pkg.status === 'active') {
        const platform = pkg.platform.toLowerCase();
        if (platform === 'mall') permissions.canAccessMall = true;
        if (platform === 'rewards') permissions.canAccessRewards = true;
        if (platform === 'spin') permissions.canAccessSpin = true;
        if (platform === 'audit') permissions.canAccessAudit = true;
        if (platform === 'expo') permissions.canAccessExpo = true;
      }
    });

    // Platinum membership grants access to everything by default
    if (membershipLevel === 'Platinum') {
      permissions.canAccessMall = true;
      permissions.canAccessRewards = true;
      permissions.canAccessSpin = true;
      permissions.canAccessAudit = true;
      permissions.canAccessExpo = true;
    }

    return permissions;
  }
}
