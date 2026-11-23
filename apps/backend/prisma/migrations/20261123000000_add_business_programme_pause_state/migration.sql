-- User-initiated programme pause.
-- `paused_at` is set while the programme clock is frozen; `paused_seconds`
-- accumulates the total paused duration once the user resumes.
ALTER TABLE "business_programmes"
  ADD COLUMN "paused_at" TIMESTAMP(3),
  ADD COLUMN "paused_seconds" INTEGER NOT NULL DEFAULT 0;
