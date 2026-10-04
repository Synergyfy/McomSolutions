import { Controller, Get, NotFoundException, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ProgrammeService } from './programme.service';

@ApiTags('Programme - User Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('programme')
export class ProgrammeUserController {
  constructor(
    private readonly programmeService: ProgrammeService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveBusinessId(req: any): Promise<string> {
    const direct = req.user?.businessId;
    if (direct) return direct;
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new NotFoundException('Business profile not found for this user');
    }
    const profile = await this.prisma.businessProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found for this user');
    }
    return profile.id;
  }

  @Get('my-programme')
  @ApiOperation({ summary: 'Get current user business programme status and missions' })
  @ApiOkResponse({ description: 'Business programme with phases and task statuses' })
  async getMyProgramme(@Req() req: any) {
    const businessId = await this.resolveBusinessId(req);
    return this.programmeService.getBusinessProgrammeByBusinessId(businessId);
  }

  @Put('my-programme/missions/:missionId/complete')
  @ApiOperation({ summary: 'Mark a 90-day programme mission completed' })
  @ApiOkResponse({ description: 'Mission marked completed' })
  async completeMission(@Param('missionId') missionId: string, @Req() req: any) {
    const businessId = await this.resolveBusinessId(req);
    return this.programmeService.completeMissionForBusiness(businessId, missionId);
  }

  @Get('phases')
  @ApiOperation({ summary: 'Get active programme phases for dashboard' })
  @ApiOkResponse({ description: 'List of programme phases' })
  async getPublicPhases() {
    return this.programmeService.getPhases();
  }
}
