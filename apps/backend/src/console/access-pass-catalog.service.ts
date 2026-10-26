import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios, { isAxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';

export interface AccessPassPlatform {
  /** Console app display name — the value MCOM access bundles use for `platform`. */
  name: string;
  clientId: string;
  platformSlug: string | null;
  /** Full URL that returns the platform's access pass plan catalogue. */
  endpoint: string;
}

export interface AccessPassPlanCatalogueEntry {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  price: number | null;
  currency: string | null;
  durationDays: number | null;
  features: string[];
  configuration: Record<string, unknown> | null;
  isActive: boolean;
  purchaseEnabled: boolean;
  codeRedemptionEnabled: boolean;
  [key: string]: unknown;
}

/**
 * Reads the access pass plan catalogues published by Console-registered apps.
 *
 * The endpoint is collected per app in Admin → Console (metadata.
 * accessPassPlansEndpoint) and is optional: platforms without one simply do not
 * appear in access-pass bundle builders.
 */
@Injectable()
export class AccessPassCatalogService {
  private readonly logger = new Logger(AccessPassCatalogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Platforms that have an access pass catalogue endpoint configured. */
  async listPlatforms(): Promise<{ success: boolean; data: AccessPassPlatform[] }> {
    const clients = await this.prisma.ssoClient.findMany({
      where: { isActive: true },
      select: {
        name: true,
        clientId: true,
        platformSlug: true,
        metadata: true,
      },
      orderBy: { name: 'asc' },
    });

    const data = clients
      .map((client) => {
        const metadata = (client.metadata ?? {}) as Record<string, unknown>;
        const endpoint =
          typeof metadata.accessPassPlansEndpoint === 'string'
            ? metadata.accessPassPlansEndpoint.trim()
            : '';
        if (!endpoint) return null;
        return {
          name: client.name,
          clientId: client.clientId,
          platformSlug: client.platformSlug,
          endpoint,
        } satisfies AccessPassPlatform;
      })
      .filter((platform): platform is AccessPassPlatform => platform !== null);

    return { success: true, data };
  }

  /** Fetch (live) the access pass plan catalogue for one platform. */
  async getPlans(platform: string): Promise<{
    success: boolean;
    platform: Omit<AccessPassPlatform, 'endpoint'>;
    data: AccessPassPlanCatalogueEntry[];
  }> {
    const key = platform?.trim();
    if (!key) {
      throw new BadRequestException('A platform is required.');
    }

    const client = await this.prisma.ssoClient.findFirst({
      where: {
        isActive: true,
        OR: [
          { name: { equals: key, mode: 'insensitive' } },
          { platformSlug: { equals: key, mode: 'insensitive' } },
          { clientId: { equals: key, mode: 'insensitive' } },
        ],
      },
      select: {
        name: true,
        clientId: true,
        platformSlug: true,
        apiKey: true,
        metadata: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Platform "${key}" was not found in the Console registry.`);
    }

    const metadata = (client.metadata ?? {}) as Record<string, unknown>;
    const endpoint =
      typeof metadata.accessPassPlansEndpoint === 'string'
        ? metadata.accessPassPlansEndpoint.trim()
        : '';
    if (!endpoint) {
      throw new BadRequestException(
        `Platform "${client.name}" has no access pass plans endpoint configured. Add one in Admin → Console.`,
      );
    }

    try {
      const { data } = await axios.get(endpoint, {
        timeout: 8000,
        headers: {
          Accept: 'application/json',
          ...(client.apiKey ? { 'x-mcom-solution-api-key': client.apiKey } : {}),
        },
      });

      return {
        success: true,
        platform: {
          name: client.name,
          clientId: client.clientId,
          platformSlug: client.platformSlug,
        },
        data: this.normalizePlans(data),
      };
    } catch (err) {
      throw this.mapError(client.name, err);
    }
  }

  private normalizePlans(payload: unknown): AccessPassPlanCatalogueEntry[] {
    let raw: unknown[] = [];
    if (Array.isArray(payload)) {
      raw = payload;
    } else if (payload && typeof payload === 'object') {
      const body = payload as Record<string, unknown>;
      const candidate = body.data ?? body.plans ?? body.items;
      if (Array.isArray(candidate)) raw = candidate;
    }

    return raw
      .filter((plan): plan is Record<string, unknown> => !!plan && typeof plan === 'object')
      .map((plan) => ({
        ...plan,
        id: String(plan.id ?? plan._id ?? plan.planId ?? ''),
        name: String(plan.name ?? plan.title ?? 'Untitled access pass'),
        slug: plan.slug != null ? String(plan.slug) : null,
        description: plan.description != null ? String(plan.description) : null,
        price: plan.price != null ? Number(plan.price) : null,
        currency: plan.currency != null ? String(plan.currency) : null,
        durationDays: plan.durationDays != null ? Number(plan.durationDays) : null,
        features: Array.isArray(plan.features) ? plan.features.map(String) : [],
        configuration:
          plan.configuration && typeof plan.configuration === 'object'
            ? (plan.configuration as Record<string, unknown>)
            : null,
        isActive: plan.isActive != null ? Boolean(plan.isActive) : plan.active != null ? Boolean(plan.active) : true,
        purchaseEnabled: plan.purchaseEnabled != null ? Boolean(plan.purchaseEnabled) : true,
        codeRedemptionEnabled:
          plan.codeRedemptionEnabled != null ? Boolean(plan.codeRedemptionEnabled) : true,
      }))
      .filter((plan) => plan.id.length > 0);
  }

  private mapError(platform: string, err: unknown): Error {
    if (isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return new BadGatewayException(
          `Unable to reach the ${platform} access pass catalogue (service offline or unreachable).`,
        );
      }
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        return new GatewayTimeoutException(
          `The ${platform} access pass catalogue timed out. Please try again.`,
        );
      }

      const status = err.response?.status;
      const responseData = err.response?.data as { message?: unknown } | undefined;
      const serverMessage =
        typeof responseData?.message === 'string' ? responseData.message : undefined;

      if (status === 401 || status === 403) {
        return new BadGatewayException(
          `Authentication failed with ${platform}. Verify the app API key and access pass endpoint.`,
        );
      }
      if (status && status >= 400 && status < 500) {
        return new BadGatewayException(
          serverMessage || `${platform} rejected the access pass catalogue request (status ${status}).`,
        );
      }
      if (status && status >= 500) {
        return new BadGatewayException(
          `${platform} returned an internal error while loading access pass plans.`,
        );
      }

      this.logger.warn(`Access pass catalogue request to ${platform} failed: ${err.message}`);
    }

    return new BadGatewayException(
      `Failed to load the ${platform} access pass catalogue.`,
    );
  }
}
