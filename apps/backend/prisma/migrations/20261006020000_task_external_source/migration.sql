-- Task engine: external platform tasks (manual completion) + nullable feature key.
-- Idempotent (IF NOT EXISTS / duplicate_object guard) per repo migration-hardening precedent.
DO $$ BEGIN
  CREATE TYPE "TaskSource" AS ENUM ('INTERNAL', 'EXTERNAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE IF EXISTS "task_definitions" ADD COLUMN IF NOT EXISTS "task_source" "TaskSource" NOT NULL DEFAULT 'INTERNAL';
ALTER TABLE IF EXISTS "task_definitions" ADD COLUMN IF NOT EXISTS "external_client_id" TEXT;
ALTER TABLE IF EXISTS "task_definitions" ADD COLUMN IF NOT EXISTS "external_app_name" TEXT;
ALTER TABLE IF EXISTS "task_definitions" ADD COLUMN IF NOT EXISTS "external_platform_slug" TEXT;
ALTER TABLE IF EXISTS "task_definitions" ADD COLUMN IF NOT EXISTS "external_app_url" TEXT;

-- featureKey becomes optional: internal tasks set it, external tasks leave it NULL
-- (workers only auto-complete rows with a non-null, active featureKey).
ALTER TABLE IF EXISTS "task_definitions" ALTER COLUMN "feature_key" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "task_definitions_task_source_idx" ON "task_definitions"("task_source");
CREATE INDEX IF NOT EXISTS "task_definitions_external_client_id_idx" ON "task_definitions"("external_client_id");
