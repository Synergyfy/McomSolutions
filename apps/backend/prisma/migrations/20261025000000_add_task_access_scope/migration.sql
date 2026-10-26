-- Task engine: per-task access scope so admins can show a task to everyone,
-- paid members only, or trial users only. Existing tasks default to ALL.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskAccessScope') THEN
    CREATE TYPE "TaskAccessScope" AS ENUM ('ALL', 'PAID', 'TRIAL');
  END IF;
END $$;

ALTER TABLE "task_definitions"
  ADD COLUMN IF NOT EXISTS "access_scope" "TaskAccessScope" NOT NULL DEFAULT 'ALL';
