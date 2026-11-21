-- Link every wallet leg of a charge to that charge.
--
-- A partner reference is reusable and cannot identify a payment on its own, so
-- the charge id must be recorded on the ledger entry to group an event
-- correctly. New rows carry it; this backfills the ones written before.
--
-- The charge id was already stored on the wallet receipt metadata
-- (`metadata.chargeId`) by the wallet debit, the payee credit and the refund.

UPDATE "gl_entries" e
SET "app_charge_id" = wt."metadata" ->> 'chargeId'
FROM "wallet_transactions" wt
WHERE e."wallet_transaction_id" = wt."id"
  AND e."app_charge_id" IS NULL
  AND wt."metadata" ? 'chargeId';
