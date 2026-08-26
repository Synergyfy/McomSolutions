import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActivityQueryDto,
  CreateActivityFeedDto,
  CreateAssessmentQuestionDto,
  CreateBackgroundJobDto,
  CreateBoroughMetricDto,
  CreateErrorLogDto,
  CreateExternalPlanDto,
  CreateSystemApiKeyDto,
  CreateSystemIntegrationDto,
  ReorderAssessmentQuestionsDto,
  UpdateActivityFeedDto,
  UpdateAssessmentQuestionDto,
  UpdateBackgroundJobDto,
  UpdateBoroughMetricDto,
  UpdateExternalPlanDto,
  UpdateSystemApiKeyDto,
  UpdateSystemIntegrationDto,
} from './dto/admin-ops.dto';
import { PlatformInfo } from '../service-connectors/connectors/connector.interface';

@Injectable()
export class AdminOpsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Audit Logger ──────────────────────────────────────
  private async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'General',
  ) {
    await this.prisma.auditLog.create({
      data: { action, adminName, targetType, targetName, details, category },
    });
  }

  // ─── System API Keys ──────────────────────────────────
  async getApiKeys() {
    const keys = await this.prisma.systemApiKey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    // Return the stored suffix only — raw keys are never persisted.
    const masked = keys.map((k) => ({
      id: k.id,
      name: k.name,
      key: k.key ? `${k.key.slice(0, 8)}****${k.key.slice(-4)}` : '',
      permissions: k.permissions,
      status: k.status,
      lastUsed: k.lastUsed,
      createdAt: k.createdAt,
      updatedAt: k.updatedAt,
    }));
    return { success: true, data: masked };
  }

  async createApiKey(dto: CreateSystemApiKeyDto) {
    const rawKey = `sk_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const key = await this.prisma.systemApiKey.create({
      data: {
        name: dto.name,
        key: rawKey.slice(-4),
        keyHash,
        permissions: dto.permissions,
      },
    });
    // Return the full key once at creation time.
    await this.logAudit('API Key Created', 'SystemApiKey', dto.name, `Created API key "${dto.name}"`, 'Admin', 'Security');
    return { success: true, data: { ...key, key: rawKey }, message: 'Store this key securely — it will not be shown again' };
  }

  async updateApiKey(id: string, dto: UpdateSystemApiKeyDto) {
    await this.ensureApiKey(id);
    const data: Prisma.SystemApiKeyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.permissions !== undefined) data.permissions = dto.permissions;
    if (dto.status !== undefined) data.status = dto.status;

    const key = await this.prisma.systemApiKey.update({ where: { id }, data });
    await this.logAudit('API Key Updated', 'SystemApiKey', id, `Updated API key "${dto.name ?? id}"`, 'Admin', 'Security');
    return { success: true, data: { ...key, key: key.key ? `${key.key.slice(0, 8)}****${key.key.slice(-4)}` : '' } };
  }

  async deleteApiKey(id: string) {
    const key = await this.ensureApiKey(id);
    await this.prisma.systemApiKey.delete({ where: { id } });
    await this.logAudit('API Key Deleted', 'SystemApiKey', key.name, `Deleted API key "${key.name}"`, 'Admin', 'Security');
    return { success: true };
  }

  // ─── System Integrations ──────────────────────────────
  async getIntegrations() {
    const integrations = await this.prisma.systemIntegration.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: integrations };
  }

  async createIntegration(dto: CreateSystemIntegrationDto) {
    const integration = await this.prisma.systemIntegration.create({
      data: {
        name: dto.name,
        type: dto.type,
        status: dto.status ?? 'Disconnected',
        lastSync: dto.lastSync ? new Date(dto.lastSync) : null,
        connectedDate: dto.connectedDate ? new Date(dto.connectedDate) : null,
      },
    });
    await this.logAudit('Integration Created', 'SystemIntegration', dto.name, `Created integration "${dto.name}"`, 'Admin', 'Integration');
    return { success: true, data: integration };
  }

  async updateIntegration(id: string, dto: UpdateSystemIntegrationDto) {
    await this.ensureIntegration(id);
    const data: Prisma.SystemIntegrationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.lastSync !== undefined) data.lastSync = dto.lastSync ? new Date(dto.lastSync) : null;
    if (dto.connectedDate !== undefined) data.connectedDate = dto.connectedDate ? new Date(dto.connectedDate) : null;

    const integration = await this.prisma.systemIntegration.update({ where: { id }, data });
    await this.logAudit('Integration Updated', 'SystemIntegration', id, `Updated integration "${dto.name ?? id}"`, 'Admin', 'Integration');
    return { success: true, data: integration };
  }

  async deleteIntegration(id: string) {
    const integration = await this.ensureIntegration(id);
    await this.prisma.systemIntegration.delete({ where: { id } });
    await this.logAudit('Integration Deleted', 'SystemIntegration', integration.name, `Deleted integration "${integration.name}"`, 'Admin', 'Integration');
    return { success: true };
  }

  // ─── Assessment Questions ─────────────────────────────
  async getAssessmentQuestions() {
    const questions = await this.prisma.assessmentQuestion.findMany({
      orderBy: { order: 'asc' },
    });
    return { success: true, data: questions };
  }

  async createAssessmentQuestion(dto: CreateAssessmentQuestionDto) {
    const maxOrder = await this.prisma.assessmentQuestion.aggregate({ _max: { order: true } });
    const question = await this.prisma.assessmentQuestion.create({
      data: {
        question: dto.question,
        iconName: dto.iconName,
        fieldType: this.mapFieldType(dto.fieldType),
        options: dto.options ?? [],
        hint: dto.hint ?? '',
        enabled: dto.enabled ?? true,
        order: dto.order ?? (maxOrder._max.order ?? 0) + 1,
      },
    });
    await this.logAudit('Assessment Question Created', 'AssessmentQuestion', dto.question, `Added assessment question "${dto.question}"`, 'Admin', 'Assessment');
    return { success: true, data: question };
  }

  async updateAssessmentQuestion(id: string, dto: UpdateAssessmentQuestionDto) {
    await this.ensureAssessmentQuestion(id);
    const data: Prisma.AssessmentQuestionUpdateInput = {};
    if (dto.question !== undefined) data.question = dto.question;
    if (dto.iconName !== undefined) data.iconName = dto.iconName;
    if (dto.fieldType !== undefined) data.fieldType = this.mapFieldType(dto.fieldType);
    if (dto.options !== undefined) data.options = dto.options;
    if (dto.hint !== undefined) data.hint = dto.hint;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.order !== undefined) data.order = dto.order;

    const question = await this.prisma.assessmentQuestion.update({ where: { id }, data });
    await this.logAudit('Assessment Question Updated', 'AssessmentQuestion', id, `Updated assessment question "${dto.question ?? id}"`, 'Admin', 'Assessment');
    return { success: true, data: question };
  }

  async deleteAssessmentQuestion(id: string) {
    const question = await this.ensureAssessmentQuestion(id);
    await this.prisma.assessmentQuestion.delete({ where: { id } });
    await this.logAudit('Assessment Question Deleted', 'AssessmentQuestion', question.question, `Deleted assessment question "${question.question}"`, 'Admin', 'Assessment');
    return { success: true };
  }

  async reorderAssessmentQuestions(dto: ReorderAssessmentQuestionsDto) {
    await this.prisma.$transaction([
      ...dto.orderedIds.map((id, index) =>
        this.prisma.assessmentQuestion.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
      this.prisma.auditLog.create({
        data: {
          action: 'Assessment Questions Reordered',
          adminName: 'Admin',
          targetType: 'AssessmentQuestion',
          targetName: 'questions',
          details: `Reordered ${dto.orderedIds.length} assessment questions`,
          category: 'Assessment',
        },
      }),
    ]);
    return { success: true };
  }

  // ─── Activity Feed ────────────────────────────────────
  async getActivities(query: ActivityQueryDto) {
    const { highStreetId, page = 1, limit = 20 } = query;
    const where: Prisma.ActivityFeedWhereInput = highStreetId ? { highStreetId } : {};
    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      this.prisma.activityFeed.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.activityFeed.count({ where }),
    ]);

    return {
      success: true,
      data: activities,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createActivity(dto: CreateActivityFeedDto) {
    if (dto.highStreetId) {
      await this.ensureHighStreet(dto.highStreetId);
    }
    const activity = await this.prisma.activityFeed.create({
      data: {
        type: dto.type,
        title: dto.title,
        details: dto.details,
        location: dto.location,
        severity: dto.severity ?? 'info',
        source: dto.source,
        highStreetId: dto.highStreetId ?? null,
      },
    });
    await this.logAudit('Activity Created', 'ActivityFeed', dto.title, `Created activity "${dto.title}"`, 'Admin', 'Activity');
    return { success: true, data: activity };
  }

  async updateActivity(id: string, dto: UpdateActivityFeedDto) {
    await this.ensureActivity(id);
    const data: Prisma.ActivityFeedUpdateInput = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.details !== undefined) data.details = dto.details;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.highStreetId !== undefined) {
      if (dto.highStreetId) {
        await this.ensureHighStreet(dto.highStreetId);
        data.highStreet = { connect: { id: dto.highStreetId } };
      } else {
        data.highStreet = { disconnect: true };
      }
    }

    const activity = await this.prisma.activityFeed.update({ where: { id }, data });
    await this.logAudit('Activity Updated', 'ActivityFeed', id, `Updated activity "${dto.title ?? id}"`, 'Admin', 'Activity');
    return { success: true, data: activity };
  }

  async deleteActivity(id: string) {
    const activity = await this.ensureActivity(id);
    await this.prisma.activityFeed.delete({ where: { id } });
    await this.logAudit('Activity Deleted', 'ActivityFeed', activity.title, `Deleted activity "${activity.title}"`, 'Admin', 'Activity');
    return { success: true };
  }

  // ─── Borough Metrics ──────────────────────────────────
  async getBoroughMetrics(boroughId: string) {
    const metrics = await this.prisma.boroughMetric.findMany({
      where: { boroughId },
      orderBy: { month: 'asc' },
    });
    return { success: true, data: metrics };
  }

  async createBoroughMetric(boroughId: string, dto: CreateBoroughMetricDto) {
    await this.ensureBorough(boroughId);
    try {
      const metric = await this.prisma.boroughMetric.create({
        data: {
          boroughId,
          month: dto.month,
          footfall: dto.footfall ?? 0,
          revenue: dto.revenue ?? 0,
          activeCustomers: dto.activeCustomers ?? 0,
          businesses: dto.businesses ?? 0,
        },
      });
      await this.logAudit('Borough Metric Created', 'BoroughMetric', boroughId, `Added metric for borough ${boroughId} (${dto.month})`, 'Admin', 'Locality');
      return { success: true, data: metric };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A metric for this borough and month already exists');
      }
      throw error;
    }
  }

  async updateBoroughMetric(id: string, dto: UpdateBoroughMetricDto) {
    await this.ensureBoroughMetric(id);
    const data: Prisma.BoroughMetricUpdateInput = {};
    if (dto.month !== undefined) data.month = dto.month;
    if (dto.footfall !== undefined) data.footfall = dto.footfall;
    if (dto.revenue !== undefined) data.revenue = dto.revenue;
    if (dto.activeCustomers !== undefined) data.activeCustomers = dto.activeCustomers;
    if (dto.businesses !== undefined) data.businesses = dto.businesses;

    const metric = await this.prisma.boroughMetric.update({ where: { id }, data });
    await this.logAudit('Borough Metric Updated', 'BoroughMetric', id, `Updated borough metric ${id}`, 'Admin', 'Locality');
    return { success: true, data: metric };
  }

  async deleteBoroughMetric(id: string) {
    await this.ensureBoroughMetric(id);
    await this.prisma.boroughMetric.delete({ where: { id } });
    await this.logAudit('Borough Metric Deleted', 'BoroughMetric', id, `Deleted borough metric ${id}`, 'Admin', 'Locality');
    return { success: true };
  }

  async getBoroughStats(boroughId: string) {
    const borough = await this.ensureBorough(boroughId);

    const [metrics, businessCount, customerCount] = await Promise.all([
      this.prisma.boroughMetric.findMany({
        where: { boroughId },
        orderBy: { month: 'asc' },
      }),
      this.prisma.user.count({ where: { role: Role.BUSINESS } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
    ]);

    const monthlyFootfall = metrics.map((m) => m.footfall);
    const monthlyRevenue = metrics.map((m) => m.revenue);
    const totalFootfall = metrics.reduce((sum, m) => sum + m.footfall, 0);
    const totalRevenue = metrics.reduce((sum, m) => sum + m.revenue, 0);
    const latest = metrics[metrics.length - 1];

    // Trend deltas: compare latest two months if available.
    const trend = (values: number[]) => {
      if (values.length < 2) return 0;
      const prev = values[values.length - 2];
      const curr = values[values.length - 1];
      if (prev === 0) return curr === 0 ? 0 : 100;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      success: true,
      data: {
        borough: {
          id: borough.id,
          name: borough.name,
          area: borough.area,
          region: borough.region,
          activity: borough.activity,
          engagement: borough.engagement,
          health: borough.health,
        },
        stats: {
          totalBusinesses: businessCount,
          activeCustomers: latest?.activeCustomers ?? 0,
          footfallDensityPerDay: latest ? Math.round(totalFootfall / 30) : 0,
          mcomImpact: totalRevenue,
        },
        trends: {
          businessGrowth: latest ? trend(metrics.map((m) => m.businesses)) : 0,
          customerGrowth: latest ? trend(metrics.map((m) => m.activeCustomers)) : 0,
          footfallTrend: trend(monthlyFootfall),
          revenueTrend: trend(monthlyRevenue),
        },
        chart: {
          footfall: monthlyFootfall,
          revenue: monthlyRevenue,
          months: metrics.map((m) => m.month),
        },
      },
    };
  }

  // ─── External Platform Packages ─────────────────────────
  private static readonly NAMED_PLATFORMS: PlatformInfo[] = [
    { name: 'MCOM Mall', clientId: 'mcom-mall', platformSlug: 'mall', isNamed: true, hasBillingApi: true },
    { name: 'MCOM Rewards', clientId: 'mcom-loyalty', platformSlug: 'rewards', isNamed: true, hasBillingApi: true },
  ];

  async getSupportedPlatforms(): Promise<{ success: boolean; data: PlatformInfo[] }> {
    const namedNames = new Set(AdminOpsService.NAMED_PLATFORMS.map((p) => p.name.toLowerCase()));

    // Find active SSO clients with billingApiUrl configured in Console
    const dbClients = await this.prisma.ssoClient.findMany({
      where: {
        isActive: true,
        billingApiUrl: { not: null },
      },
      select: {
        name: true,
        clientId: true,
        platformSlug: true,
        billingApiUrl: true,
      },
      orderBy: { name: 'asc' },
    });

    const dynamicPlatforms: PlatformInfo[] = dbClients
      .filter((client) => !namedNames.has(client.name.toLowerCase()))
      .map((client) => ({
        name: client.name,
        clientId: client.clientId,
        platformSlug: client.platformSlug,
        isNamed: false,
        hasBillingApi: true,
        billingApiUrl: client.billingApiUrl,
      }));

    return {
      success: true,
      data: [...AdminOpsService.NAMED_PLATFORMS, ...dynamicPlatforms],
    };
  }

  async getExternalPlans(platform?: string) {
    const where: Prisma.ExternalPlanWhereInput = platform ? { platform } : {};
    const plans = await this.prisma.externalPlan.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return { success: true, data: plans.map((p) => this.serializeExternalPlan(p)) };
  }

  async createExternalPlan(dto: CreateExternalPlanDto) {
    const plan = await this.prisma.externalPlan.create({
      data: {
        name: dto.name,
        platform: dto.platform,
        description: dto.description,
        monthlyPrice: dto.monthlyPrice ?? null,
        quarterlyPrice: dto.quarterlyPrice ?? null,
        annualPrice: dto.annualPrice ?? null,
        features: dto.features ?? [],
        configuration: (dto.configuration as Prisma.InputJsonValue) ?? undefined,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        type: dto.type,
        trialDuration: dto.trialDuration,
        seasonId: dto.seasonId,
        stripeMonthlyPriceId: dto.stripeMonthlyPriceId,
        stripeQuarterlyPriceId: dto.stripeQuarterlyPriceId,
        stripeAnnualPriceId: dto.stripeAnnualPriceId,
        paypalMonthlyPlanId: dto.paypalMonthlyPlanId,
        paypalQuarterlyPlanId: dto.paypalQuarterlyPlanId,
        paypalAnnualPlanId: dto.paypalAnnualPlanId,
      },
    });
    await this.logAudit('External Plan Created', 'ExternalPlan', dto.name, `Created external plan "${dto.name}" (${dto.platform})`, 'Admin', 'Plans');
    return { success: true, data: this.serializeExternalPlan(plan) };
  }

  async getExternalPlan(id: string) {
    const plan = await this.ensureExternalPlan(id);
    return { success: true, data: this.serializeExternalPlan(plan) };
  }

  async updateExternalPlan(id: string, dto: UpdateExternalPlanDto) {
    await this.ensureExternalPlan(id);
    const data: Prisma.ExternalPlanUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.monthlyPrice !== undefined) data.monthlyPrice = dto.monthlyPrice;
    if (dto.quarterlyPrice !== undefined) data.quarterlyPrice = dto.quarterlyPrice;
    if (dto.annualPrice !== undefined) data.annualPrice = dto.annualPrice;
    if (dto.features !== undefined) data.features = dto.features;
    if (dto.configuration !== undefined) data.configuration = dto.configuration as Prisma.InputJsonValue;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.trialDuration !== undefined) data.trialDuration = dto.trialDuration;
    if (dto.seasonId !== undefined) data.seasonId = dto.seasonId;
    if (dto.stripeMonthlyPriceId !== undefined) data.stripeMonthlyPriceId = dto.stripeMonthlyPriceId;
    if (dto.stripeQuarterlyPriceId !== undefined) data.stripeQuarterlyPriceId = dto.stripeQuarterlyPriceId;
    if (dto.stripeAnnualPriceId !== undefined) data.stripeAnnualPriceId = dto.stripeAnnualPriceId;
    if (dto.paypalMonthlyPlanId !== undefined) data.paypalMonthlyPlanId = dto.paypalMonthlyPlanId;
    if (dto.paypalQuarterlyPlanId !== undefined) data.paypalQuarterlyPlanId = dto.paypalQuarterlyPlanId;
    if (dto.paypalAnnualPlanId !== undefined) data.paypalAnnualPlanId = dto.paypalAnnualPlanId;

    const plan = await this.prisma.externalPlan.update({ where: { id }, data });
    await this.logAudit('External Plan Updated', 'ExternalPlan', id, `Updated external plan "${dto.name ?? id}"`, 'Admin', 'Plans');
    return { success: true, data: this.serializeExternalPlan(plan) };
  }

  async deleteExternalPlan(id: string) {
    const plan = await this.ensureExternalPlan(id);
    await this.prisma.externalPlan.delete({ where: { id } });
    await this.logAudit('External Plan Deleted', 'ExternalPlan', plan.name, `Deleted external plan "${plan.name}"`, 'Admin', 'Plans');
    return { success: true };
  }

  private serializeExternalPlan(plan: any) {
    return {
      ...plan,
      monthlyPrice: plan.monthlyPrice !== null ? Number(plan.monthlyPrice) : undefined,
      quarterlyPrice: plan.quarterlyPrice !== null ? Number(plan.quarterlyPrice) : undefined,
      annualPrice: plan.annualPrice !== null ? Number(plan.annualPrice) : undefined,
    };
  }

  private async ensureExternalPlan(id: string) {
    const p = await this.prisma.externalPlan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('External plan not found');
    return p;
  }

  // ─── Background Jobs ──────────────────────────────────
  async getBackgroundJobs() {
    const jobs = await this.prisma.backgroundJob.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: jobs };
  }

  async createBackgroundJob(dto: CreateBackgroundJobDto) {
    const job = await this.prisma.backgroundJob.create({
      data: {
        name: dto.name,
        status: dto.status ?? 'pending',
        progress: dto.progress ?? 0,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : null,
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        error: dto.error,
      },
    });
    await this.logAudit('Background Job Created', 'BackgroundJob', dto.name, `Created background job "${dto.name}"`, 'Admin', 'System');
    return { success: true, data: job };
  }

  async updateBackgroundJob(id: string, dto: UpdateBackgroundJobDto) {
    await this.ensureBackgroundJob(id);
    const data: Prisma.BackgroundJobUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.progress !== undefined) data.progress = dto.progress;
    if (dto.startedAt !== undefined) data.startedAt = dto.startedAt ? new Date(dto.startedAt) : null;
    if (dto.completedAt !== undefined) data.completedAt = dto.completedAt ? new Date(dto.completedAt) : null;
    if (dto.error !== undefined) data.error = dto.error;

    const job = await this.prisma.backgroundJob.update({ where: { id }, data });
    await this.logAudit('Background Job Updated', 'BackgroundJob', id, `Updated background job "${dto.name ?? id}"`, 'Admin', 'System');
    return { success: true, data: job };
  }

  async deleteBackgroundJob(id: string) {
    const job = await this.ensureBackgroundJob(id);
    await this.prisma.backgroundJob.delete({ where: { id } });
    await this.logAudit('Background Job Deleted', 'BackgroundJob', job.name, `Deleted background job "${job.name}"`, 'Admin', 'System');
    return { success: true };
  }

  // ─── Error Logs ───────────────────────────────────────
  async getErrorLogs() {
    const logs = await this.prisma.errorLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return { success: true, data: logs };
  }

  async createErrorLog(dto: CreateErrorLogDto) {
    const log = await this.prisma.errorLog.create({
      data: {
        level: dto.level ?? 'error',
        message: dto.message,
        stack: dto.stack,
        source: dto.source,
        path: dto.path,
      },
    });
    await this.logAudit('Error Log Created', 'ErrorLog', dto.message, `Logged error "${dto.message}"`, 'System', 'System');
    return { success: true, data: log };
  }

  // ─── System Health ────────────────────────────────────
  async getSystemHealth() {
    const started = Date.now();
    let database = 'ok';
    let error: string | undefined;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      database = 'error';
      error = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = Date.now() - started;
    return {
      success: true,
      data: {
        status: database === 'ok' ? 'healthy' : 'unhealthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
          database,
          databaseLatencyMs: latencyMs,
        },
        error,
      },
    };
  }

  // ─── Helpers ──────────────────────────────────────────
  private mapFieldType(
    t:
      | 'single-choice'
      | 'multi-choice'
      | 'text'
      | 'textarea'
      | 'number'
      | 'date'
      | 'rating'
      | 'yes-no',
  ) {
    return t.replace(/-/g, '_') as
      | 'single_choice'
      | 'multi_choice'
      | 'text'
      | 'textarea'
      | 'number'
      | 'date'
      | 'rating'
      | 'yes_no';
  }

  private async ensureApiKey(id: string) {
    const k = await this.prisma.systemApiKey.findUnique({ where: { id } });
    if (!k) throw new NotFoundException('API key not found');
    return k;
  }

  private async ensureIntegration(id: string) {
    const i = await this.prisma.systemIntegration.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Integration not found');
    return i;
  }

  private async ensureAssessmentQuestion(id: string) {
    const q = await this.prisma.assessmentQuestion.findUnique({ where: { id } });
    if (!q) throw new NotFoundException('Assessment question not found');
    return q;
  }

  private async ensureActivity(id: string) {
    const a = await this.prisma.activityFeed.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Activity not found');
    return a;
  }

  private async ensureBorough(id: string) {
    const b = await this.prisma.borough.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Borough not found');
    return b;
  }

  private async ensureBoroughMetric(id: string) {
    const m = await this.prisma.boroughMetric.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Borough metric not found');
    return m;
  }

  private async ensureHighStreet(id: string) {
    const h = await this.prisma.highStreet.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('High street not found');
    return h;
  }

  private async ensureBackgroundJob(id: string) {
    const j = await this.prisma.backgroundJob.findUnique({ where: { id } });
    if (!j) throw new NotFoundException('Background job not found');
    return j;
  }
}
