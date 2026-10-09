-- Relational membership tiers & flexible payment options.
-- Replaces the tier_* JSON blobs on membership_plans with queryable rows.
-- ADDITIVE ONLY: no ALTER/DROP on existing tables, no data deletion.
-- Every statement is re-runnable (IF NOT EXISTS / ON CONFLICT DO NOTHING),
-- so `migrate deploy` retries and re-runs are safe.

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanTier') THEN
    CREATE TYPE "PlanTier" AS ENUM ('Standard', 'Pro', 'Pro+');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembershipPaymentPlan') THEN
    CREATE TYPE "MembershipPaymentPlan" AS ENUM ('full', 'monthly', 'quarterly', 'half_yearly');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentPriceMode') THEN
    CREATE TYPE "PaymentPriceMode" AS ENUM ('manual', 'auto');
  END IF;
END $$;

-- ─── Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "membership_plan_tiers" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "tier" "PlanTier" NOT NULL,
  "duration_days" INTEGER NOT NULL,
  "full_price" DOUBLE PRECISION NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "membership_plan_tiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_payment_options" (
  "id" TEXT NOT NULL,
  "tier_id" TEXT NOT NULL,
  "payment_plan" "MembershipPaymentPlan" NOT NULL,
  "installments" INTEGER NOT NULL,
  "mode" "PaymentPriceMode" NOT NULL,
  "manual_price" DOUBLE PRECISION,
  "surcharge_pct" DOUBLE PRECISION,
  "per_charge_price" DOUBLE PRECISION NOT NULL,
  "total_price" DOUBLE PRECISION NOT NULL,
  "slice_days" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "stripe_price_id" TEXT,
  "paypal_plan_id" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "membership_payment_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_tier_features" (
  "id" TEXT NOT NULL,
  "tier_id" TEXT NOT NULL,
  "feature" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "membership_tier_features_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_tier_entitlements" (
  "id" TEXT NOT NULL,
  "tier_id" TEXT NOT NULL,
  "resource_key" TEXT NOT NULL,
  "quota_value" TEXT NOT NULL,
  CONSTRAINT "membership_tier_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_plan_app_bundles" (
  "id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "external_plan_id" TEXT,
  "package_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "membership_plan_app_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "membership_installment_subscriptions" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "tier_id" TEXT NOT NULL,
  "payment_option_id" TEXT NOT NULL,
  "installments_total" INTEGER NOT NULL,
  "installments_paid" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'active',
  "stripe_subscription_id" TEXT,
  "paypal_subscription_id" TEXT,
  "current_period_end" TIMESTAMP(3),
  "next_due_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "membership_installment_subscriptions_pkey" PRIMARY KEY ("id")
);

-- ─── Foreign keys (IF NOT EXISTS-guarded) ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_plan_tiers_plan_id_fkey') THEN
    ALTER TABLE "membership_plan_tiers" ADD CONSTRAINT "membership_plan_tiers_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_payment_options_tier_id_fkey') THEN
    ALTER TABLE "membership_payment_options" ADD CONSTRAINT "membership_payment_options_tier_id_fkey"
      FOREIGN KEY ("tier_id") REFERENCES "membership_plan_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_tier_features_tier_id_fkey') THEN
    ALTER TABLE "membership_tier_features" ADD CONSTRAINT "membership_tier_features_tier_id_fkey"
      FOREIGN KEY ("tier_id") REFERENCES "membership_plan_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_tier_entitlements_tier_id_fkey') THEN
    ALTER TABLE "membership_tier_entitlements" ADD CONSTRAINT "membership_tier_entitlements_tier_id_fkey"
      FOREIGN KEY ("tier_id") REFERENCES "membership_plan_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_plan_app_bundles_plan_id_fkey') THEN
    ALTER TABLE "membership_plan_app_bundles" ADD CONSTRAINT "membership_plan_app_bundles_plan_id_fkey"
      FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_installment_subscriptions_payment_option_id_fkey') THEN
    ALTER TABLE "membership_installment_subscriptions" ADD CONSTRAINT "membership_installment_subscriptions_payment_option_id_fkey"
      FOREIGN KEY ("payment_option_id") REFERENCES "membership_payment_options"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- ─── Unique constraints & indexes (IF NOT EXISTS-guarded) ────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_plan_tiers_plan_id_tier_key') THEN
    ALTER TABLE "membership_plan_tiers" ADD CONSTRAINT "membership_plan_tiers_plan_id_tier_key" UNIQUE ("plan_id", "tier");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_payment_options_tier_id_payment_plan_key') THEN
    ALTER TABLE "membership_payment_options" ADD CONSTRAINT "membership_payment_options_tier_id_payment_plan_key" UNIQUE ("tier_id", "payment_plan");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_tier_features_tier_id_sort_order_key') THEN
    ALTER TABLE "membership_tier_features" ADD CONSTRAINT "membership_tier_features_tier_id_sort_order_key" UNIQUE ("tier_id", "sort_order");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_tier_entitlements_tier_id_resource_key_key') THEN
    ALTER TABLE "membership_tier_entitlements" ADD CONSTRAINT "membership_tier_entitlements_tier_id_resource_key_key" UNIQUE ("tier_id", "resource_key");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_installment_subscriptions_stripe_subscription_id_key') THEN
    ALTER TABLE "membership_installment_subscriptions" ADD CONSTRAINT "membership_installment_subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'membership_installment_subscriptions_paypal_subscription_id_key') THEN
    ALTER TABLE "membership_installment_subscriptions" ADD CONSTRAINT "membership_installment_subscriptions_paypal_subscription_id_key" UNIQUE ("paypal_subscription_id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_plan_tiers_plan_id_idx') THEN
    CREATE INDEX "membership_plan_tiers_plan_id_idx" ON "membership_plan_tiers"("plan_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_payment_options_tier_id_is_active_idx') THEN
    CREATE INDEX "membership_payment_options_tier_id_is_active_idx" ON "membership_payment_options"("tier_id", "is_active");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_tier_features_tier_id_idx') THEN
    CREATE INDEX "membership_tier_features_tier_id_idx" ON "membership_tier_features"("tier_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_tier_entitlements_tier_id_idx') THEN
    CREATE INDEX "membership_tier_entitlements_tier_id_idx" ON "membership_tier_entitlements"("tier_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_plan_app_bundles_plan_id_idx') THEN
    CREATE INDEX "membership_plan_app_bundles_plan_id_idx" ON "membership_plan_app_bundles"("plan_id");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_plan_app_bundles_platform_idx') THEN
    CREATE INDEX "membership_plan_app_bundles_platform_idx" ON "membership_plan_app_bundles"("platform");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_installment_subscriptions_business_id_status_idx') THEN
    CREATE INDEX "membership_installment_subscriptions_business_id_status_idx" ON "membership_installment_subscriptions"("business_id", "status");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'membership_installment_subscriptions_status_next_due_at_idx') THEN
    CREATE INDEX "membership_installment_subscriptions_status_next_due_at_idx" ON "membership_installment_subscriptions"("status", "next_due_at");
  END IF;
END $$;

-- ─── Backfill: JSON → relational (idempotent) ─────────────────────────────
-- Deterministic IDs (plan.id + suffix) + ON CONFLICT DO NOTHING, so re-runs
-- never duplicate rows and never touch existing data. Price precedence mirrors
-- PricingService.resolveMembershipPrice: explicit tierPrices → legacy
-- monthly/quarterly/annual columns → multiplier fallbacks.

-- 1. Tiers (Standard 90d / Pro 180d / Pro+ 365d)
INSERT INTO "membership_plan_tiers"
  ("id", "plan_id", "tier", "duration_days", "full_price", "sort_order", "updated_at")
SELECT
  mp."id" || '__std', mp."id", 'Standard'::"PlanTier",
  COALESCE(
    CASE WHEN (mp."tier_durations"->>'Standard') ~ '^[0-9]+$' THEN (mp."tier_durations"->>'Standard')::int END,
    CASE WHEN (mp."tier_durations"->>'Normal') ~ '^[0-9]+$' THEN (mp."tier_durations"->>'Normal')::int END,
    90),
  COALESCE(
    CASE WHEN (mp."tier_prices"->>'Standard') ~ '^[0-9]+(\.[0-9]+)?$' THEN (mp."tier_prices"->>'Standard')::double precision END,
    CASE WHEN (mp."tier_prices"->>'Normal') ~ '^[0-9]+(\.[0-9]+)?$' THEN (mp."tier_prices"->>'Normal')::double precision END,
    mp."monthly_price", mp."price"),
  0, CURRENT_TIMESTAMP
FROM "membership_plans" mp WHERE mp."deleted_at" IS NULL
ON CONFLICT ("plan_id", "tier") DO NOTHING;

INSERT INTO "membership_plan_tiers"
  ("id", "plan_id", "tier", "duration_days", "full_price", "sort_order", "updated_at")
SELECT
  mp."id" || '__pro', mp."id", 'Pro'::"PlanTier",
  COALESCE(
    CASE WHEN (mp."tier_durations"->>'Pro') ~ '^[0-9]+$' THEN (mp."tier_durations"->>'Pro')::int END,
    180),
  COALESCE(
    CASE WHEN (mp."tier_prices"->>'Pro') ~ '^[0-9]+(\.[0-9]+)?$' THEN (mp."tier_prices"->>'Pro')::double precision END,
    FLOOR(COALESCE(mp."monthly_price", mp."price") * 6 * 0.85)),
  1, CURRENT_TIMESTAMP
FROM "membership_plans" mp WHERE mp."deleted_at" IS NULL
ON CONFLICT ("plan_id", "tier") DO NOTHING;

INSERT INTO "membership_plan_tiers"
  ("id", "plan_id", "tier", "duration_days", "full_price", "sort_order", "updated_at")
SELECT
  mp."id" || '__proplus', mp."id", 'Pro+'::"PlanTier",
  COALESCE(
    CASE WHEN (mp."tier_durations"->>'Pro+') ~ '^[0-9]+$' THEN (mp."tier_durations"->>'Pro+')::int END,
    CASE WHEN (mp."tier_durations"->>'ProPlus') ~ '^[0-9]+$' THEN (mp."tier_durations"->>'ProPlus')::int END,
    365),
  COALESCE(
    CASE WHEN (mp."tier_prices"->>'Pro+') ~ '^[0-9]+(\.[0-9]+)?$' THEN (mp."tier_prices"->>'Pro+')::double precision END,
    CASE WHEN (mp."tier_prices"->>'ProPlus') ~ '^[0-9]+(\.[0-9]+)?$' THEN (mp."tier_prices"->>'ProPlus')::double precision END,
    mp."annual_price",
    FLOOR(COALESCE(mp."monthly_price", mp."price") * 0.8) * 12),
  2, CURRENT_TIMESTAMP
FROM "membership_plans" mp WHERE mp."deleted_at" IS NULL
ON CONFLICT ("plan_id", "tier") DO NOTHING;

-- 2. Payment options: full (manual, 1 installment) for every tier
INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__full', t."id", 'full'::"MembershipPaymentPlan", 1, 'manual'::"PaymentPriceMode",
  t."full_price", NULL, t."full_price", t."full_price", t."duration_days", true, 0, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

-- 3. Splits (auto, 0% surcharge until admin configures): Standard monthly×3,
--    Pro quarterly×2 + monthly×6, Pro+ half-yearly×2 + quarterly×4 + monthly×12
INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__monthly', t."id", 'monthly'::"MembershipPaymentPlan", 3, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 3)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 3)::numeric, 2) * 3)::numeric, 2)::double precision,
  30, true, 1, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Standard'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__quarterly', t."id", 'quarterly'::"MembershipPaymentPlan", 2, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 2)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 2)::numeric, 2) * 2)::numeric, 2)::double precision,
  90, true, 1, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Pro'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__monthly', t."id", 'monthly'::"MembershipPaymentPlan", 6, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 6)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 6)::numeric, 2) * 6)::numeric, 2)::double precision,
  30, true, 2, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Pro'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__half_yearly', t."id", 'half_yearly'::"MembershipPaymentPlan", 2, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 2)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 2)::numeric, 2) * 2)::numeric, 2)::double precision,
  180, true, 1, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Pro+'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__quarterly', t."id", 'quarterly'::"MembershipPaymentPlan", 4, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 4)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 4)::numeric, 2) * 4)::numeric, 2)::double precision,
  91, true, 2, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Pro+'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

INSERT INTO "membership_payment_options"
  ("id", "tier_id", "payment_plan", "installments", "mode", "manual_price",
   "surcharge_pct", "per_charge_price", "total_price", "slice_days",
   "is_active", "sort_order", "updated_at")
SELECT t."id" || '__monthly', t."id", 'monthly'::"MembershipPaymentPlan", 12, 'auto'::"PaymentPriceMode",
  NULL, 0,
  ROUND((t."full_price" / 12)::numeric, 2)::double precision,
  ROUND((ROUND((t."full_price" / 12)::numeric, 2) * 12)::numeric, 2)::double precision,
  30, true, 3, CURRENT_TIMESTAMP
FROM "membership_plan_tiers" t WHERE t."tier" = 'Pro+'::"PlanTier"
ON CONFLICT ("tier_id", "payment_plan") DO NOTHING;

-- 4. Features: explicit per-tier arrays first …
INSERT INTO "membership_tier_features" ("id", "tier_id", "feature", "sort_order")
SELECT t."id" || '__f__std__' || (e."ord"),
  t."id", e."val", (e."ord" - 1)
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(mp."tier_features" -> 'Standard') = 'array' THEN mp."tier_features" -> 'Standard'
       WHEN jsonb_typeof(mp."tier_features" -> 'Normal') = 'array' THEN mp."tier_features" -> 'Normal'
  END) WITH ORDINALITY AS e("val", "ord")
WHERE t."tier" = 'Standard'::"PlanTier" AND mp."deleted_at" IS NULL
ON CONFLICT ("tier_id", "sort_order") DO NOTHING;

INSERT INTO "membership_tier_features" ("id", "tier_id", "feature", "sort_order")
SELECT t."id" || '__f__pro__' || (e."ord"),
  t."id", e."val", (e."ord" - 1)
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(mp."tier_features" -> 'Pro') = 'array' THEN mp."tier_features" -> 'Pro'
  END) WITH ORDINALITY AS e("val", "ord")
WHERE t."tier" = 'Pro'::"PlanTier" AND mp."deleted_at" IS NULL
ON CONFLICT ("tier_id", "sort_order") DO NOTHING;

INSERT INTO "membership_tier_features" ("id", "tier_id", "feature", "sort_order")
SELECT t."id" || '__f__proplus__' || (e."ord"),
  t."id", e."val", (e."ord" - 1)
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(mp."tier_features" -> 'Pro+') = 'array' THEN mp."tier_features" -> 'Pro+'
       WHEN jsonb_typeof(mp."tier_features" -> 'ProPlus') = 'array' THEN mp."tier_features" -> 'ProPlus'
  END) WITH ORDINALITY AS e("val", "ord")
WHERE t."tier" = 'Pro+'::"PlanTier" AND mp."deleted_at" IS NULL
ON CONFLICT ("tier_id", "sort_order") DO NOTHING;

-- … then fall back to the plan-level features list for tiers left empty
-- (mirrors PricingService.getPlans fallback: every tier inherits features).
INSERT INTO "membership_tier_features" ("id", "tier_id", "feature", "sort_order")
SELECT t."id" || '__f__base__' || (e."ord"),
  t."id", e."val", (e."ord" - 1)
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL unnest(mp."features") WITH ORDINALITY AS e("val", "ord")
WHERE mp."deleted_at" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "membership_tier_features" f WHERE f."tier_id" = t."id")
ON CONFLICT ("tier_id", "sort_order") DO NOTHING;

-- 5. Entitlements: one row per (tier, resource), tier-specific quota value
INSERT INTO "membership_tier_entitlements" ("id", "tier_id", "resource_key", "quota_value")
SELECT t."id" || '__ent__' || "key", t."id", "key", "val"
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL (
  SELECT COALESCE(e."elem"->>'resourceKey', e."elem"->>'name') AS "key",
         COALESCE(e."elem"->>'standard', e."elem"->>'Normal') AS "val"
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(mp."tier_entitlements") = 'array' THEN mp."tier_entitlements" ELSE '[]'::jsonb END
  ) AS e("elem")
) s
WHERE t."tier" = 'Standard'::"PlanTier" AND mp."deleted_at" IS NULL
  AND "key" IS NOT NULL AND "val" IS NOT NULL
ON CONFLICT ("tier_id", "resource_key") DO NOTHING;

INSERT INTO "membership_tier_entitlements" ("id", "tier_id", "resource_key", "quota_value")
SELECT t."id" || '__ent__' || "key", t."id", "key", "val"
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL (
  SELECT COALESCE(e."elem"->>'resourceKey', e."elem"->>'name') AS "key",
         COALESCE(e."elem"->>'pro', e."elem"->>'Pro', e."elem"->>'standard', e."elem"->>'Normal') AS "val"
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(mp."tier_entitlements") = 'array' THEN mp."tier_entitlements" ELSE '[]'::jsonb END
  ) AS e("elem")
) s
WHERE t."tier" = 'Pro'::"PlanTier" AND mp."deleted_at" IS NULL
  AND "key" IS NOT NULL AND "val" IS NOT NULL
ON CONFLICT ("tier_id", "resource_key") DO NOTHING;

INSERT INTO "membership_tier_entitlements" ("id", "tier_id", "resource_key", "quota_value")
SELECT t."id" || '__ent__' || "key", t."id", "key", "val"
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL (
  SELECT COALESCE(e."elem"->>'resourceKey', e."elem"->>'name') AS "key",
         COALESCE(e."elem"->>'proPlus', e."elem"->>'proplus', e."elem"->>'pro', e."elem"->>'Pro', e."elem"->>'standard', e."elem"->>'Normal') AS "val"
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(mp."tier_entitlements") = 'array' THEN mp."tier_entitlements" ELSE '[]'::jsonb END
  ) AS e("elem")
) s
WHERE t."tier" = 'Pro+'::"PlanTier" AND mp."deleted_at" IS NULL
  AND "key" IS NOT NULL AND "val" IS NOT NULL
ON CONFLICT ("tier_id", "resource_key") DO NOTHING;

-- 6. App bundles from included_apps
INSERT INTO "membership_plan_app_bundles"
  ("id", "plan_id", "platform", "external_plan_id", "package_name", "updated_at")
SELECT mp."id" || '__app__' || (e."ord"),
  mp."id",
  COALESCE(e."elem"->>'platform', e."elem"->>'platformName', 'MCOM Solutions'),
  COALESCE(e."elem"->>'planId', e."elem"->>'externalPlanId', e."elem"->>'id'),
  COALESCE(e."elem"->>'planName', e."elem"->>'name',
           e."elem"->>'platform', e."elem"->>'platformName', 'MCOM Solutions'),
  CURRENT_TIMESTAMP
FROM "membership_plans" mp
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(mp."included_apps") = 'array' THEN mp."included_apps" ELSE '[]'::jsonb END
) WITH ORDINALITY AS e("elem", "ord")
WHERE mp."deleted_at" IS NULL
ON CONFLICT ("id") DO NOTHING;
