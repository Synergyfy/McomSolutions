-- CreateEnum
CREATE TYPE "TaskAudience" AS ENUM ('BUSINESS', 'CUSTOMER', 'BOTH');

-- CreateEnum
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "task_definitions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target_audience" "TaskAudience" NOT NULL DEFAULT 'BOTH',
    "feature_key" TEXT NOT NULL,
    "deadline_days" INTEGER NOT NULL DEFAULT 7,
    "reward_points" INTEGER NOT NULL DEFAULT 50,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "platform" TEXT NOT NULL DEFAULT 'mcom_central',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_task_assignments" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_type" "Role" NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "reward_granted" BOOLEAN NOT NULL DEFAULT false,
    "reward_points" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_definitions_feature_key_idx" ON "task_definitions"("feature_key");

-- CreateIndex
CREATE INDEX "task_definitions_is_active_idx" ON "task_definitions"("is_active");

-- CreateIndex
CREATE INDEX "user_task_assignments_user_id_idx" ON "user_task_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_task_assignments_task_id_idx" ON "user_task_assignments"("task_id");

-- CreateIndex
CREATE INDEX "user_task_assignments_status_idx" ON "user_task_assignments"("status");

-- CreateIndex
CREATE INDEX "user_task_assignments_deadline_at_idx" ON "user_task_assignments"("deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_task_assignments_task_id_user_id_key" ON "user_task_assignments"("task_id", "user_id");

-- AddForeignKey
ALTER TABLE "user_task_assignments" ADD CONSTRAINT "user_task_assignments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_task_assignments" ADD CONSTRAINT "user_task_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
