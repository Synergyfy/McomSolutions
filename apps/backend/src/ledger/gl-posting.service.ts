import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GlAccount, GlIntent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseAccountCode } from './account-code';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { balanceDelta, GlDirection, planPosting, type GlStepInput } from './gl-posting.plan';

export interface GlProvenance {
  walletTransactionId?: string | null;
  appChargeId?: string | null;
  appRefundId?: string | null;
  settlementId?: string | null;
  referralCommissionId?: string | null;
}

export interface GlPostInput {
  intent: GlIntent;
  /** SsoClient.clientId that caused the movement; null for platform-internal. */
  platformId?: string | null;
  reference?: string | null;
  description?: string;
  initiatorType: 'user' | 'app' | 'admin' | 'system';
  initiatorId?: string | null;
  /** Idempotency of the whole event. Replays return the original transfer. */
  idempotencyKey: string;
  /** One or more balanced steps (gateway → platform → seller). */
  transactions: GlStepInput[];
  metadata?: Prisma.InputJsonValue;
  provenance?: GlProvenance;
  /** Account codes allowed to go negative. Almost always empty. */
  allowNegative?: string[];
  /** Account codes that must stay >= 0 even though their class normally may not. */
  nonNegative?: string[];
  /** Set when this transfer reverses another (corrections are never edits). */
  reversalOfId?: string | null;
}

export interface GlPostResult {
  transferId: string;
  /** True when this call found an existing transfer for the idempotency key. */
  replayed: boolean;
}

/**
 * The only writer of money in the platform.
 *
 * Every call is atomic with the caller's transaction: if the calling flow rolls
 * back (a charge fails, a payout is rejected), no ledger rows survive.
 */
@Injectable()
export class GlPostingService {
  private readonly logger = new Logger(GlPostingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chart: ChartOfAccountsService,
  ) {}

  async post(
    tx: Prisma.TransactionClient,
    input: GlPostInput,
  ): Promise<GlPostResult> {
    const key = input.idempotencyKey?.trim();
    if (!key) {
      throw new BadRequestException('A ledger transfer requires an idempotency key.');
    }
    if (!input.initiatorType) {
      throw new BadRequestException('A ledger transfer requires an initiator type.');
    }

    // Validate the money shape before touching the database.
    const plan = planPosting(input.transactions);

    const existing = await tx.glTransfer.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { transferId: existing.id, replayed: true };

    const accountMap = await this.chart.ensureAccounts(tx, plan.accounts);
    await this.lockAccounts(tx, plan.accounts);

    // Re-read under the lock: another transaction may have moved balances
    // between ensure and lock.
    const locked = await tx.glAccount.findMany({
      where: { code: { in: plan.accounts } },
      orderBy: { code: 'asc' },
    });
    const lockedByCode = new Map(locked.map((a) => [a.code, a]));

    // Net movement across every step of this transfer.
    const net = new Map<string, { debit: bigint; credit: bigint }>();
    for (const step of plan.steps) {
      for (const [code, movement] of step.movements) {
        const current = net.get(code) ?? { debit: 0n, credit: 0n };
        current.debit += movement.debit;
        current.credit += movement.credit;
        net.set(code, current);
      }
    }

    const deltas = new Map<string, bigint>();
    for (const [code, movement] of net) {
      const account = lockedByCode.get(code) ?? accountMap.get(code);
      if (!account) {
        throw new InternalServerErrorException(`Ledger account "${code}" was not resolved.`);
      }
      this.assertAccountUsable(account);

      const spec = parseAccountCode(code);
      const delta = balanceDelta(spec.normalSide as GlDirection, movement);
      this.assertBalanceOk(account, delta, input.allowNegative ?? [], input.nonNegative ?? []);

      if (delta !== 0n) deltas.set(code, delta);
    }

    // Claim the transfer. The unique key is the idempotency guarantee: a
    // concurrent duplicate loses here and replays the winner.
    let transferId: string;
    try {
      const transfer = await tx.glTransfer.create({
        data: {
          intent: input.intent,
          platformId: input.platformId ?? null,
          reference: input.reference ?? null,
          description: input.description ?? null,
          initiatorType: input.initiatorType,
          initiatorId: input.initiatorId ?? null,
          idempotencyKey: key,
          reversalOfId: input.reversalOfId ?? null,
          metadata: input.metadata,
        },
      });
      transferId = transfer.id;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const winner = await tx.glTransfer.findUnique({ where: { idempotencyKey: key } });
        if (winner) return { transferId: winner.id, replayed: true };
      }
      throw err;
    }

    const provenance = input.provenance ?? {};

    // A wallet receipt maps to exactly one ledger entry: its own wallet leg.
    // Attaching it to the counterparty leg too would violate the unique index
    // and would wrongly claim the other party's movement as this receipt's.
    const walletAccounts = plan.accounts.filter(
      (code) => parseAccountCode(code).type === 'LIABILITY_USER_WALLET',
    );
    const attachWalletReceipt = walletAccounts.length === 1;

    for (const step of plan.steps) {
      const transaction = await tx.glTransaction.create({
        data: {
          transferId,
          currency: 'GBP',
          amountMinor: step.amountMinor,
          status: 'posted',
        },
      });

      const entries: Prisma.GlEntryCreateManyInput[] = [];
      for (const [code, movement] of step.movements) {
        const account = lockedByCode.get(code) ?? accountMap.get(code)!;
        const isWalletLeg =
          attachWalletReceipt && walletAccounts.length === 1 && code === walletAccounts[0];

        if (movement.debit > 0n) {
          entries.push(this.entry(transaction.id, account, 'debit', movement.debit, provenance, isWalletLeg));
        }
        if (movement.credit > 0n) {
          entries.push(this.entry(transaction.id, account, 'credit', movement.credit, provenance, isWalletLeg));
        }
      }

      if (entries.length === 0) {
        throw new InternalServerErrorException(
          `Ledger transaction for transfer ${transferId} produced no entries.`,
        );
      }

      await tx.glEntry.createMany({ data: entries });
    }

    // Relative writes only — never a snapshot computed from an earlier read.
    for (const [code, delta] of deltas) {
      await tx.glAccount.update({
        where: { code },
        data: { balanceMinor: { increment: delta } },
      });
    }

    return { transferId, replayed: false };
  }

  /**
   * Lock every account the transfer touches, in code order, so two transfers
   * that share accounts cannot deadlock by acquiring them in different orders.
   */
  private async lockAccounts(tx: Prisma.TransactionClient, codes: string[]): Promise<void> {
    if (codes.length === 0) return;
    await tx.$queryRaw`
      SELECT id FROM gl_accounts
      WHERE code IN (${Prisma.join(codes)})
      ORDER BY code
      FOR UPDATE
    `;
  }

  private entry(
    transactionId: string,
    account: GlAccount,
    direction: GlDirection,
    amountMinor: bigint,
    provenance: GlProvenance,
    isWalletLeg: boolean,
  ): Prisma.GlEntryCreateManyInput {
    return {
      transactionId,
      accountId: account.id,
      direction,
      amountMinor,
      currency: 'GBP',
      walletTransactionId: isWalletLeg ? provenance.walletTransactionId ?? null : null,
      appChargeId: provenance.appChargeId ?? null,
      appRefundId: provenance.appRefundId ?? null,
      settlementId: provenance.settlementId ?? null,
      referralCommissionId: provenance.referralCommissionId ?? null,
    };
  }

  private assertAccountUsable(account: GlAccount): void {
    if (account.status !== 'ACTIVE') {
      throw new ConflictException(
        `Ledger account "${account.code}" is ${account.status} and cannot move money.`,
      );
    }
  }

  /**
   * Guard rails by account class:
   *  - a user wallet can never go negative (that is an unbacked balance)
   *  - the platform wallet can never go negative unless explicitly allowed
   *  - payables and suspense may go negative: they represent money owed *to*
   *    us, which is a real signal rather than an error
   */
  private assertBalanceOk(
    account: GlAccount,
    delta: bigint,
    allowNegative: string[],
    nonNegative: string[],
  ): void {
    if (delta >= 0n || allowNegative.includes(account.code)) return;

    const projected = account.balanceMinor + delta;
    if (projected >= 0n) return;

    if (nonNegative.includes(account.code)) {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_FUNDS',
        accountCode: account.code,
        availableBalance: Number(account.balanceMinor) / 100,
        message: `Account ${account.code} has £${(Number(account.balanceMinor) / 100).toFixed(2)} available, which is not enough for this movement.`,
      });
    }

    if (account.type === 'LIABILITY_USER_WALLET') {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_BALANCE',
        accountCode: account.code,
        availableBalance: Number(account.balanceMinor) / 100,
        message: `Wallet balance (£${(Number(account.balanceMinor) / 100).toFixed(2)}) is insufficient for this movement.`,
      });
    }

    if (account.type === 'PLATFORM_WALLET') {
      throw new UnprocessableEntityException({
        error: 'INSUFFICIENT_PLATFORM_BALANCE',
        accountCode: account.code,
        availableBalance: Number(account.balanceMinor) / 100,
        message: `The platform wallet cannot fund this movement (£${(Number(account.balanceMinor) / 100).toFixed(2)} available).`,
      });
    }

    this.logger.warn(
      `Ledger account ${account.code} (${account.type}) is going negative: ${projected}`,
    );
  }
}
