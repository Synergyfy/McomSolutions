-- AlterTable
ALTER TABLE "app_webhook_logs" ADD COLUMN     "job_id" TEXT,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "app_webhook_logs_job_id_idx" ON "app_webhook_logs"("job_id");
