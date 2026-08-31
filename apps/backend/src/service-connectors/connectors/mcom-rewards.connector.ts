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
export class McomRewardsConnector implements ServiceConnector {
  readonly platform = 'MCOM Rewards'
  private readonly logger = new Logger(McomRewardsConnector.name)
  private readonly httpClient: AxiosInstance
  private readonly baseUrl: string

  constructor(private config: ConfigService) {
    this.baseUrl = this.config.get<string>('MCOM_REWARDS_API_URL') || 'http://localhost:4000'
    const apiKey = this.config.get<string>('MCOM_REWARDS_API_KEY') || ''

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
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      monthlyPrice: data.monthlyPrice,
      quarterlyPrice: data.quarterlyPrice,
      annualPrice: data.annualPrice,
      features: data.features,
      configuration: data.configuration,
      isActive: data.isActive,
      isDefault: data.isDefault,
      type: data.type,
      trialDuration: data.trialDuration,
      seasonId: data.seasonId,
      stripeMonthlyPriceId: data.stripeMonthlyPriceId,
      stripeQuarterlyPriceId: data.stripeQuarterlyPriceId,
      stripeAnnualPriceId: data.stripeAnnualPriceId,
      paypalMonthlyPlanId: data.paypalMonthlyPlanId,
      paypalQuarterlyPlanId: data.paypalQuarterlyPlanId,
      paypalAnnualPlanId: data.paypalAnnualPlanId,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }
  }

  private handleError(error: unknown): never {
    if (isAxiosError(error)) {
      const status = error.response?.status
      const data = error.response?.data
      if (status) {
        this.logger.error(`Rewards API ${status}: ${JSON.stringify(data)}`)
        throw new HttpException(
          data?.message || `Rewards API error: ${status}`,
          status,
        )
      }
      if (error.code === 'ECONNREFUSED') {
        this.logger.error(`Rewards API unreachable at ${this.baseUrl}`)
        throw new HttpException(
          'MCOM Rewards backend is unreachable',
          HttpStatus.BAD_GATEWAY,
        )
      }
      this.logger.error(`Rewards API request failed: ${error.message}`)
      throw new HttpException(
        error.message || 'Failed to communicate with MCOM Rewards',
        HttpStatus.BAD_GATEWAY,
      )
    }
    this.logger.error('Unexpected error calling Rewards API', error)
    throw new HttpException(
      'Failed to communicate with MCOM Rewards',
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
        this.logger.warn('Failed to fetch Rewards plan schema — serving default schema');
      }
    }
    // Documented default schema — the frontend never falls back to an ad-hoc
    // hardcoded form when the Rewards service has not implemented its schema endpoint.
    return {
      quotas: [
        { key: 'maxActiveCampaigns', label: 'Max Active Campaigns', type: 'number', unlimited: true },
        { key: 'maxActiveRewards', label: 'Max Active Rewards', type: 'number', unlimited: true },
        { key: 'maxTeamMembers', label: 'Max Team Members', type: 'number' },
      ],
      featureFlags: [
        { key: 'canCreateCampaignFromScratch', label: 'Create Campaign From Scratch', type: 'boolean' },
        { key: 'hasAccessToAdvancedAnalytics', label: 'Advanced Analytics', type: 'boolean' },
        { key: 'hasAccessToCRM', label: 'CRM Access', type: 'boolean' },
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
      this.logger.error('Failed to fetch Rewards seasons:', error as any);
      throw new HttpException('Failed to fetch seasons from MCOM Rewards', HttpStatus.BAD_GATEWAY);
    }
  }
}
