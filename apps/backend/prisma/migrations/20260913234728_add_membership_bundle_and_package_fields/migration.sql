-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "membership_plan_name" TEXT;

-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "included_apps" JSONB,
ADD COLUMN     "tier_features" JSONB,
ADD COLUMN     "tier_prices" JSONB,
ADD COLUMN     "who_it_is_for" TEXT;

-- AlterTable
ALTER TABLE "package_templates" ADD COLUMN     "annual_price" DOUBLE PRECISION,
ADD COLUMN     "is_default" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthly_price" DOUBLE PRECISION,
ADD COLUMN     "quarterly_price" DOUBLE PRECISION,
ADD COLUMN     "trial_duration" INTEGER,
ADD COLUMN     "type" TEXT DEFAULT 'STANDARD';

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_category_mappings" ADD CONSTRAINT "google_category_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
