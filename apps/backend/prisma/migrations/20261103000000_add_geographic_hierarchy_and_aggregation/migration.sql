-- Geographic hierarchy (City -> Borough -> High Street -> Local Mall) plus
-- postcode-driven business assignment and cached aggregate counters.
-- Additive and safe: existing rows keep their current data, new columns are
-- nullable or defaulted.

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "business_count" INTEGER NOT NULL DEFAULT 0,
    "last_item_created_at" TIMESTAMP(3),
    "aggregated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");
CREATE INDEX "cities_name_idx" ON "cities"("name");

-- AlterTable: boroughs
ALTER TABLE "boroughs" ADD COLUMN "city_id" TEXT;
ALTER TABLE "boroughs" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "boroughs" ADD COLUMN "aggregated_at" TIMESTAMP(3);

-- AlterTable: high_streets
ALTER TABLE "high_streets" ADD COLUMN "city_id" TEXT;
ALTER TABLE "high_streets" ADD COLUMN "borough_id" TEXT;
ALTER TABLE "high_streets" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "high_streets" ADD COLUMN "aggregated_at" TIMESTAMP(3);

-- AlterTable: local_malls
ALTER TABLE "local_malls" ADD COLUMN "city_id" TEXT;
ALTER TABLE "local_malls" ADD COLUMN "borough_id" TEXT;
ALTER TABLE "local_malls" ADD COLUMN "high_street_id" TEXT;
ALTER TABLE "local_malls" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "local_malls" ADD COLUMN "aggregated_at" TIMESTAMP(3);

-- AlterTable: BusinessProfile
ALTER TABLE "BusinessProfile" ADD COLUMN "city_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "borough_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "high_street_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "sector_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "category_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "sub_category_id" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "location_assigned_at" TIMESTAMP(3);

-- AlterTable: catalog aggregation counters
ALTER TABLE "sectors" ADD COLUMN "business_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sectors" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "sectors" ADD COLUMN "aggregated_at" TIMESTAMP(3);

ALTER TABLE "categories" ADD COLUMN "business_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "categories" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "categories" ADD COLUMN "aggregated_at" TIMESTAMP(3);

ALTER TABLE "sub_categories" ADD COLUMN "business_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sub_categories" ADD COLUMN "last_item_created_at" TIMESTAMP(3);
ALTER TABLE "sub_categories" ADD COLUMN "aggregated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "boroughs_city_id_idx" ON "boroughs"("city_id");
CREATE INDEX "high_streets_city_id_idx" ON "high_streets"("city_id");
CREATE INDEX "high_streets_borough_id_idx" ON "high_streets"("borough_id");
CREATE INDEX "local_malls_city_id_idx" ON "local_malls"("city_id");
CREATE INDEX "local_malls_borough_id_idx" ON "local_malls"("borough_id");
CREATE INDEX "local_malls_high_street_id_idx" ON "local_malls"("high_street_id");
CREATE INDEX "BusinessProfile_city_id_idx" ON "BusinessProfile"("city_id");
CREATE INDEX "BusinessProfile_borough_id_idx" ON "BusinessProfile"("borough_id");
CREATE INDEX "BusinessProfile_high_street_id_idx" ON "BusinessProfile"("high_street_id");
CREATE INDEX "BusinessProfile_sector_id_idx" ON "BusinessProfile"("sector_id");
CREATE INDEX "BusinessProfile_category_id_idx" ON "BusinessProfile"("category_id");
CREATE INDEX "BusinessProfile_sub_category_id_idx" ON "BusinessProfile"("sub_category_id");

-- AddForeignKey
ALTER TABLE "boroughs" ADD CONSTRAINT "boroughs_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "high_streets" ADD CONSTRAINT "high_streets_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "high_streets" ADD CONSTRAINT "high_streets_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_malls" ADD CONSTRAINT "local_malls_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_malls" ADD CONSTRAINT "local_malls_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "local_malls" ADD CONSTRAINT "local_malls_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
