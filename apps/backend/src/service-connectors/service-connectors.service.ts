import { Injectable } from '@nestjs/common';
import { ConnectorFactory } from './connectors/connector.factory';
import {
  ExternalPlan,
  ExternalSeason,
  CreateExternalPlanInput,
  UpdateExternalPlanInput,
  PlanSchema,
} from './connectors/connector.interface';

@Injectable()
export class ServiceConnectorsService {
  constructor(private readonly connectorFactory: ConnectorFactory) {}

  async createPlan(platform: string, input: CreateExternalPlanInput): Promise<ExternalPlan> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.createPlan(input)
  }

  async getPlans(platform: string): Promise<ExternalPlan[]> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.getPlans()
  }

  async getPlanById(platform: string, id: string): Promise<ExternalPlan> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.getPlanById(id)
  }

  async updatePlan(
    platform: string,
    id: string,
    input: UpdateExternalPlanInput,
  ): Promise<ExternalPlan> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.updatePlan(id, input)
  }

  async deletePlan(platform: string, id: string): Promise<void> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.deletePlan(id)
  }

  async getPlanSchema(platform: string): Promise<PlanSchema | null> {
    const connector = await this.connectorFactory.getConnector(platform)
    return connector.getPlanSchema()
  }

  async getSeasons(platform: string): Promise<ExternalSeason[]> {
    const connector = await this.connectorFactory.getConnector(platform)
    if (typeof connector.getSeasons === 'function') {
      return connector.getSeasons()
    }
    return []
  }

  getSupportedPlatforms(): string[] {
    return this.connectorFactory.getSupportedPlatforms()
  }
}
