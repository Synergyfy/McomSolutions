-- G1: PayPal capture outbox for PayPal-success/DB-fail reconciliation.
-- Idempotent (IF NOT EXISTS) per repo migration-hardening precedent.
CREATE TABLE IF NOT EXISTS "payment_outbox" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'paypal',
  "providerPaymentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_outbox_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'payment_outbox_providerPaymentId_key'
  ) THEN
    CREATE UNIQUE INDEX "payment_outbox_providerPaymentId_key" ON "payment_outbox"("providerPaymentId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'payment_outbox_status_createdAt_idx'
  ) THEN
    CREATE INDEX "payment_outbox_status_createdAt_idx" ON "payment_outbox"("status", "createdAt");
  END IF;
END $$;
