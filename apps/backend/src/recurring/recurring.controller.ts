import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RecurringScope } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringService } from './recurring.service';
import { CancelRecurringDto, EnableWalletRecurringDto, SetAutoRenewDto } from './recurring.dto';

@ApiTags('Recurring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recurring')
export class RecurringController {
  constructor(
    private readonly recurringService: RecurringService,
    private readonly prisma: PrismaService,
  ) {}

  private async businessId(req: any): Promise<string> {
    if (req.user?.businessId) return req.user.businessId;
    if (req.user?.userId) {
      const profile = await this.prisma.businessProfile.findFirst({
        where: { userId: req.user.userId, deletedAt: null },
        select: { id: true },
      });
      if (profile?.id) return profile.id;
    }
    throw new NotFoundException('No active business profile found for this user.');
  }

  @Get()
  @ApiOperation({ summary: 'List my recurring subscriptions and recent charges' })
  async list(@Req() req: any) {
    return this.recurringService.listForBusiness(await this.businessId(req));
  }

  @Post('wallet')
  @ApiOperation({ summary: 'Enable wallet auto-debit for an existing membership or platform plan' })
  async enableWallet(@Req() req: any, @Body() dto: EnableWalletRecurringDto) {
    const businessId = await this.businessId(req);
    return this.recurringService.enableWalletAutoRenew(businessId, req.user?.userId, {
      scope: dto.scope === 'PLATFORM' ? RecurringScope.PLATFORM : RecurringScope.MEMBERSHIP,
      billingCycle: dto.billingCycle,
      platform: dto.platform,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of my recurring subscriptions' })
  async get(@Req() req: any, @Param('id') id: string) {
    return this.recurringService.getForBusiness(id, await this.businessId(req));
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel auto-renew (at period end by default)' })
  async cancel(@Req() req: any, @Param('id') id: string, @Body() dto: CancelRecurringDto) {
    return this.recurringService.cancel(id, await this.businessId(req), Boolean(dto.immediate));
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a subscription that is set to cancel at period end' })
  async resume(@Req() req: any, @Param('id') id: string) {
    return this.recurringService.resume(id, await this.businessId(req));
  }

  @Patch(':id/auto-renew')
  @ApiOperation({ summary: 'Enable or disable automatic renewal' })
  async setAutoRenew(@Req() req: any, @Param('id') id: string, @Body() dto: SetAutoRenewDto) {
    return this.recurringService.setAutoRenew(id, await this.businessId(req), dto.enabled);
  }
}
