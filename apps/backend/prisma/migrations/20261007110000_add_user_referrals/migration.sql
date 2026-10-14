-- AlterTable: every user gets a shareable referral code + optional referrer (self-relation)
ALTER TABLE "User" ADD COLUMN "referral_code" TEXT;

ALTER TABLE "User" ADD COLUMN "referred_by_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_referral_code_key" ON "User"("referral_code");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referred_by_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
