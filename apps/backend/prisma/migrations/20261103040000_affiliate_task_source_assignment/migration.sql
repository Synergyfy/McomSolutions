-- Link a delegated affiliate task back to the business programme assignment it
-- was pushed from, so the dashboard can show "Delegated" and block duplicates.
ALTER TABLE "affiliate_tasks" ADD COLUMN IF NOT EXISTS "source_assignment_id" TEXT;

CREATE INDEX IF NOT EXISTS "affiliate_tasks_source_assignment_id_idx"
  ON "affiliate_tasks"("source_assignment_id");
