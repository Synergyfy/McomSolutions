-- CreateEnum
CREATE TYPE "ProgrammeStatus" AS ENUM ('active', 'paused', 'completed', 'extended');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('internal_platform', 'external_link', 'image_upload', 'text_input', 'digit_input');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "SupportAgentRole" AS ENUM ('agent', 'account_manager', 'consultant');

-- CreateEnum
CREATE TYPE "AssessmentFieldType" AS ENUM ('single_choice', 'multi_choice', 'text', 'textarea', 'number', 'date', 'rating', 'yes_no');

-- CreateEnum
CREATE TYPE "ActivitySeverity" AS ENUM ('info', 'success', 'warning', 'danger');

-- CreateTable
CREATE TABLE "programme_phases" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "day_start" INTEGER NOT NULL,
    "day_end" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'sky',
    "order" INTEGER NOT NULL DEFAULT 0,
    "missions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "readiness_gates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_progress_percent" INTEGER NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "readiness_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_programmes" (
    "id" TEXT NOT NULL,
    "business_id" TEXT,
    "business_name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "current_day" INTEGER NOT NULL DEFAULT 1,
    "status" "ProgrammeStatus" NOT NULL DEFAULT 'active',
    "agent_id" TEXT,
    "agent_name" TEXT NOT NULL,
    "account_manager_id" TEXT,
    "account_manager_name" TEXT NOT NULL,
    "consultant_id" TEXT,
    "consultant_name" TEXT NOT NULL,
    "completed_missions" TEXT[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extended_by" INTEGER NOT NULL DEFAULT 0,
    "phase_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_programmes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme_task_statuses" (
    "id" TEXT NOT NULL,
    "business_programme_id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'not_started',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_task_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_agents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "SupportAgentRole" NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL,
    "field_type" "AssessmentFieldType" NOT NULL,
    "options" TEXT[],
    "hint" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_feed" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "location" TEXT,
    "severity" "ActivitySeverity" NOT NULL DEFAULT 'info',
    "source" TEXT,
    "high_street_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borough_metrics" (
    "id" TEXT NOT NULL,
    "borough_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "footfall" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active_customers" INTEGER NOT NULL DEFAULT 0,
    "businesses" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borough_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'error',
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "source" TEXT,
    "path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "programme_phases_order_idx" ON "programme_phases"("order");

-- CreateIndex
CREATE INDEX "business_programmes_business_id_idx" ON "business_programmes"("business_id");

-- CreateIndex
CREATE INDEX "business_programmes_agent_id_idx" ON "business_programmes"("agent_id");

-- CreateIndex
CREATE INDEX "business_programmes_status_idx" ON "business_programmes"("status");

-- CreateIndex
CREATE INDEX "business_programmes_phase_id_idx" ON "business_programmes"("phase_id");

-- CreateIndex
CREATE INDEX "programme_task_statuses_business_programme_id_idx" ON "programme_task_statuses"("business_programme_id");

-- CreateIndex
CREATE UNIQUE INDEX "programme_task_statuses_business_programme_id_mission_id_key" ON "programme_task_statuses"("business_programme_id", "mission_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_agents_email_key" ON "support_agents"("email");

-- CreateIndex
CREATE INDEX "support_agents_role_idx" ON "support_agents"("role");

-- CreateIndex
CREATE INDEX "assessment_questions_order_idx" ON "assessment_questions"("order");

-- CreateIndex
CREATE INDEX "activity_feed_high_street_id_idx" ON "activity_feed"("high_street_id");

-- CreateIndex
CREATE INDEX "activity_feed_type_idx" ON "activity_feed"("type");

-- CreateIndex
CREATE INDEX "activity_feed_created_at_idx" ON "activity_feed"("created_at");

-- CreateIndex
CREATE INDEX "borough_metrics_borough_id_idx" ON "borough_metrics"("borough_id");

-- CreateIndex
CREATE INDEX "borough_metrics_month_idx" ON "borough_metrics"("month");

-- CreateIndex
CREATE UNIQUE INDEX "borough_metrics_borough_id_month_key" ON "borough_metrics"("borough_id", "month");

-- CreateIndex
CREATE INDEX "background_jobs_status_idx" ON "background_jobs"("status");

-- CreateIndex
CREATE INDEX "error_logs_level_idx" ON "error_logs"("level");

-- CreateIndex
CREATE INDEX "error_logs_created_at_idx" ON "error_logs"("created_at");

-- AddForeignKey
ALTER TABLE "business_programmes" ADD CONSTRAINT "business_programmes_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "programme_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme_task_statuses" ADD CONSTRAINT "programme_task_statuses_business_programme_id_fkey" FOREIGN KEY ("business_programme_id") REFERENCES "business_programmes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borough_metrics" ADD CONSTRAINT "borough_metrics_borough_id_fkey" FOREIGN KEY ("borough_id") REFERENCES "boroughs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
