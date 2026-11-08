-- Customers get the same postcode-derived geographic hierarchy as businesses
-- and affiliates: City → Borough → High Street → Local Mall.
-- Additive and safe: all new columns are nullable.

ALTER TABLE "customer_profiles"
  ADD COLUMN "city_id" TEXT,
  ADD COLUMN "borough_id" TEXT,
  ADD COLUMN "high_street_id" TEXT,
  ADD COLUMN "local_mall_id" TEXT,
  ADD COLUMN "location_assigned_at" TIMESTAMP(3);

-- Indexes
CREATE INDEX "customer_profiles_city_id_idx" ON "customer_profiles"("city_id");
CREATE INDEX "customer_profiles_borough_id_idx" ON "customer_profiles"("borough_id");
CREATE INDEX "customer_profiles_high_street_id_idx" ON "customer_profiles"("high_street_id");
CREATE INDEX "customer_profiles_local_mall_id_idx" ON "customer_profiles"("local_mall_id");

-- Foreign keys
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_local_mall_id_fkey" FOREIGN KEY ("local_mall_id") REFERENCES "local_malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
