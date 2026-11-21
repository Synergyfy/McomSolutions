import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GlIntent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlPostingService } from '../ledger/gl-posting.service';
import { appPayableAccountCode, BANK_CODE, PLATFORM_WALLET_CODE } from '../ledger/account-code';

export interface RequestPayoutInput {
  appClientId: string;
  amountMinor: bigint;
  requestedBy?: string | null;
  idempotencyKey: string;
  provider?: string | null;
  providerRef?: string | null;
}

/**
 * App payouts: moving a partner's payable balance to the bank.
 *
 * Two-step on purpose — a payout cannot leave without an admin approving it,
 * and the ledger post is idempotent so a retry never pays twice. The payable
 * account is forced non-negative: we never pay out money we do not hold.
 */
@Injectable()
export class AppPayoutsService {
  private readonly logger = new Logger(AppPayoutsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posting: GlPostingService,
  ) {}

  async request(input: RequestPayoutInput) {
    if (input.amountMinor <= 0n) {
      throw new BadRequestException('Payout amount must be greater than zero.');
    }
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('A payout requires an idempotency key.');
    }

    const existing = await this.prisma.appPayout.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;

    try {
      return await this.prisma.appPayout.create({
        data: {
          appClientId: input.appClientId,
          amountMinor: input.amountMinor,
          status: 'pending',
          requestedBy: input.requestedBy ?? null,
          provider: input.provider ?? null,
          providerRef: input.providerRef ?? null,
          idempotencyKey: input.idempotencyKey,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await this.prisma.appPayout.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (winner) return winner;
      }
      throw err;
    }
  }

  /**
   * Approve and pay. The claim (pending → approved) makes two concurrent
   * approvals impossible; the posting then debits the payable and credits the
   * bank under the account lock, so the funds check cannot race.
   */
  async approve(payoutId: string, approvedBy: string, providerRef?: string | null) {
    const payout = await this.prisma.appPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.status === 'paid') return payout;
    if (payout.status !== 'pending') {
      throw new ConflictException(`Payout is ${payout.status} and cannot be approved.`);
    }

    const payable = appPayableAccountCode(payout.appClientId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.appPayout.updateMany({
          where: { id: payoutId, status: 'pending' },
          data: { status: 'approved', approvedBy },
        });
        if (claimed.count !== 1) {
          throw new ConflictException('Payout was already claimed by another approval.');
        }

        const transfer = await this.posting.post(tx, {
          intent: GlIntent.PAYOUT,
          platformId: payout.appClientId,
          reference: payout.id,
          description: `Payout to ${payout.appClientId}`,
          initiatorType: 'admin',
          initiatorId: approvedBy,
          idempotencyKey: `payout:${payout.id}`,
          transactions: [
            {
              legs: [
                { account: payable, direction: 'debit', amountMinor: payout.amountMinor },
                { account: BANK_CODE, direction: 'credit', amountMinor: payout.amountMinor },
              ],
            },
          ],
          metadata: { payoutId: payout.id, appClientId: payout.appClientId },
          nonNegative: [payable],
        });

        return tx.appPayout.update({
          where: { id: payout.id },
          data: {
            status: 'paid',
            transferId: transfer.transferId,
            providerRef: providerRef ?? payout.providerRef,
          },
        });
      });

      return result;
    } catch (err: any) {
      if (err instanceof UnprocessableEntityException) {
        // Insufficient payable: leave the request pending so it can be retried
        // once more sales land.
        await this.prisma.appPayout.updateMany({
          where: { id: payoutId, status: 'approved' },
          data: { status: 'pending', failureReason: 'INSUFFICIENT_PAYABLE' },
        });
        throw err;
      }
      throw err;
    }
  }

  async reject(payoutId: string, approvedBy: string, reason?: string) {
    const payout = await this.prisma.appPayout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found.');
    if (payout.status !== 'pending') {
      throw new ConflictException(`Payout is ${payout.status} and cannot be rejected.`);
    }

    return this.prisma.appPayout.update({
      where: { id: payoutId },
      data: { status: 'rejected', approvedBy, failureReason: reason ?? 'Rejected by admin' },
    });
  }

  async list(filters: { appClientId?: string; status?: string; page?: number; limit?: number }) {
    const page = Math.max(1, Number(filters.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(filters.limit ?? 20)));

    const where: Prisma.AppPayoutWhereInput = {
      ...(filters.appClientId ? { appClientId: filters.appClientId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.appPayout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.appPayout.count({ where }),
    ]);

    return {
      success: true as const,
      data: rows.map((row) => this.toDto(row)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Payable balances per app, with any pending payout reserved against them. */
  async listPayables() {
    const [accounts, pending] = await Promise.all([
      this.prisma.glAccount.findMany({
        where: { type: 'LIABILITY_APP_PAYABLE' },
        orderBy: { code: 'asc' },
      }),
      this.prisma.appPayout.groupBy({
        by: ['appClientId'],
        where: { status: 'pending' },
        _sum: { amountMinor: true },
      }),
    ]);

    const pendingByApp = new Map(pending.map((row) => [row.appClientId, row._sum.amountMinor ?? 0n]));

    return {
      success: true as const,
      data: accounts.map((account) => ({
        appClientId: account.ownerRef ?? account.code,
        payableMinor: account.balanceMinor.toString(),
        pendingPayoutMinor: (pendingByApp.get(account.ownerRef ?? '') ?? 0n).toString(),
        availableMinor: (account.balanceMinor - (pendingByApp.get(account.ownerRef ?? '') ?? 0n)).toString(),
        currency: account.currency,
      })),
    };
  }

  /** Balance for the calling app (partner endpoint). */
  async balanceFor(appClientId: string) {
    const [account, pending, paid] = await Promise.all([
      this.prisma.glAccount.findUnique({ where: { code: appPayableAccountCode(appClientId) } }),
      this.prisma.appPayout.aggregate({
        where: { appClientId, status: 'pending' },
        _sum: { amountMinor: true },
      }),
      this.prisma.appPayout.aggregate({
        where: { appClientId, status: 'paid' },
        _sum: { amountMinor: true },
      }),
    ]);

    const payableMinor = account?.balanceMinor ?? 0n;
    const pendingMinor = pending._sum.amountMinor ?? 0n;

    return {
      success: true as const,
      data: {
        currency: account?.currency ?? 'GBP',
        payableMinor: payableMinor.toString(),
        pendingPayoutMinor: pendingMinor.toString(),
        availableMinor: (payableMinor - pendingMinor).toString(),
        paidOutMinor: (paid._sum.amountMinor ?? 0n).toString(),
      },
    };
  }

  private toDto(row: any) {
    return {
      id: row.id,
      appClientId: row.appClientId,
      amountMinor: row.amountMinor.toString(),
      currency: row.currency,
      status: row.status,
      transferId: row.transferId,
      provider: row.provider,
      providerRef: row.providerRef,
      requestedBy: row.requestedBy,
      approvedBy: row.approvedBy,
      failureReason: row.failureReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
