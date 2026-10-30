import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PartnerGrantStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PartnerAuditService } from './partner-audit.service';
import { PartnerGrantService } from './partner-grant.service';

/** Read-only admin views for partner-issued grants, codes and audit trail. */
@ApiTags('Admin — Partner Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/partner')
export class PartnerAdminController {
  constructor(
    private readonly grants: PartnerGrantService,
    private readonly audit: PartnerAuditService,
  ) {}

  @Get('grants')
  @ApiOperation({ summary: 'List partner grants (filter by issuanceId/status)' })
  @ApiOkResponse({ description: 'Paginated partner grants' })
  listGrants(
    @Query('issuanceId') issuanceId?: string,
    @Query('status') status?: PartnerGrantStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.grants.listGrants({
      issuanceId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('access-codes')
  @ApiOperation({ summary: 'List partner-issued access-pass codes' })
  @ApiOkResponse({ description: 'Paginated access-pass codes' })
  listAccessCodes(
    @Query('sourceApp') sourceApp?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.grants.listAccessCodesAdmin({
      sourceApp: sourceApp ?? 'mcom-rewards',
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'List partner mutation audit records' })
  @ApiOkResponse({ description: 'Paginated partner audit trail' })
  listAudit(
    @Query('issuanceId') issuanceId?: string,
    @Query('callerClientId') callerClientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list({
      issuanceId,
      callerClientId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
