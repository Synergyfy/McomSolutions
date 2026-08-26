import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SsoService } from '../auth/sso.service';
import { RegisterAppDto } from './dto/register-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { ConsoleAuditQueryDto } from './dto/console-audit-query.dto';
import { encrypt } from './crypto.util';

const MASK = '••••••••••••••••';

/** Seeded apps that must never be deactivated via the Console (defense in depth). */
const SYSTEM_CLIENT_IDS = ['mcom-mall', 'mcom-loyalty', '247gbs'];

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
        metadata: undefined,
      },
    });

    await this.redis.del(`sso_client:${dto.clientId}`);
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

    const updated = await this.prisma.ssoClient.update({
      where: { clientId },
      data,
    });

    await this.redis.del(`sso_client:${clientId}`);
    if (dto.corsOrigins !== undefined) {
      await this.ssoService.invalidateCorsCache();
    }

    const changed = this.diffChanges(existing, updated);
    await this.audit(adminId, clientId, 'update_app', changed, req);

    return this.toDetail(updated);
  }

  async deactivateApp(clientId: string, adminId: string, req?: Request) {
    const client = await this.getClientOrThrow(clientId);

    if (client.isSystemApp || SYSTEM_CLIENT_IDS.includes(client.clientId)) {
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
    await this.ssoService.invalidateCorsCache();
    await this.audit(adminId, clientId, 'deactivate_app', { clientId, name: client.name }, req);

    return { success: true, message: `App "${client.name}" deactivated` };
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
    ];
    for (const field of fields) {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
        changes[field] = { before: before[field] ?? null, after: after[field] ?? null };
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
      platformSlug: client.platformSlug,
      isActive: client.isActive,
      isSystemApp: client.isSystemApp,
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
      webhookFailCount: client.webhookFailCount,
      lastWebhookAt: client.lastWebhookAt,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }
}