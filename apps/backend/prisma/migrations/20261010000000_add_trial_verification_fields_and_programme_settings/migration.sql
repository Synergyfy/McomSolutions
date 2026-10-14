-- Reconciliation migration for schema drift.
--
-- schema.prisma declared the BusinessProfile trial/verification columns and the
-- programme_settings table, but no migration ever created them. Because the
-- Prisma Client is regenerated from schema.prisma at build time, the running
-- backend queried columns that did not exist in the database, producing generic
-- 500s (e.g. POST /api/v1/auth/register). This migration is additive for the
-- columns/table and only renames/drops objects that are unused in the schema.
--
-- Generated with:
--   prisma migrate diff --from-migrations ./prisma/migrations \
--     --to-schema-datamodel ./prisma/schema.prisma --shadow-database-url <shadow> --script

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "has_paid_verification_fee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trial_access_days" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN     "trial_access_expires_at" TIMESTAMP(3),
ADD COLUMN     "verification_fee_paid_at" TIMESTAMP(3);

-- DropEnum (no column references it; removed from schema.prisma)
DROP TYPE "PlanType";

-- CreateTable
CREATE TABLE "programme_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "programme_settings_key_key" ON "programme_settings"("key");

-- RenameForeignKey
ALTER TABLE "User" RENAME CONSTRAINT "User_referredById_fkey" TO "User_referred_by_id_fkey";

-- RenameIndex
ALTER INDEX "User_referredById_idx" RENAME TO "User_referred_by_id_idx";
