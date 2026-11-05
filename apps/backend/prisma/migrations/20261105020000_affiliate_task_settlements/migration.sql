-- Affiliate task escrow + settlement ledger.
--
-- One row per delegated task ties together:
--   * the business wallet hold that reserves the charge,
--   * the business debit when the work is approved,
--   * the affiliate's MCOM wallet credit,
--   * the platform fee booked as revenue.
--
-- The wallet ledger (wallet_transactions) remains the source of truth for
-- balances; this table is the reconciliation + admin-audit record.

-- CreateEnum
CREATE TYPE "AffiliateSettlementStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING_HOLD',
  'HELD',
  'SETTLING',
  'SETTLED',
  'RELEASED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "AffiliateSettlementFunding" AS ENUM (
  'BUSINESS_WALLET',
  'PLATFORM'
);

-- CreateTable
CREATE TABLE "affiliate_task_settlements" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "business_user_id" TEXT NOT NULL,
    "affiliate_user_id" TEXT,
    "affiliate_email" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "fx_base" TEXT NOT NULL DEFAULT 'GBP',
    "fx_quote" TEXT NOT NULL DEFAULT 'MCOM',
    "fx_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "business_charge_amount" DECIMAL(18,4),
    "business_charge_credits" DECIMAL(18,4),
    "compensation_amount" DECIMAL(18,4),
    "compensation_credits" DECIMAL(18,4),
    "platform_fee_percent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "platform_fee_credits" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "platform_margin_credits" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "affiliate_payout_credits" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "funding_source" "AffiliateSettlementFunding" NOT NULL DEFAULT 'BUSINESS_WALLET',
    "status" "AffiliateSettlementStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "hold_id" TEXT,
    "hold_expires_at" TIMESTAMP(3),
    "business_transaction_id" TEXT,
    "affiliate_transaction_id" TEXT,
    "settlement_reference" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "held_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_task_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_task_settlements_task_id_key" ON "affiliate_task_settlements"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_task_settlements_hold_id_key" ON "affiliate_task_settlements"("hold_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_task_settlements_settlement_reference_key" ON "affiliate_task_settlements"("settlement_reference");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_business_id_idx" ON "affiliate_task_settlements"("business_id");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_business_user_id_idx" ON "affiliate_task_settlements"("business_user_id");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_affiliate_user_id_idx" ON "affiliate_task_settlements"("affiliate_user_id");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_status_idx" ON "affiliate_task_settlements"("status");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_funding_source_idx" ON "affiliate_task_settlements"("funding_source");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_created_at_idx" ON "affiliate_task_settlements"("created_at");

-- CreateIndex
CREATE INDEX "affiliate_task_settlements_settled_at_idx" ON "affiliate_task_settlements"("settled_at");

-- AddForeignKey
ALTER TABLE "affiliate_task_settlements" ADD CONSTRAINT "affiliate_task_settlements_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "affiliate_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
