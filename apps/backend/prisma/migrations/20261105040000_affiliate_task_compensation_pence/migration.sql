-- Exact integer compensation (GBP minor units / pence) for delegated tasks.
--
-- The admin can price membership / access-pass funded work at approval time.
-- Storing pence as an integer avoids floating-point drift; the existing
-- compensation_amount column remains as the display/back-compat value.

ALTER TABLE "affiliate_tasks"
  ADD COLUMN "compensation_pence" INTEGER;

ALTER TABLE "affiliate_task_settlements"
  ADD COLUMN "compensation_pence" INTEGER;
