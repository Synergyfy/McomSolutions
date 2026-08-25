import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CampaignService } from './campaign.service';
import {
  CampaignActionDto,
  CampaignQueryDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

@ApiTags('Campaign Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns (optionally filtered by location)' })
  @ApiQuery({ name: 'locationType', required: false, enum: ['high_street', 'borough', 'local_mall'], description: 'Filter by location type' })
  @ApiQuery({ name: 'locationId', required: false, description: 'Filter by location ID' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page (max 100)' })
  @ApiOkResponse({ description: 'Paginated list of campaigns' })
  getCampaigns(@Query() query: CampaignQueryDto) {
    return this.campaignService.getCampaigns(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single campaign by ID' })
  @ApiOkResponse({ description: 'Campaign' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  getCampaign(@Param('id') id: string) {
    return this.campaignService.getCampaign(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  @ApiBody({ type: CreateCampaignDto })
  @ApiCreatedResponse({ description: 'Campaign created' })
  createCampaign(@Body() dto: CreateCampaignDto) {
    return this.campaignService.createCampaign(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiBody({ type: UpdateCampaignDto })
  @ApiOkResponse({ description: 'Campaign updated' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  updateCampaign(@Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaignService.updateCampaign(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  async deleteCampaign(@Param('id') id: string) {
    await this.campaignService.deleteCampaign(id);
  }

  @Post(':id/action')
  @ApiOperation({ summary: 'Perform an action on a campaign (pause, resume, complete)' })
  @ApiBody({ type: CampaignActionDto })
  @ApiOkResponse({ description: 'Action applied' })
  @ApiNotFoundResponse({ description: 'Campaign not found' })
  performAction(@Param('id') id: string, @Body() dto: CampaignActionDto) {
    return this.campaignService.performAction(id, dto);
  }
}