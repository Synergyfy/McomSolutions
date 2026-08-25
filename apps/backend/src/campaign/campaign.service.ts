import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CampaignActionDto,
  CampaignQueryDto,
  CreateCampaignDto,
  UpdateCampaignDto,
} from './dto/campaign.dto';

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Audit Logger ──────────────────────────────────────
  private async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'Campaign',
  ) {
    await this.prisma.auditLog.create({
      data: { action, adminName, targetType, targetName, details, category },
    });
  }

  // ─── CRUD ─────────────────────────────────────────────
  async getCampaigns(query: CampaignQueryDto) {
    const { locationType, locationId, page = 1, limit = 20 } = query;
    const where: Prisma.CampaignWhereInput = {};
    if (locationType) where.locationType = locationType;
    if (locationId) where.locationId = locationId;

    const skip = (page - 1) * limit;
    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return {
      success: true,
      data: campaigns,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getCampaign(id: string) {
    const campaign = await this.ensureCampaign(id);
    return { success: true, data: campaign };
  }

  async createCampaign(dto: CreateCampaignDto) {
    if (dto.locationId) {
      await this.ensureLocation(dto.locationType, dto.locationId);
    }
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        description: dto.description,
        locationType: dto.locationType,
        locationId: dto.locationId ?? null,
        locationName: dto.locationName ?? null,
        status: dto.status ?? 'draft',
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
    await this.logAudit('Campaign Created', 'Campaign', dto.name, `Created campaign "${dto.name}" (${dto.locationType})`);
    return { success: true, data: campaign };
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    await this.ensureCampaign(id);
    if (dto.locationType && dto.locationId) {
      await this.ensureLocation(dto.locationType, dto.locationId);
    }
    const data: Prisma.CampaignUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.locationType !== undefined) data.locationType = dto.locationType;
    if (dto.locationId !== undefined) data.locationId = dto.locationId;
    if (dto.locationName !== undefined) data.locationName = dto.locationName;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;

    const campaign = await this.prisma.campaign.update({ where: { id }, data });
    await this.logAudit('Campaign Updated', 'Campaign', id, `Updated campaign "${dto.name ?? id}"`);
    return { success: true, data: campaign };
  }

  async deleteCampaign(id: string) {
    const campaign = await this.ensureCampaign(id);
    await this.prisma.campaign.delete({ where: { id } });
    await this.logAudit('Campaign Deleted', 'Campaign', campaign.name, `Deleted campaign "${campaign.name}"`);
    return { success: true };
  }

  // ─── Actions ──────────────────────────────────────────
  async performAction(id: string, dto: CampaignActionDto) {
    const campaign = await this.ensureCampaign(id);

    let status: 'active' | 'paused' | 'completed';
    switch (dto.action) {
      case 'pause':
        if (campaign.status !== 'active') {
          throw new BadRequestException('Only active campaigns can be paused');
        }
        status = 'paused';
        break;
      case 'resume':
        if (campaign.status !== 'paused') {
          throw new BadRequestException('Only paused campaigns can be resumed');
        }
        status = 'active';
        break;
      case 'complete':
        status = 'completed';
        break;
      default:
        throw new BadRequestException(`Unsupported action: ${dto.action}`);
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status },
    });
    await this.logAudit('Campaign Action', 'Campaign', id, `Applied "${dto.action}" to campaign "${campaign.name}"`);
    return { success: true, data: updated };
  }

  // ─── Helpers ──────────────────────────────────────────
  private async ensureCampaign(id: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  private async ensureLocation(locationType: string, locationId: string) {
    let exists: boolean;
    switch (locationType) {
      case 'high_street':
        exists = Boolean(
          await this.prisma.highStreet.findUnique({ where: { id: locationId }, select: { id: true } }),
        );
        break;
      case 'borough':
        exists = Boolean(
          await this.prisma.borough.findUnique({ where: { id: locationId }, select: { id: true } }),
        );
        break;
      case 'local_mall':
        exists = Boolean(
          await this.prisma.localMall.findUnique({ where: { id: locationId }, select: { id: true } }),
        );
        break;
      default:
        throw new BadRequestException(`Unsupported location type: ${locationType}`);
    }
    if (!exists) {
      throw new NotFoundException(`${locationType} location not found`);
    }
  }
}