-- Affiliate workflow: add the QUOTED service-request state and make all fiat
-- amounts integer pence. Pounds are a UI-only representation.
--
-- Safe to run on environments that already have/omit any legacy columns.
BEGIN;

-- ── Service request quote state ──────────────────────────────────────────
ALTER TYPE "AffiliateServiceRequestStatus" ADD VALUE IF NOT EXISTS 'QUOTED';

ALTER TABLE "affiliate_service_requests"
  ADD COLUMN IF NOT EXISTS "estimated_cost_pence" integer;

-- ── Affiliate task pence columns ─────────────────────────────────────────
ALTER TABLE "affiliate_tasks"
  ADD COLUMN IF NOT EXISTS "business_charge_pence" integer;

-- ── Settlement pence columns ─────────────────────────────────────────────
ALTER TABLE "affiliate_task_settlements"
  ADD COLUMN IF NOT EXISTS "business_charge_pence" integer;

-- ── Backfill from legacy pound columns ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_service_requests'
      AND column_name = 'estimated_cost'
  ) THEN
    EXECUTE '
      UPDATE "affiliate_service_requests"
      SET "estimated_cost_pence" = ROUND("estimated_cost" * 100)::integer
      WHERE "estimated_cost" IS NOT NULL
        AND "estimated_cost_pence" IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_tasks'
      AND column_name = 'compensation_amount'
  ) THEN
    EXECUTE '
      UPDATE "affiliate_tasks"
      SET "compensation_pence" = ROUND("compensation_amount" * 100)::integer
      WHERE "compensation_amount" IS NOT NULL
        AND "compensation_pence" IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_tasks'
      AND column_name = 'business_charge_amount'
  ) THEN
    EXECUTE '
      UPDATE "affiliate_tasks"
      SET "business_charge_pence" = ROUND("business_charge_amount" * 100)::integer
      WHERE "business_charge_amount" IS NOT NULL
        AND "business_charge_pence" IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_task_settlements'
      AND column_name = 'business_charge_amount'
  ) THEN
    EXECUTE '
      UPDATE "affiliate_task_settlements"
      SET "business_charge_pence" = ROUND("business_charge_amount" * 100)::integer
      WHERE "business_charge_amount" IS NOT NULL
        AND "business_charge_pence" IS NULL
    ';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_task_settlements'
      AND column_name = 'compensation_amount'
  ) THEN
    EXECUTE '
      UPDATE "affiliate_task_settlements"
      SET "compensation_pence" = ROUND("compensation_amount" * 100)::integer
      WHERE "compensation_amount" IS NOT NULL
        AND "compensation_pence" IS NULL
    ';
  END IF;
END $$;

-- ── Remove the legacy pound columns ──────────────────────────────────────
ALTER TABLE "affiliate_service_requests"
  DROP COLUMN IF EXISTS "estimated_cost";

ALTER TABLE "affiliate_tasks"
  DROP COLUMN IF EXISTS "compensation_amount",
  DROP COLUMN IF EXISTS "business_charge_amount";

ALTER TABLE "affiliate_task_settlements"
  DROP COLUMN IF EXISTS "business_charge_amount",
  DROP COLUMN IF EXISTS "compensation_amount";

COMMIT;
