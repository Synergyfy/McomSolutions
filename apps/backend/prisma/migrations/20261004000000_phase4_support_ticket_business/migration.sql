-- Phase 4 (REMEDIATION-PLAN): FK-scoped support-ticket ownership.
-- Replaces `fromName` string matching with `where: { businessId }`.
-- Nullable so pre-existing rows survive; backfilled from
-- fromName → BusinessProfile (businessName or id). Unmatched rows keep
-- business_id NULL (still readable by admins) — a later migration can
-- enforce NOT NULL once staging confirms zero NULLs.

-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "business_id" TEXT;

-- Backfill (idempotent: only touches rows that are still NULL)
UPDATE "support_tickets" t
SET "business_id" = b."id"
FROM "BusinessProfile" b
WHERE t."business_id" IS NULL
  AND (t."from_name" = b."businessName" OR t."from_name" = b."id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_business_id_idx" ON "support_tickets"("business_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets"("status");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_business_id_fkey'
  ) THEN
    ALTER TABLE "support_tickets"
      ADD CONSTRAINT "support_tickets_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
