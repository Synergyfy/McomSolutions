-- One membership-sync endpoint per app (mirrors profile_sync_endpoint).
-- Receives `membership.updated` events when a purchased membership bundles
-- this app. NULL = no membership synchronization for this app.
ALTER TABLE "sso_clients"
  ADD COLUMN "membership_sync_endpoint" TEXT;
