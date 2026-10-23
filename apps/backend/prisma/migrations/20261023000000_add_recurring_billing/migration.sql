-- Recurring billing mandates (Stripe / PayPal / MCOM Wallet).
-- Additive migration: existing one-time purchases keep working. Every new
-- mandate is opt-in and existing rows are backfilled with auto_renew = false
-- only when the operator chooses to backfill (no automatic charges here).

-- ─── MembershipStatus: dunning state ───────────────────────────────────────
ALTER TYPE "MembershipStatus" ADD VALUE IF NOT EXISTS 'past_due';

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringScope') THEN
    CREATE TYPE "RecurringScope" AS ENUM ('MEMBERSHIP', 'PLATFORM');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringProvider') THEN
    CREATE TYPE "RecurringProvider" AS ENUM ('stripe', 'paypal', 'wallet');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringStatus') THEN
    CREATE TYPE "RecurringStatus" AS ENUM ('INCOMPLETE', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringChargeStatus') THEN
    CREATE TYPE "RecurringChargeStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');
  END IF;
END $$;

-- ─── Business / package linkage ────────────────────────────────────────────
-- BusinessProfile and PlatformPackage keep their legacy PascalCase table
-- names in this schema (they have no @@map), unlike newer snake_case models.
ALTER TABLE "BusinessProfile"
  ADD COLUMN IF NOT EXISTS "membership_recurring_id" TEXT,
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT,
  ADD COLUMN IF NOT EXISTS "paypal_payer_id" TEXT;

ALTER TABLE "PlatformPackage"
  ADD COLUMN IF NOT EXISTS "auto_renew" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "next_charge_at" TIMESTAMP(3);

-- ─── Recurring mandates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "recurring_subscriptions" (
  "id" TEXT NOT NULL,
  "scope_key" TEXT NOT NULL,
  "scope" "RecurringScope" NOT NULL,
  "business_id" TEXT NOT NULL,
  "user_id" TEXT,
  "membership_plan_id" TEXT,
  "membership_plan_name" TEXT,
  "membership_tier" TEXT,
  "level" TEXT,
  "platform" TEXT,
  "external_plan_id" TEXT,
  "provider" "RecurringProvider" NOT NULL,
  "provider_customer_id" TEXT,
  "provider_subscription_id" TEXT,
  "provider_price_id" TEXT,
  "provider_payment_intent_id" TEXT,
  "plan_name" TEXT NOT NULL,
  "billing_cycle" TEXT NOT NULL,
  "interval_unit" TEXT NOT NULL DEFAULT 'month',
  "interval_count" INTEGER NOT NULL DEFAULT 1,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "status" "RecurringStatus" NOT NULL DEFAULT 'INCOMPLETE',
  "auto_renew" BOOLEAN NOT NULL DEFAULT true,
  "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  "current_period_start" TIMESTAMP(3),
  "current_period_end" TIMESTAMP(3),
  "next_charge_at" TIMESTAMP(3),
  "grace_days" INTEGER NOT NULL DEFAULT 3,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "last_error" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recurring_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recurring_subscriptions_scope_key_key"
  ON "recurring_subscriptions"("scope_key");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_subscriptions_provider_subscription_id_key"
  ON "recurring_subscriptions"("provider_subscription_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_subscriptions_provider_payment_intent_id_key"
  ON "recurring_subscriptions"("provider_payment_intent_id");
CREATE INDEX IF NOT EXISTS "recurring_subscriptions_status_next_charge_at_idx"
  ON "recurring_subscriptions"("status", "next_charge_at");
CREATE INDEX IF NOT EXISTS "recurring_subscriptions_business_id_scope_idx"
  ON "recurring_subscriptions"("business_id", "scope");
CREATE INDEX IF NOT EXISTS "recurring_subscriptions_provider_status_idx"
  ON "recurring_subscriptions"("provider", "status");

-- ─── Per-cycle charge ledger ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "recurring_charges" (
  "id" TEXT NOT NULL,
  "subscription_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "status" "RecurringChargeStatus" NOT NULL DEFAULT 'PENDING',
  "attempt" INTEGER NOT NULL DEFAULT 1,
  "idempotency_key" TEXT NOT NULL,
  "provider_invoice_id" TEXT,
  "provider_payment_id" TEXT,
  "error" TEXT,
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recurring_charges_idempotency_key_key"
  ON "recurring_charges"("idempotency_key");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_charges_provider_invoice_id_key"
  ON "recurring_charges"("provider_invoice_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_charges_provider_payment_id_key"
  ON "recurring_charges"("provider_payment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "recurring_charges_subscription_id_period_start_key"
  ON "recurring_charges"("subscription_id", "period_start");
CREATE INDEX IF NOT EXISTS "recurring_charges_status_created_at_idx"
  ON "recurring_charges"("status", "created_at");

ALTER TABLE "recurring_charges" DROP CONSTRAINT IF EXISTS "recurring_charges_subscription_id_fkey";
ALTER TABLE "recurring_charges"
  ADD CONSTRAINT "recurring_charges_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "recurring_subscriptions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
