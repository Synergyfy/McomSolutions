import { Injectable } from '@nestjs/common';
import { GlIntent, Prisma } from '@prisma/client';
import { gatewayAccountCode, PLATFORM_WALLET_CODE } from './account-code';
import { GlPostingService } from './gl-posting.service';

export interface RecordSaleInput {
  /** 'stripe' | 'paypal' — the clearing account the money arrived in. */
  provider: string;
  amountMinor: bigint;
  /** The sale this receipt belongs to (billing transaction / purchase id). */
  idempotencyKey: string;
  reference?: string | null;
  description?: string;
  intent?: GlIntent;
  /** SsoClient.clientId that sold it; defaults to the platform itself. */
  platformId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface RecordSaleResult {
  transferId: string;
  replayed: boolean;
}

/**
 * Platform sales receipts: money that arrives through a payment provider and
 * belongs to us (memberships, plans, access passes, verification fees).
 *
 * Two steps, always the same shape:
 *   gateway:<provider> → platform:wallet
 *
 * The platform wallet is the single, real-time figure for "our money", so every
 * sale must land there rather than in a per-product revenue account.
 */
@Injectable()
export class PlatformSalesService {
  constructor(private readonly posting: GlPostingService) {}

  async recordSale(tx: Prisma.TransactionClient, input: RecordSaleInput): Promise<RecordSaleResult | null> {
    if (input.amountMinor <= 0n) return null;

    const result = await this.posting.post(tx, {
      intent: input.intent ?? GlIntent.PURCHASE,
      platformId: input.platformId ?? 'mcom-central',
      reference: input.reference ?? null,
      description: input.description,
      initiatorType: 'system',
      idempotencyKey: input.idempotencyKey,
      transactions: [
        {
          legs: [
            { account: gatewayAccountCode(input.provider), direction: 'debit', amountMinor: input.amountMinor },
            { account: PLATFORM_WALLET_CODE, direction: 'credit', amountMinor: input.amountMinor },
          ],
        },
      ],
      metadata: input.metadata,
    });

    return result;
  }
}
