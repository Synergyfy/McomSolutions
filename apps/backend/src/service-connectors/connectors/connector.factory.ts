import { Injectable, BadRequestException } from '@nestjs/common';
import { McomMallConnector } from './mcom-mall.connector';
import { McomRewardsConnector } from './mcom-rewards.connector';
import { GenericHttpConnector } from './generic-http.connector';
import { ServiceConnector } from './connector.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const SUPPORTED_PLATFORMS: Record<string, string> = {
  'MCOM Mall': 'mcomMall',
  'MCOM Rewards': 'mcomRewards',
  // Future connectors — uncomment when implemented:
  // 'MCOM Spin': 'mcomSpin',
  // 'GBS Audit': 'gbsAudit',
  // 'GBS Expo': 'gbsExpo',
}

@Injectable()
export class ConnectorFactory {
  constructor(
    private readonly mcomMall: McomMallConnector,
    private readonly mcomRewards: McomRewardsConnector,
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getConnector(platform: string): Promise<ServiceConnector> {
    // PRIORITY 1: Named connectors — never change, never remove these
    const key = SUPPORTED_PLATFORMS[platform]
    if (key) {
      switch (key) {
        case 'mcomMall':
          return this.mcomMall
        case 'mcomRewards':
          return this.mcomRewards
        default:
          throw new BadRequestException(`Connector for "${platform}" not implemented yet`)
      }
    }

    // PRIORITY 2: DB-driven generic connector (new apps registered via Console)
    const cacheKey = `connector_client:${platform}`;
    let client = await this.redisService.get<any>(cacheKey);
    if (!client) {
      client = await this.prisma.ssoClient.findFirst({
        where: {
          OR: [
            { name: platform },
            { platformSlug: platform.toLowerCase() },
          ],
          isActive: true,
          billingApiUrl: { not: null },
        },
      });
      if (client) {
        await this.redisService.set(cacheKey, client, 300); // 5-min cache
      }
    }

    if (client && client.billingApiUrl) {
      return new GenericHttpConnector({
        name: client.name,
        apiKey: client.apiKey ?? '',
        billingApiUrl: client.billingApiUrl,
      });
    }

    // Same throw as before — existing behaviour preserved
    throw new BadRequestException(
      `Platform "${platform}" is not supported. Available: ${this.getSupportedPlatforms().join(', ')}`,
    )
  }

  getSupportedPlatforms(): string[] {
    return Object.keys(SUPPORTED_PLATFORMS)
  }
}