-- Central ledger (MCOM Pay) — double-entry journal.
--
-- Additive only: no existing table is altered destructively. Every money
-- movement in the ecosystem posts here, and a deferred constraint trigger makes
-- an unbalanced transaction physically impossible.

-- ─── Enums ────────────────────────────────────────────────────────────────
CREATE TYPE "GlAccountType" AS ENUM (
  'ASSET_GATEWAY_CLEARING',
  'ASSET_BANK',
  'PLATFORM_WALLET',
  'LIABILITY_USER_WALLET',
  'LIABILITY_APP_PAYABLE',
  'LIABILITY_PAYABLE',
  'SUSPENSE',
  'EQUITY_OPENING'
);

CREATE TYPE "GlIntent" AS ENUM (
  'ORDER',
  'BOOKING',
  'DELEGATION',
  'PURCHASE',
  'SUBSCRIPTION',
  'REFERRAL_COMMISSION',
  'TOP_UP',
  'REFUND',
  'PAYOUT',
  'TRANSFER',
  'ADJUSTMENT',
  'FEE',
  'CHARGEBACK',
  'OPENING_BALANCE'
);

CREATE TYPE "GlEntryDirection" AS ENUM ('debit', 'credit');
CREATE TYPE "GlTransactionStatus" AS ENUM ('pending', 'posted', 'reversed');
CREATE TYPE "GlAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- ─── Accounts ─────────────────────────────────────────────────────────────
CREATE TABLE "gl_accounts" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "type"          "GlAccountType" NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'GBP',
  "scope"         TEXT NOT NULL,
  "owner_ref"     TEXT,
  "balance_minor" BIGINT NOT NULL DEFAULT 0,
  "status"        "GlAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "is_system"     BOOLEAN NOT NULL DEFAULT false,
  "metadata"      JSONB,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gl_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_accounts_code_key" ON "gl_accounts"("code");
CREATE INDEX "gl_accounts_type_currency_idx" ON "gl_accounts"("type", "currency");
CREATE INDEX "gl_accounts_scope_owner_ref_idx" ON "gl_accounts"("scope", "owner_ref");
CREATE INDEX "gl_accounts_status_idx" ON "gl_accounts"("status");

-- ─── Transfers (one business event) ───────────────────────────────────────
CREATE TABLE "gl_transfers" (
  "id"              TEXT NOT NULL,
  "intent"          "GlIntent" NOT NULL,
  "platform_id"     TEXT,
  "reference"       TEXT,
  "description"     TEXT,
  "initiator_type"  TEXT NOT NULL,
  "initiator_id"    TEXT,
  "idempotency_key" TEXT NOT NULL,
  "reversal_of_id"  TEXT,
  "metadata"        JSONB,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_transfers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_transfers_idempotency_key_key" ON "gl_transfers"("idempotency_key");
CREATE UNIQUE INDEX "gl_transfers_reversal_of_id_key" ON "gl_transfers"("reversal_of_id");
CREATE INDEX "gl_transfers_platform_id_created_at_idx" ON "gl_transfers"("platform_id", "created_at" DESC);
CREATE INDEX "gl_transfers_intent_created_at_idx" ON "gl_transfers"("intent", "created_at" DESC);
CREATE INDEX "gl_transfers_reference_idx" ON "gl_transfers"("reference");
CREATE INDEX "gl_transfers_created_at_idx" ON "gl_transfers"("created_at" DESC);

-- ─── Transactions (one balanced step, GBP) ────────────────────────────────
CREATE TABLE "gl_transactions" (
  "id"                      TEXT NOT NULL,
  "transfer_id"             TEXT NOT NULL,
  "currency"                TEXT NOT NULL DEFAULT 'GBP',
  "amount_minor"            BIGINT NOT NULL,
  "status"                  "GlTransactionStatus" NOT NULL DEFAULT 'posted',
  "reverses_transaction_id" TEXT,
  "posted_at"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_transactions_reverses_transaction_id_key"
  ON "gl_transactions"("reverses_transaction_id");
CREATE INDEX "gl_transactions_transfer_id_idx" ON "gl_transactions"("transfer_id");
CREATE INDEX "gl_transactions_posted_at_idx" ON "gl_transactions"("posted_at");

ALTER TABLE "gl_transactions"
  ADD CONSTRAINT "gl_transactions_transfer_id_fkey"
  FOREIGN KEY ("transfer_id") REFERENCES "gl_transfers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Entries (one debit or credit) ────────────────────────────────────────
CREATE TABLE "gl_entries" (
  "id"                     TEXT NOT NULL,
  "transaction_id"         TEXT NOT NULL,
  "account_id"             TEXT NOT NULL,
  "direction"              "GlEntryDirection" NOT NULL,
  "amount_minor"           BIGINT NOT NULL,
  "currency"               TEXT NOT NULL DEFAULT 'GBP',
  "wallet_transaction_id"  TEXT,
  "app_charge_id"          TEXT,
  "app_refund_id"          TEXT,
  "settlement_id"          TEXT,
  "referral_commission_id" TEXT,
  "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gl_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_entries_wallet_transaction_id_key"
  ON "gl_entries"("wallet_transaction_id");
CREATE INDEX "gl_entries_account_id_created_at_idx" ON "gl_entries"("account_id", "created_at" DESC);
CREATE INDEX "gl_entries_transaction_id_idx" ON "gl_entries"("transaction_id");
CREATE INDEX "gl_entries_app_charge_id_idx" ON "gl_entries"("app_charge_id");
CREATE INDEX "gl_entries_referral_commission_id_idx" ON "gl_entries"("referral_commission_id");
CREATE INDEX "gl_entries_created_at_idx" ON "gl_entries"("created_at" DESC);

ALTER TABLE "gl_entries"
  ADD CONSTRAINT "gl_entries_transaction_id_fkey"
  FOREIGN KEY ("transaction_id") REFERENCES "gl_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "gl_entries"
  ADD CONSTRAINT "gl_entries_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "gl_accounts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Daily rollups (derived, rebuildable) ─────────────────────────────────
CREATE TABLE "gl_daily_rollups" (
  "id"           TEXT NOT NULL,
  "date"         TEXT NOT NULL,
  "platform_id"  TEXT NOT NULL DEFAULT 'mcom-central',
  "intent"       "GlIntent" NOT NULL,
  "currency"     TEXT NOT NULL DEFAULT 'GBP',
  "debit_minor"  BIGINT NOT NULL DEFAULT 0,
  "credit_minor" BIGINT NOT NULL DEFAULT 0,
  "txn_count"    INTEGER NOT NULL DEFAULT 0,
  "updated_at"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gl_daily_rollups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gl_daily_rollups_date_platform_id_intent_currency_key"
  ON "gl_daily_rollups"("date", "platform_id", "intent", "currency");
CREATE INDEX "gl_daily_rollups_date_idx" ON "gl_daily_rollups"("date");

-- ─── WalletTransaction → journal projection ───────────────────────────────
ALTER TABLE "wallet_transactions" ADD COLUMN "intent" "GlIntent";
ALTER TABLE "wallet_transactions" ADD COLUMN "transfer_id" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN "counterparty_wallet_id" TEXT;
ALTER TABLE "wallet_transactions" ADD COLUMN "ledger_entry_id" TEXT;

CREATE UNIQUE INDEX "wallet_transactions_ledger_entry_id_key"
  ON "wallet_transactions"("ledger_entry_id");
CREATE INDEX "wallet_transactions_intent_idx" ON "wallet_transactions"("intent");
CREATE INDEX "wallet_transactions_transfer_id_idx" ON "wallet_transactions"("transfer_id");

-- ─── Seed the platform's own wallet ───────────────────────────────────────
-- Deterministic id so code can find it without a lookup table.
INSERT INTO "gl_accounts" (
  "id", "code", "type", "currency", "scope", "owner_ref",
  "balance_minor", "status", "is_system", "updated_at"
) VALUES (
  'glacct_platform_wallet_gbp',
  'platform:wallet:GBP',
  'PLATFORM_WALLET',
  'GBP',
  'platform',
  NULL,
  0,
  'ACTIVE',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

-- ─── Balance invariant: Σ debits == Σ credits per transaction ─────────────
-- Deferred to commit so a multi-leg insert cannot trip the check mid-flight.
CREATE OR REPLACE FUNCTION gl_assert_transaction_balanced() RETURNS trigger AS $$
DECLARE
  debit_total  numeric;
  credit_total numeric;
BEGIN
  SELECT
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'debit'), 0),
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'credit'), 0)
  INTO debit_total, credit_total
  FROM gl_entries
  WHERE transaction_id = NEW.transaction_id;

  IF debit_total <> credit_total THEN
    RAISE EXCEPTION
      'gl_transaction % is unbalanced: debit %, credit %',
      NEW.transaction_id, debit_total, credit_total;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "gl_entries_balanced"
  AFTER INSERT OR UPDATE ON "gl_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION gl_assert_transaction_balanced();
