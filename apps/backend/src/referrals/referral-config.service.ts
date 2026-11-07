import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  ReferralCommissionFrequency,
  ReferralConfig,
  ReferralRewardMode,
  ReferralRewardType,
  Role,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublishReferralConfigDto, RoleRewardDto } from './dto/referral-config.dto';

const ALLOWED_REFERRAL_ROLES = Object.values(Role).filter((role) => role !== Role.ADMIN);

const CONFIG_FIELDS = [
  'isActive',
  'rewardMode',
  'rewardType',
  'percentage',
  'fixedAmountGbp',
  'roleRewards',
  'eligibleRoles',
  'qualifyAllMemberships',
  'qualifyAllAccessPasses',
  'qualifiedMembershipPlanIds',
  'qualifiedAccessPlanIds',
  'commissionFrequency',
  'note',
] as const;

export interface SerializedReferralConfig {
  id: string;
  version: number;
  isCurrent: boolean;
  isActive: boolean;
  rewardMode: ReferralRewardMode;
  rewardType: ReferralRewardType;
  percentage: number | null;
  fixedAmountGbp: number | null;
  roleRewards: Record<string, RoleRewardDto>;
  eligibleRoles: string[];
  qualifyAllMemberships: boolean;
  qualifyAllAccessPasses: boolean;
  qualifiedMembershipPlanIds: string[];
  qualifiedAccessPlanIds: string[];
  commissionFrequency: ReferralCommissionFrequency;
  note: string | null;
  changes: Array<{ field: string; from: unknown; to: unknown }>;
  createdByUserId: string;
  createdAt: string;
}

@Injectable()
export class ReferralConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(): Promise<ReferralConfig | null> {
    const current = await this.prisma.referralConfig.findFirst({
      where: { isCurrent: true },
      orderBy: { version: 'desc' },
    });
    if (current) return current;
    // Defensive fallback for a partially-written deployment.
    return this.prisma.referralConfig.findFirst({ orderBy: { version: 'desc' } });
  }

  async getPublicConfig(): Promise<SerializedReferralConfig | null> {
    const current = await this.getCurrent();
    return current ? this.serialize(current) : null;
  }

  async listHistory(page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const [items, total] = await Promise.all([
      this.prisma.referralConfig.findMany({
        orderBy: { version: 'desc' },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.referralConfig.count(),
    ]);
    return {
      success: true,
      data: items.map((item) => this.serialize(item)),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  }

  async publish(input: PublishReferralConfigDto, adminUserId: string) {
    const eligibleRoles = Array.from(
      new Set(
        (input.eligibleRoles ?? [])
          .map((role) => String(role).trim().toUpperCase())
          .filter(Boolean),
      ),
    );
    const invalidRoles = eligibleRoles.filter(
      (role) => !(ALLOWED_REFERRAL_ROLES as string[]).includes(role),
    );
    if (invalidRoles.length) {
      throw new BadRequestException(
        `Unknown or ineligible referral roles: ${invalidRoles.join(', ')}`,
      );
    }

    this.validateReward(input.rewardType, input.percentage, input.fixedAmountGbp);
    const roleRewards = this.normalizeRoleRewards(input.roleRewards);
    for (const [role, reward] of Object.entries(roleRewards)) {
      if (!(ALLOWED_REFERRAL_ROLES as string[]).includes(role)) {
        throw new BadRequestException(`Unknown role reward configured for ${role}.`);
      }
      this.validateReward(reward.rewardType, reward.percentage, reward.fixedAmountGbp);
    }

    const previous = await this.getCurrent();
    const nextData = {
      isActive: input.isActive ?? true,
      rewardMode: input.rewardMode,
      rewardType: input.rewardType,
      percentage:
        input.percentage != null ? new Prisma.Decimal(input.percentage) : null,
      fixedAmountGbp:
        input.fixedAmountGbp != null ? new Prisma.Decimal(input.fixedAmountGbp) : null,
      roleRewards: roleRewards as unknown as Prisma.InputJsonValue,
      eligibleRoles,
      qualifyAllMemberships: input.qualifyAllMemberships ?? true,
      qualifyAllAccessPasses: input.qualifyAllAccessPasses ?? true,
      qualifiedMembershipPlanIds: input.qualifiedMembershipPlanIds ?? [],
      qualifiedAccessPlanIds: input.qualifiedAccessPlanIds ?? [],
      commissionFrequency: input.commissionFrequency,
      note: input.note?.trim() || null,
    };
    const changes = this.buildChanges(previous, nextData);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.referralConfig.findFirst({
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      await tx.referralConfig.updateMany({
        where: { isCurrent: true },
        data: { isCurrent: false },
      });
      const created = await tx.referralConfig.create({
        data: {
          ...nextData,
          version: (latest?.version ?? 0) + 1,
          isCurrent: true,
          changes: changes as unknown as Prisma.InputJsonValue,
          createdByUserId: adminUserId,
        },
      });
      return this.serialize(created);
    });
  }

  isRoleEligible(config: ReferralConfig, role: string | null | undefined): boolean {
    if (!role) return false;
    return (config.eligibleRoles ?? []).includes(String(role).toUpperCase());
  }

  qualifiesPlan(
    config: ReferralConfig,
    sourceType: 'MEMBERSHIP' | 'ACCESS_PASS',
    planId?: string | null,
  ): boolean {
    if (sourceType === 'MEMBERSHIP') {
      if (config.qualifyAllMemberships) return true;
      return Boolean(planId && (config.qualifiedMembershipPlanIds ?? []).includes(planId));
    }
    if (config.qualifyAllAccessPasses) return true;
    return Boolean(planId && (config.qualifiedAccessPlanIds ?? []).includes(planId));
  }

  resolveReward(
    config: ReferralConfig,
    role: string | null | undefined,
  ): { rewardType: ReferralRewardType; value: number } {
    const roleRewards = (config.roleRewards ?? {}) as unknown as Record<
      string,
      RoleRewardDto
    >;
    const perRole =
      config.rewardMode === ReferralRewardMode.PER_ROLE
        ? roleRewards[String(role ?? '').toUpperCase()]
        : undefined;

    const rewardType = perRole?.rewardType ?? config.rewardType;
    const value =
      rewardType === ReferralRewardType.PERCENTAGE
        ? Number(perRole?.percentage ?? config.percentage ?? 0)
        : Number(perRole?.fixedAmountGbp ?? config.fixedAmountGbp ?? 0);

    return { rewardType, value: Number.isFinite(value) ? value : 0 };
  }

  serialize(config: ReferralConfig): SerializedReferralConfig {
    return {
      id: config.id,
      version: config.version,
      isCurrent: config.isCurrent,
      isActive: config.isActive,
      rewardMode: config.rewardMode,
      rewardType: config.rewardType,
      percentage: config.percentage != null ? Number(config.percentage) : null,
      fixedAmountGbp:
        config.fixedAmountGbp != null ? Number(config.fixedAmountGbp) : null,
      roleRewards: (config.roleRewards ?? {}) as unknown as Record<
        string,
        RoleRewardDto
      >,
      eligibleRoles: config.eligibleRoles ?? [],
      qualifyAllMemberships: config.qualifyAllMemberships,
      qualifyAllAccessPasses: config.qualifyAllAccessPasses,
      qualifiedMembershipPlanIds: config.qualifiedMembershipPlanIds ?? [],
      qualifiedAccessPlanIds: config.qualifiedAccessPlanIds ?? [],
      commissionFrequency: config.commissionFrequency,
      note: config.note,
      changes: (config.changes ?? []) as Array<{
        field: string;
        from: unknown;
        to: unknown;
      }>,
      createdByUserId: config.createdByUserId,
      createdAt: config.createdAt.toISOString(),
    };
  }

  private validateReward(
    rewardType: ReferralRewardType,
    percentage?: number | null,
    fixedAmountGbp?: number | null,
  ) {
    if (rewardType === ReferralRewardType.PERCENTAGE) {
      if (percentage == null || !Number.isFinite(Number(percentage))) {
        throw new BadRequestException('A percentage reward value is required.');
      }
      if (Number(percentage) < 0 || Number(percentage) > 100) {
        throw new BadRequestException('Percentage rewards must be between 0 and 100.');
      }
      return;
    }
    if (fixedAmountGbp == null || !Number.isFinite(Number(fixedAmountGbp))) {
      throw new BadRequestException('A fixed GBP reward amount is required.');
    }
    if (Number(fixedAmountGbp) < 0) {
      throw new BadRequestException('Fixed rewards cannot be negative.');
    }
  }

  private normalizeRoleRewards(
    input?: Record<string, RoleRewardDto>,
  ): Record<string, RoleRewardDto> {
    if (!input) return {};
    const normalized: Record<string, RoleRewardDto> = {};
    for (const [role, value] of Object.entries(input)) {
      if (!value) continue;
      normalized[role.toUpperCase()] = {
        rewardType: value.rewardType,
        percentage: value.percentage != null ? Number(value.percentage) : null,
        fixedAmountGbp:
          value.fixedAmountGbp != null ? Number(value.fixedAmountGbp) : null,
      };
    }
    return normalized;
  }

  private buildChanges(previous: ReferralConfig | null, next: Record<string, unknown>) {
    if (!previous) {
      return [{ field: 'version', from: null, to: 'Initial configuration' }];
    }
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
    for (const field of CONFIG_FIELDS) {
      const before = this.comparable((previous as unknown as Record<string, unknown>)[field]);
      const after = this.comparable(next[field]);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changes.push({ field, from: before, to: after });
      }
    }
    return changes;
  }

  private comparable(value: unknown): unknown {
    if (value instanceof Prisma.Decimal) return Number(value);
    if (value && typeof value === 'object' && 'toNumber' in value) {
      return Number((value as { toNumber: () => number }).toNumber());
    }
    return value ?? null;
  }
}
