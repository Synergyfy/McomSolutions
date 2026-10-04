-- Phase 2 (REMEDIATION-PLAN): DB-backed payment idempotency.
-- providerPaymentId (Stripe payment intent ID / PayPal order ID) is the cross-restart
-- idempotency key. NULLs are exempt from uniqueness in Postgres, so legacy rows
-- without a provider reference are unaffected.
--
-- Pre-deploy check (staging/prod): dedupe first —
--   SELECT "providerPaymentId", COUNT(*) FROM "BillingTransaction"
--   WHERE "providerPaymentId" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
-- Any rows returned must be reconciled (keep the 'paid' row) before this applies.

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BillingTransaction_providerPaymentId_key" ON "BillingTransaction"("providerPaymentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BillingTransaction_businessId_status_idx" ON "BillingTransaction"("businessId", "status");
