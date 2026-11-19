-- AlterTable
ALTER TABLE "affiliate_vouchers" ADD COLUMN     "local_affiliate_id" TEXT,
ADD COLUMN     "tracking_link_code" TEXT;

-- CreateIndex
CREATE INDEX "affiliate_vouchers_local_affiliate_id_idx" ON "affiliate_vouchers"("local_affiliate_id");

