-- CreateEnum
CREATE TYPE "MembershipLevel" AS ENUM ('Bronze', 'Silver', 'Gold', 'Platinum');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('Free', 'Normal', 'Pro', 'Pro+');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'inactive', 'trial');

-- AlterTable
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipLevel" DROP DEFAULT;
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipLevel" TYPE "MembershipLevel" USING "membershipLevel"::text::"MembershipLevel";
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipLevel" SET DEFAULT 'Bronze';

ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipTier" DROP DEFAULT;
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipTier" TYPE "MembershipTier" USING "membershipTier"::text::"MembershipTier";
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipTier" SET DEFAULT 'Normal';

ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipStatus" DROP DEFAULT;
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipStatus" TYPE "MembershipStatus" USING "membershipStatus"::text::"MembershipStatus";
ALTER TABLE "BusinessProfile" ALTER COLUMN "membershipStatus" SET DEFAULT 'active';
