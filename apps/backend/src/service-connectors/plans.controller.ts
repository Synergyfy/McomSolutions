import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ServiceConnectorsService } from './service-connectors.service';

@ApiTags('Public Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly connectorsService: ServiceConnectorsService) {}

  @Get('platform')
  @ApiOperation({ summary: 'List plans from a platform (public, no auth required)' })
  @ApiQuery({ name: 'platform', description: 'Platform name (MCOM Mall or MCOM Rewards)', required: true })
  async getPlatformPlans(@Query('platform') platform: string) {
    const plans = await this.connectorsService.getPlans(platform);
    return { success: true, data: plans };
  }
}
