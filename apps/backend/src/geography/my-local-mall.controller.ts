import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocalMallOverviewService } from './local-mall-overview.service';

/**
 * Per-account local mall snapshot used by the business and customer
 * dashboards. Role-agnostic: the service reads whichever profile exists.
 */
@ApiTags('Geography')
@ApiBearerAuth()
@Controller('geography')
export class MyLocalMallController {
  constructor(private readonly localMallOverview: LocalMallOverviewService) {}

  @Get('my-local-mall')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get the current account's city, borough, high street, local mall and partner businesses",
  })
  @ApiOkResponse({
    description: 'Resolved location hierarchy and businesses in the same local mall',
  })
  async getMyLocalMall(@Request() req: any) {
    // JwtStrategy authenticates to `req.user.userId` (not `req.user.id`).
    const data = await this.localMallOverview.getOverview(req.user.userId);
    return { success: true, data };
  }
}
