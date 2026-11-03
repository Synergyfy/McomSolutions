-- Postcode capture for customers (optional) and affiliates (required by the
-- application layer), plus geographic assignment for affiliate profiles and
-- cached affiliate totals on location scopes.
-- Additive and safe: all new columns are nullable or defaulted.

-- Customer postcode (optional)
ALTER TABLE "customer_profiles" ADD COLUMN "postcode" TEXT;

-- Affiliate postcode + location assignment
ALTER TABLE "agent_profiles"
  ADD COLUMN "postcode" TEXT,
  ADD COLUMN "city_id" TEXT,
  ADD COLUMN "borough_id" TEXT,
  ADD COLUMN "high_street_id" TEXT,
  ADD COLUMN "local_mall_id" TEXT,
  ADD COLUMN "location_assigned_at" TIMESTAMP(3);

ALTER TABLE "consultant_profiles"
  ADD COLUMN "postcode" TEXT,
  ADD COLUMN "city_id" TEXT,
  ADD COLUMN "borough_id" TEXT,
  ADD COLUMN "high_street_id" TEXT,
  ADD COLUMN "local_mall_id" TEXT,
  ADD COLUMN "location_assigned_at" TIMESTAMP(3);

ALTER TABLE "account_manager_profiles"
  ADD COLUMN "postcode" TEXT,
  ADD COLUMN "city_id" TEXT,
  ADD COLUMN "borough_id" TEXT,
  ADD COLUMN "high_street_id" TEXT,
  ADD COLUMN "local_mall_id" TEXT,
  ADD COLUMN "location_assigned_at" TIMESTAMP(3);

-- Cached affiliate totals per location scope
ALTER TABLE "cities" ADD COLUMN "affiliate_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "boroughs" ADD COLUMN "affiliate_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "high_streets" ADD COLUMN "affiliate_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "local_malls" ADD COLUMN "affiliate_count" INTEGER NOT NULL DEFAULT 0;

-- Indexes
CREATE INDEX "agent_profiles_city_id_idx" ON "agent_profiles"("city_id");
CREATE INDEX "agent_profiles_borough_id_idx" ON "agent_profiles"("borough_id");
CREATE INDEX "agent_profiles_high_street_id_idx" ON "agent_profiles"("high_street_id");
CREATE INDEX "agent_profiles_local_mall_id_idx" ON "agent_profiles"("local_mall_id");

CREATE INDEX "consultant_profiles_city_id_idx" ON "consultant_profiles"("city_id");
CREATE INDEX "consultant_profiles_borough_id_idx" ON "consultant_profiles"("borough_id");
CREATE INDEX "consultant_profiles_high_street_id_idx" ON "consultant_profiles"("high_street_id");
CREATE INDEX "consultant_profiles_local_mall_id_idx" ON "consultant_profiles"("local_mall_id");

CREATE INDEX "account_manager_profiles_city_id_idx" ON "account_manager_profiles"("city_id");
CREATE INDEX "account_manager_profiles_borough_id_idx" ON "account_manager_profiles"("borough_id");
CREATE INDEX "account_manager_profiles_high_street_id_idx" ON "account_manager_profiles"("high_street_id");
CREATE INDEX "account_manager_profiles_local_mall_id_idx" ON "account_manager_profiles"("local_mall_id");

-- Foreign keys
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_local_mall_id_fkey" FOREIGN KEY ("local_mall_id") REFERENCES "local_malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_local_mall_id_fkey" FOREIGN KEY ("local_mall_id") REFERENCES "local_malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "account_manager_profiles" ADD CONSTRAINT "account_manager_profiles_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_manager_profiles" ADD CONSTRAINT "account_manager_profiles_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_manager_profiles" ADD CONSTRAINT "account_manager_profiles_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_manager_profiles" ADD CONSTRAINT "account_manager_profiles_local_mall_id_fkey" FOREIGN KEY ("local_mall_id") REFERENCES "local_malls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
