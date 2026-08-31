-- AlterTable
ALTER TABLE "password_reset_codes" ALTER COLUMN "user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "password_reset_codes" ADD COLUMN     "email" TEXT,
ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'PASSWORD_RESET';

-- Backfill seeded platform clients as system apps so they cannot be deactivated
-- via the Admin Console (see docs/mcom-console-plan.md §8.8 — isSystemApp guard).
UPDATE "sso_clients" SET "is_system_app" = true
WHERE "client_id" IN ('mcom-mall', 'mcom-loyalty', '247gbs');

-- CreateIndex
CREATE INDEX "password_reset_codes_email_idx" ON "password_reset_codes"("email");

-- CreateIndex
CREATE INDEX "password_reset_codes_purpose_idx" ON "password_reset_codes"("purpose");