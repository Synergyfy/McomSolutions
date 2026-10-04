-- Phase 1B (REMEDIATION-PLAN): soft deletes for User + BusinessProfile.
-- DELETE /business/:id no longer cascades prisma.user.delete; it stamps deleted_at.
-- Queries filter WHERE deleted_at IS NULL (PrismaService middleware + explicit filters).
--
-- Column type TIMESTAMP(3) and snake_case index names match Prisma's canonical
-- mapping for `deletedAt DateTime? @map("deleted_at")` (verified with
-- `prisma migrate diff`: zero drift against schema.prisma).
-- IF NOT EXISTS guards tolerate pre-existing DDL from direct-db-push drift.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_deleted_at_idx" ON "User"("deleted_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BusinessProfile_deleted_at_idx" ON "BusinessProfile"("deleted_at");
