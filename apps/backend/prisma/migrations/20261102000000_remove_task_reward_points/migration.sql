-- Task reward points are no longer used. Completion rewards are coupon-based.
ALTER TABLE "task_definitions" ALTER COLUMN "reward_points" SET DEFAULT 0;

-- Stop any future point payouts for existing definitions and open assignments.
UPDATE "task_definitions" SET "reward_points" = 0;
UPDATE "user_task_assignments"
SET "reward_points" = 0
WHERE "reward_granted" = false;
