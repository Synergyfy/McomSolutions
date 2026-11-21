-- Retire the MCOM credit currency.
--
-- The platform is GBP-only: wallets, settlements and commissions are all
-- denominated in pounds sterling. There is no conversion layer any more, so
-- this migration is only safe when every historical amount was already 1:1.
-- The DO block below refuses to run otherwise — a silent 1:1 rewrite of money
-- bought at another rate would be a financial error, not a schema change.

DO $$
DECLARE
  bad_fx      bigint;
  bad_topups  bigint;
BEGIN
  SELECT count(*) INTO bad_fx
  FROM fx_rates
  WHERE base = 'GBP' AND quote = 'MCOM' AND rate <> 1;

  IF bad_fx > 0 THEN
    RAISE EXCEPTION
      'Cannot retire MCOM: % GBP->MCOM FxRate rows are not 1:1. Reconcile those rates before migrating.',
      bad_fx;
  END IF;

  SELECT count(*) INTO bad_topups
  FROM wallet_top_up_requests
  WHERE exchange_rate IS NOT NULL
    AND round(amount * exchange_rate, 4) <> round(amount, 4);

  IF bad_topups > 0 THEN
    RAISE EXCEPTION
      'Cannot retire MCOM: % wallet top-ups were converted at a non-1 rate. Reconcile them before migrating.',
      bad_topups;
  END IF;
END $$;

-- Currency labels
UPDATE wallets
   SET currency = 'GBP'
 WHERE currency = 'MCOM';

UPDATE wallet_transactions
   SET currency = 'GBP'
 WHERE currency = 'MCOM';

UPDATE wallet_top_up_requests
   SET wallet_currency = 'GBP',
       exchange_rate   = 1
 WHERE wallet_currency = 'MCOM'
    OR exchange_rate <> 1;

-- Settlement FX snapshot: the columns stay for audit history, pinned at 1:1.
UPDATE affiliate_task_settlements
   SET fx_base  = 'GBP',
       fx_quote = 'GBP',
       fx_rate  = 1
 WHERE fx_quote = 'MCOM'
    OR fx_rate <> 1;

-- Referral commissions: commission_credits is the wallet amount, which is now
-- simply the GBP commission.
UPDATE referral_commissions
   SET commission_credits = commission_amount_gbp,
       fx_rate            = 1
 WHERE commission_amount_gbp <> 0
   AND commission_credits <> commission_amount_gbp;

-- Defaults for freshly created rows.
ALTER TABLE wallets
  ALTER COLUMN currency SET DEFAULT 'GBP';

ALTER TABLE wallet_transactions
  ALTER COLUMN currency SET DEFAULT 'GBP';

ALTER TABLE wallet_top_up_requests
  ALTER COLUMN wallet_currency SET DEFAULT 'GBP';

ALTER TABLE affiliate_task_settlements
  ALTER COLUMN fx_quote SET DEFAULT 'GBP';
