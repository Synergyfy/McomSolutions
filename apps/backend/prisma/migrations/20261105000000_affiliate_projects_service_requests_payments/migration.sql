-- CreateEnum
CREATE TYPE "AffiliateTaskCategory" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AffiliateCompensationModel" AS ENUM ('NONE', 'FIXED', 'HOURLY', 'COMMISSION', 'MEMBERSHIP_INCLUDED');

-- CreateEnum
CREATE TYPE "AffiliatePaymentStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'ELIGIBLE', 'PAID', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "AffiliateChargeStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING_APPROVAL', 'APPROVED', 'DECLINED', 'CHARGED', 'WAIVED');

-- CreateEnum
CREATE TYPE "AffiliateProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'AWAITING_BUSINESS_APPROVAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliateServiceRequestStatus" AS ENUM ('SUBMITTED', 'CLARIFICATION_REQUIRED', 'APPROVED', 'CONVERTED', 'COMPLETED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AffiliateTaskStatus" ADD VALUE 'PENDING_BUSINESS_APPROVAL';

-- AlterTable
ALTER TABLE "account_manager_profiles" ADD COLUMN     "availability_status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "available_from" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "affiliate_task_reviews" ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE "affiliate_tasks" ADD COLUMN     "accepted_at" TIMESTAMP(3),
ADD COLUMN     "am_review_notes" TEXT,
ADD COLUMN     "am_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "am_reviewed_by_user_id" TEXT,
ADD COLUMN     "billable_to_business" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "business_approval_notes" TEXT,
ADD COLUMN     "business_approved_at" TIMESTAMP(3),
ADD COLUMN     "business_approved_by_user_id" TEXT,
ADD COLUMN     "business_charge_amount" DOUBLE PRECISION,
ADD COLUMN     "business_charge_approved_at" TIMESTAMP(3),
ADD COLUMN     "business_charge_approved_by_user_id" TEXT,
ADD COLUMN     "business_charge_currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "business_charge_status" "AffiliateChargeStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "category" "AffiliateTaskCategory" NOT NULL DEFAULT 'EXTERNAL',
ADD COLUMN     "compensation_amount" DOUBLE PRECISION,
ADD COLUMN     "compensation_currency" TEXT NOT NULL DEFAULT 'GBP',
ADD COLUMN     "compensation_model" "AffiliateCompensationModel" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "deliverables" TEXT,
ADD COLUMN     "earnings_recorded_at" TIMESTAMP(3),
ADD COLUMN     "follow_up_notes" TEXT,
ADD COLUMN     "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "materials" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_status" "AffiliatePaymentStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "prerequisite_task_id" TEXT,
ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requires_business_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settlement_reference" TEXT;

-- AlterTable
ALTER TABLE "agent_profiles" ADD COLUMN     "availability_status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "available_from" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "consultant_profiles" ADD COLUMN     "availability_status" TEXT NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "available_from" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "affiliate_projects" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "service_request_id" TEXT,
    "account_manager_id" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objective" TEXT,
    "status" "AffiliateProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "due_at" TIMESTAMP(3),
    "requires_business_approval" BOOLEAN NOT NULL DEFAULT false,
    "business_approved_at" TIMESTAMP(3),
    "business_approved_by_user_id" TEXT,
    "closed_at" TIMESTAMP(3),
    "outcome_summary" TEXT,
    "follow_up_required" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_service_requests" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "account_manager_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "desired_outcome" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" "AffiliateServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "clarification_note" TEXT,
    "estimated_cost" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "price_approved_at" TIMESTAMP(3),
    "price_approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "closed_at" TIMESTAMP(3),
    "follow_up_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_task_events" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_role" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_projects_service_request_id_key" ON "affiliate_projects"("service_request_id");

-- CreateIndex
CREATE INDEX "affiliate_projects_business_id_idx" ON "affiliate_projects"("business_id");

-- CreateIndex
CREATE INDEX "affiliate_projects_account_manager_id_idx" ON "affiliate_projects"("account_manager_id");

-- CreateIndex
CREATE INDEX "affiliate_projects_status_idx" ON "affiliate_projects"("status");

-- CreateIndex
CREATE INDEX "affiliate_projects_created_at_idx" ON "affiliate_projects"("created_at");

-- CreateIndex
CREATE INDEX "affiliate_service_requests_business_id_idx" ON "affiliate_service_requests"("business_id");

-- CreateIndex
CREATE INDEX "affiliate_service_requests_account_manager_id_idx" ON "affiliate_service_requests"("account_manager_id");

-- CreateIndex
CREATE INDEX "affiliate_service_requests_status_idx" ON "affiliate_service_requests"("status");

-- CreateIndex
CREATE INDEX "affiliate_service_requests_created_at_idx" ON "affiliate_service_requests"("created_at");

-- CreateIndex
CREATE INDEX "affiliate_task_events_task_id_created_at_idx" ON "affiliate_task_events"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_task_events_type_idx" ON "affiliate_task_events"("type");

-- CreateIndex
CREATE INDEX "affiliate_tasks_project_id_idx" ON "affiliate_tasks"("project_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_category_idx" ON "affiliate_tasks"("category");

-- CreateIndex
CREATE INDEX "affiliate_tasks_prerequisite_task_id_idx" ON "affiliate_tasks"("prerequisite_task_id");

-- CreateIndex
CREATE INDEX "affiliate_tasks_payment_status_idx" ON "affiliate_tasks"("payment_status");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "affiliate_projects" ADD CONSTRAINT "affiliate_projects_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_projects" ADD CONSTRAINT "affiliate_projects_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "affiliate_service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_projects" ADD CONSTRAINT "affiliate_projects_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_projects" ADD CONSTRAINT "affiliate_projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_service_requests" ADD CONSTRAINT "affiliate_service_requests_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_service_requests" ADD CONSTRAINT "affiliate_service_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_service_requests" ADD CONSTRAINT "affiliate_service_requests_account_manager_id_fkey" FOREIGN KEY ("account_manager_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_task_events" ADD CONSTRAINT "affiliate_task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "affiliate_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_task_events" ADD CONSTRAINT "affiliate_task_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "affiliate_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tasks" ADD CONSTRAINT "affiliate_tasks_prerequisite_task_id_fkey" FOREIGN KEY ("prerequisite_task_id") REFERENCES "affiliate_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

