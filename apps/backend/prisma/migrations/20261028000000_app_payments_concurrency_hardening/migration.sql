-- MCOM Pay concurrency / idempotency hardening (Phase 1)
--
-- Additive except one index swap: AppCharge.idempotencyKey moves from a global
-- unique index to a per-app composite unique index. This MUST ship in the same
-- release as the service change that stops using findUnique({ idempotencyKey }).

-- AlterEnum
ALTER TYPE "AppChargeStatus" ADD VALUE 'refunding';
ALTER TYPE "AppChargeStatus" ADD VALUE 'partially_refunded';

-- AlterTable
ALTER TABLE "app_charges"
  ADD COLUMN "refunded_minor" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "request_hash" TEXT,
  ADD COLUMN "reconciliation_needed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "settlement_attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "app_refunds" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "app_client_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "fee_refund_minor" BIGINT NOT NULL DEFAULT 0,
    "net_refund_minor" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "provider" TEXT,
    "provider_ref" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT,
    "reason" TEXT,
    "failure_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "charge_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_payment_outbox" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "app_client_id" TEXT NOT NULL,
    "charge_id" TEXT,
    "refund_id" TEXT,
    "event" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_payment_outbox_pkey" PRIMARY KEY ("id")
);

-- DropIndex (replaced by the per-app composite unique below)
DROP INDEX "app_charges_idempotency_key_key";

-- CreateIndex
CREATE UNIQUE INDEX "app_charges_app_client_id_idempotency_key_key" ON "app_charges"("app_client_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "app_charges_reconciliation_needed_idx" ON "app_charges"("reconciliation_needed");

-- CreateIndex
CREATE UNIQUE INDEX "app_refunds_provider_ref_key" ON "app_refunds"("provider_ref");

-- CreateIndex
CREATE UNIQUE INDEX "app_refunds_app_client_id_idempotency_key_key" ON "app_refunds"("app_client_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "app_refunds_charge_id_idx" ON "app_refunds"("charge_id");

-- CreateIndex
CREATE INDEX "app_refunds_status_idx" ON "app_refunds"("status");

-- CreateIndex
CREATE INDEX "app_refunds_app_client_id_created_at_idx" ON "app_refunds"("app_client_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "processed_webhook_events_provider_event_id_key" ON "processed_webhook_events"("provider", "event_id");

-- CreateIndex
CREATE INDEX "processed_webhook_events_charge_id_idx" ON "processed_webhook_events"("charge_id");

-- CreateIndex
CREATE INDEX "processed_webhook_events_received_at_idx" ON "processed_webhook_events"("received_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "app_payment_outbox_dedupe_key_key" ON "app_payment_outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "app_payment_outbox_status_next_attempt_at_idx" ON "app_payment_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "app_payment_outbox_charge_id_idx" ON "app_payment_outbox"("charge_id");

-- AddForeignKey
ALTER TABLE "app_refunds" ADD CONSTRAINT "app_refunds_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "app_charges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data backfill: fully refunded charges already moved their whole gross back.
UPDATE "app_charges" SET "refunded_minor" = "amount_minor" WHERE "status" = 'refunded';
