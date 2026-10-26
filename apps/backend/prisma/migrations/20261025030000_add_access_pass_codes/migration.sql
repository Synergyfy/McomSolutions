-- Paid-but-not-yet-activated access passes (gift and transferable codes).
CREATE TYPE "AccessPassCodeStatus" AS ENUM ('PENDING_PAYMENT', 'UNUSED', 'REDEEMED', 'REVOKED');

CREATE TABLE "access_pass_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "access_plan_id" TEXT NOT NULL,
  "purchaser_business_id" TEXT NOT NULL,
  "purchaser_user_id" TEXT,
  "recipient_email" TEXT,
  "mode" TEXT NOT NULL DEFAULT 'CODE',
  "status" "AccessPassCodeStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "provider" TEXT,
  "provider_payment_id" TEXT,
  "purchased_at" TIMESTAMP(3),
  "email_sent_at" TIMESTAMP(3),
  "redeemed_at" TIMESTAMP(3),
  "redeemed_by_business_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "access_pass_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_pass_codes_code_key" ON "access_pass_codes"("code");
CREATE UNIQUE INDEX "access_pass_codes_provider_payment_id_key" ON "access_pass_codes"("provider_payment_id");
CREATE INDEX "access_pass_codes_purchaser_business_id_idx" ON "access_pass_codes"("purchaser_business_id");
CREATE INDEX "access_pass_codes_recipient_email_idx" ON "access_pass_codes"("recipient_email");
CREATE INDEX "access_pass_codes_status_idx" ON "access_pass_codes"("status");

ALTER TABLE "access_pass_codes"
  ADD CONSTRAINT "access_pass_codes_access_plan_id_fkey"
  FOREIGN KEY ("access_plan_id") REFERENCES "access_plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
