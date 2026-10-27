-- Task engine: EXTERNAL_LINK tasks on MCOM Central point the user at an
-- admin-supplied destination link. The user opens it, then confirms completion
-- in the dashboard (proof of visit is stored in user_task_assignments.submission_data).

ALTER TABLE "task_definitions"
  ADD COLUMN IF NOT EXISTS "action_url" TEXT,
  ADD COLUMN IF NOT EXISTS "action_label" TEXT;
