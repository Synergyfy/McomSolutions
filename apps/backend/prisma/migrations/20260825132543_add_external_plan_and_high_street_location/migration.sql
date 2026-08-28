-- AlterTable
ALTER TABLE "high_streets" ADD COLUMN     "assigned_to" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "external_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "description" TEXT,
    "monthly_price" DECIMAL(65,30),
    "quarterly_price" DECIMAL(65,30),
    "annual_price" DECIMAL(65,30),
    "features" TEXT[],
    "configuration" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "trial_duration" INTEGER,
    "season_id" TEXT,
    "stripe_monthly_price_id" TEXT,
    "stripe_quarterly_price_id" TEXT,
    "stripe_annual_price_id" TEXT,
    "paypal_monthly_plan_id" TEXT,
    "paypal_quarterly_plan_id" TEXT,
    "paypal_annual_plan_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "external_plans_platform_idx" ON "external_plans"("platform");

-- CreateIndex
CREATE INDEX "external_plans_platform_is_active_idx" ON "external_plans"("platform", "is_active");
