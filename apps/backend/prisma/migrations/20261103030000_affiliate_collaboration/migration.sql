-- CreateEnum
CREATE TYPE "AffiliateTaskStatus" AS ENUM ('PENDING_ASSIGNMENT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'COMPLETED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliateTaskSource" AS ENUM ('PROGRAMME', 'MANUAL');

-- CreateEnum
CREATE TYPE "AffiliateReviewDecision" AS ENUM ('APPROVED', 'CHANGES_REQUESTED');

-- CreateEnum
CREATE TYPE "AffiliateRatingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AffiliateReportStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN     "account_manager_assigned_at" TIMESTAMP(3),
ADD COLUMN     "account_manager_id" TEXT;

-- AlterTable
ALTER TABLE "account_manager_profiles" ADD COLUMN     "completed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experience_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputation_score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN     "completed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experience_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputation_score" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "consultant_profiles" ADD COLUMN     "completed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experience_score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failed_tasks_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reputation_score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "affiliate_tasks" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "source" "AffiliateTaskSource" NOT NULL DEFAULT 'MANUAL',
    "task_definition_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AffiliateTaskStatus" NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "assignee_id" TEXT,
    "assignee_role" "Role",
    "assigned_by_admin_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "affiliate_task_id" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_error" TEXT,
    "submission_data" JSONB,
    "revision_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "reputation_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_task_attachments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_name" TEXT,
    "mime_type" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_task_reviews" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "decision" "AffiliateReviewDecision" NOT NULL,
    "notes" TEXT,
    "reviewer_id" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_task_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_reputation_events" (
    "id" TEXT NOT NULL,
    "affiliate_user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_reputation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_ratings" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "affiliate_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "status" "AffiliateRatingStatus" NOT NULL DEFAULT 'APPROVED',
    "created_by_user_id" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_reports" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "affiliate_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "AffiliateReportStatus" NOT NULL DEFAULT 'PENDING',
    "admin_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reputation_applied" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "affiliate_tasks_business_id_idx" ON "affiliate_tasks"("business_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_assignee_id_idx" ON "affiliate_tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_status_idx" ON "affiliate_tasks"("status");

-- CreateIndex
CREATE INDEX "affiliate_tasks_task_definition_id_idx" ON "affiliate_tasks"("task_definition_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_affiliate_task_id_idx" ON "affiliate_tasks"("affiliate_task_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_created_at_idx" ON "affiliate_tasks"("created_at");

-- CreateIndex
CREATE INDEX "affiliate_task_attachments_task_id_idx" ON "affiliate_task_attachments"("task_id");

-- CreateIndex
CREATE INDEX "affiliate_task_reviews_task_id_idx" ON "affiliate_task_reviews"("task_id");

-- CreateIndex
CREATE INDEX "affiliate_reputation_events_affiliate_user_id_created_at_idx" ON "affiliate_reputation_events"("affiliate_user_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_ratings_affiliate_user_id_idx" ON "affiliate_ratings"("affiliate_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_ratings_business_id_affiliate_user_id_key" ON "affiliate_ratings"("business_id", "affiliate_user_id");

-- CreateIndex
CREATE INDEX "affiliate_reports_business_id_idx" ON "affiliate_reports"("business_id");

-- CreateIndex
CREATE INDEX "affiliate_reports_affiliate_user_id_idx" ON "affiliate_reports"("affiliate_user_id");

-- CreateIndex
CREATE INDEX "affiliate_reports_status_idx" ON "affiliate_reports"("status");

-- CreateIndex
CREATE INDEX "BusinessProfile_account_manager_id_idx" ON "BusinessProfile"("account_manager_id");

-- AddForeignKey
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_task_definition_id_fkey" FOREIGN KEY ("task_definition_id") REFERENCES "task_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_assigned_by_admin_id_fkey" FOREIGN KEY ("assigned_by_admin_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_task_attachments" ADD CONSTRAINT "affiliate_task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "affiliate_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_task_reviews" ADD CONSTRAINT "affiliate_task_reviews_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "affiliate_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_task_reviews" ADD CONSTRAINT "affiliate_task_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reputation_events" ADD CONSTRAINT "affiliate_reputation_events_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ratings" ADD CONSTRAINT "affiliate_ratings_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reports" ADD CONSTRAINT "affiliate_reports_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reports" ADD CONSTRAINT "affiliate_reports_affiliate_user_id_fkey" FOREIGN KEY ("affiliate_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reports" ADD CONSTRAINT "affiliate_reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

