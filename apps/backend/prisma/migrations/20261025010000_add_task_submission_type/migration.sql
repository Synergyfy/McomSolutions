-- Task engine: task submission/action types under MCOM Central.
-- AUTO keeps the existing event-worker behaviour; the other values complete the
-- task when the user submits the requested proof.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskSubmissionType') THEN
    CREATE TYPE "TaskSubmissionType" AS ENUM ('AUTO', 'EXTERNAL_LINK', 'TEXT_INPUT', 'DIGIT_INPUT', 'IMAGE_UPLOAD');
  END IF;
END $$;

ALTER TABLE "task_definitions"
  ADD COLUMN IF NOT EXISTS "submission_type" "TaskSubmissionType" NOT NULL DEFAULT 'AUTO';
