import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WalletDto {
  @ApiProperty({ example: 'clx8p2abc0000x4vj3k5m7n9p' })
  id: string;

  @ApiProperty({ example: 'user_abc123' })
  userId: string;

  @ApiProperty({ example: 1250.0 })
  balance: number;

  @ApiProperty({ example: 1200.0, description: 'Balance minus active holds' })
  availableBalance: number;

  @ApiProperty({ example: 'MCOM' })
  currency: string;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED'] })
  status: string;

  @ApiPropertyOptional({ example: 50000 })
  dailyDebitLimit?: number | null;

  @ApiPropertyOptional({ example: 200000 })
  monthlyDebitLimit?: number | null;

  @ApiProperty({ example: '2026-08-26T11:15:00.000Z' })
  createdAt: string;

  @ApiPropertyOptional({ example: '2026-08-26T11:15:00.000Z' })
  lastTransactionAt?: string | null;
}

export class TransactionReceiptDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  transactionId: string;

  @ApiProperty({ example: 'DEBIT', enum: ['CREDIT', 'DEBIT'] })
  type: string;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiProperty({ example: 150.0 })
  balanceBefore: number;

  @ApiProperty({ example: 100.0 })
  balanceAfter: number;

  @ApiProperty({ example: 'MCOM' })
  currency: string;

  @ApiPropertyOptional({ example: 'sub_inv_0042' })
  reference?: string | null;

  @ApiPropertyOptional({ example: 'mcom-mall-sub-inv-0042-aug2026' })
  idempotencyKey?: string | null;

  @ApiProperty({ example: '2026-08-26T11:15:00.000Z' })
  processedAt: string;
}

export class WalletTransactionDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  id: string;

  @ApiProperty({ example: 'DEBIT', enum: ['CREDIT', 'DEBIT'] })
  type: string;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiProperty({ example: 150.0 })
  balanceBefore: number;

  @ApiProperty({ example: 100.0 })
  balanceAfter: number;

  @ApiProperty({ example: 'MCOM' })
  currency: string;

  @ApiPropertyOptional({ example: 'mcom-mall' })
  platformClientId?: string | null;

  @ApiPropertyOptional({ example: 'MCOM Mall' })
  platformName?: string | null;

  @ApiPropertyOptional({ example: 'mall' })
  platformSlug?: string | null;

  @ApiProperty({ example: 'SUBSCRIPTION' })
  category: string;

  @ApiPropertyOptional({ example: 'sub_inv_0042' })
  reference?: string | null;

  @ApiPropertyOptional({ example: 'MCOM Mall — Gold Package Subscription' })
  description?: string | null;

  @ApiProperty({ example: 'COMPLETED' })
  status: string;

  @ApiPropertyOptional({ example: 'platform:mcom-mall' })
  initiatedBy?: string | null;

  @ApiProperty({ example: '2026-08-26T11:15:00.000Z' })
  createdAt: string;
}

export class PaginatedWalletTransactionsDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: [WalletTransactionDto] })
  data: WalletTransactionDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class WalletHoldDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  id: string;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiProperty({ example: 'mcom-mall' })
  platformClientId: string;

  @ApiProperty({ example: 'MCOM Mall' })
  platformName: string;

  @ApiPropertyOptional({ example: 'sub_inv_0042' })
  reference?: string | null;

  @ApiProperty({ example: 'ACTIVE', enum: ['ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED'] })
  status: string;

  @ApiProperty({ example: '2026-08-27T11:15:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-08-26T11:15:00.000Z' })
  createdAt: string;
}

export class WalletSummaryDto {
  @ApiProperty({ example: '30d' })
  period: string;

  @ApiProperty({ example: 320.0 })
  totalSpent: number;

  @ApiProperty({ example: 540.0 })
  totalCredited: number;

  @ApiProperty({ example: 220.0 })
  netFlow: number;

  @ApiProperty({
    example: [{ platformSlug: 'mall', platformName: 'MCOM Mall', totalSpent: 120.0, txnCount: 6 }],
  })
  spentByPlatform: Array<Record<string, any>>;

  @ApiProperty({ example: [{ category: 'SUBSCRIPTION', total: 200.0, count: 3 }] })
  topCategories: Array<Record<string, any>>;
}

export class WalletTopUpInitiateDto {
  @ApiProperty({ example: 'cs_test_abc123' })
  sessionId: string;

  @ApiProperty({ example: 'https://checkout.stripe.com/c/pay/cs_test_abc123' })
  checkoutUrl: string;

  @ApiProperty({ example: 'PENDING' })
  status: string;
}

export class TopUpRequestDto {
  @ApiProperty({ example: 'clx8p2qr10000x4vj3k5m7n9p' })
  id: string;

  @ApiProperty({ example: 50.0 })
  amount: number;

  @ApiProperty({ example: 'GBP' })
  currency: string;

  @ApiProperty({ example: 'MCOM' })
  walletCurrency: string;

  @ApiProperty({ example: 'stripe' })
  provider: string;

  @ApiProperty({ example: 'COMPLETED', enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] })
  status: string;

  @ApiPropertyOptional({ example: '2026-08-26T11:15:00.000Z' })
  completedAt?: string | null;

  @ApiProperty({ example: '2026-08-26T11:15:00.000Z' })
  createdAt: string;
}

export class WalletBalanceDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 100.0 })
  balance: number;

  @ApiProperty({ example: 50.0 })
  availableBalance: number;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 'MCOM' })
  currency: string;
}

export class PartnerTransactionsDto extends PaginatedWalletTransactionsDto {
  @ApiProperty({ example: 'mcom-mall' })
  platformClientId: string;
}