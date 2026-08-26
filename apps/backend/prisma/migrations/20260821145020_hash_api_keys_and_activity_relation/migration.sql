-- AlterTable
-- Add key_hash as nullable first so existing rows can be backfilled.
ALTER TABLE "system_api_keys" ADD COLUMN "key_hash" TEXT;

-- Backfill existing rows: hash whatever is currently stored in `key`
-- (legacy rows hold full plaintext keys; new rows hold a 4-char suffix).
UPDATE "system_api_keys" SET "key_hash" = encode(sha256("key"::bytea), 'hex') WHERE "key_hash" IS NULL;

-- Truncate legacy plaintext keys to the 4-char display suffix so raw keys
-- are no longer persisted anywhere.
UPDATE "system_api_keys" SET "key" = right("key", 4) WHERE length("key") > 4;

-- Add foreign key for ActivityFeed -> HighStreet
ALTER TABLE "activity_feed" ADD CONSTRAINT "activity_feed_high_street_id_fkey" FOREIGN KEY ("high_street_id") REFERENCES "high_streets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "system_api_keys" ALTER COLUMN "key_hash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "system_api_keys_key_hash_key" ON "system_api_keys"("key_hash");