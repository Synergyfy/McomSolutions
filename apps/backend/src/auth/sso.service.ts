import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma, SsoClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { calculatePermissions } from '../data-sharing/permissions.util';
import { ssoEntitlementClientSelect, ssoUserInfoSelect } from './profile-selects';
import { buildSsoIdentity, SsoIdentity } from './sso-identity';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

export type SsoClientSafe = Omit<SsoClient, 'clientSecret' | 'webhookSecret'> & {
  clientSecret?: string;
  webhookSecret?: string | null;
};

export interface AppPlanView {
  source?: string;
  platform?: string;
  clientId?: string | null;
  planId?: string;
  planName?: string;
  status?: string;
  quotas?: Record<string, unknown>;
  limits?: Record<string, unknown>;
  expiresAt?: Date | string | null;
  membershipPlanName?: string | null;
  directPlan?: {
    planId?: string;
    planName?: string;
    limits?: Record<string, unknown>;
    status?: string;
    expiresAt?: Date | string | null;
  } | null;
  membershipPlan?: {
    planId?: string;
    planName?: string;
    quotas?: Record<string, unknown>;
    membershipPlanName?: string | null;
  } | null;
}

export interface EntitlementPackage {
  id: string;
  platform: string;
  packageName: string;
  externalPlanId?: string | null;
  planName?: string | null;
  planType?: string | null;
  status: string;
  limits?: Prisma.JsonValue;
  expiresAt?: Date | string | null;
  billingCycle?: string | null;
  amount?: number | Prisma.Decimal | null;
  [key: string]: unknown;
}

export interface PlatformEntitlement {
  version: string;
  targetPlatform: {
    clientId: string | null;
    platformSlug: string | null;
    name: string | null;
  };
  access: {
    hasAccess: boolean;
    accessType: 'PAID_MEMBERSHIP' | 'TRIAL_PROGRAMME' | 'DIRECT_PACKAGE' | 'NONE';
    reason?: 'PLATFORM_NOT_IN_MEMBERSHIP' | 'TRIAL_NO_TASKS' | 'TRIAL_EXPIRED' | 'UNVERIFIED' | 'MEMBERSHIP_EXPIRED' | 'NO_ACTIVE_ENTITLEMENT';
    upgradeUrl: string;
  };
  plan: {
    planId: string;
    planName: string;
    source: 'membership' | 'trial' | 'direct';
    status: string;
    billingCycle?: string | null;
    expiresAt?: Date | string | null;
    quotas: Record<string, unknown>;
    limits: Record<string, unknown>;
    features: string[];
  } | null;
  membershipContext: {
    membershipPlanName: string | null;
    membershipLevel: string;
    membershipStatus: string;
    isIncludedInMembership: boolean;
  };
  trialContext: {
    isInTrial: boolean;
    hasPaidVerificationFee: boolean;
    trialExpiresAt: Date | string | null;
    daysRemaining: number;
    programmeTasks: Array<{
      taskId: string;
      title: string;
      description: string;
      deadlineDays: number;
      rewardPoints: number;
      status: string;
    }>;
  };
}

export interface EntitlementBusinessProfile {
  id?: string | null;
  businessName?: string | null;
  membershipPlanName?: string | null;
  membershipExpiresAt?: Date | string | null;
  membershipLevel?: string | null;
  membershipStatus?: string | null;
  membershipTier?: string | null;
  hasPaidVerificationFee?: boolean | null;
  verificationFeePaidAt?: Date | string | null;
  trialAccessDays?: number | null;
  trialAccessExpiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  packages?: EntitlementPackage[];
  phone?: string | null;
  address?: string | null;
  postcode?: string | null;
  [key: string]: unknown;
}

export interface EntitlementUser {
  id?: string;
  role?: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
  businessProfile?: EntitlementBusinessProfile | null;
  [key: string]: unknown;
}

export interface EntitlementClient {
  id?: string;
  clientId?: string;
  platformSlug?: string | null;
  name?: string;
  [key: string]: unknown;
}

export interface RegisterClientInput {
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  scopes?: string[];
  logoUrl?: string | null;
  apiKey?: string | null;
  description?: string | null;
  appUrl?: string | null;
  billingApiUrl?: string | null;
  hmacSecret?: string | null;
  webhookSecret?: string | null;
  webhookUrl?: string | null;
  platformSlug?: string | null;
  corsOrigins?: string[];
  isSystemApp?: boolean;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);
  private readonly memCache = new Map<string, { data: SsoClientSafe; exp: number }>();
  private static readonly MEM_TTL_MS = 30_000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getSsoJwtSecret(): string {
    // Phase 3 (strict): SSO audience is SSO_JWT_SECRET only, in every
    // environment. No JWT_SECRET fallback — fail closed when missing so a
    // regular API token can never be mistaken for an SSO token and vice versa.
    const ssoSecret = this.configService.get<string>('SSO_JWT_SECRET');
    if (!ssoSecret) {
      throw new Error('SSO_JWT_SECRET must be configured (no JWT_SECRET fallback).');
    }
    return ssoSecret;
  }

  generateToken(payload: Record<string, unknown>): string {
    const secret = this.getSsoJwtSecret();
    return this.jwtService.sign(payload, {
      secret,
      expiresIn: '5m',
      algorithm: 'HS256',
    });
  }

  async generateAuthCode(userId: string, clientId: string, redirectUri: string, scopes: string[]): Promise<string> {
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
    });

    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const normalizedRedirectUri = redirectUri.trim().replace(/\/$/, '');
    const isAllowed = client.redirectUris.some(uri => uri.trim().replace(/\/$/, '') === normalizedRedirectUri);

    if (!isAllowed) {
      throw new BadRequestException('Redirect URI not allowed for this client');
    }

    const code = crypto.randomBytes(32).toString('hex');
    const codeTtl = parseInt(this.configService.get<string>('SSO_CODE_TTL_SECONDS') || '300', 10);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + codeTtl);

    await this.prisma.ssoAuthCode.create({
      data: {
        code,
        userId,
        clientId: client.id,
        redirectUri,
        scopes,
        expiresAt,
      },
    });

    return code;
  }

  async exchangeCodeForTokens(code: string, clientId: string, redirectUri: string) {
    const authCode = await this.prisma.ssoAuthCode.findUnique({
      where: { code },
      include: { client: true },
    });

    if (!authCode) {
      throw new UnauthorizedException('Invalid authorization code');
    }

    if (authCode.used) {
      throw new UnauthorizedException('Authorization code has already been used');
    }

    if (authCode.expiresAt < new Date()) {
      throw new UnauthorizedException('Authorization code has expired');
    }

    if (authCode.client.clientId !== clientId) {
      throw new UnauthorizedException('Client mismatch');
    }

    if (authCode.redirectUri !== redirectUri) {
      throw new UnauthorizedException('Redirect URI mismatch');
    }

    // Atomically mark code as used to prevent race conditions on concurrent requests
    const updateResult = await this.prisma.ssoAuthCode.updateMany({
      where: { code, used: false },
      data: { used: true },
    });

    if (updateResult.count === 0) {
      throw new UnauthorizedException('Authorization code has already been used');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authCode.userId },
      // Shared SSO select — full identity + contact + role profile, minus
      // credentials and other internal columns.
      select: ssoUserInfoSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate tokens
    const jwtSecret = this.getSsoJwtSecret();
    const accessTokenTtl = this.configService.get<string>('SSO_ACCESS_TOKEN_TTL') || '3600';
    const refreshTokenTtl = this.configService.get<string>('SSO_REFRESH_TOKEN_TTL') || '604800';

    const identity = buildSsoIdentity(user);
    const name = identity.name;

    const accessPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      profileType: identity.profileType,
      name,
      firstName: identity.firstName || '',
      lastName: identity.lastName || '',
      businessName: identity.businessName || '',
      businessId: identity.businessId,
      scopes: authCode.scopes,
    };

    const refreshPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      profileType: identity.profileType,
      name,
      firstName: identity.firstName || '',
      lastName: identity.lastName || '',
      businessName: identity.businessName || '',
      businessId: identity.businessId,
      scopes: authCode.scopes,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(accessTokenTtl, 10),
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(refreshTokenTtl, 10),
    });

    // Save SSO Session in DB (refresh token is hashed with SHA-256)
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setSeconds(sessionExpiresAt.getSeconds() + parseInt(refreshTokenTtl, 10));

    await this.prisma.ssoSession.create({
      data: {
        userId: user.id,
        clientId: authCode.client.id,
        accessToken,
        refreshToken: this.hashToken(refreshToken),
        expiresAt: sessionExpiresAt,
      },
    });

    // Resolve appPlan and platform entitlement for the client during code exchange
    const { appPlan, entitlement, membership, enrichedPackages, permissions } =
      await this.resolveEntitlements(user, authCode.client);

    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(accessTokenTtl, 10),
      tokenType: 'Bearer',
      entitlement,
      user: this.buildSsoUserPayload(identity, {
        appPlan,
        entitlement,
        membership,
        packages: enrichedPackages,
        permissions,
      }),
    };
  }

  /**
   * Decorates the shared {@link SsoIdentity} with entitlement data. The
   * business profile keeps its full contact/detail fields so partners can
   * provision and render a complete account from the SSO response alone.
   */
  private buildSsoUserPayload(
    identity: SsoIdentity,
    extras: {
      appPlan: AppPlanView | null;
      entitlement: PlatformEntitlement | null;
      membership?: unknown;
      packages?: unknown[];
      permissions?: Record<string, boolean>;
    },
  ) {
    const businessProfile = identity.businessProfile
      ? {
          ...identity.businessProfile,
          packages: extras.packages ?? identity.businessProfile.packages,
          trialAccessExpiresAt:
            extras.entitlement?.trialContext.trialExpiresAt ??
            identity.businessProfile.trialAccessExpiresAt,
          appPlan: extras.appPlan,
          entitlement: extras.entitlement,
        }
      : null;

    return {
      ...identity,
      businessProfile,
      appPlan: extras.appPlan,
      entitlement: extras.entitlement,
      membership: extras.membership,
      packages: extras.packages,
      permissions: extras.permissions,
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async refreshSsoToken(refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);
    let session = await this.prisma.ssoSession.findUnique({
      where: { refreshToken: hashedToken },
    });

    // TODO: Remove after migration — run hash-sessions script
    // Fallback for sessions created before hashing rollout
    if (!session) {
      session = await this.prisma.ssoSession.findUnique({
        where: { refreshToken },
      });
      if (session) {
        this.logger.warn(`Legacy plaintext refresh token detected for session ${session.id}; upgrading to SHA-256 hash.`);
        await this.prisma.ssoSession.update({
          where: { id: session.id },
          data: { refreshToken: hashedToken },
        });
      }
    }

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await this.prisma.ssoSession.delete({ where: { id: session.id } });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const jwtSecret = this.getSsoJwtSecret();
    let payload: { sub: string; [key: string]: unknown };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: jwtSecret });
    } catch (e) {
      await this.prisma.ssoSession.delete({ where: { id: session.id } });
      throw new UnauthorizedException('Invalid refresh token signature');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: ssoUserInfoSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const identity = buildSsoIdentity(user);
    const newPayload = {
      jti: crypto.randomUUID(),
      sub: user.id,
      email: user.email,
      role: user.role,
      profileType: identity.profileType,
      name: identity.name,
      firstName: identity.firstName || '',
      lastName: identity.lastName || '',
      businessName: identity.businessName || '',
      businessId: identity.businessId,
      scopes: payload.scopes,
    };

    const accessTokenTtl = this.configService.get<string>('SSO_ACCESS_TOKEN_TTL') || '3600';
    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: jwtSecret,
      expiresIn: parseInt(accessTokenTtl, 10),
    });

    // Update session
    await this.prisma.ssoSession.update({
      where: { id: session.id },
      data: { accessToken: newAccessToken },
    });

    return {
      accessToken: newAccessToken,
      expiresIn: parseInt(accessTokenTtl, 10),
      tokenType: 'Bearer',
    };
  }

  async logout(accessToken: string) {
    const session = await this.prisma.ssoSession.findUnique({
      where: { accessToken },
    });

    if (session) {
      await this.prisma.ssoSession.delete({
        where: { id: session.id },
      });
    }
    return { success: true };
  }

  /**
   * Helper to match a platform or clientId against an SsoClient or target platform string.
   */
  private matchesClientOrPlatform(
    targetPlatform?: string | null,
    targetClientId?: string | null,
    clientObj?: { clientId?: string | null; name?: string | null; platformSlug?: string | null } | null,
    explicitPlatform?: string | null,
  ): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (explicitPlatform && targetPlatform) {
      if (norm(targetPlatform) === norm(explicitPlatform)) return true;
      if (targetPlatform.toLowerCase().includes(explicitPlatform.toLowerCase())) return true;
      if (explicitPlatform.toLowerCase().includes(targetPlatform.toLowerCase())) return true;
    }

    if (!clientObj) return false;

    // Direct match by clientId
    if (targetClientId && clientObj.clientId) {
      if (targetClientId.toLowerCase().trim() === clientObj.clientId.toLowerCase().trim()) return true;
    }

    // Match targetPlatform against client fields
    if (targetPlatform) {
      const normTarget = norm(targetPlatform);
      if (clientObj.clientId && normTarget === norm(clientObj.clientId)) return true;
      if (clientObj.name && normTarget === norm(clientObj.name)) return true;
      if (clientObj.platformSlug && normTarget === norm(clientObj.platformSlug)) return true;
      if (clientObj.name && targetPlatform.toLowerCase().includes(clientObj.name.toLowerCase())) return true;
      if (clientObj.name && clientObj.name.toLowerCase().includes(targetPlatform.toLowerCase())) return true;
      if (clientObj.platformSlug && targetPlatform.toLowerCase().includes(clientObj.platformSlug.toLowerCase())) return true;
    }

    return false;
  }

  /**
   * Resolves platform entitlements for a user across both direct platform packages
   * (the former standalone system) and memberships (multi-app bundles).
   */
  async resolveEntitlements(
    user: EntitlementUser | null | undefined,
    client?: EntitlementClient | null,
    explicitPlatform?: string | null,
  ) {
    const businessProfile = user?.businessProfile;
    const packages: EntitlementPackage[] = businessProfile?.packages ?? [];
    const membershipLevel = businessProfile?.membershipLevel || 'Bronze';
    const membershipStatus = businessProfile?.membershipStatus || 'active';
    const membershipTier = businessProfile?.membershipTier || 'Normal';
    const membershipExpiresAt = businessProfile?.membershipExpiresAt ? new Date(businessProfile.membershipExpiresAt) : null;
    const now = new Date();
    const isMembershipExpired = membershipExpiresAt ? membershipExpiresAt.getTime() <= now.getTime() : false;

    // A paid membership plan is only active if:
    // 1. membershipStatus is 'active' or 'trial'
    // 2. An explicit membershipPlanName is recorded (subscribed plan)
    // 3. The membership has not expired
    const hasExplicitMembershipPlan = Boolean(businessProfile?.membershipPlanName);
    const isMembershipActive =
      (membershipStatus === 'active' || membershipStatus === 'trial' || membershipStatus === 'past_due') &&
      hasExplicitMembershipPlan &&
      !isMembershipExpired;

    let membershipPlan: {
      name: string;
      includedApps?: unknown;
      [key: string]: unknown;
    } | null = null;
    if (isMembershipActive && businessProfile?.membershipPlanName) {
      membershipPlan = await this.prisma.membershipPlan.findFirst({
        where: {
          name: { equals: businessProfile.membershipPlanName, mode: 'insensitive' },
          archived: false,
        },
        // G6: only the fields resolveEntitlements reads.
        select: { name: true, includedApps: true },
      });
    }

    const membershipAppPlans: Array<{
      platform: string;
      clientId: string | null;
      planId: string;
      planName: string;
      quotas: Record<string, unknown>;
      limits: Record<string, unknown>;
    }> = [];

    if (membershipPlan && Array.isArray(membershipPlan.includedApps)) {
      for (const rawApp of membershipPlan.includedApps) {
        const app = rawApp as Record<string, unknown>;
        if (app && (app.platform || app.platformName)) {
          const platform = String(app.platform || app.platformName);
          const planName = String(app.planName || app.name || 'Standard');
          const planId = String(app.planId || app.id || 'standard');
          const quotas = (app.quotas || app.limits || app.usageLimits || {}) as Record<string, unknown>;
          membershipAppPlans.push({
            platform,
            clientId: app.clientId ? String(app.clientId) : null,
            planId,
            planName,
            quotas,
            limits: quotas,
          });
        }
      }
    }

    // Build enriched packages list (preserving all existing fields, adding externalPlanId, planName, source, etc.)
    const enrichedPackages = packages.map((pkg) => {
      const isFromMembership =
        isMembershipActive &&
        membershipAppPlans.some((a) =>
          this.matchesClientOrPlatform(a.platform, a.clientId, null, pkg.platform),
        ) &&
        (!pkg.amount || pkg.amount === 0);

      return {
        id: pkg.id,
        platform: pkg.platform,
        packageName: pkg.packageName,
        externalPlanId: pkg.externalPlanId || null,
        planName: pkg.planName || pkg.packageName,
        planType: pkg.planType || 'STANDARD',
        status: pkg.status,
        limits: (pkg.limits as Record<string, unknown>) || {},
        expiresAt: pkg.expiresAt || null,
        billingCycle: pkg.billingCycle || null,
        source: (isFromMembership ? 'membership' : 'direct') as 'membership' | 'direct',
      };
    });

    // If active membership has apps that aren't represented in packages, add them so legacy checks see them
    if (isMembershipActive) {
      for (const memApp of membershipAppPlans) {
        const exists = enrichedPackages.some((p) =>
          this.matchesClientOrPlatform(p.platform, null, null, memApp.platform),
        );
        if (!exists) {
          enrichedPackages.push({
            id: `membership-${memApp.planId}`,
            platform: memApp.platform,
            packageName: memApp.planName,
            externalPlanId: memApp.planId,
            planName: memApp.planName,
            planType: 'MEMBERSHIP_INCLUDED',
            status: membershipStatus,
            limits: (memApp.quotas as Record<string, unknown>) || {},
            expiresAt: null,
            billingCycle: null,
            source: 'membership' as const,
          });
        }
      }
    }

    // Resolve target client if explicit platform was passed without client object
    let targetClient = client ?? null;
    if (!targetClient && explicitPlatform) {
      const foundClient = await this.prisma.ssoClient.findFirst({
        where: {
          OR: [
            { clientId: { equals: explicitPlatform, mode: 'insensitive' } },
            { platformSlug: { equals: explicitPlatform, mode: 'insensitive' } },
            { name: { equals: explicitPlatform, mode: 'insensitive' } },
          ],
          isActive: true,
        },
        select: ssoEntitlementClientSelect,
      });
      if (foundClient) {
        targetClient = foundClient;
      }
    }

    // Resolve appPlan for the specific calling client or explicit platform (if identified)
    let appPlan: AppPlanView | null = null;
    const targetPlatformIdent = targetClient?.clientId || targetClient?.platformSlug || targetClient?.name || explicitPlatform;

    // 1. Check for active direct package
    const directPackageMatch = targetPlatformIdent
      ? enrichedPackages.find(
          (pkg) =>
            pkg.source === 'direct' &&
            this.matchesClientOrPlatform(pkg.platform, null, targetClient, explicitPlatform) &&
            pkg.status === 'active' &&
            (!pkg.expiresAt || new Date(pkg.expiresAt) > new Date()),
        )
      : null;

    // 2. Check for active membership plan
    const membershipAppPlanMatch = isMembershipActive && targetPlatformIdent
      ? membershipAppPlans.find((app) =>
          this.matchesClientOrPlatform(app.platform, app.clientId, targetClient, explicitPlatform),
        )
      : null;

    if (directPackageMatch && membershipAppPlanMatch) {
      // User has both direct package and membership plan
      const isPaidDirect = directPackageMatch.source === 'direct';
      appPlan = {
        source: isPaidDirect ? 'direct' : 'membership',
        platform: directPackageMatch.platform || membershipAppPlanMatch.platform,
        clientId: targetClient?.clientId || membershipAppPlanMatch.clientId || null,
        planId: directPackageMatch.externalPlanId || membershipAppPlanMatch.planId,
        planName: directPackageMatch.planName || membershipAppPlanMatch.planName,
        status: 'active',
        quotas: { ...(membershipAppPlanMatch.quotas || {}), ...(directPackageMatch.limits || {}) },
        limits: { ...(membershipAppPlanMatch.quotas || {}), ...(directPackageMatch.limits || {}) },
        expiresAt: directPackageMatch.expiresAt || null,
        membershipPlanName: membershipPlan?.name || null,
        directPlan: {
          planId: directPackageMatch.externalPlanId || directPackageMatch.packageName,
          planName: directPackageMatch.planName || directPackageMatch.packageName,
          limits: directPackageMatch.limits || {},
          status: directPackageMatch.status,
          expiresAt: directPackageMatch.expiresAt,
        },
        membershipPlan: {
          planId: membershipAppPlanMatch.planId,
          planName: membershipAppPlanMatch.planName,
          quotas: membershipAppPlanMatch.quotas,
          membershipPlanName: membershipPlan?.name || null,
        },
      };
    } else if (directPackageMatch) {
      // User has only direct platform package (the former system)
      appPlan = {
        source: directPackageMatch.source || 'direct',
        platform: directPackageMatch.platform,
        clientId: targetClient?.clientId || null,
        planId: directPackageMatch.externalPlanId || directPackageMatch.packageName,
        planName: directPackageMatch.planName || directPackageMatch.packageName,
        status: directPackageMatch.status,
        quotas: directPackageMatch.limits || {},
        limits: directPackageMatch.limits || {},
        expiresAt: directPackageMatch.expiresAt || null,
        membershipPlanName: null,
        directPlan: {
          planId: directPackageMatch.externalPlanId || directPackageMatch.packageName,
          planName: directPackageMatch.planName || directPackageMatch.packageName,
          limits: directPackageMatch.limits || {},
          status: directPackageMatch.status,
          expiresAt: directPackageMatch.expiresAt,
        },
        membershipPlan: null,
      };
    } else if (membershipAppPlanMatch) {
      // User has only membership plan (bundle system)
      appPlan = {
        source: 'membership',
        platform: membershipAppPlanMatch.platform,
        clientId: targetClient?.clientId || membershipAppPlanMatch.clientId || null,
        planId: membershipAppPlanMatch.planId,
        planName: membershipAppPlanMatch.planName,
        status: membershipStatus,
        quotas: membershipAppPlanMatch.quotas || {},
        limits: membershipAppPlanMatch.quotas || {},
        expiresAt: businessProfile?.membershipExpiresAt || null,
        membershipPlanName: membershipPlan?.name || null,
        directPlan: null,
        membershipPlan: {
          planId: membershipAppPlanMatch.planId,
          planName: membershipAppPlanMatch.planName,
          quotas: membershipAppPlanMatch.quotas,
          membershipPlanName: membershipPlan?.name || null,
        },
      };
    }

    // 3. Programme Trial Access verification & task engine resolution
    const hasPaidVerificationFee = Boolean(businessProfile?.hasPaidVerificationFee);

    // Verification is mandatory unless an admin explicitly turns it off. When
    // optional, unpaid businesses receive a free trial of `trialAccessDays`
    // starting from signup (or from the moment verification was disabled).
    const programmeSettings = await this.prisma.programmeSetting.findMany({
      where: { key: { in: ['verification_required', 'trial_access_days'] } },
    });
    const settingMap = new Map(programmeSettings.map((s) => [s.key, s]));
    const verificationSetting = settingMap.get('verification_required');
    const trialDaysSetting = settingMap.get('trial_access_days');
    const verificationRequired = verificationSetting ? verificationSetting.value === 'true' : true;
    const configuredTrialDays = trialDaysSetting ? parseInt(trialDaysSetting.value, 10) : 14;
    const trialDays = isNaN(configuredTrialDays) ? 14 : configuredTrialDays;

    let trialAccessExpiresAt: Date | null = null;
    if (businessProfile?.trialAccessExpiresAt) {
      trialAccessExpiresAt = new Date(businessProfile.trialAccessExpiresAt);
    } else if (hasPaidVerificationFee && businessProfile?.verificationFeePaidAt) {
      const paidAt = new Date(businessProfile.verificationFeePaidAt);
      const days = businessProfile.trialAccessDays || trialDays;
      trialAccessExpiresAt = new Date(paidAt.getTime() + days * 24 * 60 * 60 * 1000);
    }

    if (!trialAccessExpiresAt && !verificationRequired) {
      const profileCreatedAt = businessProfile?.createdAt ? new Date(businessProfile.createdAt) : null;
      const optionalSince = verificationSetting?.updatedAt ? new Date(verificationSetting.updatedAt) : null;
      const trialStartedAt =
        !profileCreatedAt
          ? optionalSince
          : optionalSince && optionalSince.getTime() > profileCreatedAt.getTime()
            ? optionalSince
            : profileCreatedAt;
      if (trialStartedAt && !isNaN(trialStartedAt.getTime())) {
        trialAccessExpiresAt = new Date(trialStartedAt.getTime() + trialDays * 24 * 60 * 60 * 1000);
      }
    }

    const hasTrialEntitlement = hasPaidVerificationFee || !verificationRequired;
    const isTrialTimeValid = trialAccessExpiresAt ? trialAccessExpiresAt.getTime() > now.getTime() : false;
    const isInTrial = hasTrialEntitlement && isTrialTimeValid;
    const daysRemaining = isInTrial && trialAccessExpiresAt
      ? Math.max(0, Math.ceil((trialAccessExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    // Check if platform has an active task in /admin/programme (TaskDefinition)
    const clientIdentifiers = [
      targetClient?.clientId,
      targetClient?.platformSlug,
      targetClient?.name,
      explicitPlatform,
    ].filter((v): v is string => Boolean(v && v.trim()));

    let programmeTasks: Array<{
      taskId: string;
      title: string;
      description: string;
      deadlineDays: number;
      rewardPoints: number;
      status: string;
    }> = [];

    if (clientIdentifiers.length > 0) {
      try {
        const matchingTaskDefs = await this.prisma.taskDefinition.findMany({
          where: {
            isActive: true,
            taskSource: 'EXTERNAL',
            targetAudience: { in: ['BUSINESS', 'BOTH'] },
            OR: [
              { externalClientId: { in: clientIdentifiers } },
              { externalPlatformSlug: { in: clientIdentifiers } },
              { externalAppName: { in: clientIdentifiers } },
            ],
          },
          select: {
            id: true,
            title: true,
            description: true,
            deadlineDays: true,
            rewardPoints: true,
            assignments: user?.id
              ? {
                  where: { userId: user.id },
                  select: { status: true },
                  take: 1,
                }
              : false,
          },
        });

        programmeTasks = matchingTaskDefs.map((t) => ({
          taskId: t.id,
          title: t.title,
          description: t.description,
          deadlineDays: t.deadlineDays,
          rewardPoints: t.rewardPoints,
          status: (t.assignments && (t.assignments as any)[0]?.status) || 'PENDING',
        }));
      } catch (taskErr: unknown) {
        this.logger.warn(`Failed to query trial tasks for client "${clientIdentifiers.join(',')}": ${taskErr}`);
      }
    }

    const hasPlatformTrialTasks = programmeTasks.length > 0;
    const isTrialAccessGranted = isInTrial && hasPlatformTrialTasks;

    // Determine access verdict & build protocol PlatformEntitlement
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    let hasAccess = false;
    let accessType: 'PAID_MEMBERSHIP' | 'TRIAL_PROGRAMME' | 'DIRECT_PACKAGE' | 'NONE' = 'NONE';
    let accessReason:
      | 'PLATFORM_NOT_IN_MEMBERSHIP'
      | 'TRIAL_NO_TASKS'
      | 'TRIAL_EXPIRED'
      | 'UNVERIFIED'
      | 'MEMBERSHIP_EXPIRED'
      | 'NO_ACTIVE_ENTITLEMENT'
      | undefined;
    let upgradeUrl = `${frontendUrl}/dashboard/memberships`;

    if (membershipAppPlanMatch) {
      hasAccess = true;
      accessType = 'PAID_MEMBERSHIP';
    } else if (directPackageMatch) {
      hasAccess = true;
      accessType = 'DIRECT_PACKAGE';
    } else if (isTrialAccessGranted) {
      hasAccess = true;
      accessType = 'TRIAL_PROGRAMME';
      if (!appPlan) {
        appPlan = {
          source: 'trial',
          platform: targetClient?.name || explicitPlatform || 'External Platform',
          clientId: targetClient?.clientId || null,
          planId: `trial_${targetClient?.platformSlug || targetClient?.clientId || 'app'}`,
          planName: 'Programme Trial Access',
          status: 'trial',
          quotas: { trialAccess: true, daysRemaining },
          limits: { trialAccess: true, daysRemaining },
          expiresAt: trialAccessExpiresAt,
          membershipPlanName: null,
          directPlan: null,
          membershipPlan: null,
        };
      }
    } else {
      hasAccess = false;
      accessType = 'NONE';
      const hasActiveMembership = isMembershipActive && Boolean(membershipPlan);
      if (hasActiveMembership) {
        accessReason = 'PLATFORM_NOT_IN_MEMBERSHIP';
        upgradeUrl = `${frontendUrl}/dashboard/memberships`;
      } else if (isInTrial && !hasPlatformTrialTasks) {
        accessReason = 'TRIAL_NO_TASKS';
        upgradeUrl = `${frontendUrl}/dashboard/memberships`;
      } else if (hasTrialEntitlement && !isTrialTimeValid) {
        accessReason = 'TRIAL_EXPIRED';
        upgradeUrl = `${frontendUrl}/dashboard/memberships`;
      } else if (verificationRequired && !hasPaidVerificationFee) {
        accessReason = 'UNVERIFIED';
        upgradeUrl = `${frontendUrl}/dashboard?action=verify`;
      } else {
        accessReason = 'NO_ACTIVE_ENTITLEMENT';
        upgradeUrl = `${frontendUrl}/dashboard/memberships`;
      }
    }

    let planDetails: PlatformEntitlement['plan'] = null;
    if (hasAccess) {
      if (membershipAppPlanMatch) {
        planDetails = {
          planId: membershipAppPlanMatch.planId,
          planName: membershipAppPlanMatch.planName,
          source: 'membership',
          status: 'active',
          billingCycle: null,
          expiresAt: null,
          quotas: membershipAppPlanMatch.quotas || {},
          limits: membershipAppPlanMatch.limits || {},
          features: Array.isArray((membershipAppPlanMatch.quotas as any)?.features)
            ? (membershipAppPlanMatch.quotas as any).features
            : [],
        };
      } else if (directPackageMatch) {
        planDetails = {
          planId: directPackageMatch.externalPlanId || directPackageMatch.packageName,
          planName: directPackageMatch.planName || directPackageMatch.packageName,
          source: 'direct',
          status: directPackageMatch.status,
          billingCycle: directPackageMatch.billingCycle || null,
          expiresAt: directPackageMatch.expiresAt || null,
          quotas: (directPackageMatch.limits as Record<string, unknown>) || {},
          limits: (directPackageMatch.limits as Record<string, unknown>) || {},
          features: [],
        };
      } else if (isTrialAccessGranted) {
        planDetails = {
          planId: `trial_${targetClient?.platformSlug || targetClient?.clientId || 'app'}`,
          planName: 'Programme Trial Access',
          source: 'trial',
          status: 'trial',
          billingCycle: null,
          expiresAt: trialAccessExpiresAt,
          quotas: { trialAccess: true, daysRemaining },
          limits: { trialAccess: true, daysRemaining },
          features: ['trial_tasks_access'],
        };
      }
    }

    const entitlement: PlatformEntitlement | null =
      targetClient || explicitPlatform
        ? {
            version: '2026-10-01',
            targetPlatform: {
              clientId: targetClient?.clientId || null,
              platformSlug: targetClient?.platformSlug || null,
              name: targetClient?.name || explicitPlatform || null,
            },
            access: {
              hasAccess,
              accessType,
              reason: hasAccess ? undefined : accessReason,
              upgradeUrl,
            },
            plan: planDetails,
            membershipContext: {
              membershipPlanName: businessProfile?.membershipPlanName || (isMembershipActive ? membershipLevel : null),
              membershipLevel,
              membershipStatus,
              isIncludedInMembership: Boolean(membershipAppPlanMatch),
            },
            trialContext: {
              isInTrial,
              hasPaidVerificationFee,
              trialExpiresAt: trialAccessExpiresAt,
              daysRemaining,
              programmeTasks,
            },
          }
        : null;

    const permissions = calculatePermissions(
      user?.role || 'BUSINESS',
      membershipLevel,
      membershipStatus,
      enrichedPackages,
    );

    const membership = {
      planName: businessProfile?.membershipPlanName || (isMembershipActive ? membershipPlan?.name || membershipLevel : null),
      level: membershipLevel,
      tier: membershipTier,
      status: membershipStatus,
      hasActiveMembership: isMembershipActive && Boolean(membershipPlan),
      appPlans: membershipAppPlans,
    };

    return {
      appPlan,
      membership,
      enrichedPackages,
      permissions,
      entitlement,
    };
  }

  async getUserInfoFromToken(accessToken: string, requestedClientId?: string) {
    const jwtSecret = this.getSsoJwtSecret();
    let payload: { sub: string; [key: string]: unknown };
    try {
      payload = this.jwtService.verify(accessToken, { secret: jwtSecret });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: ssoUserInfoSelect,
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Try to find client from SSO session or requested clientId.
    // Phase 6: secrets never leave SQL — select the safe fields only.
    let client: EntitlementClient | null = null;
    const session = await this.prisma.ssoSession.findUnique({
      where: { accessToken },
      select: { client: { select: ssoEntitlementClientSelect } },
    });
    if (session?.client) {
      client = session.client;
    } else if (requestedClientId) {
      client = await this.getClientByClientId(requestedClientId);
    }

    const { appPlan, membership, enrichedPackages, permissions, entitlement } =
      await this.resolveEntitlements(user, client);

    const identity = buildSsoIdentity(user);

    return {
      ...this.buildSsoUserPayload(identity, {
        appPlan,
        entitlement,
        membership,
        packages: enrichedPackages,
        permissions,
      }),
      // Legacy flat fields kept for backwards compatibility with existing
      // partner integrations that read them from `userinfo`.
      membershipLevel: identity.membershipLevel || 'Bronze',
      membershipTier: identity.membershipTier || 'Normal',
      membershipStatus: identity.membershipStatus || 'active',
      hasPaidVerificationFee: Boolean(identity.hasPaidVerificationFee),
      trialAccessExpiresAt: entitlement?.trialContext.trialExpiresAt ?? identity.trialAccessExpiresAt,
    };
  }

  async getIntrospectedEntitlement(clientId: string, userIdOrBusinessId: string) {
    const client = await this.getClientByClientId(clientId);
    if (!client) {
      throw new BadRequestException('Client not found');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userIdOrBusinessId },
          { businessProfile: { id: userIdOrBusinessId } },
          { email: userIdOrBusinessId },
        ],
      },
      select: ssoUserInfoSelect,
    });

    if (!user) {
      throw new BadRequestException('User or business not found');
    }

    const { entitlement, appPlan, membership, enrichedPackages, permissions } =
      await this.resolveEntitlements(user, client);

    const identity = buildSsoIdentity(user);

    return {
      success: true,
      entitlement,
      appPlan,
      membership,
      packages: enrichedPackages,
      permissions,
      user: this.buildSsoUserPayload(identity, {
        appPlan,
        entitlement,
        membership,
        packages: enrichedPackages,
        permissions,
      }),
    };
  }

  async getClientByClientId(clientId: string): Promise<SsoClientSafe | null> {
    // L1: in-memory cache (fastest, no network)
    const mem = this.memCache.get(clientId);
    if (mem && mem.exp > Date.now()) {
      return mem.data;
    }

    // L2: Redis cache (shared across instances)
    const cacheKey = `sso_client:${clientId}`;
    const cached = await this.redisService.get<SsoClientSafe>(cacheKey);
    if (cached) {
      this.memCache.set(clientId, { data: cached, exp: Date.now() + SsoService.MEM_TTL_MS });
      return cached;
    }

    // L3: PostgreSQL (source of truth)
    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
    });

    if (client) {
      // Cache safe client object in Redis for 5 minutes (300s) and L1 for 30s
      // Strip clientSecret and webhookSecret before caching in Redis, in L1, and returning
      const { clientSecret, webhookSecret, ...safeClient } = client;
      await this.redisService.set(cacheKey, safeClient, 300);
      this.memCache.set(clientId, { data: safeClient, exp: Date.now() + SsoService.MEM_TTL_MS });
      return safeClient;
    }

    return null;
  }

  async invalidateMemCache(clientId?: string) {
    if (clientId) {
      this.memCache.delete(clientId);
    } else {
      this.memCache.clear();
    }
  }

  /**
   * Flattens `corsOrigins` from all active SsoClient records.
   * Redis-cached under `cors:all_origins` (60s TTL) — used by main.ts CORS bootstrap
   * and the 60s polling refresh.
   */
  async getAllCorsOrigins(): Promise<string[]> {
    const cacheKey = 'cors:all_origins';
    const cached = await this.redisService.get<string[]>(cacheKey);
    if (cached) return cached;

    const clients = await this.prisma.ssoClient.findMany({
      where: { isActive: true },
      select: { corsOrigins: true },
    });

    const origins = [...new Set(clients.flatMap((c) => c.corsOrigins ?? []))];
    await this.redisService.set(cacheKey, origins, 60);
    return origins;
  }

  /** Invalidates the CORS origin cache whenever a console write changes origins. */
  async invalidateCorsCache(): Promise<void> {
    await this.redisService.del('cors:all_origins');
  }

  async registerClient(data: RegisterClientInput) {
    const salt = await bcrypt.genSalt(12);
    const clientSecret = await bcrypt.hash(data.clientSecret, salt);

    const created = await this.prisma.ssoClient.create({
      data: {
        clientId: data.clientId,
        clientSecret,
        name: data.name,
        redirectUris: data.redirectUris,
        scopes: data.scopes || ['profile', 'email'],
        logoUrl: data.logoUrl || null,
        apiKey: data.apiKey || `api_key_${crypto.randomBytes(16).toString('hex')}`,
      },
    });

    await this.redisService.del(`sso_client:${data.clientId}`);
    this.memCache.delete(data.clientId);
    return created;
  }

  async listClients() {
    return this.prisma.ssoClient.findMany({
      select: {
        id: true,
        clientId: true,
        name: true,
        redirectUris: true,
        scopes: true,
        logoUrl: true,
        apiKey: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateClient(clientId: string, data: { redirectUris?: string[]; name?: string; isActive?: boolean }) {
    const client = await this.prisma.ssoClient.findUnique({ where: { clientId } });
    if (!client) {
      throw new BadRequestException('Client not found');
    }
    const updated = await this.prisma.ssoClient.update({
      where: { clientId },
      data,
    });

    // Invalidate Redis cache instantly on update
    await this.redisService.del(`sso_client:${clientId}`);
    this.memCache.delete(clientId);
    return updated;
  }

  async clearClientCache(clientId?: string) {
    if (clientId) {
      await this.redisService.del(`sso_client:${clientId}`);
      this.memCache.delete(clientId);
    } else {
      await this.redisService.delPattern('sso_client:*');
      this.memCache.clear();
    }
    return { success: true, message: 'SSO Client cache invalidated' };
  }
}
