import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PartnerAuditEntry {
  callerClientId: string;
  scope?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  issuanceId?: string | null;
  outcome: 'success' | 'error';
  statusCode?: number | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Durable audit trail for partner mutations. Best-effort: a failed audit write
 * is logged but never blocks or fails the request.
 */
@Injectable()
export class PartnerAuditService {
  private readonly logger = new Logger(PartnerAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: PartnerAuditEntry): Promise<void> {
    try {
      await this.prisma.partnerAuditLog.create({
        data: {
          callerClientId: entry.callerClientId,
          scope: entry.scope ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          issuanceId: entry.issuanceId ?? null,
          outcome: entry.outcome,
          statusCode: entry.statusCode ?? null,
          errorCode: entry.errorCode ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write partner audit (${entry.action}, ${entry.issuanceId ?? '-'}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async list(query: {
    issuanceId?: string;
    callerClientId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const where: Prisma.PartnerAuditLogWhereInput = {
      ...(query.issuanceId ? { issuanceId: query.issuanceId } : {}),
      ...(query.callerClientId ? { callerClientId: query.callerClientId } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.partnerAuditLog.count({ where }),
      this.prisma.partnerAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return {
      success: true,
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
