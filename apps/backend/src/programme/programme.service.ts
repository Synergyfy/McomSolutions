import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
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
import { Prisma } from '@prisma/client';

@Injectable()
export class ProgrammeService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Audit Logger ──────────────────────────────────────
  private async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'Programme',
  ) {
    await this.prisma.auditLog.create({
      data: { action, adminName, targetType, targetName, details, category },
    });
  }

  // ─── Phases ───────────────────────────────────────────
  async getPhases() {
    const phases = await this.prisma.programmePhase.findMany({
      orderBy: { order: 'asc' },
    });
    return { success: true, data: phases };
  }

  async getPhase(id: string) {
    const phase = await this.prisma.programmePhase.findUnique({ where: { id } });
    if (!phase) throw new NotFoundException('Programme phase not found');
    return { success: true, data: phase };
  }

  async createPhase(dto: CreateProgrammePhaseDto) {
    const phase = await this.prisma.programmePhase.create({
      data: {
        name: dto.name,
        dayStart: dto.dayStart,
        dayEnd: dto.dayEnd,
        description: dto.description,
        color: dto.color ?? 'sky',
        order: dto.order ?? 0,
        missions: (dto.missions ?? []) as Prisma.InputJsonValue,
      },
    });
    await this.logAudit('Programme Phase Created', 'ProgrammePhase', dto.name, `Created programme phase "${dto.name}"`);
    return { success: true, data: phase };
  }

  async updatePhase(id: string, dto: UpdateProgrammePhaseDto) {
    await this.ensurePhase(id);
    const data: Prisma.ProgrammePhaseUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.dayStart !== undefined) data.dayStart = dto.dayStart;
    if (dto.dayEnd !== undefined) data.dayEnd = dto.dayEnd;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.missions !== undefined) data.missions = dto.missions as Prisma.InputJsonValue;

    const phase = await this.prisma.programmePhase.update({ where: { id }, data });
    await this.logAudit('Programme Phase Updated', 'ProgrammePhase', id, `Updated programme phase "${dto.name ?? id}"`);
    return { success: true, data: phase };
  }

  async deletePhase(id: string) {
    const phase = await this.ensurePhase(id);
    await this.prisma.programmePhase.delete({ where: { id } });
    await this.logAudit('Programme Phase Deleted', 'ProgrammePhase', phase.name, `Deleted programme phase "${phase.name}"`);
    return { success: true };
  }

  // ─── Readiness Gates ──────────────────────────────────
  async getGates() {
    const gates = await this.prisma.readinessGate.findMany({
      orderBy: { minProgressPercent: 'desc' },
    });
    return { success: true, data: gates };
  }

  async createGate(dto: CreateReadinessGateDto) {
    const gate = await this.prisma.readinessGate.create({
      data: {
        name: dto.name,
        minProgressPercent: dto.minProgressPercent,
        isEnabled: dto.isEnabled ?? true,
      },
    });
    await this.logAudit('Readiness Gate Created', 'ReadinessGate', dto.name, `Created readiness gate "${dto.name}"`);
    return { success: true, data: gate };
  }

  async updateGate(id: string, dto: UpdateReadinessGateDto) {
    await this.ensureGate(id);
    const data: Prisma.ReadinessGateUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.minProgressPercent !== undefined) data.minProgressPercent = dto.minProgressPercent;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;

    const gate = await this.prisma.readinessGate.update({ where: { id }, data });
    await this.logAudit('Readiness Gate Updated', 'ReadinessGate', id, `Updated readiness gate "${dto.name ?? id}"`);
    return { success: true, data: gate };
  }

  async deleteGate(id: string) {
    const gate = await this.ensureGate(id);
    await this.prisma.readinessGate.delete({ where: { id } });
    await this.logAudit('Readiness Gate Deleted', 'ReadinessGate', gate.name, `Deleted readiness gate "${gate.name}"`);
    return { success: true };
  }

  // ─── Support Agents ───────────────────────────────────
  async getAgents() {
    const agents = await this.prisma.supportAgent.findMany({
      orderBy: { name: 'asc' },
    });
    return { success: true, data: agents };
  }

  async createAgent(dto: CreateSupportAgentDto) {
    try {
      const agent = await this.prisma.supportAgent.create({
        data: { name: dto.name, role: dto.role, email: dto.email },
      });
      await this.logAudit('Support Agent Created', 'SupportAgent', dto.name, `Created support agent "${dto.name}"`);
      return { success: true, data: agent };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A support agent with this email already exists');
      }
      throw error;
    }
  }

  async updateAgent(id: string, dto: UpdateSupportAgentDto) {
    await this.ensureAgent(id);
    try {
      const agent = await this.prisma.supportAgent.update({
        where: { id },
        data: {
          name: dto.name,
          role: dto.role,
          email: dto.email,
        },
      });
      await this.logAudit('Support Agent Updated', 'SupportAgent', id, `Updated support agent "${dto.name ?? id}"`);
      return { success: true, data: agent };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A support agent with this email already exists');
      }
      throw error;
    }
  }

  async deleteAgent(id: string) {
    const agent = await this.ensureAgent(id);
    await this.prisma.supportAgent.delete({ where: { id } });
    await this.logAudit('Support Agent Deleted', 'SupportAgent', agent.name, `Deleted support agent "${agent.name}"`);
    return { success: true };
  }

  // ─── Business Programmes ──────────────────────────────
  async getBusinesses() {
    const businesses = await this.prisma.businessProgramme.findMany({
      include: { phase: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: businesses };
  }

  async createBusiness(dto: CreateBusinessProgrammeDto) {
    const data: Prisma.BusinessProgrammeCreateInput = {
      businessId: dto.businessId ?? null,
      businessName: dto.businessName,
      sector: dto.sector ?? '',
      currentDay: dto.currentDay ?? 1,
      status: dto.status ?? 'active',
      agentId: dto.agentId ?? null,
      agentName: dto.agentName ?? '',
      accountManagerId: dto.accountManagerId ?? null,
      accountManagerName: dto.accountManagerName ?? '',
      consultantId: dto.consultantId ?? null,
      consultantName: dto.consultantName ?? '',
      completedMissions: dto.completedMissions ?? [],
      extendedBy: dto.extendedBy ?? 0,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
    };
    if (dto.phaseId) {
      data.phase = { connect: { id: dto.phaseId } };
    }
    const business = await this.prisma.businessProgramme.create({ data });
    await this.logAudit('Business Programme Created', 'BusinessProgramme', dto.businessName, `Created business programme for "${dto.businessName}"`);
    return { success: true, data: business };
  }

  async updateBusiness(id: string, dto: UpdateBusinessProgrammeDto) {
    await this.ensureBusiness(id);
    const data: Prisma.BusinessProgrammeUpdateInput = {};
    if (dto.businessId !== undefined) data.businessId = dto.businessId;
    if (dto.businessName !== undefined) data.businessName = dto.businessName;
    if (dto.sector !== undefined) data.sector = dto.sector;
    if (dto.currentDay !== undefined) data.currentDay = dto.currentDay;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.agentId !== undefined) data.agentId = dto.agentId;
    if (dto.agentName !== undefined) data.agentName = dto.agentName;
    if (dto.accountManagerId !== undefined) data.accountManagerId = dto.accountManagerId;
    if (dto.accountManagerName !== undefined) data.accountManagerName = dto.accountManagerName;
    if (dto.consultantId !== undefined) data.consultantId = dto.consultantId;
    if (dto.consultantName !== undefined) data.consultantName = dto.consultantName;
    if (dto.completedMissions !== undefined) data.completedMissions = dto.completedMissions;
    if (dto.extendedBy !== undefined) data.extendedBy = dto.extendedBy;
    if (dto.startedAt !== undefined) data.startedAt = new Date(dto.startedAt);
    if (dto.phaseId !== undefined) {
      data.phase = dto.phaseId ? { connect: { id: dto.phaseId } } : { disconnect: true };
    }

    const business = await this.prisma.businessProgramme.update({ where: { id }, data });
    await this.logAudit('Business Programme Updated', 'BusinessProgramme', id, `Updated business programme "${dto.businessName ?? id}"`);
    return { success: true, data: business };
  }

  async deleteBusiness(id: string) {
    const business = await this.ensureBusiness(id);
    await this.prisma.businessProgramme.delete({ where: { id } });
    await this.logAudit('Business Programme Deleted', 'BusinessProgramme', business.businessName, `Deleted business programme "${business.businessName}"`);
    return { success: true };
  }

  // ─── Business Actions ─────────────────────────────────
  async performAction(id: string, action: string, days?: number) {
    const business = await this.ensureBusiness(id);

    let data: Prisma.BusinessProgrammeUpdateInput = {};

    switch (action) {
      case 'pause':
        if (business.status !== 'active') {
          throw new BadRequestException('Only active programmes can be paused');
        }
        data = { status: 'paused' };
        break;
      case 'resume':
        if (business.status !== 'paused') {
          throw new BadRequestException('Only paused programmes can be resumed');
        }
        data = { status: 'active' };
        break;
      case 'fastTrack':
        data = { currentDay: Math.min(90, business.currentDay + 7) };
        break;
      case 'extend':
        data = {
          extendedBy: (business.extendedBy ?? 0) + (days ?? 7),
          status: business.status === 'completed' ? 'active' : business.status,
        };
        break;
      case 'skipPhase':
        data = { currentDay: Math.min(90, business.currentDay + 14) };
        break;
      case 'reset':
        data = {
          currentDay: 1,
          status: 'active',
          extendedBy: 0,
          completedMissions: [],
        };
        break;
      default:
        throw new BadRequestException(`Unsupported action: ${action}`);
    }

    const updated = await this.prisma.businessProgramme.update({ where: { id }, data });
    await this.logAudit('Business Programme Action', 'BusinessProgramme', id, `Applied "${action}" to business programme "${business.businessName}"`);
    return { success: true, data: updated };
  }

  // ─── Task Statuses ────────────────────────────────────
  async getTaskStatuses(id: string) {
    await this.ensureBusiness(id);
    const statuses = await this.prisma.programmeTaskStatus.findMany({
      where: { businessProgrammeId: id },
    });
    const map: Record<string, string> = {};
    for (const s of statuses) map[s.missionId] = s.status;
    return { success: true, data: map };
  }

  async setTaskStatus(id: string, dto: UpdateTaskStatusDto) {
    const business = await this.ensureBusiness(id);

    const existing = await this.prisma.programmeTaskStatus.findUnique({
      where: { businessProgrammeId_missionId: { businessProgrammeId: id, missionId: dto.missionId } },
    });

    let status;
    if (existing) {
      status = await this.prisma.programmeTaskStatus.update({
        where: { id: existing.id },
        data: { status: dto.status },
      });
    } else {
      status = await this.prisma.programmeTaskStatus.create({
        data: { businessProgrammeId: id, missionId: dto.missionId, status: dto.status },
      });
    }

    if (dto.status === 'completed') {
      const missions = new Set(business.completedMissions);
      missions.add(dto.missionId);
      await this.prisma.businessProgramme.update({
        where: { id },
        data: { completedMissions: Array.from(missions) },
      });
    } else {
      await this.prisma.businessProgramme.update({
        where: { id },
        data: { completedMissions: business.completedMissions.filter((m) => m !== dto.missionId) },
      });
    }

    await this.logAudit('Business Programme Task Updated', 'BusinessProgramme', id, `Set task "${dto.missionId}" to "${dto.status}" for "${business.businessName}"`);
    return { success: true, data: status };
  }

  // ─── Helpers ──────────────────────────────────────────
  private async ensurePhase(id: string) {
    const phase = await this.prisma.programmePhase.findUnique({ where: { id } });
    if (!phase) throw new NotFoundException('Programme phase not found');
    return phase;
  }

  private async ensureGate(id: string) {
    const gate = await this.prisma.readinessGate.findUnique({ where: { id } });
    if (!gate) throw new NotFoundException('Readiness gate not found');
    return gate;
  }

  private async ensureAgent(id: string) {
    const agent = await this.prisma.supportAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException('Support agent not found');
    return agent;
  }

  private async ensureBusiness(id: string) {
    const business = await this.prisma.businessProgramme.findUnique({ where: { id } });
    if (!business) throw new NotFoundException('Business programme not found');
    return business;
  }
}
