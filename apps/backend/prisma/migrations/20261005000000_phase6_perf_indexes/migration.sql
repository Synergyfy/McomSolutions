-- Phase 6 (REMEDIATION-PLAN): performance indexes for hot filters and cron scans.
-- Additive only (CREATE INDEX IF NOT EXISTS). No new UNIQUE constraints, so no
-- pre-deploy dedupe is required. Names follow Prisma's canonical convention
-- ({table}_{columns}_idx using database column names) so `migrate diff`
-- stays empty after deploy.
--
-- NOTE: no trigram index here on purpose. Business-name substring search
-- (`contains … mode: insensitive` = ILIKE '%…%') cannot use a btree, and the
-- pg_trgm extension needs elevated privilege that would fail an unattended
-- `migrate deploy`. Apply the pg_trgm GIN index manually where permitted
-- (see task notes); otherwise the documented skip stands.

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessProfile_membership_expires_at_idx" ON "BusinessProfile"("membership_expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessProfile_localMallId_idx" ON "BusinessProfile"("localMallId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessProfile_membershipStatus_idx" ON "BusinessProfile"("membershipStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BillingTransaction_createdAt_idx" ON "BillingTransaction"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BillingTransaction_businessId_status_createdAt_idx" ON "BillingTransaction"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_business_id_status_idx" ON "subscriptions"("business_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "subscriptions_status_end_date_idx" ON "subscriptions"("status", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ecosystem_subscriptions_status_idx" ON "ecosystem_subscriptions"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ecosystem_subscriptions_status_end_date_idx" ON "ecosystem_subscriptions"("status", "end_date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_payments_status_idx" ON "admin_payments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_payments_date_idx" ON "admin_payments"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_payments_status_date_idx" ON "admin_payments"("status", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_at_idx" ON "support_tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_category_idx" ON "audit_logs"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcast_notifications_status_idx" ON "broadcast_notifications"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "revenue_records_date_idx" ON "revenue_records"("date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "membership_plans_archived_idx" ON "membership_plans"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "package_templates_archived_idx" ON "package_templates"("archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "package_templates_platform_idx" ON "package_templates"("platform");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "package_templates_platform_archived_idx" ON "package_templates"("platform", "archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wallet_holds_status_expires_at_idx" ON "wallet_holds"("status", "expires_at");
