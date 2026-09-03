import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import {
  ServiceConnector,
  ExternalPlan,
  ExternalSeason,
  CreateExternalPlanInput,
  UpdateExternalPlanInput,
  PlanSchema,
} from './connector.interface';

@Injectable()
export class McomMallConnector implements ServiceConnector {
  readonly platform = 'MCOM Mall'
  private readonly logger = new Logger(McomMallConnector.name)
  private readonly httpClient: AxiosInstance
  private readonly baseUrl: string

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('MCOM_MALL_API_URL') || 'http://localhost:3001'
    const apiKey = this.config.get<string>('MCOM_SOLUTION_API_KEY') || ''

    this.httpClient = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'x-mcom-solution-api-key': apiKey,
      },
    })
  }

  private mapPlanResponse(data: any): ExternalPlan {
    const raw = data?.data ?? data;
    return {
      id: raw.id,
      name: raw.name,
      description: raw.description,
      monthlyPrice: raw.monthlyPrice,
      quarterlyPrice: raw.quarterlyPrice,
      annualPrice: raw.annualPrice,
      features: raw.features,
      configuration: raw.configuration,
      isActive: raw.isActive,
      isDefault: raw.isDefault,
      type: raw.type,
      trialDuration: raw.trialDuration,
      seasonId: raw.seasonId,
      stripeMonthlyPriceId: raw.stripeMonthlyPriceId,
      stripeQuarterlyPriceId: raw.stripeQuarterlyPriceId,
      stripeAnnualPriceId: raw.stripeAnnualPriceId,
      paypalMonthlyPlanId: raw.paypalMonthlyPlanId,
      paypalQuarterlyPlanId: raw.paypalQuarterlyPlanId,
      paypalAnnualPlanId: raw.paypalAnnualPlanId,
      created_at: raw.created_at,
      updated_at: raw.updated_at,
    };
  }

  private handleError(error: unknown): never {
    if (isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data
      if (status) {
        this.logger.error(`Mall API ${status}: ${JSON.stringify(data)}`)
        throw new HttpException(
          data?.message || `Mall API error: ${status}`,
          status,
        )
      }
      if (error.code === 'ECONNREFUSED') {
        this.logger.error(`Mall API unreachable at ${this.baseUrl}`)
        throw new HttpException(
          'MCOM Mall backend is unreachable',
          HttpStatus.BAD_GATEWAY,
        )
      }
      this.logger.error(`Mall API request failed: ${error.message}`)
      throw new HttpException(
        error.message || 'Failed to communicate with MCOM Mall',
        HttpStatus.BAD_GATEWAY,
      )
    }
    this.logger.error('Unexpected error calling Mall API', error)
    throw new HttpException(
      'Failed to communicate with MCOM Mall',
      HttpStatus.INTERNAL_SERVER_ERROR,
    )
  }

  async createPlan(input: CreateExternalPlanInput): Promise<ExternalPlan> {
    try {
      const { data } = await this.httpClient.post('/system/plans', input)
      return this.mapPlanResponse(data)
    } catch (error) {
      this.handleError(error)
    }
  }

  async getPlans(): Promise<ExternalPlan[]> {
    try {
      const { data } = await this.httpClient.get('/system/plans')
      const plans = Array.isArray(data) ? data : data?.data ?? []
      return plans.map((p: any) => this.mapPlanResponse(p))
    } catch (error) {
      this.handleError(error)
    }
  }

  async getPlanById(id: string): Promise<ExternalPlan> {
    try {
      const { data } = await this.httpClient.get(`/system/plans/${id}`)
      return this.mapPlanResponse(data)
    } catch (error) {
      this.handleError(error)
    }
  }

  async updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan> {
    try {
      const { data } = await this.httpClient.patch(`/system/plans/${id}`, input)
      return this.mapPlanResponse(data)
    } catch (error) {
      this.handleError(error)
    }
  }

  async deletePlan(id: string): Promise<void> {
    try {
      await this.httpClient.delete(`/system/plans/${id}`)
    } catch (error) {
      this.handleError(error)
    }
  }

  async getPlanSchema(): Promise<PlanSchema | null> {
    try {
      const { data } = await this.httpClient.get('/system/plans/schema');
      const schema = data?.data ?? data;
      if (schema && (Array.isArray(schema.quotas) || Array.isArray(schema.featureFlags))) {
        return schema as PlanSchema;
      }
    } catch (error) {
      const status = isAxiosError(error) ? error.response?.status : undefined;
      if (!status || (status !== 404 && status !== 405)) {
        this.logger.warn('Failed to fetch Mall plan schema — serving default schema');
      }
    }
    // Documented default schema — the frontend never falls back to an ad-hoc
    // hardcoded form when the Mall service has not implemented its schema endpoint.
    return {
      quotas: [
        { key: 'maxListings', label: 'Max Listings', type: 'number', unlimited: true },
        { key: 'maxProducts', label: 'Max Products', type: 'number', unlimited: true },
        { key: 'maxServices', label: 'Max Services', type: 'number', unlimited: true },
        { key: 'maxImagesPerListing', label: 'Max Images per Listing', type: 'number' },
      ],
      featureFlags: [
        { key: 'priorityInSearch', label: 'Priority in Search', type: 'boolean' },
        { key: 'advancedAnalytics', label: 'Advanced Analytics', type: 'boolean' },
        { key: 'allowCustomBranding', label: 'Custom Branding', type: 'boolean' },
      ],
    };
  }

  async getSeasons(): Promise<ExternalSeason[]> {
    try {
      const { data } = await this.httpClient.get('/system/seasons');
      const raw = Array.isArray(data) ? data : data?.data ?? [];
      return raw.map((s: any) => ({
        id: s.id || s._id || s.seasonId,
        name: s.name || s.title || s.seasonName || s.id,
        startDate: s.startDate,
        endDate: s.endDate,
        isActive: s.isActive ?? (s.status === 'ACTIVE' || s.status === 'Active'),
        status: s.status,
      }));
    } catch (error) {
      // Endpoint not implemented (404/405) → no seasons, degrade gracefully.
      if (isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
        return [];
      }
      this.logger.error('Failed to fetch Mall seasons:', error as any);
      throw new HttpException('Failed to fetch seasons from MCOM Mall', HttpStatus.BAD_GATEWAY);
    }
  }
}
