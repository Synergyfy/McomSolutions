import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';
import { AffiliateTask, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AffiliatePushResult {
  ok: boolean;
  affiliateTaskId?: string | null;
  error?: string;
}

export interface AffiliateDirectoryEntry {
  email: string;
  name: string;
  role: string;
  skills: string[];
  languages: string[];
}

const AFFILIATE_CLIENT_IDS = ['247gbs-affiliate', '247gbs'];
const AFFILIATE_PLATFORM_SLUGS = ['247gbs_affiliate'];

/**
 * Backend-to-backend client for the 247GBS Affiliates API.
 *
 * Central creates delegated tasks here (business → account manager / agent /
 * consultant) and pushes review outcomes. Credentials come from the console
 * app registry (`SsoClient`) with env fallbacks so the same keys can be rotated
 * in one place.
 */
@Injectable()
export class AffiliateClientService {
  private readonly logger = new Logger(AffiliateClientService.name);
  private directoryCache: { at: number; data: Map<string, AffiliateDirectoryEntry> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async resolveConnection(): Promise<{ baseUrl: string; apiKey: string } | null> {
    const client = await this.prisma.ssoClient.findFirst({
      where: {
        OR: [
          { clientId: { in: AFFILIATE_CLIENT_IDS } },
          { platformSlug: { in: AFFILIATE_PLATFORM_SLUGS } },
        ],
      },
      select: { serviceBaseUrl: true, appUrl: true, apiKey: true, metadata: true },
    });

    const metadata = (client?.metadata ?? {}) as Record<string, unknown>;
    const baseUrl =
      client?.serviceBaseUrl ||
      (typeof metadata.affiliateServiceBaseUrl === 'string'
        ? metadata.affiliateServiceBaseUrl
        : undefined) ||
      this.config.get<string>('AFFILIATE_SERVICE_BASE_URL') ||
      'http://localhost:7088/api/v1';

    // Central → affiliate uses the affiliate's INTERNAL_API_KEY (shared secret).
    // Stored in env (and optionally mirrored into the console metadata).
    const apiKey =
      this.config.get<string>('AFFILIATE_INTERNAL_API_KEY') ||
      (typeof metadata.internalApiKey === 'string' ? metadata.internalApiKey : undefined) ||
      client?.apiKey ||
      '';

    if (!apiKey) {
      this.logger.warn('No affiliate API key configured — task will not be mirrored to 247GBS.');
      return null;
    }

    return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
  }

  private async http(): Promise<{ client: AxiosInstance; baseUrl: string } | null> {
    const connection = await this.resolveConnection();
    if (!connection) return null;
    return {
      baseUrl: connection.baseUrl,
      client: axios.create({
        baseURL: connection.baseUrl,
        timeout: 10000,
        headers: { 'x-api-key': connection.apiKey, 'content-type': 'application/json' },
      }),
    };
  }

  /** Mirror a newly-assigned central task into the affiliate task board. */
  async createTask(
    task: AffiliateTask & {
      business?: { businessName: string; email: string } | null;
      assignee?: { email: string; firstName: string | null; lastName: string | null } | null;
    },
  ): Promise<AffiliatePushResult> {
    const http = await this.http();
    if (!http) return { ok: false, error: 'Affiliate integration not configured' };

    try {
      const response = await http.client.post('/tasks/incoming', {
        externalTaskId: task.id,
        originSystem: 'MCOM_CENTRAL',
        originRequesterId: task.businessId,
        taskType: 'CENTRAL_DELEGATION',
        title: task.title,
        description: task.description,
        businessName: task.business?.businessName ?? null,
        platforms: task.platforms,
        dueDate: task.dueAt ? task.dueAt.toISOString() : null,
        assignedAgentEmail: task.assignee?.email ?? null,
        assignedAgentName: task.assignee
          ? [task.assignee.firstName, task.assignee.lastName].filter(Boolean).join(' ') || task.assignee.email
          : null,
        projectId: task.projectId,
        projectName: (task as any).project?.title ?? null,
        category: String(task.category ?? 'EXTERNAL').toLowerCase(),
        requiredSkills: task.requiredSkills,
        deliverables: task.deliverables
          ? task.deliverables
              .split(/\r?\n|,/)
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        materials: task.materials,
        prerequisiteExternalTaskId: task.prerequisiteTaskId,
        compensationModel: task.compensationModel,
        compensationAmount: task.compensationAmount,
        compensationCurrency: task.compensationCurrency,
        billableToBusiness: task.billableToBusiness,
        businessChargeAmount: task.businessChargeAmount,
        businessChargeCurrency: task.businessChargeCurrency,
        chargeApprovalRequired:
          task.businessChargeStatus === 'PENDING_APPROVAL' ||
          (task.billableToBusiness && !task.businessChargeApprovedAt),
        metadata: {
          centralTaskId: task.id,
          centralBusinessId: task.businessId,
          centralAssigneeId: task.assigneeId,
          source: task.source,
          projectId: task.projectId,
          projectTitle: (task as any).project?.title ?? null,
          category: task.category,
          requiredSkills: task.requiredSkills,
          deliverables: task.deliverables,
          materials: task.materials,
          requiresBusinessApproval: task.requiresBusinessApproval,
          prerequisiteTaskId: task.prerequisiteTaskId,
          prerequisiteStatus: (task as any).prerequisiteTask?.status ?? null,
          compensationModel: task.compensationModel,
          compensationAmount: task.compensationAmount,
          compensationCurrency: task.compensationCurrency,
          billableToBusiness: task.billableToBusiness,
          businessChargeAmount: task.businessChargeAmount,
          businessChargeCurrency: task.businessChargeCurrency,
          businessChargeStatus: task.businessChargeStatus,
          chargeApprovalRequired:
            task.businessChargeStatus === 'PENDING_APPROVAL' ||
            (task.billableToBusiness && !task.businessChargeApprovedAt),
          paymentStatus: task.paymentStatus,
        },
      } as Record<string, unknown>);

      const affiliateTaskId =
        (response.data?.id as string | undefined) ??
        (response.data?.data?.id as string | undefined) ??
        null;

      return { ok: true, affiliateTaskId };
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Unknown affiliate sync error';
      this.logger.error(`Failed to push task ${task.id} to 247GBS: ${JSON.stringify(message)}`);
      return { ok: false, error: String(message) };
    }
  }

  /**
   * Push an admin review outcome to the affiliate board so the assignee sees the
   * notes and can resubmit (or sees the final approved state).
   */
  async pushReview(
    task: AffiliateTask,
    input: { decision: 'APPROVED' | 'CHANGES_REQUESTED'; notes?: string | null; round: number },
  ): Promise<AffiliatePushResult> {
    const http = await this.http();
    if (!http) return { ok: false, error: 'Affiliate integration not configured' };

    try {
      await http.client.post(`/tasks/external/${encodeURIComponent(task.id)}/review`, {
        decision: input.decision,
        notes: input.notes ?? null,
        round: input.round,
        status: input.decision === 'APPROVED' ? 'approved' : 'revision_requested',
        compensationAmount: task.compensationAmount,
        compensationPence: task.compensationPence,
      });
      return { ok: true, affiliateTaskId: task.affiliateTaskId };
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Unknown affiliate review sync error';
      this.logger.error(`Failed to push review for task ${task.id} to 247GBS: ${JSON.stringify(message)}`);
      return { ok: false, error: String(message) };
    }
  }

  async pushStatus(centralTaskId: string, status: string): Promise<AffiliatePushResult> {
    const http = await this.http();
    if (!http) return { ok: false, error: 'Affiliate integration not configured' };
    try {
      await http.client.post(`/tasks/external/${encodeURIComponent(centralTaskId)}/status`, {
        status,
      });
      return { ok: true };
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Unknown affiliate status sync error';
      this.logger.error(`Failed to push status ${status} for ${centralTaskId}: ${message}`);
      return { ok: false, error: String(message) };
    }
  }

  /**
   * Credit the affiliate's 247GBS wallet when a task is approved. The affiliate
   * backend resolves the local user by email (Central and Affiliates issue
   * different local ids) and uses the reference for idempotency.
   */
  async creditAffiliateWallet(input: {
    email: string;
    amount: number;
    currency: string;
    description: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }): Promise<AffiliatePushResult & { reference?: string }> {
    const http = await this.http();
    if (!http) return { ok: false, error: 'Affiliate integration not configured' };
    try {
      const response = await http.client.post('/internal/affiliates/wallet/credit', input);
      return {
        ok: true,
        reference: response.data?.data?.reference ?? input.reference,
      };
    } catch (error: any) {
      const message =
        error?.response?.data?.message || error?.message || 'Unknown affiliate wallet error';
      this.logger.error(`Failed to credit affiliate wallet for ${input.email}: ${message}`);
      return { ok: false, error: String(message) };
    }
  }

  async ping(): Promise<boolean> {
    const http = await this.http();
    if (!http) return false;
    try {
      await http.client.get('/health');
      return true;
    } catch {
      // Some deployments don't expose /health; treat any HTTP response as alive.
      try {
        await http.client.get('/tasks', { params: { limit: 1 } });
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Affiliate skills live in the 247GBS app (collected during onboarding), not
   * in Central. This fetches the shared directory and caches it briefly so the
   * /dashboard/tasks skill search stays fast. Failures degrade gracefully to an
   * empty map (search still works on specialisation/role).
   */
  async getAffiliateDirectory(): Promise<Map<string, AffiliateDirectoryEntry>> {
    const ttlMs = 5 * 60 * 1000;
    if (this.directoryCache && Date.now() - this.directoryCache.at < ttlMs) {
      return this.directoryCache.data;
    }

    const http = await this.http();
    if (!http) return new Map();

    try {
      const response = await http.client.get('/internal/affiliates');
      const rows: any[] =
        (Array.isArray(response.data?.data) && response.data.data) ||
        (Array.isArray(response.data) && response.data) ||
        [];

      const map = new Map<string, AffiliateDirectoryEntry>();
      for (const row of rows) {
        const email = String(row?.email || '').toLowerCase();
        if (!email) continue;
        map.set(email, {
          email,
          name: [row.firstName, row.lastName].filter(Boolean).join(' ') || email,
          role: String(row.role || '').toUpperCase(),
          skills: Array.isArray(row.skills) ? row.skills.map(String) : [],
          languages: Array.isArray(row.languages) ? row.languages.map(String) : [],
        });
      }
      this.directoryCache = { at: Date.now(), data: map };
      return map;
    } catch (error: any) {
      this.logger.warn(
        `Affiliate directory lookup failed: ${error?.response?.data?.message || error?.message}`,
      );
      return new Map();
    }
  }
}

// Keep Prisma import used for typing parity with generated client updates.
export type AffiliateTaskWithRelations = AffiliateTask & {
  business?: { businessName: string; email: string } | null;
};
export type _PrismaJson = Prisma.JsonValue;
