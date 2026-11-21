-- One profile-sync endpoint per app (replaces the per-role JSON map).
ALTER TABLE "sso_clients"
  ADD COLUMN "profile_sync_endpoint" TEXT;

-- Preserve an existing destination if an app already had one configured.
UPDATE "sso_clients"
SET "profile_sync_endpoint" = COALESCE(
  "profile_sync_endpoints"->>'BUSINESS',
  "profile_sync_endpoints"->>'CUSTOMER',
  "profile_sync_endpoints"->>'AGENT',
  "profile_sync_endpoints"->>'CONSULTANT',
  "profile_sync_endpoints"->>'ACCOUNT_MANAGER',
  "profile_sync_endpoints"->>'PARTNER'
)
WHERE "profile_sync_endpoints" IS NOT NULL;

ALTER TABLE "sso_clients"
  DROP COLUMN "profile_sync_endpoints";
