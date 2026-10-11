-- CreateEnum
CREATE TYPE "AppChargeMethod" AS ENUM ('stripe', 'paypal', 'wallet');

-- CreateEnum
CREATE TYPE "AppChargeStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('gateway_clearing', 'wallet_clearing', 'app_payable', 'mcom_revenue', 'refund');

-- AlterTable
ALTER TABLE "sso_clients" ADD COLUMN     "fee_fixed_minor" BIGINT,
ADD COLUMN     "fee_percent" DECIMAL(5,4);

-- CreateTable
CREATE TABLE "app_charges" (
    "id" TEXT NOT NULL,
    "app_client_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "fee_minor" BIGINT NOT NULL DEFAULT 0,
    "net_minor" BIGINT NOT NULL,
    "method" "AppChargeMethod" NOT NULL,
    "status" "AppChargeStatus" NOT NULL DEFAULT 'pending',
    "reference" TEXT,
    "description" TEXT,
    "mcom_user_id" TEXT,
    "external_customer_id" TEXT,
    "provider" TEXT,
    "provider_ref" TEXT,
    "wallet_debit_amount" DECIMAL(18,4),
    "idempotency_key" TEXT NOT NULL,
    "metadata" JSONB,
    "failure_reason" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_payment_ledger_entries" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "app_client_id" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "mcom_user_id" TEXT,
    "provider" TEXT,
    "provider_ref" TEXT,
    "reference" TEXT,
    "metadata" JSONB,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_payment_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_charges_provider_ref_key" ON "app_charges"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "app_charges_idempotency_key_key" ON "app_charges"("idempotency_key");

-- CreateIndex
CREATE INDEX "app_charges_app_client_id_created_at_idx" ON "app_charges"("app_client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_charges_status_idx" ON "app_charges"("status");

-- CreateIndex
CREATE INDEX "app_charges_mcom_user_id_idx" ON "app_charges"("mcom_user_id");

-- CreateIndex
CREATE INDEX "app_charges_reference_idx" ON "app_charges"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "app_payment_ledger_entries_idempotency_key_key" ON "app_payment_ledger_entries"("idempotency_key");

-- CreateIndex
CREATE INDEX "app_payment_ledger_entries_charge_id_idx" ON "app_payment_ledger_entries"("charge_id");

-- CreateIndex
CREATE INDEX "app_payment_ledger_entries_app_client_id_created_at_idx" ON "app_payment_ledger_entries"("app_client_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "app_payment_ledger_entries_account_idx" ON "app_payment_ledger_entries"("account");

-- AddForeignKey
ALTER TABLE "app_payment_ledger_entries" ADD CONSTRAINT "app_payment_ledger_entries_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "app_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
