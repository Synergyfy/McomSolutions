import { HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import {
  ServiceConnector,
  ExternalPlan,
  ExternalSeason,
  CreateExternalPlanInput,
  UpdateExternalPlanInput,
  PlanSchema,
} from './connector.interface';

/**
 * Generic DB-driven connector for Console-registered apps.
 * Talks to `<billingApiUrl>/api/v1/system/plans` using the app's API key.
 * 8s hard timeout — no retries inside the connector (callers decide policy).
 */
export class GenericHttpConnector implements ServiceConnector {
  readonly platform: string;
  private readonly http: AxiosInstance;
  private readonly planSchemaEndpoint?: string;

  constructor(
    private readonly client: {
      name: string;
      apiKey: string;
      billingApiUrl: string;
      planSchemaEndpoint?: string | null;
    },
  ) {
    this.platform = client.name;
    this.planSchemaEndpoint = client.planSchemaEndpoint || undefined;
    this.http = axios.create({
      baseURL: `${client.billingApiUrl}/api/v1`,
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'x-mcom-solution-api-key': client.apiKey,
      },
    });
  }

  async createPlan(input: CreateExternalPlanInput): Promise<ExternalPlan> {
    const res: any = await this.call(() => this.http.post('/system/plans', input));
    return this.unwrapPlan(res);
  }

  async getPlans(): Promise<ExternalPlan[]> {
    const data: any = await this.call<any>(() => this.http.get('/system/plans'));
    const list = Array.isArray(data) ? data : data?.data ?? [];
    return list.map((item: any) => this.unwrapPlan(item));
  }

  async getPlanById(id: string): Promise<ExternalPlan> {
    const res: any = await this.call(() => this.http.get(`/system/plans/${id}`));
    return this.unwrapPlan(res);
  }

  async updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan> {
    const res: any = await this.call(() => this.http.patch(`/system/plans/${id}`, input));
    return this.unwrapPlan(res);
  }

  async deletePlan(id: string): Promise<void> {
    await this.call(() => this.http.delete(`/system/plans/${id}`));
  }

  async getPlanSchema(): Promise<PlanSchema | null> {
    try {
      const body: any = await this.call<any>(() =>
        this.planSchemaEndpoint ? axios.get(this.planSchemaEndpoint, {
          timeout: 8000,
          headers: { 'x-mcom-solution-api-key': this.client.apiKey },
        }) : this.http.get('/system/plans/schema'),
      );
      const schema = body?.data ?? body;
      if (
        schema &&
        (Array.isArray(schema.quotas) || Array.isArray(schema.featureFlags))
      ) {
        return schema as PlanSchema;
      }
      return null;
    } catch {
      // Older services without a schema endpoint return 404 — degrade gracefully.
      return null;
    }
  }

  async getSeasons(): Promise<ExternalSeason[]> {
    try {
      const body: any = await this.call<any>(() => this.http.get('/system/seasons'));
      const raw = body?.data ?? body;
      const list = Array.isArray(raw) ? raw : [];
      return list.map((s: any) => ({
        id: s.id || s._id || s.seasonId,
        name: s.name || s.title || s.seasonName || s.id,
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive ?? (s.status === 'ACTIVE' || s.status === 'Active'),
        status: s.status,
      }));
    } catch (error) {
      // Endpoint not implemented (404/405) → no seasons, degrade gracefully.
      if (error instanceof HttpException && (error.getStatus() === 404 || error.getStatus() === 405)) {
        return [];
      }
      throw new HttpException(`Failed to fetch seasons from ${this.platform}`, HttpStatus.BAD_GATEWAY);
    }
  }

  private unwrapPlan(data: any): ExternalPlan {
    const raw = data?.data ?? data;
    if (!raw) return raw as ExternalPlan;

    if (!Array.isArray(raw.variants) || raw.variants.length === 0) {
      return raw as ExternalPlan;
    }

    const variants = raw.variants.map((v: any) => {
      const tierName = v.tierLevel?.name || v.tier || 'STANDARD';
      const activePrice = Array.isArray(v.prices)
        ? v.prices.find((p: any) => p.isActive)?.amount ?? v.prices[0]?.amount
        : v.price;
      return {
        id: v.id,
        tier: tierName,
        tierLevel: v.tierLevel,
        price: activePrice != null ? Number(activePrice) : undefined,
        features: Array.isArray(v.features) ? v.features : [],
        configuration: v.configuration || {},
        isActive: v.isActive ?? true,
        stripePriceId: v.stripePriceId,
        paypalPlanId: v.paypalPlanId,
      };
    });

    const tierPrices: Record<string, number> = {};
    const tierFeatures: Record<string, string[]> = {};
    for (const v of variants) {
      const key = v.tier === 'PRO_PLUS' || v.tier === 'Pro+' ? 'Pro+' : v.tier === 'PRO' || v.tier === 'Pro' ? 'Pro' : 'Standard';
      if (v.price != null) tierPrices[key] = v.price;
      if (v.features) tierFeatures[key] = v.features;
    }

    const standardPrice = tierPrices.Standard ?? raw.monthlyPrice;
    const proPrice = tierPrices.Pro ?? raw.quarterlyPrice;
    const proPlusPrice = tierPrices['Pro+'] ?? raw.annualPrice;

    return {
      ...raw,
      slug: raw.slug,
      variants,
      tierPrices: raw.tierPrices || tierPrices,
      tierFeatures: raw.tierFeatures || tierFeatures,
      tierDurations: raw.tierDurations || { Standard: 90, Pro: 180, 'Pro+': 365 },
      monthlyPrice: standardPrice != null ? Number(standardPrice) : raw.monthlyPrice,
      quarterlyPrice: proPrice != null ? Number(proPrice) : raw.quarterlyPrice,
      annualPrice: proPlusPrice != null ? Number(proPlusPrice) : raw.annualPrice,
      features: raw.features || tierFeatures.Standard || [],
      configuration: raw.configuration || variants[0]?.configuration || {},
    };
  }

  private async call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const { data } = await fn();
      return data;
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const serverMessage = err.response?.data?.message;

        if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
          throw new HttpException(
            `Unable to reach ${this.platform} (service offline or unreachable).`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
          throw new HttpException(
            `Request to ${this.platform} timed out. Please try again.`,
            HttpStatus.GATEWAY_TIMEOUT,
          );
        }

        if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
          throw new HttpException(
            `Authentication failed with ${this.platform}. Please verify API key configuration.`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        if (status && status >= 400 && status < 500) {
          throw new HttpException(
            serverMessage || `${this.platform} rejected the request (Status ${status}).`,
            status,
          );
        }

        if (status && status >= 500) {
          throw new HttpException(
            `${this.platform} returned an internal error. Please try again later.`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        throw new HttpException(
          serverMessage || `Failed to communicate with ${this.platform}.`,
          status ?? HttpStatus.BAD_GATEWAY,
        );
      }
      throw new HttpException(`Failed to reach ${this.platform}`, HttpStatus.BAD_GATEWAY);
    }
  }
}