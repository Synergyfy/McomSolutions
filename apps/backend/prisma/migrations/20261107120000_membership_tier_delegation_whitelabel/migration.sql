-- Per-variant free delegated-task allowance on membership tiers.
-- Existing plans keep their previous behaviour by copying the plan-level
-- values onto each tier row.
ALTER TABLE "membership_plan_tiers"
  ADD COLUMN "free_delegated_tasks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "unlimited_free_delegated_tasks" BOOLEAN NOT NULL DEFAULT false;

UPDATE "membership_plan_tiers" tier
SET
  "free_delegated_tasks" = plan."free_delegated_tasks",
  "unlimited_free_delegated_tasks" = plan."unlimited_free_delegated_tasks"
FROM "membership_plans" plan
WHERE tier."plan_id" = plan."id";

-- White-label platforms bundled with a membership, scoped to variants.
CREATE TABLE "membership_plan_whitelabel_accesses" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "tiers" "PlanTier"[] DEFAULT ARRAY[]::"PlanTier"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plan_whitelabel_accesses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "membership_plan_whitelabel_accesses_plan_id_idx"
  ON "membership_plan_whitelabel_accesses"("plan_id");
CREATE INDEX "membership_plan_whitelabel_accesses_client_id_idx"
  ON "membership_plan_whitelabel_accesses"("client_id");
CREATE UNIQUE INDEX "membership_plan_whitelabel_accesses_plan_id_client_id_key"
  ON "membership_plan_whitelabel_accesses"("plan_id", "client_id");

ALTER TABLE "membership_plan_whitelabel_accesses"
  ADD CONSTRAINT "membership_plan_whitelabel_accesses_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership_plan_whitelabel_accesses"
  ADD CONSTRAINT "membership_plan_whitelabel_accesses_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "sso_clients"("client_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- White-label platforms bundled with a one-time access pass.
CREATE TABLE "access_plan_whitelabel_accesses" (
    "id" TEXT NOT NULL,
    "access_plan_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_plan_whitelabel_accesses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_plan_whitelabel_accesses_access_plan_id_idx"
  ON "access_plan_whitelabel_accesses"("access_plan_id");
CREATE INDEX "access_plan_whitelabel_accesses_client_id_idx"
  ON "access_plan_whitelabel_accesses"("client_id");
CREATE UNIQUE INDEX "access_plan_whitelabel_accesses_access_plan_id_client_id_key"
  ON "access_plan_whitelabel_accesses"("access_plan_id", "client_id");

ALTER TABLE "access_plan_whitelabel_accesses"
  ADD CONSTRAINT "access_plan_whitelabel_accesses_access_plan_id_fkey"
  FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "access_plan_whitelabel_accesses"
  ADD CONSTRAINT "access_plan_whitelabel_accesses_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "sso_clients"("client_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
