-- CreateEnum
CREATE TYPE "PartnerGrantKind" AS ENUM ('MEMBERSHIP', 'ACCESS_PASS');

-- CreateEnum
CREATE TYPE "PartnerGrantStatus" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED', 'FAILED');

-- AlterTable
ALTER TABLE "BillingTransaction" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "access_pass_codes" ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "source_app" TEXT,
ALTER COLUMN "purchaser_business_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN     "expiry_event_sent_at" TIMESTAMP(3),
ADD COLUMN     "external_ref" TEXT,
ADD COLUMN     "source_app" TEXT;

-- CreateTable
CREATE TABLE "partner_grants" (
    "id" TEXT NOT NULL,
    "issuance_id" TEXT NOT NULL,
    "source_app" TEXT NOT NULL,
    "caller_client_id" TEXT NOT NULL,
    "kind" "PartnerGrantKind" NOT NULL,
    "business_id" TEXT,
    "plan_id" TEXT NOT NULL,
    "tier" TEXT,
    "duration_days" INTEGER,
    "status" "PartnerGrantStatus" NOT NULL DEFAULT 'GRANTED',
    "provider_payment_id" TEXT,
    "access_pass_code_id" TEXT,
    "expires_at" TIMESTAMP(3),
    "expiry_notified_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_audit_logs" (
    "id" TEXT NOT NULL,
    "caller_client_id" TEXT NOT NULL,
    "scope" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "issuance_id" TEXT,
    "outcome" TEXT NOT NULL,
    "status_code" INTEGER,
    "error_code" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_grants_business_id_idx" ON "partner_grants"("business_id");

-- CreateIndex
CREATE INDEX "partner_grants_status_idx" ON "partner_grants"("status");

-- CreateIndex
CREATE INDEX "partner_grants_status_expires_at_idx" ON "partner_grants"("status", "expires_at");

-- CreateIndex
CREATE INDEX "partner_grants_caller_client_id_idx" ON "partner_grants"("caller_client_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_grants_source_app_issuance_id_key" ON "partner_grants"("source_app", "issuance_id");

-- CreateIndex
CREATE INDEX "partner_audit_logs_caller_client_id_idx" ON "partner_audit_logs"("caller_client_id");

-- CreateIndex
CREATE INDEX "partner_audit_logs_issuance_id_idx" ON "partner_audit_logs"("issuance_id");

-- CreateIndex
CREATE INDEX "partner_audit_logs_created_at_idx" ON "partner_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "access_pass_codes_source_app_external_ref_key" ON "access_pass_codes"("source_app", "external_ref");

-- CreateIndex
CREATE INDEX "coupons_source_app_external_ref_idx" ON "coupons"("source_app", "external_ref");


-- ─── Data: register Central as a callable mesh peer ──────────────────────────
-- Idempotent. client_secret is random and NOT a valid bcrypt hash, so this
-- system client can never authenticate with the client-credentials grant.
INSERT INTO "sso_clients" (
  "id", "client_id", "client_secret", "name", "redirect_uris", "scopes",
  "is_active", "created_at", "updated_at", "platform_slug", "is_system_app",
  "service_enabled", "service_base_url", "service_scopes", "allowed_audiences",
  "allowed_callers", "cors_origins", "webhook_fail_count"
) VALUES (
  'sys_mcom_central', 'mcom-central',
  md5(random()::text) || md5(random()::text) || md5(random()::text),
  'MCOM Central', ARRAY[]::text[], ARRAY[]::text[],
  true, now(), now(), 'mcom-central', true,
  true, 'https://auth.mcomsolutions.com',
  ARRAY['central:read','central:issue']::text[],
  ARRAY[]::text[],
  ARRAY['mcom-rewards']::text[],
  ARRAY[]::text[], 0
)
ON CONFLICT ("client_id") DO UPDATE SET
  "name" = 'MCOM Central',
  "platform_slug" = 'mcom-central',
  "is_system_app" = true,
  "is_active" = true,
  "service_enabled" = true,
  "service_base_url" = COALESCE("sso_clients"."service_base_url", 'https://auth.mcomsolutions.com'),
  "service_scopes" = ARRAY(
    SELECT DISTINCT unnest("sso_clients"."service_scopes" || ARRAY['central:read','central:issue']::text[])
  ),
  "allowed_callers" = ARRAY(
    SELECT DISTINCT unnest("sso_clients"."allowed_callers" || ARRAY['mcom-rewards']::text[])
  ),
  "updated_at" = now();

-- Rewards must be able to mint aud=mcom-central tokens with central scopes.
UPDATE "sso_clients" SET
  "allowed_audiences" = ARRAY(
    SELECT DISTINCT unnest("allowed_audiences" || ARRAY['mcom-central']::text[])
  ),
  "service_scopes" = ARRAY(
    SELECT DISTINCT unnest("service_scopes" || ARRAY['central:read','central:issue']::text[])
  ),
  "updated_at" = now()
WHERE "client_id" = 'mcom-rewards';

-- ─── Rollback (forward-only Prisma migrations; run manually to revert) ───────
-- UPDATE "sso_clients" SET
--   "allowed_audiences" = array_remove("allowed_audiences", 'mcom-central'),
--   "service_scopes" = array_remove(array_remove("service_scopes", 'central:read'), 'central:issue')
-- WHERE "client_id" = 'mcom-rewards';
-- DELETE FROM "sso_clients" WHERE "client_id" = 'mcom-central';
-- DROP INDEX "coupons_source_app_external_ref_idx";
-- DROP INDEX "access_pass_codes_source_app_external_ref_key";
-- DROP TABLE "partner_audit_logs"; DROP TABLE "partner_grants";
-- ALTER TABLE "coupons" DROP COLUMN "source_app", DROP COLUMN "external_ref", DROP COLUMN "expiry_event_sent_at";
-- ALTER TABLE "access_pass_codes" DROP COLUMN "source_app", DROP COLUMN "external_ref";
-- ALTER TABLE "access_pass_codes" ALTER COLUMN "purchaser_business_id" SET NOT NULL;
-- ALTER TABLE "BillingTransaction" DROP COLUMN "metadata";
-- DROP TYPE "PartnerGrantStatus"; DROP TYPE "PartnerGrantKind";
