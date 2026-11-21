-- The backfill labelled partner-app wallet movements as TRANSFER regardless of
-- their category, so a refund booked by a platform was indistinguishable from a
-- transfer and merged into the sale it reversed.
--
-- A refund that credited a wallet carries category REFUND on the receipt; its
-- transfer must say REFUND too.

UPDATE "gl_transfers" gt
SET "intent" = 'REFUND'
WHERE gt."intent" <> 'REFUND'
  AND EXISTS (
    SELECT 1
    FROM "gl_transactions" t
    JOIN "gl_entries" e ON e."transaction_id" = t."id"
    JOIN "wallet_transactions" wt ON wt."id" = e."wallet_transaction_id"
    WHERE t."transfer_id" = gt."id"
      AND wt."category" = 'REFUND'
  );
