import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { WalletService } from './wallet.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { FilterTransactionsDto, AdminWalletQueryDto } from './dto/filter-transactions.dto';
import {
  AdminAdjustWalletDto,
  AdminWalletActionDto,
  AdminWalletLimitsDto,
  ReverseTransactionDto,
} from './dto/admin-wallet.dto';
import { WalletLedgerService } from './wallet-ledger.service';

const ADMIN_PARTNER = { clientId: 'mcom-admin', name: 'MCOM Admin', platformSlug: 'system' };

@Injectable()
export class WalletAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly walletService: WalletService,
    private readonly ledgerService: WalletLedgerService,
    private readonly lockUtil: WalletLockUtil,
    private readonly config: ConfigService,
  ) {}

  // ─── LIST & DETAIL ─────────────────────────────────────────────────────────

  async listWallets(query: AdminWalletQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.WalletWhereInput = {
      ...(query.status && { status: query.status as any }),
      ...(query.search && {
        OR: [
          { user: { email: { contains: query.search, mode: 'insensitive' } } },
          { userId: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.wallet.findMany({
        where,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.wallet.count({ where }),
    ]);

    return {
      success: true,
      data: await Promise.all(
        data.map(async (w) => {
          const holds = await this.prisma.walletHold.aggregate({
            where: { walletId: w.id, status: 'ACTIVE' },
            _sum: { amount: true },
          });
          return {
            id: w.id,
            userId: w.userId,
            email: w.user.email,
            balance: w.balance.toNumber(),
            availableBalance: w.balance.minus(holds._sum.amount ?? new Decimal(0)).toNumber(),
            currency: w.currency,
            status: w.status,
            createdAt: w.createdAt.toISOString(),
          };
        }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getWalletDetail(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const [holds, activeHoldsSum] = await Promise.all([
      this.prisma.walletHold.findMany({ where: { walletId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }),
      this.prisma.walletHold.aggregate({ where: { walletId, status: 'ACTIVE' }, _sum: { amount: true } }),
    ]);

    return {
      ...this.toWalletView(wallet),
      availableBalance: wallet.balance.minus(activeHoldsSum._sum.amount ?? new Decimal(0)).toNumber(),
      activeHolds: holds.map((h) => ({
        id: h.id,
        amount: h.amount.toNumber(),
        platformClientId: h.platformClientId,
        platformName: h.platformName,
        reference: h.reference,
        status: h.status,
        expiresAt: h.expiresAt.toISOString(),
      })),
    };
  }

  async getWalletByUser(userId: string) {
    const wallet = await this.walletService.ensureWallet(userId);
    return this.getWalletDetail(wallet.id);
  }

  // ─── STATUS TRANSITIONS ────────────────────────────────────────────────────

  async setWalletStatus(
    walletId: string,
    action: 'freeze' | 'unfreeze' | 'close',
    adminId: string,
    dto: AdminWalletActionDto,
    req?: any,
  ) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    let nextStatus: string;
    if (action === 'freeze') {
      if (wallet.status !== 'ACTIVE') throw new ConflictException(`Wallet is ${wallet.status}`);
      nextStatus = 'FROZEN';
    } else if (action === 'unfreeze') {
      if (wallet.status !== 'FROZEN') throw new ConflictException(`Only FROZEN wallets can be unfrozen (status: ${wallet.status})`);
      nextStatus = 'ACTIVE';
    } else {
      if (wallet.status === 'CLOSED') throw new ConflictException('Wallet is already closed');
      nextStatus = 'CLOSED';
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { status: nextStatus as any },
    });

    await this.audit(walletId, adminId, action, dto.reason, { before: wallet.status, after: nextStatus }, req);
    await this.redis.del(`wallet:balance:${wallet.userId}`);

    return { success: true, status: nextStatus };
  }

  // ─── MANUAL ADJUSTMENTS ────────────────────────────────────────────────────

  async manualCredit(
    walletId: string,
    adminId: string,
    dto: AdminAdjustWalletDto,
    req?: any,
  ) {
    const wallet = await this.requireWallet(walletId);
    const receipt = await this.walletService.creditWallet(
      ADMIN_PARTNER,
      {
        userId: wallet.userId,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        reference: dto.reference,
        metadata: dto.metadata,
      },
      `admin:${walletId}:credit:${crypto.randomUUID()}`,
      req?.ip,
    );
    await this.audit(walletId, adminId, 'manual_credit', dto.reason, dto, req);
    return receipt;
  }

  async manualDebit(
    walletId: string,
    adminId: string,
    dto: AdminAdjustWalletDto,
    req?: any,
  ) {
    const wallet = await this.requireWallet(walletId);
    const receipt = await this.walletService.debitWallet(
      ADMIN_PARTNER,
      {
        userId: wallet.userId,
        amount: dto.amount,
        category: dto.category,
        description: dto.description,
        reference: dto.reference,
        metadata: dto.metadata,
      },
      `admin:${walletId}:debit:${crypto.randomUUID()}`,
      req?.ip,
    );
    await this.audit(walletId, adminId, 'manual_debit', dto.reason, dto, req);
    return receipt;
  }

  async setLimits(
    walletId: string,
    adminId: string,
    dto: AdminWalletLimitsDto,
    req?: any,
  ) {
    const wallet = await this.requireWallet(walletId);
    const data: Prisma.WalletUpdateInput = {
      ...(dto.dailyDebitLimit !== undefined && { dailyDebitLimit: new Decimal(dto.dailyDebitLimit) }),
      ...(dto.monthlyDebitLimit !== undefined && { monthlyDebitLimit: new Decimal(dto.monthlyDebitLimit) }),
      ...(dto.maxBalance !== undefined && { maxBalance: new Decimal(dto.maxBalance) }),
    };
    const updated = await this.prisma.wallet.update({ where: { id: walletId }, data });
    await this.audit(walletId, adminId, 'adjust_limit', 'Limits updated', dto, req);
    return this.toWalletView(updated);
  }

  // ─── REVERSAL (compensating entry — never edit the original) ──────────────

  async reverseTransaction(
    transactionId: string,
    adminId: string,
    dto: ReverseTransactionDto,
    req?: any,
  ) {
    const txn = await this.prisma.walletTransaction.findUnique({ where: { id: transactionId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    if (txn.status === 'REVERSED') throw new ConflictException('Transaction already reversed');

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: txn.walletId } });
    const reverseType = txn.type === 'DEBIT' ? 'CREDIT' : 'DEBIT';
    const reverseCategory = txn.type === 'DEBIT' ? 'REFUND' : 'ADMIN_DEBIT';
    const amount = new Decimal(txn.amount);

    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      const balanceBefore = fresh.balance;
      const balanceAfter =
        reverseType === 'CREDIT' ? balanceBefore.plus(amount) : balanceBefore.minus(amount);

      if (reverseType === 'DEBIT' && balanceAfter.isNegative()) {
        throw new BadRequestException('Cannot reverse — wallet balance would go negative');
      }

      const [reverseTxn] = await this.prisma.$transaction([
        this.prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: reverseType,
            amount,
            balanceBefore,
            balanceAfter,
            currency: wallet.currency,
            platformClientId: txn.platformClientId,
            platformName: txn.platformName,
            platformSlug: txn.platformSlug,
            category: reverseCategory,
            reference: txn.reference,
            description: `Reversal of ${txn.description ?? txn.id}`,
            metadata: { reversedTransactionId: txn.id } as Prisma.InputJsonValue,
            idempotencyKey: `reverse:${txn.id}`,
            status: 'COMPLETED',
            initiatedBy: `admin:${adminId}`,
            ipAddress: req?.ip,
          },
        }),
        this.prisma.walletTransaction.update({
          where: { id: txn.id },
          data: { status: 'REVERSED' },
        }),
        this.prisma.wallet.update({
          where: { id: wallet.id },
          data: { balance: balanceAfter, lastTransactionAt: new Date() },
        }),
      ]);

      await this.audit(wallet.id, adminId, 'reverse_transaction', dto.reason, { transactionId }, req);
      await this.redis.del(`wallet:balance:${wallet.userId}`);
      return this.walletService.toReceipt(reverseTxn);
    });
  }

  // ─── REPORTS ───────────────────────────────────────────────────────────────

  async getPlatformSummary(dateFrom?: string, dateTo?: string) {
    const where: Prisma.WalletTransactionWhereInput = {
      status: 'COMPLETED',
      ...(dateFrom && { createdAt: { gte: new Date(dateFrom) } }),
      ...(dateTo && { createdAt: { lte: new Date(`${dateTo}T23:59:59.999Z`) } }),
    };
    const rows = await this.prisma.walletTransaction.groupBy({
      by: ['platformClientId', 'platformName'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    return {
      success: true,
      data: rows.map((r) => ({
        platform: r.platformName || r.platformClientId,
        platformClientId: r.platformClientId,
        total: r._sum.amount?.toNumber() ?? 0,
        txnCount: r._count,
      })),
    };
  }

  async getDailyVolume(dateFrom?: string, dateTo?: string) {
    const since = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 86400000);
    const until = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : new Date();

    const [credits, debits] = await Promise.all([
      this.prisma.walletTransaction.groupBy({
        by: ['createdAt'],
        where: { type: 'CREDIT', status: 'COMPLETED', createdAt: { gte: since, lte: until } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.groupBy({
        by: ['createdAt'],
        where: { type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: since, lte: until } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const byDay = new Map<string, { date: string; credits: number; debits: number; creditCount: number; debitCount: number }>();
    for (const row of credits) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const entry = byDay.get(day) || { date: day, credits: 0, debits: 0, creditCount: 0, debitCount: 0 };
      entry.credits += row._sum.amount?.toNumber() ?? 0;
      entry.creditCount += row._count;
      byDay.set(day, entry);
    }
    for (const row of debits) {
      const day = row.createdAt.toISOString().slice(0, 10);
      const entry = byDay.get(day) || { date: day, credits: 0, debits: 0, creditCount: 0, debitCount: 0 };
      entry.debits += row._sum.amount?.toNumber() ?? 0;
      entry.debitCount += row._count;
      byDay.set(day, entry);
    }

    return {
      success: true,
      data: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async getReconciliationReport() {
    const [credits, debits, holds, wallets] = await Promise.all([
      this.prisma.walletTransaction.groupBy({
        by: ['walletId'],
        where: { type: 'CREDIT', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.walletTransaction.groupBy({
        by: ['walletId'],
        where: { type: 'DEBIT', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.walletHold.groupBy({
        by: ['walletId'],
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      this.prisma.wallet.findMany({ select: { id: true, userId: true, balance: true } }),
    ]);

    const sum = (rows: Array<{ walletId: string; _sum: { amount: Decimal | null } }>, id: string) =>
      rows.find((r) => r.walletId === id)?._sum.amount ?? new Decimal(0);

    const discrepancies: Array<{ walletId: string; userId: string; expected: number; actual: number }> = [];
    for (const wallet of wallets) {
      const expected = sum(credits, wallet.id).minus(sum(debits, wallet.id)).minus(sum(holds, wallet.id));
      if (!expected.equals(wallet.balance)) {
        discrepancies.push({
          walletId: wallet.id,
          userId: wallet.userId,
          expected: expected.toNumber(),
          actual: wallet.balance.toNumber(),
        });
      }
    }

    return {
      success: true,
      data: {
        walletsChecked: wallets.length,
        discrepancies,
        hasDiscrepancy: discrepancies.length > 0,
      },
    };
  }

  async listAuditLogs(walletId?: string, page = 1, limit = 20) {
    const where: Prisma.WalletAuditLogWhereInput = walletId ? { walletId } : {};
    const [data, total] = await Promise.all([
      this.prisma.walletAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.walletAuditLog.count({ where }),
    ]);
    return { success: true, data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async listAdminTransactions(walletId: string, filters: FilterTransactionsDto) {
    return this.ledgerService.getTransactions(walletId, filters);
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  private async requireWallet(walletId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  private async audit(
    walletId: string,
    adminId: string,
    action: string,
    reason: string,
    changes: Record<string, any>,
    req?: any,
  ) {
    await this.prisma.walletAuditLog.create({
      data: {
        walletId,
        adminId,
        action,
        reason,
        changes: changes as Prisma.InputJsonValue,
        ip: req?.ip ?? null,
        userAgent: req?.headers?.['user-agent'] ?? null,
      },
    });
  }

  private toWalletView(wallet: any) {
    return {
      id: wallet.id,
      userId: wallet.userId,
      email: wallet.user?.email,
      balance: wallet.balance.toNumber(),
      currency: wallet.currency,
      status: wallet.status,
      dailyDebitLimit: wallet.dailyDebitLimit ? wallet.dailyDebitLimit.toNumber() : null,
      monthlyDebitLimit: wallet.monthlyDebitLimit ? wallet.monthlyDebitLimit.toNumber() : null,
      maxBalance: wallet.maxBalance ? wallet.maxBalance.toNumber() : null,
      createdAt: wallet.createdAt.toISOString(),
      lastTransactionAt: wallet.lastTransactionAt ? wallet.lastTransactionAt.toISOString() : null,
    };
  }
}