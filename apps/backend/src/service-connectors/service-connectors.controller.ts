import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ServiceConnectorsService } from './service-connectors.service';
import { CreateExternalPlanDto, UpdateExternalPlanDto } from './dto/create-mall-plan.dto';

@ApiTags('Service Connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/packages/external')
export class ServiceConnectorsController {
  constructor(private readonly connectorsService: ServiceConnectorsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a plan on an external service (e.g. MCOM Mall)' })
  async createPlan(@Body() dto: CreateExternalPlanDto) {
    const { platform, ...planData } = dto
    const plan = await this.connectorsService.createPlan(platform, planData)
    return { success: true, data: plan }
  }

  @Get()
  @ApiOperation({ summary: 'List plans from an external service' })
  @ApiQuery({ name: 'platform', description: 'Platform name (e.g. MCOM Mall)', required: true })
  async getPlans(@Query('platform') platform: string) {
    const plans = await this.connectorsService.getPlans(platform)
    return { success: true, data: plans }
  }

  @Get('platforms')
  @ApiOperation({ summary: 'List supported platforms' })
  async getSupportedPlatforms() {
    const platforms = this.connectorsService.getSupportedPlatforms()
    return { success: true, data: platforms }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plan by ID from an external service' })
  @ApiQuery({ name: 'platform', description: 'Platform name', required: true })
  async getPlanById(
    @Param('id') id: string,
    @Query('platform') platform: string,
  ) {
    const plan = await this.connectorsService.getPlanById(platform, id)
    return { success: true, data: plan }
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan on an external service' })
  @ApiQuery({ name: 'platform', description: 'Platform name', required: true })
  async updatePlan(
    @Param('id') id: string,
    @Query('platform') platform: string,
    @Body() dto: UpdateExternalPlanDto,
  ) {
    const plan = await this.connectorsService.updatePlan(platform, id, dto)
    return { success: true, data: plan }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a plan from an external service' })
  @ApiQuery({ name: 'platform', description: 'Platform name', required: true })
  async deletePlan(
    @Param('id') id: string,
    @Query('platform') platform: string,
  ) {
    await this.connectorsService.deletePlan(platform, id)
    return { success: true }
  }
}
