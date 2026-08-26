-- AlterTable
ALTER TABLE "sso_clients" ADD COLUMN     "app_url" TEXT,
ADD COLUMN     "billing_api_url" TEXT,
ADD COLUMN     "cors_origins" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "description" TEXT,
ADD COLUMN     "hmac_secret" TEXT,
ADD COLUMN     "is_system_app" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_webhook_at" TIMESTAMP(3),
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "platform_slug" TEXT,
ADD COLUMN     "webhook_fail_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "webhook_secret" TEXT,
ADD COLUMN     "webhook_url" TEXT;

-- CreateTable
CREATE TABLE "app_webhook_logs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status_code" INTEGER,
    "response_body" TEXT,
    "delivered_at" TIMESTAMP(3),
    "failed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "console_audit_logs" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "console_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_webhook_logs_client_id_idx" ON "app_webhook_logs"("client_id");

-- CreateIndex
CREATE INDEX "app_webhook_logs_created_at_idx" ON "app_webhook_logs"("created_at");

-- CreateIndex
CREATE INDEX "app_webhook_logs_client_id_created_at_idx" ON "app_webhook_logs"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "console_audit_logs_client_id_idx" ON "console_audit_logs"("client_id");

-- CreateIndex
CREATE INDEX "console_audit_logs_admin_id_idx" ON "console_audit_logs"("admin_id");

-- CreateIndex
CREATE INDEX "console_audit_logs_created_at_idx" ON "console_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sso_clients_platform_slug_key" ON "sso_clients"("platform_slug");

-- CreateIndex
CREATE INDEX "sso_clients_platform_slug_idx" ON "sso_clients"("platform_slug");

-- CreateIndex
CREATE INDEX "sso_clients_is_active_idx" ON "sso_clients"("is_active");