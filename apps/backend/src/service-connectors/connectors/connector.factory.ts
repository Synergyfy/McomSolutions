import { Injectable, BadRequestException } from '@nestjs/common';
import { McomMallConnector } from './mcom-mall.connector';
import { McomRewardsConnector } from './mcom-rewards.connector';
import { ServiceConnector } from './connector.interface';

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
  ) {}

  getConnector(platform: string): ServiceConnector {
    const key = SUPPORTED_PLATFORMS[platform]
    if (!key) {
      throw new BadRequestException(
        `Platform "${platform}" is not supported. Available: ${this.getSupportedPlatforms().join(', ')}`,
      )
    }

    switch (key) {
      case 'mcomMall':
        return this.mcomMall
      case 'mcomRewards':
        return this.mcomRewards
      default:
        throw new BadRequestException(`Connector for "${platform}" not implemented yet`)
    }
  }

  getSupportedPlatforms(): string[] {
    return Object.keys(SUPPORTED_PLATFORMS)
  }
}
