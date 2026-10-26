-- Access pass bundles now inherit their duration from the source platform
-- access pass plan instead of a single admin-entered duration.
ALTER TABLE "access_plan_app_bundles" ADD COLUMN "duration_days" INTEGER;
