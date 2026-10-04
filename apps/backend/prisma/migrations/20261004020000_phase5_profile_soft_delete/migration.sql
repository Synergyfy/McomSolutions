-- Phase 5 (REMEDIATION-PLAN): soft deletes for affiliate profile tables.
-- Extends the User/BusinessProfile `deleted_at` pattern to CustomerProfile,
-- AgentProfile, ConsultantProfile, and AccountManagerProfile so admin user
-- removal stamps rows instead of cascade-deleting the User (audit trail
-- preserved; the soft-delete query extension hides trashed rows from reads).
-- Nullable with no backfill: existing rows read as live.

-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consultant_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "account_manager_profiles" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customer_profiles_deleted_at_idx" ON "customer_profiles"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agent_profiles_deleted_at_idx" ON "agent_profiles"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "consultant_profiles_deleted_at_idx" ON "consultant_profiles"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "account_manager_profiles_deleted_at_idx" ON "account_manager_profiles"("deleted_at");
