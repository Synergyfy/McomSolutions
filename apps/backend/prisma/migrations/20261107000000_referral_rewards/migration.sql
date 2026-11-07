-- Referral rewards: versioned configuration changelog + commission ledger.
-- Configuration rows are append-only: publishing a new version marks the
-- previous row non-current and inserts a new immutable row.

CREATE TYPE "ReferralRewardMode" AS ENUM ('SINGLE', 'PER_ROLE');
CREATE TYPE "ReferralRewardType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "ReferralCommissionFrequency" AS ENUM ('ONE_TIME', 'RECURRING');
CREATE TYPE "ReferralCommissionSourceType" AS ENUM ('MEMBERSHIP', 'ACCESS_PASS');
CREATE TYPE "ReferralCommissionStatus" AS ENUM (
  'PENDING',
  'CREDITED',
  'FAILED',
  'SKIPPED_ROLE',
  'SKIPPED_PLAN',
  'SKIPPED_ONE_TIME',
  'SKIPPED_NO_CONFIG',
  'SKIPPED_ZERO'
);

CREATE TABLE "referral_configs" (
  "id" text NOT NULL,
  "version" integer NOT NULL,
  "is_current" boolean NOT NULL DEFAULT true,
  "is_active" boolean NOT NULL DEFAULT true,
  "reward_mode" "ReferralRewardMode" NOT NULL DEFAULT 'SINGLE',
  "reward_type" "ReferralRewardType" NOT NULL DEFAULT 'PERCENTAGE',
  "percentage" numeric(7, 4),
  "fixed_amount_gbp" numeric(18, 4),
  "role_rewards" jsonb,
  "eligible_roles" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "qualify_all_memberships" boolean NOT NULL DEFAULT true,
  "qualify_all_access_passes" boolean NOT NULL DEFAULT true,
  "qualified_membership_plan_ids" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "qualified_access_plan_ids" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "commission_frequency" "ReferralCommissionFrequency" NOT NULL DEFAULT 'RECURRING',
  "note" text,
  "changes" jsonb,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "referral_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_configs_version_key" ON "referral_configs" ("version");
CREATE INDEX "referral_configs_is_current_idx" ON "referral_configs" ("is_current");
CREATE INDEX "referral_configs_created_at_idx" ON "referral_configs" ("created_at" DESC);

CREATE TABLE "referral_commissions" (
  "id" text NOT NULL,
  "referrer_user_id" text NOT NULL,
  "referred_user_id" text NOT NULL,
  "referrer_role" text NOT NULL,
  "referred_role" text NOT NULL,
  "referred_email" text,
  "referred_name" text,
  "source_type" "ReferralCommissionSourceType" NOT NULL,
  "source_id" text NOT NULL,
  "source_name" text,
  "plan_id" text,
  "purchase_amount_gbp" numeric(18, 4) NOT NULL,
  "reward_type" "ReferralRewardType" NOT NULL,
  "reward_value" numeric(18, 4) NOT NULL,
  "commission_amount_gbp" numeric(18, 4) NOT NULL DEFAULT 0,
  "fx_rate" numeric(18, 6),
  "commission_credits" numeric(18, 4) NOT NULL DEFAULT 0,
  "status" "ReferralCommissionStatus" NOT NULL,
  "wallet_transaction_id" text,
  "config_version" integer,
  "failure_reason" text,
  "idempotency_key" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "referral_commissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referral_commissions_idempotency_key_key"
  ON "referral_commissions" ("idempotency_key");
CREATE INDEX "referral_commissions_referrer_created_idx"
  ON "referral_commissions" ("referrer_user_id", "created_at" DESC);
CREATE INDEX "referral_commissions_referred_user_id_idx"
  ON "referral_commissions" ("referred_user_id");
CREATE INDEX "referral_commissions_status_idx"
  ON "referral_commissions" ("status");
CREATE INDEX "referral_commissions_source_idx"
  ON "referral_commissions" ("source_type", "source_id");
