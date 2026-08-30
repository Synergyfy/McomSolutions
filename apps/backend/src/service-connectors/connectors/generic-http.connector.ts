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
    return this.call(() => this.http.post('/system/plans', input));
  }

  async getPlans(): Promise<ExternalPlan[]> {
    const data: any = await this.call<any>(() => this.http.get('/system/plans'));
    return Array.isArray(data) ? data : data?.data ?? [];
  }

  async getPlanById(id: string): Promise<ExternalPlan> {
    return this.call(() => this.http.get(`/system/plans/${id}`));
  }

  async updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan> {
    return this.call(() => this.http.patch(`/system/plans/${id}`, input));
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
    } catch {
      // Return empty list if platform does not implement seasons endpoint
      return [];
    }
  }

  private async call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const { data } = await fn();
      return data;
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status ?? HttpStatus.BAD_GATEWAY;
        const message = err.response?.data?.message ?? `${this.platform} API error`;
        throw new HttpException(message, status);
      }
      throw new HttpException(`Failed to reach ${this.platform}`, HttpStatus.BAD_GATEWAY);
    }
  }
}