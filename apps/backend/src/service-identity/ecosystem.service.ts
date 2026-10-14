import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ServiceKeyService } from './keys/service-key.service';
import { ECOSYSTEM_SERVICES_CACHE_KEY } from './constants';

export interface EcosystemServiceEntry {
  clientId: string;
  name: string;
  platformSlug: string | null;
  baseUrl: string | null;
  appUrl: string | null;
  scopes: string[];
  /** Ingress policy — peers permitted to call this app. Empty = deny all; `*` = any. */
  allowedCallers: string[];
  isSystemApp: boolean;
}

const SERVICE_SELECT = {
  clientId: true,
  name: true,
  platformSlug: true,
  serviceBaseUrl: true,
  billingApiUrl: true,
  serviceScopes: true,
  allowedCallers: true,
  appUrl: true,
  isSystemApp: true,
} as const;

/**
 * Public service registry (control plane). Registered app backends cache this
 * to know which peers exist, where they live, and what scopes they expose. It
 * is NOT on the request path — receivers resolve identities locally.
 */
@Injectable()
export class EcosystemService {
  private static readonly CACHE_KEY = ECOSYSTEM_SERVICES_CACHE_KEY;
  private static readonly CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly keys: ServiceKeyService,
  ) {}

  async listServices(): Promise<EcosystemServiceEntry[]> {
    const cached = await this.redis.get<EcosystemServiceEntry[]>(
      EcosystemService.CACHE_KEY,
    );
    if (cached) return cached;

    const clients = await this.prisma.ssoClient.findMany({
      where: { isActive: true, serviceEnabled: true },
      orderBy: [{ isSystemApp: 'desc' }, { createdAt: 'asc' }],
      select: SERVICE_SELECT,
    });

    const data = clients.map((c) => this.toEntry(c));
    await this.redis.set(EcosystemService.CACHE_KEY, data, EcosystemService.CACHE_TTL_SECONDS);
    return data;
  }

  async getService(clientIdOrSlug: string): Promise<EcosystemServiceEntry> {
    const client = await this.prisma.ssoClient.findFirst({
      where: {
        isActive: true,
        serviceEnabled: true,
        OR: [{ clientId: clientIdOrSlug }, { platformSlug: clientIdOrSlug }],
      },
      select: SERVICE_SELECT,
    });

    if (!client) {
      throw new NotFoundException(`Service "${clientIdOrSlug}" not found`);
    }
    return this.toEntry(client);
  }

  /** OIDC-style discovery document for partner integration. */
  discovery() {
    return {
      issuer: this.keys.getIssuer(),
      jwks_uri: '/.well-known/jwks.json',
      token_endpoint: '/api/v1/auth/service-token',
      token_exchange_endpoint: '/api/v1/auth/service-token/exchange',
      registry_endpoint: '/api/v1/ecosystem/services',
      signing_alg: 'RS256',
      key_id: this.keys.getKid(),
    };
  }

  private toEntry(client: {
    clientId: string;
    name: string;
    platformSlug: string | null;
    serviceBaseUrl: string | null;
    billingApiUrl: string | null;
    serviceScopes: string[];
    allowedCallers: string[];
    appUrl: string | null;
    isSystemApp: boolean;
  }): EcosystemServiceEntry {
    return {
      clientId: client.clientId,
      name: client.name,
      platformSlug: client.platformSlug,
      baseUrl: client.serviceBaseUrl ?? client.billingApiUrl ?? null,
      appUrl: client.appUrl,
      scopes: client.serviceScopes ?? [],
      allowedCallers: client.allowedCallers ?? [],
      isSystemApp: client.isSystemApp,
    };
  }
}
