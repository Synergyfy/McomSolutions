-- Roles that may use a Console-registered app. Empty array means "all
-- profile-sync roles" so existing apps keep their current behaviour.
ALTER TABLE "sso_clients"
  ADD COLUMN "supported_roles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Per-role endpoint map that receives `profile.updated` events.
-- Missing / NULL = no profile synchronization for this app.
ALTER TABLE "sso_clients"
  ADD COLUMN "profile_sync_endpoints" JSONB;
