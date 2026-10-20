-- Coupons: admin-generated codes, task-reward coupons, reservations and ledger.
-- Additive migration — existing membership/payment/task data is untouched.

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponDiscountType') THEN
    CREATE TYPE "CouponDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponSource') THEN
    CREATE TYPE "CouponSource" AS ENUM ('ADMIN', 'TASK_REWARD');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CouponRedemptionStatus') THEN
    CREATE TYPE "CouponRedemptionStatus" AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');
  END IF;
END $$;

-- ─── Task reward configuration ─────────────────────────────────────────────
ALTER TABLE "task_definitions"
  ADD COLUMN IF NOT EXISTS "reward_coupon_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reward_coupon_discount_type" "CouponDiscountType",
  ADD COLUMN IF NOT EXISTS "reward_coupon_value" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "reward_coupon_applies_to_all" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reward_coupon_valid_days" INTEGER,
  ADD COLUMN IF NOT EXISTS "reward_coupon_expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "task_definitions_reward_coupon_enabled_idx"
  ON "task_definitions"("reward_coupon_enabled");

-- ─── Coupons ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coupons" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "discount_type" "CouponDiscountType" NOT NULL,
  "discount_value" DOUBLE PRECISION NOT NULL,
  "applies_to_all_memberships" BOOLEAN NOT NULL DEFAULT true,
  "max_uses" INTEGER,
  "max_uses_per_user" INTEGER DEFAULT 1,
  "times_redeemed" INTEGER NOT NULL DEFAULT 0,
  "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "source" "CouponSource" NOT NULL DEFAULT 'ADMIN',
  "locked_to_user_id" TEXT,
  "task_definition_id" TEXT,
  "task_assignment_id" TEXT,
  "created_by_name" TEXT,
  "email_sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_task_assignment_id_key" ON "coupons"("task_assignment_id");
CREATE INDEX IF NOT EXISTS "coupons_is_active_valid_from_expires_at_idx"
  ON "coupons"("is_active", "valid_from", "expires_at");
CREATE INDEX IF NOT EXISTS "coupons_source_idx" ON "coupons"("source");
CREATE INDEX IF NOT EXISTS "coupons_locked_to_user_id_idx" ON "coupons"("locked_to_user_id");
CREATE INDEX IF NOT EXISTS "coupons_task_definition_id_idx" ON "coupons"("task_definition_id");

ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_locked_to_user_id_fkey";
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_task_definition_id_fkey";
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_task_assignment_id_fkey";
ALTER TABLE "coupons"
  ADD CONSTRAINT "coupons_locked_to_user_id_fkey"
    FOREIGN KEY ("locked_to_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "coupons_task_definition_id_fkey"
    FOREIGN KEY ("task_definition_id") REFERENCES "task_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "coupons_task_assignment_id_fkey"
    FOREIGN KEY ("task_assignment_id") REFERENCES "user_task_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Coupon ↔ membership plan scope ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "coupon_membership_plans" (
  "coupon_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  CONSTRAINT "coupon_membership_plans_pkey" PRIMARY KEY ("coupon_id", "plan_id")
);

CREATE INDEX IF NOT EXISTS "coupon_membership_plans_plan_id_idx"
  ON "coupon_membership_plans"("plan_id");

ALTER TABLE "coupon_membership_plans" DROP CONSTRAINT IF EXISTS "coupon_membership_plans_coupon_id_fkey";
ALTER TABLE "coupon_membership_plans" DROP CONSTRAINT IF EXISTS "coupon_membership_plans_plan_id_fkey";
ALTER TABLE "coupon_membership_plans"
  ADD CONSTRAINT "coupon_membership_plans_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_membership_plans_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Redemption ledger / payment reservations ──────────────────────────────
CREATE TABLE IF NOT EXISTS "coupon_redemptions" (
  "id" TEXT NOT NULL,
  "coupon_id" TEXT NOT NULL,
  "coupon_code" TEXT NOT NULL,
  "user_id" TEXT,
  "business_id" TEXT,
  "plan_id" TEXT,
  "plan_name" TEXT,
  "billing_transaction_id" TEXT,
  "provider" TEXT,
  "provider_payment_id" TEXT,
  "original_amount" DOUBLE PRECISION NOT NULL,
  "discount_amount" DOUBLE PRECISION NOT NULL,
  "final_amount" DOUBLE PRECISION NOT NULL,
  "status" "CouponRedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "reserved_until" TIMESTAMP(3),
  "redeemed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "coupon_redemptions_billing_transaction_id_key"
  ON "coupon_redemptions"("billing_transaction_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_coupon_id_status_reserved_until_idx"
  ON "coupon_redemptions"("coupon_id", "status", "reserved_until");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_user_id_coupon_id_status_idx"
  ON "coupon_redemptions"("user_id", "coupon_id", "status");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_status_reserved_until_idx"
  ON "coupon_redemptions"("status", "reserved_until");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_business_id_idx"
  ON "coupon_redemptions"("business_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_plan_id_idx"
  ON "coupon_redemptions"("plan_id");
CREATE INDEX IF NOT EXISTS "coupon_redemptions_redeemed_at_idx"
  ON "coupon_redemptions"("redeemed_at");

ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_coupon_id_fkey";
ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_user_id_fkey";
ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_business_id_fkey";
ALTER TABLE "coupon_redemptions" DROP CONSTRAINT IF EXISTS "coupon_redemptions_plan_id_fkey";
ALTER TABLE "coupon_redemptions"
  ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_redemptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_redemptions_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "coupon_redemptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Task reward plan scope ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "task_reward_coupon_plans" (
  "task_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  CONSTRAINT "task_reward_coupon_plans_pkey" PRIMARY KEY ("task_id", "plan_id")
);

CREATE INDEX IF NOT EXISTS "task_reward_coupon_plans_plan_id_idx"
  ON "task_reward_coupon_plans"("plan_id");

ALTER TABLE "task_reward_coupon_plans" DROP CONSTRAINT IF EXISTS "task_reward_coupon_plans_task_id_fkey";
ALTER TABLE "task_reward_coupon_plans" DROP CONSTRAINT IF EXISTS "task_reward_coupon_plans_plan_id_fkey";
ALTER TABLE "task_reward_coupon_plans"
  ADD CONSTRAINT "task_reward_coupon_plans_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "task_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "task_reward_coupon_plans_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
