-- Free delegated-task allowances on membership plans and access passes.
--
-- `unlimited_free_delegated_tasks` wins over `free_delegated_tasks`. Once the
-- allowance is exhausted, further delegations are charged to the business
-- wallet (the same escrow path used by Trial / Access Pass businesses).
--
-- Existing membership plans are backfilled to unlimited so current paid members
-- keep their previous "included" behaviour until an admin sets an explicit cap.
-- Access plans default to 0 (always chargeable), matching today's behaviour.

ALTER TABLE "membership_plans"
  ADD COLUMN IF NOT EXISTS "free_delegated_tasks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unlimited_free_delegated_tasks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "access_plans"
  ADD COLUMN IF NOT EXISTS "free_delegated_tasks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unlimited_free_delegated_tasks" BOOLEAN NOT NULL DEFAULT false;

-- Preserve the previous membership behaviour for plans that already exist.
UPDATE "membership_plans"
SET "unlimited_free_delegated_tasks" = true
WHERE "unlimited_free_delegated_tasks" = false
  AND "free_delegated_tasks" = 0;

-- Per-task quota snapshot + free/chargeable decision.
ALTER TABLE "affiliate_tasks"
  ADD COLUMN IF NOT EXISTS "free_delegation" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "delegation_quota_source" TEXT,
  ADD COLUMN IF NOT EXISTS "delegation_quota_limit" INTEGER,
  ADD COLUMN IF NOT EXISTS "delegation_quota_used" INTEGER,
  ADD COLUMN IF NOT EXISTS "delegation_quota_unlimited" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "delegation_quota_period_start" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "affiliate_tasks_business_id_created_at_idx"
  ON "affiliate_tasks" ("business_id", "created_at");
