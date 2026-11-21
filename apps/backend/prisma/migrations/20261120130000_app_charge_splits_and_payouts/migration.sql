-- Phase 4: payee splits, charge intent, and app payouts.
--
-- A charge may now say where its money goes. Split rows are settled
-- independently so one unreachable payee cannot block another's funds.

-- ─── AppCharge: intent + settlement state ─────────────────────────────────
ALTER TABLE "app_charges" ADD COLUMN "intent" "GlIntent" NOT NULL DEFAULT 'ORDER';
ALTER TABLE "app_charges" ADD COLUMN "payee_type" TEXT;
ALTER TABLE "app_charges" ADD COLUMN "payee_ref" TEXT;
ALTER TABLE "app_charges" ADD COLUMN "transfer_id" TEXT;
ALTER TABLE "app_charges" ADD COLUMN "settlement_state" TEXT NOT NULL DEFAULT 'NA';

CREATE INDEX "app_charges_settlement_state_idx" ON "app_charges"("settlement_state");

-- ─── Charge splits ────────────────────────────────────────────────────────
CREATE TABLE "app_charge_splits" (
  "id"                    TEXT NOT NULL,
  "charge_id"             TEXT NOT NULL,
  "payee_type"            TEXT NOT NULL,
  "payee_user_id"         TEXT,
  "payee_external_id"     TEXT,
  "amount_minor"          BIGINT NOT NULL,
  "fee_minor"             BIGINT NOT NULL DEFAULT 0,
  "net_minor"             BIGINT NOT NULL,
  "status"                TEXT NOT NULL DEFAULT 'pending',
  "wallet_transaction_id" TEXT,
  "failure_reason"        TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_charge_splits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_charge_splits_charge_id_idx" ON "app_charge_splits"("charge_id");
CREATE INDEX "app_charge_splits_payee_user_id_idx" ON "app_charge_splits"("payee_user_id");
CREATE INDEX "app_charge_splits_status_idx" ON "app_charge_splits"("status");

ALTER TABLE "app_charge_splits"
  ADD CONSTRAINT "app_charge_splits_charge_id_fkey"
  FOREIGN KEY ("charge_id") REFERENCES "app_charges"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── App payouts ──────────────────────────────────────────────────────────
CREATE TABLE "app_payouts" (
  "id"              TEXT NOT NULL,
  "app_client_id"   TEXT NOT NULL,
  "amount_minor"    BIGINT NOT NULL,
  "currency"        TEXT NOT NULL DEFAULT 'GBP',
  "status"          TEXT NOT NULL DEFAULT 'pending',
  "transfer_id"     TEXT,
  "provider"        TEXT,
  "provider_ref"    TEXT,
  "requested_by"    TEXT,
  "approved_by"     TEXT,
  "idempotency_key" TEXT NOT NULL,
  "failure_reason"  TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_payouts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_payouts_idempotency_key_key" ON "app_payouts"("idempotency_key");
CREATE INDEX "app_payouts_app_client_id_status_idx" ON "app_payouts"("app_client_id", "status");
CREATE INDEX "app_payouts_status_created_at_idx" ON "app_payouts"("status", "created_at");
