-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('TOP_UP', 'REWARD', 'REFUND', 'ADMIN_CREDIT', 'TRANSFER_IN', 'SUBSCRIPTION', 'PURCHASE', 'SERVICE_FEE', 'ADMIN_DEBIT', 'TRANSFER_OUT', 'HOLD_CAPTURE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "HoldStatus" AS ENUM ('ACTIVE', 'CAPTURED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MCOM',
    "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "daily_debit_limit" DECIMAL(18,4),
    "monthly_debit_limit" DECIMAL(18,4),
    "max_balance" DECIMAL(18,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_transaction_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balance_before" DECIMAL(18,4) NOT NULL,
    "balance_after" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MCOM',
    "platform_client_id" TEXT,
    "platform_name" TEXT,
    "platform_slug" TEXT,
    "category" "TransactionCategory" NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "idempotency_key" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "failure_reason" TEXT,
    "hold_id" TEXT,
    "initiated_by" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_holds" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "platform_client_id" TEXT NOT NULL,
    "platform_name" TEXT NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "status" "HoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "captured_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_audit_logs" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changes" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_top_up_requests" (
    "id" TEXT NOT NULL,
    "wallet_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "wallet_currency" TEXT NOT NULL DEFAULT 'MCOM',
    "exchange_rate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "provider_status" TEXT,
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "wallet_top_up_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_status_idx" ON "wallets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_platform_client_id_idx" ON "wallet_transactions"("platform_client_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_platform_slug_idx" ON "wallet_transactions"("platform_slug");

-- CreateIndex
CREATE INDEX "wallet_transactions_category_idx" ON "wallet_transactions"("category");

-- CreateIndex
CREATE INDEX "wallet_transactions_type_idx" ON "wallet_transactions"("type");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_idempotency_key_idx" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_idx" ON "wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_platform_slug_created_at_idx" ON "wallet_transactions"("wallet_id", "platform_slug", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_holds_wallet_id_idx" ON "wallet_holds"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_holds_platform_client_id_idx" ON "wallet_holds"("platform_client_id");

-- CreateIndex
CREATE INDEX "wallet_holds_expires_at_idx" ON "wallet_holds"("expires_at");

-- CreateIndex
CREATE INDEX "wallet_holds_status_idx" ON "wallet_holds"("status");

-- CreateIndex
CREATE INDEX "wallet_audit_logs_wallet_id_idx" ON "wallet_audit_logs"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_audit_logs_admin_id_idx" ON "wallet_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "wallet_audit_logs_created_at_idx" ON "wallet_audit_logs"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_up_requests_provider_ref_key" ON "wallet_top_up_requests"("provider_ref");

-- CreateIndex
CREATE INDEX "wallet_top_up_requests_wallet_id_idx" ON "wallet_top_up_requests"("wallet_id");

-- CreateIndex
CREATE INDEX "wallet_top_up_requests_user_id_idx" ON "wallet_top_up_requests"("user_id");

-- CreateIndex
CREATE INDEX "wallet_top_up_requests_provider_ref_idx" ON "wallet_top_up_requests"("provider_ref");

-- CreateIndex
CREATE INDEX "wallet_top_up_requests_status_idx" ON "wallet_top_up_requests"("status");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "wallet_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_audit_logs" ADD CONSTRAINT "wallet_audit_logs_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_top_up_requests" ADD CONSTRAINT "wallet_top_up_requests_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
