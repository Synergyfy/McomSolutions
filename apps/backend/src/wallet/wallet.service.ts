import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, TransactionCategory, TransactionStatus, TransactionType, Wallet, WalletTransaction } from '@prisma/client';
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

  // ─── FX ────────────────────────────────────────────────────────────────────

  /** GBP → MCOM wallet credits. Mirrors wallet top-up FX lookup/fallback. */
  async getGbpToMcomRate(): Promise<number> {
    try {
      const fx = await this.prisma.fxRate.findUnique({
        where: { base_quote: { base: 'GBP', quote: 'MCOM' } },
      });
      if (fx) return new Decimal(fx.rate.toString()).toNumber();
    } catch {
      // Table may be unavailable in a fresh environment — fall through to env.
    }
    const parsed = parseFloat(this.config.get<string>('MCOM_GBP_RATE') ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  /** Convert a GBP amount into the MCOM credits a wallet debit would charge. */
  async convertGbpToCredits(amountGbp: number): Promise<number> {
    const rate = await this.getGbpToMcomRate();
    return new Decimal(amountGbp).times(rate).toDecimalPlaces(4).toNumber();
  }

  // ─── DEBIT ─────────────────────────────────────────────────────────────────

  async debitWallet(
    partner: PartnerContext,
    dto: DebitWalletDto,
    idempotencyKey: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    const amount = toDecimal(dto.amount);
    this.assertSingleTxnLimit(amount);

    const existing = await this.checkIdempotency(idempotencyKey, partner.clientId);
    if (existing) return existing;

    const wallet = await this.ensureWallet(dto.userId);
    this.assertWalletActive(wallet.status);

    try {
      const txn = await this.lockUtil.withLock(wallet.id, () =>
        this.withWalletRowLock(wallet.id, async (tx, fresh) => {
          this.assertWalletActive(fresh.status);

          // Re-check under the lock: a concurrent request may have committed this
          // same idempotency key between the fast-path miss and now.
          const duplicate = await this.findIdempotentTransaction(tx, idempotencyKey, partner.clientId);
          if (duplicate) return duplicate;

          const holds = await this.getTotalActiveHolds(fresh.id, tx);
          const available = safeSubtract(fresh.balance, holds);
          if (!isGte(available, amount)) {
            throw new UnprocessableEntityException({
              error: 'INSUFFICIENT_BALANCE',
              availableBalance: available.toNumber(),
              message: `Wallet balance (${available.toNumber()} MCOM) is insufficient for debit of ${amount.toNumber()} MCOM`,
            });
          }

          await this.checkDebitLimits(fresh, amount, tx);

          const balanceBefore = fresh.balance;
          const balanceAfter = safeSubtract(balanceBefore, amount);

          // Relative update — never write a snapshot back. Even if a writer slipped
          // past the Redis lock, the decrement applies to the current row value.
          const updated = await tx.wallet.update({
            where: { id: fresh.id },
            data: { balance: { decrement: amount }, lastTransactionAt: new Date() },
          });
          if (updated.balance.isNegative()) {
            throw new UnprocessableEntityException({
              error: 'INSUFFICIENT_BALANCE',
              message: 'Wallet balance would go negative — debit rejected',
            });
          }

          return this.insertTransaction(tx, fresh, {
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
        }),
      );

      await this.afterTransaction(dto.userId, txn.balanceAfter, idempotencyKey, txn);
      return this.toReceipt(txn);
    } catch (err) {
      // Two concurrent requests with the same key: the loser hit the unique index.
      // Return the winner's receipt instead of a 500 — the money moved exactly once.
      const winner = await this.recoverIdempotentCollision(err, idempotencyKey, partner.clientId);
      if (winner) return winner;
      throw err;
    }
  }

  // ─── CREDIT ────────────────────────────────────────────────────────────────

  async creditWallet(
    partner: PartnerContext,
    dto: CreditWalletDto,
    idempotencyKey: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    const amount = toDecimal(dto.amount);
    this.assertSingleTxnLimit(amount);

    const existing = await this.checkIdempotency(idempotencyKey, partner.clientId);
    if (existing) return existing;

    const wallet = await this.ensureWallet(dto.userId);
    this.assertWalletActive(wallet.status);

    try {
      const txn = await this.lockUtil.withLock(wallet.id, () =>
        this.withWalletRowLock(wallet.id, async (tx, fresh) => {
          this.assertWalletActive(fresh.status);

          const duplicate = await this.findIdempotentTransaction(tx, idempotencyKey, partner.clientId);
          if (duplicate) return duplicate;

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

          await tx.wallet.update({
            where: { id: fresh.id },
            data: { balance: { increment: amount }, lastTransactionAt: new Date() },
          });

          return this.insertTransaction(tx, fresh, {
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
        }),
      );

      await this.afterTransaction(dto.userId, txn.balanceAfter, idempotencyKey, txn);
      return this.toReceipt(txn);
    } catch (err) {
      const winner = await this.recoverIdempotentCollision(err, idempotencyKey, partner.clientId);
      if (winner) return winner;
      throw err;
    }
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

    return this.lockUtil.withLock(wallet.id, () =>
      this.withWalletRowLock(wallet.id, async (tx, fresh) => {
        this.assertWalletActive(fresh.status);

        const holds = await this.getTotalActiveHolds(fresh.id, tx);
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

        const hold = await tx.walletHold.create({
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
      }),
    );
  }

  async captureHold(
    partner: PartnerContext,
    holdId: string,
    category: TransactionCategory,
    idempotencyKey?: string,
    ipAddress?: string,
  ): Promise<TransactionReceiptDto> {
    if (idempotencyKey) {
      const existing = await this.checkIdempotency(idempotencyKey, partner.clientId);
      if (existing) return existing;
    }

    const hold = await this.prisma.walletHold.findUnique({ where: { id: holdId } });
    if (!hold) throw new NotFoundException('Hold not found');
    if (hold.platformClientId !== partner.clientId) {
      throw new ForbiddenException('Hold does not belong to this platform');
    }
    if (hold.status !== 'ACTIVE') {
      if (hold.status === 'CAPTURED') {
        const existingTxn = await this.prisma.walletTransaction.findFirst({
          where: { holdId },
        });
        if (existingTxn) {
          return this.toReceipt(existingTxn);
        }
      }
      throw new ConflictException(`Hold is not active (status: ${hold.status})`);
    }

    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
    this.assertWalletActive(wallet.status);

    return this.lockUtil.withLock(wallet.id, async () => {
      const txn = await this.withWalletRowLock(wallet.id, async (tx, fresh) => {
        this.assertWalletActive(fresh.status);

        // Claim the hold with a compare-and-set: two concurrent captures of the
        // same hold must debit the wallet once.
        const claimed = await tx.walletHold.updateMany({
          where: { id: holdId, status: 'ACTIVE' },
          data: { status: 'CAPTURED', capturedAt: new Date() },
        });
        if (claimed.count !== 1) {
          const existingTxn = await tx.walletTransaction.findFirst({ where: { holdId } });
          if (existingTxn) return existingTxn;
          throw new ConflictException('Hold is not active (already captured or released)');
        }

        const freshHold = await tx.walletHold.findUniqueOrThrow({ where: { id: holdId } });
        const amount = freshHold.amount;
        const balanceBefore = fresh.balance;
        const balanceAfter = safeSubtract(balanceBefore, amount);

        await tx.wallet.update({
          where: { id: fresh.id },
          data: { balance: { decrement: amount }, lastTransactionAt: new Date() },
        });

        return this.insertTransaction(tx, fresh, {
          type: 'DEBIT',
          amount,
          balanceBefore,
          balanceAfter,
          category: category || 'HOLD_CAPTURE',
          reference: freshHold.reference ?? undefined,
          description: freshHold.description ?? 'Hold captured',
          metadata: { holdId },
          idempotencyKey: idempotencyKey ?? null,
          partner,
          ipAddress,
          holdId,
        });
      });

      await this.afterTransaction(wallet.userId, txn.balanceAfter, idempotencyKey, txn);
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

    // Compare-and-set: the expiry cron and an explicit release can race, and only
    // one of them may write the terminal status.
    const released = await this.prisma.walletHold.updateMany({
      where: { id: holdId, status: 'ACTIVE' },
      data: { status, releasedAt: new Date() },
    });
    if (released.count === 0) {
      const current = await this.prisma.walletHold.findUnique({ where: { id: holdId } });
      return { success: true, holdId, status: current?.status ?? status };
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { id: hold.walletId } });
    if (wallet) {
      await this.redis.del(`wallet:balance:${wallet.userId}`);
    }
    return { success: true, holdId, status };
  }

  // ─── INTERNAL HELPERS ──────────────────────────────────────────────────────

  /**
   * Run a balance mutation under a real database row lock.
   *
   * The Redis lock is only contention control — its lease can lapse. The
   * `FOR UPDATE` here is what serialises concurrent writers, so a stale
   * `balance` can never be validated and written back: the second writer blocks
   * until the first commits and then reads the committed value.
   */
  private async withWalletRowLock<T>(
    walletId: string,
    fn: (tx: Prisma.TransactionClient, wallet: Wallet) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      // Prisma's typed API has no FOR UPDATE; one raw statement takes the lock
      // and holds it for the rest of this transaction.
      await tx.$queryRaw`SELECT "id" FROM "wallets" WHERE "id" = ${walletId} FOR UPDATE`;
      const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: walletId } });
      return fn(tx, wallet);
    });
  }

  /** Insert the ledger row for a balance mutation that already happened in `tx`. */
  private async insertTransaction(
    tx: Prisma.TransactionClient,
    wallet: Wallet,
    data: {
      type: TransactionType;
      amount: Decimal;
      balanceBefore: Decimal;
      balanceAfter: Decimal;
      category: TransactionCategory;
      reference?: string | null;
      description?: string | null;
      metadata: Record<string, any>;
      idempotencyKey?: string | null;
      partner: PartnerContext;
      ipAddress?: string;
      holdId?: string;
    },
  ) {
    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: data.type,
        amount: data.amount,
        balanceBefore: data.balanceBefore,
        balanceAfter: data.balanceAfter,
        currency: wallet.currency,
        platformClientId: data.partner.clientId,
        platformName: data.partner.name,
        platformSlug: data.partner.platformSlug,
        category: data.category,
        reference: data.reference ?? undefined,
        description: data.description ?? undefined,
        metadata: data.metadata as Prisma.InputJsonValue,
        idempotencyKey: data.idempotencyKey ?? undefined,
        status: 'COMPLETED',
        initiatedBy: `platform:${data.partner.clientId}`,
        ipAddress: data.ipAddress,
        holdId: data.holdId,
      },
    });
  }

  /**
   * Look for a transaction already committed under this key, inside the row
   * lock. This is the definitive duplicate check — the fast-path cache is only
   * an optimisation.
   */
  private async findIdempotentTransaction(
    tx: Prisma.TransactionClient,
    key: string,
    partnerClientId: string,
  ): Promise<WalletTransaction | null> {
    const existing = await tx.walletTransaction.findUnique({ where: { idempotencyKey: key } });
    if (!existing) return null;
    this.assertIdempotencyOwner(existing.platformClientId, partnerClientId);
    await this.cacheReceipt(existing);
    return existing;
  }

  /**
   * Translate a unique-index collision on `walletTransaction.idempotencyKey`
   * into the winner's receipt. The loser's transaction rolled back in full, so
   * the money moved exactly once.
   */
  private async recoverIdempotentCollision(
    err: unknown,
    idempotencyKey: string,
    partnerClientId: string,
  ): Promise<TransactionReceiptDto | null> {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
      return null;
    }
    const winner = await this.checkIdempotency(idempotencyKey, partnerClientId);
    if (winner) return winner;
    return null;
  }

  private async afterTransaction(
    userId: string,
    balanceAfter: Decimal,
    idempotencyKey: string,
    txn: any,
  ) {
    await this.redis.del(`wallet:balance:${userId}`);
    if (idempotencyKey) {
      await this.cacheReceipt(txn);
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

  /**
   * Cache the receipt alongside the originating platform so a key reused by a
   * different platform is detected as a collision, not served as a replay.
   */
  private async cacheReceipt(txn: any): Promise<void> {
    if (!txn?.idempotencyKey) return;
    await this.redis.set(
      `wallet:idempotency:${txn.idempotencyKey}`,
      { receipt: this.toReceipt(txn), platformClientId: txn.platformClientId },
      IDEMPOTENCY_TTL_SECONDS,
    );
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

  private async getTotalActiveHolds(
    walletId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Decimal> {
    const agg = await client.walletHold.aggregate({
      where: { walletId, status: 'ACTIVE' },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Decimal(0);
  }

  private async checkDebitLimits(
    wallet: Wallet,
    amount: Decimal,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    if (!wallet.dailyDebitLimit && !wallet.monthlyDebitLimit) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [daily, monthly] = await Promise.all([
      wallet.dailyDebitLimit
        ? client.walletTransaction.aggregate({
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
        ? client.walletTransaction.aggregate({
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

  private toWalletDto(wallet: Wallet): WalletDto {
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
    const toNum = (val: any) =>
      val == null ? 0 : typeof val?.toNumber === 'function' ? val.toNumber() : Number(val);

    return {
      success: true,
      transactionId: txn.id,
      type: txn.type,
      amount: toNum(txn.amount),
      balanceBefore: toNum(txn.balanceBefore),
      balanceAfter: toNum(txn.balanceAfter),
      currency: txn.currency,
      reference: txn.reference ?? null,
      idempotencyKey: txn.idempotencyKey ?? null,
      processedAt: txn.createdAt instanceof Date ? txn.createdAt.toISOString() : (txn.createdAt ?? new Date().toISOString()),
    };
  }
}