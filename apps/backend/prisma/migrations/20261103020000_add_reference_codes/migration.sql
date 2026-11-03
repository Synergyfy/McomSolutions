-- Stable ONS GSS codes for imported administrative areas and OSM identity for
-- imported local malls. Additive and safe: all columns are nullable/defaulted.

ALTER TABLE "cities" ADD COLUMN "gss_code" TEXT;
ALTER TABLE "boroughs" ADD COLUMN "gss_code" TEXT;
ALTER TABLE "high_streets" ADD COLUMN "gss_code" TEXT;

ALTER TABLE "local_malls"
  ADD COLUMN "osm_id" TEXT,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX "cities_gss_code_key" ON "cities"("gss_code");
CREATE UNIQUE INDEX "boroughs_gss_code_key" ON "boroughs"("gss_code");
CREATE UNIQUE INDEX "high_streets_gss_code_key" ON "high_streets"("gss_code");
CREATE UNIQUE INDEX "local_malls_osm_id_key" ON "local_malls"("osm_id");
