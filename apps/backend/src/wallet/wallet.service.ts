import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TransactionCategory, TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SsoService } from '../auth/sso.service';
import { WalletLockUtil } from './utils/wallet-lock.util';
import { isGte, safeAdd, safeSubtract, toDecimal } from './utils/decimal.util';
import { WalletEventsService } from './wallet-events.service';
import { DebitWalletDto } from './dto/debit-wallet.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { WalletBalanceDto, WalletDto, TransactionReceiptDto } from './dto/responses.dto';
import { ConfigService } from '@nestjs/config';

interface PartnerContext {
  clientId: string;
  name: string;
  platformSlug: string | null;
}

const IDEMPOTENCY_TTL_SECONDS = 86400; // 24h
const BALANCE_CACHE_TTL_SECONDS = 30;

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly lockUtil: WalletLockUtil,
    private readonly ssoService: SsoService,
    private readonly config: ConfigService,
    private readonly walletEvents: WalletEventsService,
  ) {}

  // ─── WALLET ACCESS ─────────────────────────────────────────────────────────

  /**
   * Lazy get-or-create. Guarantees every user has a wallet regardless of how
   * their user row was created (registration, Google callback, admin import).
   */
  async ensureWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;
    try {
      return await this.prisma.wallet.create({
        data: { userId, balance: 0, currency: 'MCOM', status: 'ACTIVE' },
      });
    } catch (err) {
      // Race: two requests created it simultaneously → return the winner
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.wallet.findUniqueOrThrow({ where: { userId } });
      }
      throw err;
    }
  }

  async getWalletForUser(userId: string): Promise<WalletDto> {
    const wallet = await this.ensureWallet(userId);
    const holds = await this.getTotalActiveHolds(wallet.id);
    const available = safeSubtract(wallet.balance, holds);
    return { ...this.toWalletDto(wallet), availableBalance: available.toNumber() };
  }

  async getBalanceForPartner(partner: PartnerContext, userId: string): Promise<WalletBalanceDto> {
    const wallet = await this.ensureWallet(userId);
    const cacheKey = `wallet:balance:${userId}`;
    const cached = await this.redis.get<WalletBalanceDto>(cacheKey);
    if (cached) return cached;

    const holds = await this.getTotalActiveHolds(wallet.id);
    const available = safeSubtract(wallet.balance, holds);
    const result: WalletBalanceDto = {
      success: true,
      balance: wallet.balance.toNumber(),
      availableBalance: available.toNumber(),
      status: wallet.status,
      currency: wallet.currency,
    };
    await this.redis.set(cacheKey, result, BALANCE_CACHE_TTL_SECONDS);
    return result;
  }

  // ─── DEBIT ─────────────────────────────────────────────────────────────────

  async debitWallet(
    partner: PartnerContext,
    dto: DebitWalletDto,
    idempotencyKey: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    const existing = await this.checkIdempotency(idempotencyKey, partner.clientId);
    if (existing) return existing;

    const amount = toDecimal(dto.amount);
    this.assertSingleTxnLimit(amount);

    const wallet = await this.ensureWallet(dto.userId);
    this.assertWalletActive(wallet.status);

    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      this.assertWalletActive(fresh.status);

      const holds = await this.getTotalActiveHolds(fresh.id);
      const available = safeSubtract(fresh.balance, holds);
      if (!isGte(available, amount)) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_BALANCE',
          availableBalance: available.toNumber(),
          message: `Wallet balance (${available.toNumber()} MCOM) is insufficient for debit of ${amount.toNumber()} MCOM`,
        });
      }

      await this.checkDebitLimits(fresh, amount);

      const balanceBefore = fresh.balance;
      const balanceAfter = safeSubtract(balanceBefore, amount);

      const txn = await this.createTransaction(fresh.id, {
        type: 'DEBIT',
        amount,
        balanceBefore,
        balanceAfter,
        category: dto.category,
        reference: dto.reference,
        description: dto.description,
        metadata: dto.metadata ?? {},
        idempotencyKey,
        partner,
        ipAddress,
      });

      await this.afterTransaction(dto.userId, balanceAfter, idempotencyKey, txn);
      return this.toReceipt(txn);
    });
  }

  // ─── CREDIT ────────────────────────────────────────────────────────────────

  async creditWallet(
    partner: PartnerContext,
    dto: CreditWalletDto,
    idempotencyKey: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    const existing = await this.checkIdempotency(idempotencyKey, partner.clientId);
    if (existing) return existing;

    const amount = toDecimal(dto.amount);
    this.assertSingleTxnLimit(amount);
    const wallet = await this.ensureWallet(dto.userId);
    this.assertWalletActive(wallet.status);

    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      this.assertWalletActive(fresh.status);

      if (fresh.maxBalance) {
        const projected = safeAdd(fresh.balance, amount);
        if (projected.greaterThan(fresh.maxBalance)) {
          throw new UnprocessableEntityException({
            error: 'MAX_BALANCE_EXCEEDED',
            message: `Credit of ${amount.toNumber()} MCOM would exceed the wallet maximum balance`,
          });
        }
      }

      const balanceBefore = fresh.balance;
      const balanceAfter = safeAdd(balanceBefore, amount);

      const txn = await this.createTransaction(fresh.id, {
        type: 'CREDIT',
        amount,
        balanceBefore,
        balanceAfter,
        category: dto.category,
        reference: dto.reference,
        description: dto.description,
        metadata: dto.metadata ?? {},
        idempotencyKey,
        partner,
        ipAddress,
      });

      await this.afterTransaction(dto.userId, balanceAfter, idempotencyKey, txn);
      return this.toReceipt(txn);
    });
  }

  // ─── HOLDS (pre-authorization) ─────────────────────────────────────────────

  async placeHold(
    partner: PartnerContext,
    dto: { userId: string; amount: number; reference: string; description?: string },
  ): Promise<{ holdId: string; reserved: number; expiresAt: string }> {
    const amount = toDecimal(dto.amount);
    this.assertSingleTxnLimit(amount);
    const wallet = await this.ensureWallet(dto.userId);
    this.assertWalletActive(wallet.status);

    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      this.assertWalletActive(fresh.status);

      const holds = await this.getTotalActiveHolds(fresh.id);
      const available = safeSubtract(fresh.balance, holds);
      if (!isGte(available, amount)) {
        throw new UnprocessableEntityException({
          error: 'INSUFFICIENT_BALANCE',
          availableBalance: available.toNumber(),
          message: `Wallet balance (${available.toNumber()} MCOM) is insufficient to reserve ${amount.toNumber()} MCOM`,
        });
      }

      const ttlHours = this.config.get<number>('WALLET_HOLD_DEFAULT_TTL_HOURS') ?? 24;
      const expiresAt = new Date(Date.now() + ttlHours * 3600_000);

      const hold = await this.prisma.walletHold.create({
        data: {
          walletId: fresh.id,
          amount,
          platformClientId: partner.clientId,
          platformName: partner.name,
          reference: dto.reference,
          description: dto.description,
          status: 'ACTIVE',
          expiresAt,
        },
      });

      return { holdId: hold.id, reserved: amount.toNumber(), expiresAt: expiresAt.toISOString() };
    });
  }

  async captureHold(
    partner: PartnerContext,
    holdId: string,
    category: TransactionCategory,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    const hold = await this.prisma.walletHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.platformClientId !== partner.clientId) {
      throw new ForbiddenException('Hold does not belong to this platform');
    }
    if (hold.status !== 'ACTIVE') {
      throw new ConflictException(`Hold is not active (status: ${hold.status})`);
    }

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
    this.assertWalletActive(wallet.status);

    return this.lockUtil.withLock(wallet.id, async () => {
      const fresh = await this.prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
      this.assertWalletActive(fresh.status);
      const freshHold = await this.prisma.walletHold.findUniqueOrThrow({ where: { id: holdId } });
      if (freshHold.status !== 'ACTIVE') {
        throw new ConflictException(`Hold is not active (status: ${freshHold.status})`);
      }

      const amount = freshHold.amount;
      const balanceBefore = fresh.balance;
      const balanceAfter = safeSubtract(balanceBefore, amount);

      const [txn] = await this.prisma.$transaction([
        this.prisma.walletHold.update({
          where: { id: holdId },
          data: { status: 'CAPTURED', capturedAt: new Date() },
        }),
        this.prisma.walletTransaction.create({
          data: {
            walletId: fresh.id,
            type: 'DEBIT',
            amount,
            balanceBefore,
            balanceAfter,
            currency: fresh.currency,
            platformClientId: partner.clientId,
            platformName: partner.name,
            platformSlug: partner.platformSlug,
            category: category || 'HOLD_CAPTURE',
            reference: freshHold.reference,
            description: freshHold.description ?? 'Hold captured',
            metadata: { holdId },
            idempotencyKey: idempotencyKey ?? null,
            status: 'COMPLETED',
            initiatedBy: `platform:${partner.clientId}`,
            ipAddress,
            holdId,
          },
        }),
        this.prisma.wallet.update({
          where: { id: fresh.id },
          data: { balance: balanceAfter, lastTransactionAt: new Date() },
        }),
      ]);

      await this.afterTransaction(wallet.userId, balanceAfter, idempotencyKey, txn);
      return this.toReceipt(txn);
    });
  }

  async releaseHold(
    partner: PartnerContext,
    holdId: string,
    status: 'RELEASED' | 'EXPIRED' = 'RELEASED',
  ): Promise<{ success: boolean; holdId: string; status: string }> {
    const hold = await this.prisma.walletHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (partner && hold.platformClientId !== partner.clientId) {
      throw new ForbiddenException('Hold does not belong to this platform');
    }
    return this.releaseHoldInternal(holdId, status);
  }

  /**
   * Internal release used by the hold-expiry cron — bypasses the partner
   * ownership check (the system owns expired holds). Never call this from a
   * partner-facing path.
   */
  async releaseHoldInternal(
    holdId: string,
    status: 'RELEASED' | 'EXPIRED' = 'EXPIRED',
  ): Promise<{ success: boolean; holdId: string; status: string }> {
    const hold = await this.prisma.walletHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.status !== 'ACTIVE') {
      return { success: true, holdId, status: hold.status };
    }

    await this.prisma.walletHold.update({
      where: { id: holdId },
      data: { status, releasedAt: new Date() },
    });
    const wallet = await this.prisma.wallet.findUnique({ where: { id: hold.walletId } });
    if (wallet) {
      await this.redis.del(`wallet:balance:${wallet.userId}`);
    }
    return { success: true, holdId, status };
  }

  // ─── INTERNAL HELPERS ──────────────────────────────────────────────────────

  private async createTransaction(
    walletId: string,
    data: {
      type: TransactionType;
      amount: Decimal;
      balanceBefore: Decimal;
      balanceAfter: Decimal;
      category: TransactionCategory;
      reference?: string;
      description: string;
      metadata: Record<string, any>;
      idempotencyKey?: string;
      partner: PartnerContext;
      ipAddress?: string;
    },
  ) {
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: walletId } });
    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({
        data: {
          walletId,
          type: data.type,
          amount: data.amount,
          balanceBefore: data.balanceBefore,
          balanceAfter: data.balanceAfter,
          currency: wallet.currency,
          platformClientId: data.partner.clientId,
          platformName: data.partner.name,
          platformSlug: data.partner.platformSlug,
          category: data.category,
          reference: data.reference,
          description: data.description,
          metadata: data.metadata as Prisma.InputJsonValue,
          idempotencyKey: data.idempotencyKey,
          status: 'COMPLETED',
          initiatedBy: `platform:${data.partner.clientId}`,
          ipAddress: data.ipAddress,
        },
      }),
      this.prisma.wallet.update({
        where: { id: walletId },
        data: { balance: data.balanceAfter, lastTransactionAt: new Date() },
      }),
    ]);
    return txn;
  }

  private async afterTransaction(
    userId: string,
    balanceAfter: Decimal,
    idempotencyKey: string,
    txn: any,
  ) {
    await this.redis.del(`wallet:balance:${userId}`);
    if (idempotencyKey) {
      // Cache the receipt alongside the originating platform so a key reused by
      // a different platform is detected as a collision, not served as a replay.
      await this.redis.set(
        `wallet:idempotency:${idempotencyKey}`,
        { receipt: this.toReceipt(txn), platformClientId: txn.platformClientId },
        IDEMPOTENCY_TTL_SECONDS,
      );
    }
    await this.walletEvents.onTransactionProcessed({
      userId,
      walletId: txn.walletId,
      transactionId: txn.id,
      type: txn.type,
      amount: txn.amount.toNumber(),
      category: txn.category,
      platformName: txn.platformName,
      balanceAfter: balanceAfter.toNumber(),
    });
  }

  async checkIdempotency(key: string, partnerClientId: string): Promise<TransactionReceiptDto | null> {
    if (!key) return null;

    // Fast path: Redis. Cached value carries the originating platform so a key
    // reused across platforms is detected (idempotency keys must be scoped).
    const cached = await this.redis.get<{
      receipt: TransactionReceiptDto;
      platformClientId?: string | null;
    }>(`wallet:idempotency:${key}`);
    if (cached) {
      this.assertIdempotencyOwner(cached.platformClientId, partnerClientId);
      return cached.receipt;
    }

    // Slow path: DB fallback (handles Redis restart between commit and cache).
    const existing = await this.prisma.walletTransaction.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      this.assertIdempotencyOwner(existing.platformClientId, partnerClientId);
      const receipt = this.toReceipt(existing);
      await this.redis.set(
        `wallet:idempotency:${key}`,
        { receipt, platformClientId: existing.platformClientId },
        IDEMPOTENCY_TTL_SECONDS,
      );
      return receipt;
    }
    return null;
  }

  private assertIdempotencyOwner(ownerClientId: string | null | undefined, partnerClientId: string): void {
    if (ownerClientId && ownerClientId !== partnerClientId) {
      throw new ConflictException(
        `Idempotency key collision: this key belongs to platform "${ownerClientId}"`,
      );
    }
  }

  private async getTotalActiveHolds(walletId: string): Promise<Decimal> {
    const agg = await this.prisma.walletHold.aggregate({
      where: { walletId, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Decimal(0);
  }

  private async checkDebitLimits(wallet: any, amount: Decimal): Promise<void> {
    if (!wallet.dailyDebitLimit && !wallet.monthlyDebitLimit) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, monthly] = await Promise.all([
      wallet.dailyDebitLimit
        ? this.prisma.walletTransaction.aggregate({
            where: {
              walletId: wallet.id,
              type: 'DEBIT',
              status: 'COMPLETED',
              createdAt: { gte: startOfDay },
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: null } },
      wallet.monthlyDebitLimit
        ? this.prisma.walletTransaction.aggregate({
            where: {
              walletId: wallet.id,
              type: 'DEBIT',
              status: 'COMPLETED',
              createdAt: { gte: startOfMonth },
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: null } },
    ]);

    if (wallet.dailyDebitLimit) {
      const used = (daily._sum.amount ?? new Decimal(0)).plus(amount);
      if (used.greaterThan(wallet.dailyDebitLimit)) {
        throw new UnprocessableEntityException({
          error: 'DAILY_LIMIT_EXCEEDED',
          message: `Daily debit limit (${wallet.dailyDebitLimit.toNumber()} MCOM) exceeded`,
        });
      }
    }
    if (wallet.monthlyDebitLimit) {
      const used = (monthly._sum.amount ?? new Decimal(0)).plus(amount);
      if (used.greaterThan(wallet.monthlyDebitLimit)) {
        throw new UnprocessableEntityException({
          error: 'MONTHLY_LIMIT_EXCEEDED',
          message: `Monthly debit limit (${wallet.monthlyDebitLimit.toNumber()} MCOM) exceeded`,
        });
      }
    }
  }

  private assertWalletActive(status: string): void {
    if (status !== 'ACTIVE') {
      const error =
        status === 'FROZEN'
          ? 'WALLET_FROZEN'
          : status === 'SUSPENDED'
            ? 'WALLET_SUSPENDED'
            : 'WALLET_CLOSED';
      throw new ForbiddenException({
        error,
        message: `Wallet is ${status}`,
      });
    }
  }

  /**
   * Single source of truth for per-transaction amount limits. Enforced on
   * debits, credits, and holds. Configured via WALLET_MAX_SINGLE_TXN.
   */
  private assertSingleTxnLimit(amount: Decimal): void {
    const maxSingle = this.config.get<number>('WALLET_MAX_SINGLE_TXN') ?? 10000;
    if (amount.greaterThan(maxSingle)) {
      throw new UnprocessableEntityException({
        error: 'AMOUNT_LIMIT_EXCEEDED',
        message: `Single transaction limit is ${maxSingle} MCOM`,
      });
    }
  }

  async resolvePartner(clientId: string): Promise<PartnerContext> {
    const client = await this.ssoService.getClientByClientId(clientId);
    return {
      clientId,
      name: client?.name ?? clientId,
      platformSlug: client?.platformSlug ?? clientId,
    };
  }

  private toWalletDto(wallet: any): WalletDto {
    return {
      id: wallet.id,
      userId: wallet.userId,
      balance: wallet.balance.toNumber(),
      availableBalance: 0, // computed lazily by caller where needed
      currency: wallet.currency,
      status: wallet.status,
      dailyDebitLimit: wallet.dailyDebitLimit ? wallet.dailyDebitLimit.toNumber() : null,
      monthlyDebitLimit: wallet.monthlyDebitLimit ? wallet.monthlyDebitLimit.toNumber() : null,
      createdAt: wallet.createdAt.toISOString(),
      lastTransactionAt: wallet.lastTransactionAt ? wallet.lastTransactionAt.toISOString() : null,
    };
  }

  toReceipt(txn: any): TransactionReceiptDto {
    return {
      success: true,
      transactionId: txn.id,
      type: txn.type,
      amount: txn.amount.toNumber(),
      balanceBefore: txn.balanceBefore.toNumber(),
      balanceAfter: txn.balanceAfter.toNumber(),
      currency: txn.currency,
      reference: txn.reference ?? null,
      idempotencyKey: txn.idempotencyKey ?? null,
      processedAt: txn.createdAt.toISOString(),
    };
  }
}