-- Reason supplied by the affiliate when declining an assigned task.
-- Displayed on the business and admin dashboards before reassignment.
ALTER TABLE "affiliate_tasks"
  ADD COLUMN "decline_reason" TEXT;
