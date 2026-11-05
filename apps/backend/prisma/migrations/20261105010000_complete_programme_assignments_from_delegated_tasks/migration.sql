-- Backfill programme assignments whose delegated affiliate task already passed
-- the full review chain before the automatic completion link was introduced.
UPDATE "user_task_assignments" AS uta
SET "status" = 'COMPLETED'::"TaskAssignmentStatus",
    "completed_at" = COALESCE(uta."completed_at", at."completed_at", NOW()),
    "updated_at" = NOW()
FROM "affiliate_tasks" AS at
WHERE at."source_assignment_id" = uta."id"
  AND at."source" = 'PROGRAMME'::"AffiliateTaskSource"
  AND at."status" = 'COMPLETED'::"AffiliateTaskStatus"
  AND uta."status" <> 'COMPLETED'::"TaskAssignmentStatus";
