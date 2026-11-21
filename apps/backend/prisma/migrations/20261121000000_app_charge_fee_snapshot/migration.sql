-- Snapshot the fee rate applied to each charge.
--
-- Fee configuration is mutable (per app, then programme setting, then env
-- default). Looking it up at read time would silently re-price history, so the
-- rate used is recorded with the charge. Existing rows stay NULL: their true
-- rate is unknown and guessing it would be worse than admitting that.

ALTER TABLE "app_charges" ADD COLUMN "fee_percent_applied" DECIMAL(5,4);
ALTER TABLE "app_charges" ADD COLUMN "fee_fixed_minor_applied" BIGINT;
