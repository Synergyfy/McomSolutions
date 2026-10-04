-- G5: soft-delete columns for catalogue + programme tables.
-- Idempotent (IF NOT EXISTS) per repo migration-hardening precedent.
ALTER TABLE IF EXISTS "membership_plans" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE IF EXISTS "package_templates" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE IF EXISTS "business_programmes" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "membership_plans_deleted_at_idx" ON "membership_plans"("deleted_at");
CREATE INDEX IF NOT EXISTS "package_templates_deleted_at_idx" ON "package_templates"("deleted_at");
CREATE INDEX IF NOT EXISTS "business_programmes_deleted_at_idx" ON "business_programmes"("deleted_at");
