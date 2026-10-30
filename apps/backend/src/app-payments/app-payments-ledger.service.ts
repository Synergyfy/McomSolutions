import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerAccount, LedgerDirection, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

export interface FeeConfig {
  feePercent: Decimal;
  feeFixedMinor: bigint;
}

export interface ChargeLedgerParams {
  chargeId: string;
  appClientId: string;
  amountMinor: bigint;
  feeMinor: bigint;
  netMinor: bigint;
  currency: string;
  clearingAccount: LedgerAccount;
  mcomUserId?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface RefundLedgerParams {
  chargeId: string;
  /** AppRefund.id — the idempotency key every row in this refund is scoped to. */
  refundId: string;
  appClientId: string;
  refundMinor: bigint;
  feeRefundMinor: bigint;
  netRefundMinor: bigint;
  currency: string;
  clearingAccount: LedgerAccount;
  mcomUserId?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  reference?: string | null;
  metadata?: Prisma.InputJsonValue;
}

const DEFAULT_FEE_PERCENT = '0.029'; // 2.9%
const DEFAULT_FEE_FIXED_MINOR = '20'; // 20p

/**
 * Append-only, double-entry ledger for MCOM Pay charges.
 *
 * Every paid charge posts:
 *   debit  <clearing>      gross   (money in — gateway or wallet)
 *   credit app_payable     net     (what MCOM owes the app)
 *   credit mcom_revenue    fee     (MCOM's cut, when > 0)
 *
 * Refunds post the exact reverse, so the ledger always sums to zero.
 */
@Injectable()
export class AppPaymentsLedgerService {
  private readonly logger = new Logger(AppPaymentsLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolveFeeConfig(client: {
    feePercent?: Prisma.Decimal | null;
    feeFixedMinor?: bigint | null;
  }): Promise<FeeConfig> {
    const feePercent =
      client.feePercent != null
        ? new Decimal(client.feePercent.toString())
        : new Decimal(
            await this.programmeValue(
              'app_payment_fee_percent',
              this.config.get<string>('MCOM_PAY_FEE_PERCENT') || DEFAULT_FEE_PERCENT,
            ),
          );

    const feeFixedMinor =
      client.feeFixedMinor != null
        ? BigInt(client.feeFixedMinor.toString())
        : BigInt(
            await this.programmeValue(
              'app_payment_fee_fixed_minor',
              this.config.get<string>('MCOM_PAY_FEE_FIXED_MINOR') || DEFAULT_FEE_FIXED_MINOR,
            ),
          );

    return { feePercent, feeFixedMinor };
  }

  private async programmeValue(key: string, fallback: string): Promise<string> {
    try {
      const setting = await this.prisma.programmeSetting.findUnique({ where: { key } });
      if (setting?.value) return setting.value;
    } catch (err: any) {
      this.logger.warn(`Failed to read ProgrammeSetting "${key}": ${err?.message}`);
    }
    return fallback;
  }

  /**
   * Integer-only fee calculation. Fee is clamped to [0, gross] so a large fixed
   * fee can never make the net negative.
   */
  computeFee(amountMinor: bigint, cfg: FeeConfig): bigint {
    const pctPart = new Decimal(amountMinor.toString()).times(cfg.feePercent);
    const fee = pctPart
      .plus(new Decimal(cfg.feeFixedMinor.toString()))
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toFixed(0);
    let feeMinor = BigInt(fee);
    if (feeMinor < 0n) feeMinor = 0n;
    if (feeMinor > amountMinor) feeMinor = amountMinor;
    return feeMinor;
  }

  /**
   * Fee portion of a refund, proportional to the refunded amount.
   *
   * `prior` carries what earlier refunds on the same charge already returned.
   * Without it a series of partial refunds could each round up and hand back
   * more fee than MCOM ever took. The refund that closes a charge always
   * returns the remaining fee, so per-refund rounding never strands a penny.
   */
  computeRefundFee(
    charge: { amountMinor: bigint; feeMinor: bigint },
    refundMinor: bigint,
    prior: { refundedMinor?: bigint; feeRefundedMinor?: bigint } = {},
  ): bigint {
    if (refundMinor <= 0n) return 0n;

    const refundedSoFar = prior.refundedMinor ?? 0n;
    const feeRefundedSoFar = prior.feeRefundedMinor ?? 0n;
    const remainingGross = charge.amountMinor - refundedSoFar;
    const remainingFee = charge.feeMinor - feeRefundedSoFar;

    if (remainingGross <= 0n || remainingFee <= 0n) return 0n;
    if (refundMinor >= remainingGross) return remainingFee;

    const proportional = BigInt(
      new Decimal(charge.feeMinor.toString())
        .times(refundMinor.toString())
        .dividedBy(charge.amountMinor.toString())
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toFixed(0),
    );
    return proportional > remainingFee ? remainingFee : proportional;
  }

  async postChargeLedger(tx: Prisma.TransactionClient, params: ChargeLedgerParams): Promise<void> {
    const base = {
      chargeId: params.chargeId,
      appClientId: params.appClientId,
      currency: params.currency,
      mcomUserId: params.mcomUserId ?? null,
      provider: params.provider ?? null,
      providerRef: params.providerRef ?? null,
      reference: params.reference ?? null,
      metadata: params.metadata,
    };

    const entries: Prisma.AppPaymentLedgerEntryCreateManyInput[] = [
      {
        ...base,
        account: params.clearingAccount,
        direction: LedgerDirection.debit,
        amountMinor: params.amountMinor,
        idempotencyKey: `${params.chargeId}:clearing:debit`,
      },
      {
        ...base,
        account: LedgerAccount.app_payable,
        direction: LedgerDirection.credit,
        amountMinor: params.netMinor,
        idempotencyKey: `${params.chargeId}:app_payable:credit`,
      },
    ];

    if (params.feeMinor > 0n) {
      entries.push({
        ...base,
        account: LedgerAccount.mcom_revenue,
        direction: LedgerDirection.credit,
        amountMinor: params.feeMinor,
        idempotencyKey: `${params.chargeId}:mcom_revenue:credit`,
      });
    }

    await tx.appPaymentLedgerEntry.createMany({ data: entries, skipDuplicates: true });
  }

  /**
   * Post the mirror image of a charge for one refund.
   *
   * Rows are keyed by `refundId`, not `chargeId`: a charge can be refunded in
   * several partials, and per-charge keys made `skipDuplicates` silently drop
   * every refund after the first.
   */
  async postRefundLedger(tx: Prisma.TransactionClient, params: RefundLedgerParams): Promise<void> {
    if (params.refundMinor <= 0n) {
      throw new InternalServerErrorException(
        `Refund ledger called with a non-positive amount for refund ${params.refundId}.`,
      );
    }
    if (params.refundMinor !== params.feeRefundMinor + params.netRefundMinor) {
      throw new InternalServerErrorException(
        `Refund ledger imbalance for refund ${params.refundId}: gross ${params.refundMinor} != fee ${params.feeRefundMinor} + net ${params.netRefundMinor}.`,
      );
    }

    const base = {
      chargeId: params.chargeId,
      appClientId: params.appClientId,
      currency: params.currency,
      mcomUserId: params.mcomUserId ?? null,
      provider: params.provider ?? null,
      providerRef: params.providerRef ?? null,
      reference: params.reference ?? null,
      metadata: params.metadata,
    };

    const entries: Prisma.AppPaymentLedgerEntryCreateManyInput[] = [
      {
        ...base,
        account: params.clearingAccount,
        direction: LedgerDirection.credit,
        amountMinor: params.refundMinor,
        idempotencyKey: `${params.refundId}:clearing:credit`,
      },
      {
        ...base,
        account: LedgerAccount.app_payable,
        direction: LedgerDirection.debit,
        amountMinor: params.netRefundMinor,
        idempotencyKey: `${params.refundId}:app_payable:debit`,
      },
    ];

    if (params.feeRefundMinor > 0n) {
      entries.push({
        ...base,
        account: LedgerAccount.mcom_revenue,
        direction: LedgerDirection.debit,
        amountMinor: params.feeRefundMinor,
        idempotencyKey: `${params.refundId}:mcom_revenue:debit`,
      });
    }

    await tx.appPaymentLedgerEntry.createMany({ data: entries, skipDuplicates: true });
  }

  /** Ledger entries for one charge (admin / debugging). */
  async getEntriesForCharge(chargeId: string) {
    const rows = await this.prisma.appPaymentLedgerEntry.findMany({
      where: { chargeId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      account: r.account,
      direction: r.direction,
      amountMinor: r.amountMinor.toString(),
      currency: r.currency,
      provider: r.provider,
      providerRef: r.providerRef,
      reference: r.reference,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
