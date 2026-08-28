import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProgrammeService } from './programme.service';
import {
  BusinessActionDto,
  CreateBusinessProgrammeDto,
  CreateProgrammePhaseDto,
  CreateReadinessGateDto,
  CreateSupportAgentDto,
  UpdateBusinessProgrammeDto,
  UpdateProgrammePhaseDto,
  UpdateReadinessGateDto,
  UpdateSupportAgentDto,
  UpdateTaskStatusDto,
} from './dto/programme.dto';

@ApiTags('Programme Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/programme')
export class ProgrammeController {
  constructor(private readonly programmeService: ProgrammeService) {}

  // ─── Phases ───────────────────────────────────────────
  @Get('phases')
  @ApiOperation({ summary: 'List programme phases' })
  @ApiOkResponse({ description: 'List of programme phases' })
  getPhases() {
    return this.programmeService.getPhases();
  }

  @Get('phases/:id')
  @ApiOperation({ summary: 'Get a programme phase by ID' })
  @ApiOkResponse({ description: 'Programme phase' })
  @ApiNotFoundResponse({ description: 'Phase not found' })
  getPhase(@Param('id') id: string) {
    return this.programmeService.getPhase(id);
  }

  @Post('phases')
  @ApiOperation({ summary: 'Create a programme phase' })
  @ApiBody({ type: CreateProgrammePhaseDto })
  @ApiCreatedResponse({ description: 'Phase created' })
  createPhase(@Body() dto: CreateProgrammePhaseDto) {
    return this.programmeService.createPhase(dto);
  }

  @Put('phases/:id')
  @ApiOperation({ summary: 'Update a programme phase' })
  @ApiBody({ type: UpdateProgrammePhaseDto })
  @ApiOkResponse({ description: 'Phase updated' })
  @ApiNotFoundResponse({ description: 'Phase not found' })
  updatePhase(@Param('id') id: string, @Body() dto: UpdateProgrammePhaseDto) {
    return this.programmeService.updatePhase(id, dto);
  }

  @Delete('phases/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a programme phase' })
  @ApiNotFoundResponse({ description: 'Phase not found' })
  async deletePhase(@Param('id') id: string) {
    await this.programmeService.deletePhase(id);
  }

  // ─── Readiness Gates ──────────────────────────────────
  @Get('gates')
  @ApiOperation({ summary: 'List readiness gates' })
  @ApiOkResponse({ description: 'List of readiness gates' })
  getGates() {
    return this.programmeService.getGates();
  }

  @Post('gates')
  @ApiOperation({ summary: 'Create a readiness gate' })
  @ApiBody({ type: CreateReadinessGateDto })
  @ApiCreatedResponse({ description: 'Gate created' })
  createGate(@Body() dto: CreateReadinessGateDto) {
    return this.programmeService.createGate(dto);
  }

  @Put('gates/:id')
  @ApiOperation({ summary: 'Update a readiness gate' })
  @ApiBody({ type: UpdateReadinessGateDto })
  @ApiOkResponse({ description: 'Gate updated' })
  @ApiNotFoundResponse({ description: 'Gate not found' })
  updateGate(@Param('id') id: string, @Body() dto: UpdateReadinessGateDto) {
    return this.programmeService.updateGate(id, dto);
  }

  @Delete('gates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a readiness gate' })
  @ApiNotFoundResponse({ description: 'Gate not found' })
  async deleteGate(@Param('id') id: string) {
    await this.programmeService.deleteGate(id);
  }

  // ─── Support Agents ───────────────────────────────────
  @Get('agents')
  @ApiOperation({ summary: 'List support agents' })
  @ApiOkResponse({ description: 'List of support agents' })
  getAgents() {
    return this.programmeService.getAgents();
  }

  @Post('agents')
  @ApiOperation({ summary: 'Create a support agent' })
  @ApiBody({ type: CreateSupportAgentDto })
  @ApiCreatedResponse({ description: 'Agent created' })
  @ApiConflictResponse({ description: 'Agent email already exists' })
  createAgent(@Body() dto: CreateSupportAgentDto) {
    return this.programmeService.createAgent(dto);
  }

  @Put('agents/:id')
  @ApiOperation({ summary: 'Update a support agent' })
  @ApiBody({ type: UpdateSupportAgentDto })
  @ApiOkResponse({ description: 'Agent updated' })
  @ApiConflictResponse({ description: 'Agent email already exists' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  updateAgent(@Param('id') id: string, @Body() dto: UpdateSupportAgentDto) {
    return this.programmeService.updateAgent(id, dto);
  }

  @Delete('agents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a support agent' })
  @ApiNotFoundResponse({ description: 'Agent not found' })
  async deleteAgent(@Param('id') id: string) {
    await this.programmeService.deleteAgent(id);
  }

  // ─── Business Programmes ──────────────────────────────
  @Get('businesses')
  @ApiOperation({ summary: 'List business programmes' })
  @ApiOkResponse({ description: 'List of business programme records' })
  getBusinesses() {
    return this.programmeService.getBusinesses();
  }

  @Post('businesses')
  @ApiOperation({ summary: 'Create a business programme record' })
  @ApiBody({ type: CreateBusinessProgrammeDto })
  @ApiCreatedResponse({ description: 'Business programme created' })
  createBusiness(@Body() dto: CreateBusinessProgrammeDto) {
    return this.programmeService.createBusiness(dto);
  }

  @Put('businesses/:id')
  @ApiOperation({ summary: 'Update a business programme record' })
  @ApiBody({ type: UpdateBusinessProgrammeDto })
  @ApiOkResponse({ description: 'Business programme updated' })
  @ApiNotFoundResponse({ description: 'Business programme not found' })
  updateBusiness(@Param('id') id: string, @Body() dto: UpdateBusinessProgrammeDto) {
    return this.programmeService.updateBusiness(id, dto);
  }

  @Delete('businesses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a business programme record' })
  @ApiNotFoundResponse({ description: 'Business programme not found' })
  async deleteBusiness(@Param('id') id: string) {
    await this.programmeService.deleteBusiness(id);
  }

  @Post('businesses/:id/action')
  @ApiOperation({ summary: 'Perform an action on a business programme (pause, resume, extend, etc.)' })
  @ApiBody({ type: BusinessActionDto })
  @ApiOkResponse({ description: 'Action applied' })
  @ApiNotFoundResponse({ description: 'Business programme not found' })
  async performAction(@Param('id') id: string, @Body() dto: BusinessActionDto) {
    return this.programmeService.performAction(id, dto.action, dto.days);
  }

  // ─── Task Statuses ────────────────────────────────────
  @Get('businesses/:id/tasks')
  @ApiOperation({ summary: 'Get task statuses for a business programme' })
  @ApiOkResponse({ description: 'Map of missionId -> task status' })
  @ApiNotFoundResponse({ description: 'Business programme not found' })
  getTaskStatuses(@Param('id') id: string) {
    return this.programmeService.getTaskStatuses(id);
  }

  @Put('businesses/:id/tasks')
  @ApiOperation({ summary: 'Set a task status for a business programme' })
  @ApiBody({ type: UpdateTaskStatusDto })
  @ApiOkResponse({ description: 'Task status updated' })
  @ApiNotFoundResponse({ description: 'Business programme not found' })
  setTaskStatus(@Param('id') id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.programmeService.setTaskStatus(id, dto);
  }
}
