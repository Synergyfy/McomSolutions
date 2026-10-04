-- Catalog `image_url` columns (REMEDIATION-PLAN migration hardening).
-- `imageUrl String? @map("image_url")` was added to Sector / Category / SubCategory
-- in schema.prisma via direct db push and never captured in a migration file —
-- staging would be missing these columns and any query selecting `imageUrl`
-- would fail. Nullable TEXT: existing rows unaffected, no backfill needed.
-- IF NOT EXISTS guards tolerate databases that already received the DDL via push.

-- AlterTable
ALTER TABLE "sectors" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

-- AlterTable
ALTER TABLE "sub_categories" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
