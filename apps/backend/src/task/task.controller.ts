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
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { TaskService } from './task.service';
import {
  AssignTaskDto,
  CreateTaskDefinitionDto,
  QueryAssignmentsDto,
  UpdateAssignmentStatusDto,
  UpdateTaskDefinitionDto,
} from './dto/task.dto';

@ApiTags('Programme Task Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  // ─── ADMIN: Feature Keys ──────────────────────────────
  @Get('admin/programme/tasks/features')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List available MCOM Central feature key triggers' })
  @ApiOkResponse({ description: 'List of feature keys' })
  getFeatures() {
    return this.taskService.getFeatures();
  }

  // ─── ADMIN: Overview Statistics ───────────────────────
  @Get('admin/programme/tasks/overview')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get overview stats for task engine' })
  @ApiOkResponse({ description: 'Task engine overview statistics' })
  getOverviewStats() {
    return this.taskService.getOverviewStats();
  }

  // ─── ADMIN: Task Definitions ──────────────────────────
  @Get('admin/programme/tasks')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all task definitions' })
  @ApiOkResponse({ description: 'List of task definitions with assignment counts' })
  getTaskDefinitions() {
    return this.taskService.getTaskDefinitions();
  }

  @Get('admin/programme/tasks/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get a task definition by ID' })
  @ApiOkResponse({ description: 'Task definition details' })
  @ApiNotFoundResponse({ description: 'Task not found' })
  getTaskDefinition(@Param('id') id: string) {
    return this.taskService.getTaskDefinition(id);
  }

  @Post('admin/programme/tasks')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new task definition' })
  @ApiCreatedResponse({ description: 'Task definition created' })
  @ApiBody({ type: CreateTaskDefinitionDto })
  createTaskDefinition(@Body() dto: CreateTaskDefinitionDto, @Req() req: any) {
    const adminName = req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user?.email || 'Admin';
    return this.taskService.createTaskDefinition(dto, adminName);
  }

  @Put('admin/programme/tasks/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a task definition' })
  @ApiOkResponse({ description: 'Task definition updated' })
  @ApiBody({ type: UpdateTaskDefinitionDto })
  updateTaskDefinition(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDefinitionDto,
    @Req() req: any,
  ) {
    const adminName = req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user?.email || 'Admin';
    return this.taskService.updateTaskDefinition(id, dto, adminName);
  }

  @Delete('admin/programme/tasks/:id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task definition' })
  @ApiOkResponse({ description: 'Task definition deleted' })
  deleteTaskDefinition(@Param('id') id: string, @Req() req: any) {
    const adminName = req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user?.email || 'Admin';
    return this.taskService.deleteTaskDefinition(id, adminName);
  }

  // ─── ADMIN: Assignment Operations ─────────────────────
  @Post('admin/programme/tasks/:id/assign')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Assign task definition to eligible users or specified users' })
  @ApiOkResponse({ description: 'Task assigned' })
  @ApiBody({ type: AssignTaskDto })
  assignTask(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @Req() req: any,
  ) {
    const adminName = req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user?.email || 'Admin';
    return this.taskService.assignTask(id, dto, adminName);
  }

  @Get('admin/programme/tasks/:id/assignments')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get user assignments and progress for a task' })
  @ApiOkResponse({ description: 'List of assignments' })
  getTaskAssignments(
    @Param('id') id: string,
    @Query() query: QueryAssignmentsDto,
  ) {
    return this.taskService.getTaskAssignments(id, query);
  }

  @Patch('admin/programme/tasks/assignments/:assignmentId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Manually update status of a user task assignment' })
  @ApiOkResponse({ description: 'Assignment updated' })
  @ApiBody({ type: UpdateAssignmentStatusDto })
  updateAssignmentStatus(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentStatusDto,
    @Req() req: any,
  ) {
    const adminName = req.user?.firstName
      ? `${req.user.firstName} ${req.user.lastName || ''}`.trim()
      : req.user?.email || 'Admin';
    return this.taskService.updateAssignmentStatus(assignmentId, dto, adminName);
  }

  // ─── USER-FACING: My Assigned Tasks ───────────────────
  @Get('programme/my-tasks')
  @ApiOperation({ summary: 'List tasks assigned to the currently logged in user' })
  @ApiOkResponse({ description: 'Assigned tasks' })
  getMyTasks(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.taskService.getMyTasks(userId);
  }

  @Patch('programme/my-tasks/:assignmentId/start')
  @ApiOperation({ summary: 'Mark an assigned task as in progress' })
  @ApiOkResponse({ description: 'Task marked in progress' })
  startMyTask(@Param('assignmentId') assignmentId: string, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    return this.taskService.startMyTask(assignmentId, userId);
  }

  @Post('programme/my-tasks/:assignmentId/complete')
  @ApiOperation({ summary: 'Submit and complete an assigned task, claiming its reward' })
  @ApiOkResponse({ description: 'Task completed and reward queued' })
  completeMyTask(
    @Param('assignmentId') assignmentId: string,
    @Body() body: { submissionData?: unknown; notes?: string },
    @Req() req: any,
  ) {
    const userId = req.user?.userId || req.user?.id;
    return this.taskService.completeMyTask(assignmentId, userId, body ?? {});
  }
}
