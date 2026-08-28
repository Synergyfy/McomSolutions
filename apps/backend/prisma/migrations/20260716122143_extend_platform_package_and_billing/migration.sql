-- AlterTable
ALTER TABLE "BillingTransaction" ADD COLUMN     "platformPackageId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerPaymentId" TEXT;

-- AlterTable
ALTER TABLE "PlatformPackage" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "externalPlanId" TEXT,
ADD COLUMN     "planName" TEXT,
ADD COLUMN     "planType" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "BillingTransaction_platformPackageId_idx" ON "BillingTransaction"("platformPackageId");

-- CreateIndex
CREATE INDEX "PlatformPackage_externalPlanId_idx" ON "PlatformPackage"("externalPlanId");

-- CreateIndex
CREATE INDEX "PlatformPackage_expiresAt_idx" ON "PlatformPackage"("expiresAt");
