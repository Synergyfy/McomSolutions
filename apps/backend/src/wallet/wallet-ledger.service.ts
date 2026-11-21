import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { PaginatedWalletTransactionsDto, WalletTransactionDto } from './dto/responses.dto';

@Injectable()
export class WalletLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Transaction list with composable filters. Lists are NEVER cached — users
   * expect real-time financial accuracy.
   */
  async getTransactions(
    walletId: string,
    filters: FilterTransactionsDto,
    partnerClientId?: string,
  ): Promise<PaginatedWalletTransactionsDto> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where: Prisma.WalletTransactionWhereInput = {
      walletId,
      ...(partnerClientId && { platformClientId: partnerClientId }),
      ...(filters.platformSlug && { platformSlug: filters.platformSlug }),
      ...(filters.platformClientId && { platformClientId: filters.platformClientId }),
      ...(filters.type && { type: filters.type }),
      ...(filters.category && { category: filters.category }),
      ...(filters.status && { status: filters.status }),
      ...(filters.search && {
        OR: [
          { description: { contains: filters.search, mode: 'insensitive' } },
          { reference: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters.minAmount && { amount: { gte: new Decimal(filters.minAmount) } }),
      ...(filters.maxAmount && { amount: { lte: new Decimal(filters.maxAmount) } }),
      ...((filters.dateFrom || filters.dateTo) && {
        createdAt: {
          ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
          ...(filters.dateTo && { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) }),
        },
      }),
    };

    const [total, data] = await this.prisma.$transaction([
      this.prisma.walletTransaction.count({ where }),
      this.prisma.walletTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const counterparties = await this.loadCounterparties(
      data.map((row) => row.counterpartyWalletId).filter(Boolean) as string[],
    );

    return {
      success: true,
      data: data.map((row) =>
        this.toDto(row, row.counterpartyWalletId ? counterparties.get(row.counterpartyWalletId) ?? null : null),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getTransactionById(transactionId: string, walletId?: string): Promise<WalletTransactionDto> {
    const txn = await this.prisma.walletTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    // Caller-scoped reads (e.g. GET /wallet/transactions/:id) must never leak
    // another user's transaction. Partner lookups omit walletId and retain
    // their own platform-ownership check in WalletPartnerController.
    if (walletId && txn.walletId !== walletId) {
      throw new NotFoundException('Transaction not found');
    }

    const counterparty = txn.counterpartyWalletId
      ? (await this.loadCounterparties([txn.counterpartyWalletId])).get(txn.counterpartyWalletId) ?? null
      : null;
    return this.toDto(txn, counterparty);
  }

  /** Look up by idempotencyKey (partner reconciliation convenience). */
  async getTransactionByIdempotencyKey(key: string): Promise<WalletTransactionDto> {
    const txn = await this.prisma.walletTransaction.findUniqueOrThrow({
      where: { idempotencyKey: key },
    });
    return this.toDto(txn);
  }

  async getActiveHolds(walletId: string) {
    return this.prisma.walletHold.findMany({
      where: { walletId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getWalletSummary(userId: string, period: '30d' | '90d' | '1y' = '30d') {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const since = new Date(Date.now() - days * 86400000);
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      return { period, totalSpent: 0, totalCredited: 0, netFlow: 0, spentByPlatform: [], topCategories: [] };
    }
    const walletId = wallet.id;

    const [debits, credits, byPlatform, byCategory] = await Promise.all([
      this.prisma.walletTransaction.aggregate({
        where: { walletId, type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.aggregate({
        where: { walletId, type: 'CREDIT', status: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.groupBy({
        by: ['platformSlug', 'platformName'],
        where: { walletId, type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.walletTransaction.groupBy({
        by: ['category'],
        where: { walletId, status: 'COMPLETED', createdAt: { gte: since } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const sortedPlatforms = [...byPlatform]
      .sort((a, b) => (b._sum.amount ?? new Decimal(0)).minus(a._sum.amount ?? new Decimal(0)).toNumber())
      .slice(0, 10);
    const sortedCategories = [...byCategory]
      .sort((a, b) => (b._sum.amount ?? new Decimal(0)).minus(a._sum.amount ?? new Decimal(0)).toNumber())
      .slice(0, 5);

    const totalSpent = debits._sum.amount?.toNumber() ?? 0;
    const totalCredited = credits._sum.amount?.toNumber() ?? 0;

    return {
      period,
      totalSpent,
      totalCredited,
      netFlow: totalCredited - totalSpent,
      spentByPlatform: sortedPlatforms.map((p) => ({
        platformSlug: p.platformSlug,
        platformName: p.platformName,
        totalSpent: p._sum.amount?.toNumber() ?? 0,
        txnCount: p._count,
      })),
      topCategories: sortedCategories.map((c) => ({
        category: c.category,
        total: c._sum.amount?.toNumber() ?? 0,
        count: c._count,
      })),
    };
  }

  /**
   * Resolve the other party's display name for wallet-to-wallet movements.
   * Only the name and broad type are exposed — never their balance or history.
   */
  private async loadCounterparties(
    walletIds: string[],
  ): Promise<Map<string, { type: 'business' | 'user'; displayName: string }>> {
    const unique = [...new Set(walletIds)];
    if (unique.length === 0) return new Map();

    const wallets = await this.prisma.wallet.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            businessProfile: { select: { businessName: true } },
          },
        },
      },
    });

    const result = new Map<string, { type: 'business' | 'user'; displayName: string }>();
    for (const wallet of wallets) {
      const businessName = wallet.user?.businessProfile?.businessName;
      const personName = [wallet.user?.firstName, wallet.user?.lastName].filter(Boolean).join(' ');
      result.set(wallet.id, {
        type: businessName ? 'business' : 'user',
        displayName: businessName || personName || 'MCOM user',
      });
    }
    return result;
  }

  toDto(
    txn: any,
    counterparty?: { type: 'business' | 'user'; displayName: string } | null,
  ): WalletTransactionDto {
    return {
      id: txn.id,
      type: txn.type,
      amount: txn.amount.toNumber(),
      balanceBefore: txn.balanceBefore.toNumber(),
      balanceAfter: txn.balanceAfter.toNumber(),
      currency: txn.currency,
      platformClientId: txn.platformClientId ?? null,
      platformName: txn.platformName ?? null,
      platformSlug: txn.platformSlug ?? null,
      category: txn.category,
      reference: txn.reference ?? null,
      description: txn.description ?? null,
      status: txn.status,
      initiatedBy: txn.initiatedBy ?? null,
      createdAt: txn.createdAt.toISOString(),
      intent: txn.intent ?? null,
      counterparty: counterparty ?? null,
    };
  }
}