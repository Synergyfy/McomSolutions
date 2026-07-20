import { Module } from '@nestjs/common';
import { ServiceConnectorsController } from './service-connectors.controller';
import { PlansController } from './plans.controller';
import { ServiceConnectorsService } from './service-connectors.service';
import { ConnectorFactory } from './connectors/connector.factory';
import { McomMallConnector } from './connectors/mcom-mall.connector';
import { McomRewardsConnector } from './connectors/mcom-rewards.connector';

@Module({
  controllers: [ServiceConnectorsController, PlansController],
  providers: [
    ServiceConnectorsService,
    ConnectorFactory,
    McomMallConnector,
    McomRewardsConnector,
  ],
  exports: [ServiceConnectorsService],
})
export class ServiceConnectorsModule {}
