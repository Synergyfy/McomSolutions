-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('MEMBERSHIP', 'PACKAGE');

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "membership_expires_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN "tier_durations" JSONB,
ADD COLUMN "tier_entitlements" JSONB;

-- AlterTable
ALTER TABLE "package_templates" ADD COLUMN "tier_durations" JSONB,
ADD COLUMN "tier_entitlements" JSONB,
ADD COLUMN "tier_features" JSONB,
ADD COLUMN "tier_prices" JSONB;

-- CreateTable
CREATE TABLE "tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "duration_days" INTEGER,
    "is_annual" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "PlanType" NOT NULL DEFAULT 'MEMBERSHIP',
    "platform" TEXT,
    "description" TEXT,
    "badge" TEXT,
    "color" TEXT,
    "who_it_is_for" TEXT,
    "includedApps" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_variants" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "tier_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entitlements" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_prices" (
    "id" TEXT NOT NULL,
    "plan_variant_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "billing_interval" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "plan_variant_id" TEXT NOT NULL,
    "price_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3) NOT NULL,
    "amount_paid" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiers_name_key" ON "tiers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tiers_slug_key" ON "tiers"("slug");

-- CreateIndex
CREATE INDEX "tiers_sort_order_idx" ON "tiers"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateIndex
CREATE INDEX "plans_type_idx" ON "plans"("type");

-- CreateIndex
CREATE INDEX "plans_platform_idx" ON "plans"("platform");

-- CreateIndex
CREATE INDEX "plans_is_active_idx" ON "plans"("is_active");

-- CreateIndex
CREATE INDEX "plan_variants_plan_id_idx" ON "plan_variants"("plan_id");

-- CreateIndex
CREATE INDEX "plan_variants_tier_id_idx" ON "plan_variants"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_variants_plan_id_tier_id_key" ON "plan_variants"("plan_id", "tier_id");

-- CreateIndex
CREATE INDEX "plan_prices_plan_variant_id_idx" ON "plan_prices"("plan_variant_id");

-- CreateIndex
CREATE INDEX "plan_prices_is_active_idx" ON "plan_prices"("is_active");

-- CreateIndex
CREATE INDEX "subscriptions_business_id_idx" ON "subscriptions"("business_id");

-- CreateIndex
CREATE INDEX "subscriptions_plan_variant_id_idx" ON "subscriptions"("plan_variant_id");

-- CreateIndex
CREATE INDEX "subscriptions_price_id_idx" ON "subscriptions"("price_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- AddForeignKey
ALTER TABLE "plan_variants" ADD CONSTRAINT "plan_variants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_variants" ADD CONSTRAINT "plan_variants_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_prices" ADD CONSTRAINT "plan_prices_plan_variant_id_fkey" FOREIGN KEY ("plan_variant_id") REFERENCES "plan_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_variant_id_fkey" FOREIGN KEY ("plan_variant_id") REFERENCES "plan_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "plan_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
