import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConsoleAdminGuard } from '../console/guards/console-admin.guard';
import { AppPaymentsService } from './app-payments.service';
import { AdminFilterChargesDto } from './dto/admin-filter-charges.dto';
import { PaginatedChargesDto } from './dto/responses.dto';

@ApiTags('MCOM Pay (Admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ConsoleAdminGuard)
@Controller('admin/app-payments')
export class AppPaymentsAdminController {
  constructor(private readonly service: AppPaymentsService) {}

  @Get('charges')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'List all app charges across every registered app' })
  @ApiOkResponse({ type: PaginatedChargesDto })
  async list(@Query() filters: AdminFilterChargesDto) {
    return this.service.listAllCharges(filters);
  }

  @Get('charges/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get a single charge (admin view)' })
  async get(@Param('id') id: string) {
    return this.service.getChargeAsAdmin(id);
  }

  @Get('charges/:id/ledger')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Double-entry ledger rows for a charge' })
  async ledger(@Param('id') id: string) {
    return this.service.getLedgerForCharge(id);
  }
}
