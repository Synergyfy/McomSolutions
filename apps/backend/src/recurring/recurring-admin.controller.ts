import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RecurringService } from './recurring.service';
import { AdminRecurringQueryDto } from './recurring.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/recurring')
export class RecurringAdminController {
  constructor(private readonly recurringService: RecurringService) {}

  @Get()
  @ApiOperation({ summary: 'List all recurring subscriptions (optionally filtered)' })
  async list(@Query() query: AdminRecurringQueryDto) {
    return this.recurringService.listForAdmin(query);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Recurring billing metrics (active, past due, MRR)' })
  async metrics() {
    return this.recurringService.metrics();
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Retry a failed renewal charge' })
  async retry(@Param('id') id: string) {
    return this.recurringService.retry(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a recurring subscription as an admin' })
  async cancel(@Param('id') id: string) {
    return this.recurringService.cancel(id, undefined, false, true);
  }
}
