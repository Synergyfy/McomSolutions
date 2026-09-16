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

    let variants: any[] | undefined = undefined;
    let tierPrices: Record<string, number> | undefined = undefined;
    let tierFeatures: Record<string, string[]> | undefined = undefined;

    if (Array.isArray(raw.variants) && raw.variants.length > 0) {
      variants = raw.variants.map((v: any) => {
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

      tierPrices = {};
      tierFeatures = {};
      for (const v of variants) {
        const key = v.tier === 'PRO_PLUS' || v.tier === 'Pro+' ? 'Pro+' : v.tier === 'PRO' || v.tier === 'Pro' ? 'Pro' : 'Standard';
        if (v.price != null) tierPrices[key] = v.price;
        if (v.features) tierFeatures[key] = v.features;
      }
    }

    const standardPrice = tierPrices?.Standard ?? raw.monthlyPrice;
    const proPrice = tierPrices?.Pro ?? raw.quarterlyPrice;
    const proPlusPrice = tierPrices?.['Pro+'] ?? raw.annualPrice;

    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      variants,
      tierPrices,
      tierFeatures,
      tierDurations: { Standard: 90, Pro: 180, 'Pro+': 365 },
      monthlyPrice: standardPrice != null ? Number(standardPrice) : undefined,
      quarterlyPrice: proPrice != null ? Number(proPrice) : undefined,
      annualPrice: proPlusPrice != null ? Number(proPlusPrice) : undefined,
      features: raw.features || tierFeatures?.Standard || [],
      configuration: raw.configuration || variants?.[0]?.configuration || {},
      isActive: raw.isActive ?? true,
      isDefault: raw.isDefault ?? false,
      type: raw.type,
      trialDuration: raw.trialDuration,
      seasonId: raw.seasonId,
      stripeMonthlyPriceId: raw.stripeMonthlyPriceId,
      stripeQuarterlyPriceId: raw.stripeQuarterlyPriceId,
      stripeAnnualPriceId: raw.stripeAnnualPriceId,
      paypalMonthlyPlanId: raw.paypalMonthlyPlanId,
      paypalQuarterlyPlanId: raw.paypalQuarterlyPlanId,
      paypalAnnualPlanId: raw.paypalAnnualPlanId,
      created_at: raw.created_at || raw.createdAt,
      updated_at: raw.updated_at || raw.updatedAt,
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
