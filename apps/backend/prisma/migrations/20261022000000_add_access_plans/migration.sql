-- Access plans: one-time, fixed-duration platform passes.
-- Additive migration — memberships, coupons and tasks keep their current
-- behaviour because every new scope flag defaults to "off" for access.

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponProductType') THEN
    CREATE TYPE "CouponProductType" AS ENUM ('MEMBERSHIP', 'ACCESS');
  END IF;
END $$;

-- ─── Access plans ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "access_plans" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DOUBLE PRECISION NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "platform_access" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "who_it_is_for" TEXT,
  "badge" TEXT,
  "color" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "access_plans_archived_idx" ON "access_plans"("archived");
CREATE INDEX IF NOT EXISTS "access_plans_deleted_at_idx" ON "access_plans"("deleted_at");

CREATE TABLE IF NOT EXISTS "access_plan_app_bundles" (
  "id" TEXT NOT NULL,
  "access_plan_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "external_plan_id" TEXT,
  "package_name" TEXT NOT NULL,
  "variant_tier" "PlanTier",
  "limits" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_plan_app_bundles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "access_plan_app_bundles_access_plan_id_idx"
  ON "access_plan_app_bundles"("access_plan_id");
CREATE INDEX IF NOT EXISTS "access_plan_app_bundles_platform_idx"
  ON "access_plan_app_bundles"("platform");

ALTER TABLE "access_plan_app_bundles" DROP CONSTRAINT IF EXISTS "access_plan_app_bundles_access_plan_id_fkey";
ALTER TABLE "access_plan_app_bundles"
  ADD CONSTRAINT "access_plan_app_bundles_access_plan_id_fkey"
    FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "access_purchases" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "access_plan_id" TEXT NOT NULL,
  "access_plan_name" TEXT NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "provider" TEXT,
  "provider_payment_id" TEXT,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "access_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "access_purchases_provider_payment_id_key"
  ON "access_purchases"("provider_payment_id");
CREATE INDEX IF NOT EXISTS "access_purchases_business_id_status_expires_at_idx"
  ON "access_purchases"("business_id", "status", "expires_at");
CREATE INDEX IF NOT EXISTS "access_purchases_access_plan_id_idx"
  ON "access_purchases"("access_plan_id");

ALTER TABLE "access_purchases" DROP CONSTRAINT IF EXISTS "access_purchases_business_id_fkey";
ALTER TABLE "access_purchases" DROP CONSTRAINT IF EXISTS "access_purchases_access_plan_id_fkey";
ALTER TABLE "access_purchases"
  ADD CONSTRAINT "access_purchases_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "access_purchases_access_plan_id_fkey"
    FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Coupon access scope ───────────────────────────────────────────────────
ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "applies_to_all_access" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "coupon_access_plans" (
  "coupon_id" TEXT NOT NULL,
  "access_plan_id" TEXT NOT NULL,
  CONSTRAINT "coupon_access_plans_pkey" PRIMARY KEY ("coupon_id", "access_plan_id")
);

CREATE INDEX IF NOT EXISTS "coupon_access_plans_access_plan_id_idx"
  ON "coupon_access_plans"("access_plan_id");

ALTER TABLE "coupon_access_plans" DROP CONSTRAINT IF EXISTS "coupon_access_plans_coupon_id_fkey";
ALTER TABLE "coupon_access_plans" DROP CONSTRAINT IF EXISTS "coupon_access_plans_access_plan_id_fkey";
ALTER TABLE "coupon_access_plans"
  ADD CONSTRAINT "coupon_access_plans_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_access_plans_access_plan_id_fkey"
    FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Coupon redemption product tracking ────────────────────────────────────
ALTER TABLE "coupon_redemptions"
  ADD COLUMN IF NOT EXISTS "product_type" "CouponProductType" NOT NULL DEFAULT 'MEMBERSHIP',
  ADD COLUMN IF NOT EXISTS "access_plan_id" TEXT,
  ADD COLUMN IF NOT EXISTS "access_plan_name" TEXT;

CREATE INDEX IF NOT EXISTS "coupon_redemptions_access_plan_id_idx"
  ON "coupon_redemptions"("access_plan_id");

ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_access_plan_id_fkey";
ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_access_plan_id_fkey"
    FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Task reward access scope ──────────────────────────────────────────────
ALTER TABLE "task_definitions"
  ADD COLUMN IF NOT EXISTS "reward_coupon_applies_to_all_access" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "task_reward_coupon_access_plans" (
  "task_id" TEXT NOT NULL,
  "access_plan_id" TEXT NOT NULL,
  CONSTRAINT "task_reward_coupon_access_plans_pkey" PRIMARY KEY ("task_id", "access_plan_id")
);

CREATE INDEX IF NOT EXISTS "task_reward_coupon_access_plans_access_plan_id_idx"
  ON "task_reward_coupon_access_plans"("access_plan_id");

ALTER TABLE "task_reward_coupon_access_plans" DROP CONSTRAINT IF EXISTS "task_reward_coupon_access_plans_task_id_fkey";
ALTER TABLE "task_reward_coupon_access_plans" DROP CONSTRAINT IF EXISTS "task_reward_coupon_access_plans_access_plan_id_fkey";
ALTER TABLE "task_reward_coupon_access_plans"
  ADD CONSTRAINT "task_reward_coupon_access_plans_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "task_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "task_reward_coupon_access_plans_access_plan_id_fkey"
    FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
