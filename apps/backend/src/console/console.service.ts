import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SsoService } from '../auth/sso.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import { WEBHOOK_DISPATCH_QUEUE, WEBHOOK_DISPATCH_DLQ } from '../queue/queue.constants';
import { RegisterAppDto } from './dto/register-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { ConsoleAuditQueryDto } from './dto/console-audit-query.dto';
import { encrypt } from './crypto.util';
import { ECOSYSTEM_SERVICES_CACHE_KEY } from '../service-identity/constants';
import { normalizePeerList, SERVICE_PEER_WILDCARD } from '../service-identity/policy.util';
import { SetServicePolicyDto } from './dto/service-policy.dto';

const MASK = '••••••••••••••••';

export interface AppSecretSet {
  clientSecret: string;
  apiKey: string;
  hmacSecret: string;
  webhookSecret: string;
}

@Injectable()
export class ConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly ssoService: SsoService,
    private readonly webhookDispatcher: WebhookDispatcherService,
    @Optional()
    @InjectQueue(WEBHOOK_DISPATCH_QUEUE)
    private readonly dispatchQueue?: Queue,
    @Optional()
    @InjectQueue(WEBHOOK_DISPATCH_DLQ)
    private readonly dlqQueue?: Queue,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async registerApp(dto: RegisterAppDto, adminId: string, req?: Request) {
    await this.assertClientIdAvailable(dto.clientId);
    if (dto.platformSlug) {
      await this.assertPlatformSlugAvailable(dto.platformSlug);
    }

    this.validateRedirectUris(dto.redirectUris);
    this.validateCorsOrigins(dto.corsOrigins);

    const secrets = this.generateSecrets();

    const created = await this.prisma.ssoClient.create({
      data: {
        clientId: dto.clientId,
        clientSecret: await bcrypt.hash(secrets.clientSecret, 12),
        name: dto.name,
        redirectUris: dto.redirectUris,
        scopes: dto.scopes,
        logoUrl: null,
        apiKey: secrets.apiKey,
        isActive: true,
        description: dto.description ?? null,
        appUrl: dto.appUrl ?? null,
        billingApiUrl: dto.billingApiUrl ?? null,
        platformSlug: dto.platformSlug ?? null,
        corsOrigins: dto.corsOrigins,
        webhookUrl: dto.webhookUrl ?? null,
        webhookSecret: dto.webhookUrl ? encrypt(secrets.webhookSecret, this.encryptionKey()) : null,
        hmacSecret: encrypt(secrets.hmacSecret, this.encryptionKey()),
        isSystemApp: dto.isSystemApp ?? false,
        feePercent: dto.feePercent ?? null,
        feeFixedMinor: dto.feeFixedMinor != null ? BigInt(dto.feeFixedMinor) : null,
        metadata: dto.planSchemaEndpoint ? { planSchemaEndpoint: dto.planSchemaEndpoint } : undefined,
        serviceEnabled: dto.serviceEnabled ?? true,
        serviceBaseUrl: dto.serviceBaseUrl ?? null,
        serviceScopes: dto.serviceScopes ?? [],
        allowedAudiences: dto.allowedAudiences ?? [],
        allowedCallers: dto.allowedCallers ?? [],
      },
    });

    await this.redis.del(`sso_client:${dto.clientId}`);
    await this.redis.del(ECOSYSTEM_SERVICES_CACHE_KEY);
    await this.ssoService.invalidateCorsCache();
    await this.audit(adminId, dto.clientId, 'register_app', { name: dto.name, platformSlug: dto.platformSlug }, req);

    return {
      client: this.toDetail(created),
      plainSecrets: secrets,
    };
  }

  async listApps() {
    const clients = await this.prisma.ssoClient.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return clients.map((c) => this.toListItem(c));
  }

  async getApp(clientId: string) {
    const client = await this.prisma.ssoClient.findUnique({ where: { clientId } });
    if (!client) {
      throw new NotFoundException(`App "${clientId}" not found`);
    }
    return this.toDetail(client);
  }

  async updateApp(clientId: string, dto: UpdateAppDto, adminId: string, req?: Request) {
    const existing = await this.getClientOrThrow(clientId);

    if (dto.platformSlug && dto.platformSlug !== existing.platformSlug) {
      await this.assertPlatformSlugAvailable(dto.platformSlug, clientId);
    }
    if (dto.redirectUris) this.validateRedirectUris(dto.redirectUris);
    if (dto.corsOrigins) this.validateCorsOrigins(dto.corsOrigins);

    const data: Prisma.SsoClientUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.platformSlug !== undefined) data.platformSlug = dto.platformSlug ?? null;
    if (dto.appUrl !== undefined) data.appUrl = dto.appUrl ?? null;
    if (dto.billingApiUrl !== undefined) data.billingApiUrl = dto.billingApiUrl ?? null;
    if (dto.redirectUris !== undefined) data.redirectUris = dto.redirectUris;
    if (dto.corsOrigins !== undefined) data.corsOrigins = dto.corsOrigins;
    if (dto.scopes !== undefined) data.scopes = dto.scopes;
    if (dto.webhookUrl !== undefined) data.webhookUrl = dto.webhookUrl ?? null;
    if (dto.planSchemaEndpoint !== undefined) {
      const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
      data.metadata = {
        ...existingMetadata,
        planSchemaEndpoint: dto.planSchemaEndpoint || null,
      };
    }
    if (dto.feePercent !== undefined) data.feePercent = dto.feePercent ?? null;
    if (dto.feeFixedMinor !== undefined) {
      data.feeFixedMinor = dto.feeFixedMinor != null ? BigInt(dto.feeFixedMinor) : null;
    }
    if (dto.serviceEnabled !== undefined) data.serviceEnabled = dto.serviceEnabled;
    if (dto.serviceBaseUrl !== undefined) data.serviceBaseUrl = dto.serviceBaseUrl ?? null;
    if (dto.serviceScopes !== undefined) data.serviceScopes = dto.serviceScopes;
    if (dto.allowedAudiences !== undefined) data.allowedAudiences = dto.allowedAudiences;
    if (dto.allowedCallers !== undefined) data.allowedCallers = dto.allowedCallers;

    const updated = await this.prisma.ssoClient.update({
      where: { clientId },
      data,
    });

    await this.redis.del(`sso_client:${clientId}`);
    await this.redis.del(ECOSYSTEM_SERVICES_CACHE_KEY);
    if (dto.corsOrigins !== undefined) {
      await this.ssoService.invalidateCorsCache();
    }

    const changed = this.diffChanges(existing, updated);
    await this.audit(adminId, clientId, 'update_app', changed, req);

    return this.toDetail(updated);
  }

  async deactivateApp(clientId: string, adminId: string, req?: Request) {
    const client = await this.getClientOrThrow(clientId);

    if (client.isSystemApp) {
      throw new ForbiddenException(
        'System apps cannot be deactivated via Console. Edit the seed configuration instead.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.ssoClient.update({
        where: { clientId },
        data: { isActive: false },
      }),
      this.prisma.ssoSession.deleteMany({ where: { clientId: client.id } }),
    ]);

    await this.redis.del(`sso_client:${clientId}`);
    await this.redis.del(ECOSYSTEM_SERVICES_CACHE_KEY);
    await this.ssoService.invalidateCorsCache();
    await this.audit(adminId, clientId, 'deactivate_app', { clientId, name: client.name }, req);

    return { success: true, message: `App "${client.name}" deactivated` };
  }

  async deleteApp(clientId: string, adminId: string, req?: Request) {
    const client = await this.getClientOrThrow(clientId);

    if (client.isSystemApp) {
      throw new ForbiddenException(
        'System apps cannot be deleted via Console. Edit the seed configuration instead.',
      );
    }

    // Atomic purge of all application traces
    await this.prisma.$transaction(async (tx) => {
      // 1. Delete SSO sessions and auth codes
      await tx.ssoSession.deleteMany({ where: { clientId: client.id } });
      await tx.ssoAuthCode.deleteMany({ where: { clientId: client.id } });

      // 2. Delete webhook delivery logs
      await tx.appWebhookLog.deleteMany({ where: { clientId } });

      // 3. Delete console audit logs for this client
      await tx.consoleAuditLog.deleteMany({ where: { clientId } });

      // 4. Release / clean up wallet holds for this client if any
      await tx.walletHold.deleteMany({ where: { platformClientId: clientId } });

      // 5. Unlink wallet transactions without breaking financial ledger history
      await tx.walletTransaction.updateMany({
        where: {
          OR: [
            { platformClientId: clientId },
            ...(client.platformSlug ? [{ platformSlug: client.platformSlug }] : []),
          ],
        },
        data: {
          platformClientId: null,
          platformSlug: null,
        },
      });

      // 6. Delete the SsoClient record
      await tx.ssoClient.delete({ where: { clientId } });
    });

    // Clean up caches
    await this.redis.del(`sso_client:${clientId}`);
    if (client.platformSlug) {
      await this.redis.del(`sso_client:slug:${client.platformSlug}`);
    }
    if (client.apiKey) {
      await this.redis.del(`sso_client:apikey:${client.apiKey}`);
    }
    await this.redis.del(ECOSYSTEM_SERVICES_CACHE_KEY);
    await this.ssoService.invalidateCorsCache();

    return { success: true, message: `App "${client.name}" (${clientId}) and all associated traces permanently deleted` };
  }

  // ─── SECRET ROTATION ───────────────────────────────────────────────────────

  async rotateClientSecret(clientId: string, adminId: string, req?: Request) {
    const client = await this.getClientOrThrow(clientId);
    const clientSecret = this.generateClientSecret();
    await this.prisma.ssoClient.update({
      where: { clientId },
      data: { clientSecret: await bcrypt.hash(clientSecret, 12) },
    });
    await this.redis.del(`sso_client:${clientId}`);
    await this.audit(adminId, clientId, 'rotate_client_secret', { clientId, rotatedAt: new Date().toISOString() }, req);
    return { clientSecret };
  }

  async rotateApiKey(clientId: string, adminId: string, req?: Request) {
    await this.getClientOrThrow(clientId);
    const apiKey = this.generateApiKey();
    await this.prisma.ssoClient.update({ where: { clientId }, data: { apiKey } });
    await this.redis.del(`sso_client:${clientId}`);
    await this.audit(adminId, clientId, 'rotate_api_key', { clientId, rotatedAt: new Date().toISOString() }, req);
    return { apiKey };
  }

  async rotateHmacSecret(clientId: string, adminId: string, req?: Request) {
    await this.getClientOrThrow(clientId);
    const hmacSecret = this.generateHmacSecret();
    await this.prisma.ssoClient.update({
      where: { clientId },
      data: { hmacSecret: encrypt(hmacSecret, this.encryptionKey()) },
    });
    await this.redis.del(`sso_client:${clientId}`);
    await this.audit(adminId, clientId, 'rotate_hmac_secret', { clientId, rotatedAt: new Date().toISOString() }, req);
    return { hmacSecret };
  }

  async rotateWebhookSecret(clientId: string, adminId: string, req?: Request) {
    await this.getClientOrThrow(clientId);
    const webhookSecret = this.generateWebhookSecret();
    await this.prisma.ssoClient.update({
      where: { clientId },
      data: { webhookSecret: encrypt(webhookSecret, this.encryptionKey()) },
    });
    await this.redis.del(`sso_client:${clientId}`);
    await this.audit(adminId, clientId, 'rotate_webhook_secret', { clientId, rotatedAt: new Date().toISOString() }, req);
    return { webhookSecret };
  }

  // ─── UTILITY ───────────────────────────────────────────────────────────────

  async pingAppHealth(clientId: string): Promise<{ reachable: boolean; latencyMs: number }> {
    const client = await this.getClientOrThrow(clientId);
    if (!client.billingApiUrl) {
      throw new BadRequestException(`App "${clientId}" has no billingApiUrl configured`);
    }
    const start = Date.now();
    try {
      await axios.head(client.billingApiUrl, { timeout: 8000 });
      return { reachable: true, latencyMs: Date.now() - start };
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        // A 4xx/5xx still proves the host is reachable.
        return { reachable: true, latencyMs: Date.now() - start };
      }
      throw new BadGatewayException(`App "${client.name}" billingApiUrl is unreachable`);
    }
  }

  async testWebhook(clientId: string) {
    const client = await this.getClientOrThrow(clientId);
    if (!client.webhookUrl) {
      throw new BadRequestException(`App "${clientId}" has no webhookUrl configured`);
    }

    const testPayload = {
      test: true,
      message: 'This is a test webhook from MCOM Solutions Console',
      timestamp: new Date().toISOString(),
    };

    return this.webhookDispatcher.dispatch(clientId, 'ping', testPayload);
  }

  async getWebhookLogs(clientId: string, limit = 50) {
    await this.getClientOrThrow(clientId);
    return this.prisma.appWebhookLog.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async listAuditLogs(query: ConsoleAuditQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.ConsoleAuditLogWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.action) where.action = query.action;

    const [data, total] = await Promise.all([
      this.prisma.consoleAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.consoleAuditLog.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── SERVICE MESH POLICY ─────────────────────────────────────────────────────

  /**
   * Returns the directed peer policy for every app (egress + ingress).
   * Deny-by-default: empty = no peers; `*` = any registered app.
   */
  async getServicePolicy() {
    const clients = await this.prisma.ssoClient.findMany({
      orderBy: [{ isSystemApp: 'desc' }, { createdAt: 'asc' }],
      select: {
        clientId: true,
        name: true,
        serviceEnabled: true,
        isActive: true,
        allowedAudiences: true,
        allowedCallers: true,
      },
    });

    return {
      apps: clients.map((c) => ({
        clientId: c.clientId,
        name: c.name,
        serviceEnabled: c.serviceEnabled,
        isActive: c.isActive,
        allowedAudiences: c.allowedAudiences ?? [],
        allowedCallers: c.allowedCallers ?? [],
      })),
    };
  }

  /**
   * Bulk-replaces the peer policy graph in one transaction. Validates that every
   * referenced peer is a registered clientId/platformSlug (or `*`) and that no
   * app references itself. Writes a single audit entry.
   */
  async setServicePolicy(dto: SetServicePolicyDto, adminId: string, req?: Request) {
    const clients = await this.prisma.ssoClient.findMany({
      select: {
        clientId: true,
        platformSlug: true,
        allowedAudiences: true,
        allowedCallers: true,
      },
    });

    const byClientId = new Map(clients.map((c) => [c.clientId, c]));
    const validPeers = new Set<string>([SERVICE_PEER_WILDCARD]);
    for (const c of clients) {
      validPeers.add(c.clientId);
      if (c.platformSlug) validPeers.add(c.platformSlug);
    }

    const seen = new Set<string>();
    for (const app of dto.apps) {
      const client = byClientId.get(app.clientId);
      if (!client) {
        throw new NotFoundException(`App "${app.clientId}" not found`);
      }
      if (seen.has(app.clientId)) {
        throw new BadRequestException(`Duplicate policy entry for "${app.clientId}"`);
      }
      seen.add(app.clientId);

      const selfIds = new Set(
        [client.clientId, client.platformSlug].filter((v): v is string => Boolean(v)),
      );
      for (const field of ['allowedAudiences', 'allowedCallers'] as const) {
        for (const peer of app[field] ?? []) {
          if (!validPeers.has(peer)) {
            throw new BadRequestException(
              `Unknown peer "${peer}" in ${field} for "${app.clientId}"`,
            );
          }
          if (selfIds.has(peer)) {
            throw new BadRequestException(
              `"${app.clientId}" cannot reference itself in ${field}`,
            );
          }
        }
      }
    }

    await this.prisma.$transaction(
      dto.apps.map((app) =>
        this.prisma.ssoClient.update({
          where: { clientId: app.clientId },
          data: {
            allowedAudiences: normalizePeerList(app.allowedAudiences),
            allowedCallers: normalizePeerList(app.allowedCallers),
          },
        }),
      ),
    );

    for (const app of dto.apps) {
      await this.redis.del(`sso_client:${app.clientId}`);
    }
    await this.redis.del(ECOSYSTEM_SERVICES_CACHE_KEY);

    const changes: Record<string, any> = {};
    for (const app of dto.apps) {
      const before = byClientId.get(app.clientId)!;
      changes[app.clientId] = {
        before: {
          allowedAudiences: before.allowedAudiences ?? [],
          allowedCallers: before.allowedCallers ?? [],
        },
        after: {
          allowedAudiences: normalizePeerList(app.allowedAudiences),
          allowedCallers: normalizePeerList(app.allowedCallers),
        },
      };
    }
    await this.audit(adminId, 'service-policy', 'update_service_policy', changes, req);

    return { success: true, updated: dto.apps.length };
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  private encryptionKey(): string {
    const key = this.config.get<string>('CONSOLE_ENCRYPTION_KEY');
    if (!key) {
      throw new Error('CONSOLE_ENCRYPTION_KEY is not configured');
    }
    return key;
  }

  private async getClientOrThrow(clientId: string) {
    const client = await this.prisma.ssoClient.findUnique({ where: { clientId } });
    if (!client) {
      throw new NotFoundException(`App "${clientId}" not found`);
    }
    return client;
  }

  private async assertClientIdAvailable(clientId: string) {
    const existing = await this.prisma.ssoClient.findUnique({
      where: { clientId },
      select: { clientId: true },
    });
    if (existing) {
      throw new ConflictException(`An app with Client ID "${clientId}" already exists`);
    }
  }

  private async assertPlatformSlugAvailable(platformSlug: string, exceptClientId?: string) {
    const existing = await this.prisma.ssoClient.findFirst({
      where: {
        platformSlug,
        ...(exceptClientId ? { clientId: { not: exceptClientId } } : {}),
      },
      select: { clientId: true },
    });
    if (existing) {
      throw new ConflictException(`Platform slug "${platformSlug}" is already in use`);
    }
  }

  private validateRedirectUris(uris: string[]) {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    for (const uri of uris) {
      let url: URL;
      try {
        url = new URL(uri);
      } catch {
        throw new BadRequestException(`Invalid redirect URI: ${uri}`);
      }
      if (uri.includes('..')) {
        throw new BadRequestException('Relative paths not allowed in redirect URI');
      }
      if (isProd && url.protocol !== 'https:') {
        throw new BadRequestException('Redirect URI must use HTTPS in production');
      }
    }
  }

  private validateCorsOrigins(origins: string[]) {
    for (const origin of origins) {
      let url: URL;
      try {
        url = new URL(origin);
      } catch {
        throw new BadRequestException(`CORS origin must be scheme + hostname only, e.g. https://app.com`);
      }
      const hasPath = url.pathname && url.pathname !== '/' && url.pathname !== '';
      if (hasPath || url.search || url.hash) {
        throw new BadRequestException(`CORS origin must be scheme + hostname only, e.g. https://app.com`);
      }
    }
  }

  private diffChanges(before: Record<string, any>, after: Record<string, any>): Record<string, any> {
    const changes: Record<string, any> = {};
    const fields = [
      'name',
      'description',
      'platformSlug',
      'appUrl',
      'billingApiUrl',
      'redirectUris',
      'corsOrigins',
      'scopes',
      'webhookUrl',
      'planSchemaEndpoint',
      'serviceEnabled',
      'serviceBaseUrl',
      'serviceScopes',
      'allowedAudiences',
      'allowedCallers',
    ];
    for (const field of fields) {
      const beforeVal = field === 'planSchemaEndpoint'
        ? (before.metadata?.planSchemaEndpoint ?? null)
        : before[field];
      const afterVal = field === 'planSchemaEndpoint'
        ? (after.metadata?.planSchemaEndpoint ?? null)
        : after[field];
      if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
        changes[field] = { before: beforeVal ?? null, after: afterVal ?? null };
      }
    }
    return changes;
  }

  private async audit(adminId: string, clientId: string, action: string, changes: Record<string, any>, req?: Request) {
    await this.prisma.consoleAuditLog.create({
      data: {
        adminId,
        clientId,
        action,
        changes: changes as Prisma.InputJsonValue,
        ip: req?.ip ?? null,
        userAgent: req?.headers['user-agent'] ?? null,
      },
    });
  }

  private generateSecrets(): AppSecretSet {
    return {
      clientSecret: this.generateClientSecret(),
      apiKey: this.generateApiKey(),
      hmacSecret: this.generateHmacSecret(),
      webhookSecret: this.generateWebhookSecret(),
    };
  }

  private generateClientSecret(): string {
    return `cs_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateApiKey(): string {
    return `ak_${crypto.randomBytes(24).toString('hex')}`;
  }

  private generateHmacSecret(): string {
    return `hm_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateWebhookSecret(): string {
    return `wh_${crypto.randomBytes(24).toString('hex')}`;
  }

  private maskSecret(value?: string | null): string | null {
    if (!value) return null;
    if (value.startsWith('ak_')) {
      return `ak_****${value.slice(-4)}`;
    }
    return MASK;
  }

  private toListItem(client: Record<string, any>) {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      description: client.description ?? null,
      appUrl: client.appUrl ?? null,
      logoUrl: client.logoUrl ?? null,
      platformSlug: client.platformSlug,
      isActive: client.isActive,
      isSystemApp: client.isSystemApp,
      serviceScopes: client.serviceScopes ?? [],
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  private toDetail(client: Record<string, any>) {
    return {
      id: client.id,
      clientId: client.clientId,
      name: client.name,
      description: client.description,
      platformSlug: client.platformSlug,
      appUrl: client.appUrl,
      billingApiUrl: client.billingApiUrl,
      planSchemaEndpoint: (client.metadata?.planSchemaEndpoint as string | null | undefined) ?? null,
      redirectUris: client.redirectUris,
      corsOrigins: client.corsOrigins,
      scopes: client.scopes,
      webhookUrl: client.webhookUrl,
      logoUrl: client.logoUrl,
      clientSecret: MASK,
      apiKey: this.maskSecret(client.apiKey),
      hmacSecret: client.hmacSecret ? MASK : null,
      webhookSecret: client.webhookSecret ? MASK : null,
      isActive: client.isActive,
      isSystemApp: client.isSystemApp,
      feePercent: client.feePercent != null ? Number(client.feePercent) : null,
      feeFixedMinor: client.feeFixedMinor != null ? Number(client.feeFixedMinor) : null,
      serviceEnabled: client.serviceEnabled ?? true,
      serviceBaseUrl: client.serviceBaseUrl ?? null,
      serviceScopes: client.serviceScopes ?? [],
      allowedAudiences: client.allowedAudiences ?? [],
      allowedCallers: client.allowedCallers ?? [],
      webhookFailCount: client.webhookFailCount,
      lastWebhookAt: client.lastWebhookAt,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  // ─── Webhook DLQ Management ───────────────────────────
  async getDlqJobs(limit = 50) {
    if (!this.dlqQueue) {
      return { success: true, count: 0, jobs: [] };
    }
    const jobs = await this.dlqQueue.getJobs(['waiting', 'failed', 'completed'], 0, limit - 1);
    return {
      success: true,
      count: jobs.length,
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        data: j.data,
        failedReason: j.failedReason,
        attemptsMade: j.attemptsMade,
        timestamp: j.timestamp,
      })),
    };
  }

  async replayDlqJob(jobId: string) {
    if (!this.dlqQueue || !this.dispatchQueue) {
      throw new BadRequestException('Queue system is not enabled');
    }
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(`DLQ job '${jobId}' not found`);
    }

    const payload = job.data?.data || job.data;
    await this.dispatchQueue.add(
      'dispatch',
      payload,
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    await job.remove();

    return {
      success: true,
      message: `Re-queued job '${jobId}' for delivery`,
    };
  }
}