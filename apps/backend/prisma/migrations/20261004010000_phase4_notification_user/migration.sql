-- Phase 4 (REMEDIATION-PLAN): user-scoped notification delivery.
-- Adds plain (non-FK) `user_id` — deleting a user must not cascade-delete
-- their notification history. Nullable: existing business/global rows keep
-- working; writers populate it for user-targeted notifications going forward.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "user_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_user_id_idx" ON "Notification"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_businessId_read_createdAt_idx" ON "Notification"("businessId", "read", "createdAt");
