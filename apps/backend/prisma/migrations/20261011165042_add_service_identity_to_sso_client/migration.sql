-- AlterTable
ALTER TABLE "sso_clients" ADD COLUMN     "allowed_audiences" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowed_callers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "service_base_url" TEXT,
ADD COLUMN     "service_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "service_scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "service_token_audit" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "token_type" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "subject" TEXT,
    "audience" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_token_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_token_audit_jti_key" ON "service_token_audit"("jti");

-- CreateIndex
CREATE INDEX "service_token_audit_client_id_idx" ON "service_token_audit"("client_id");

-- CreateIndex
CREATE INDEX "service_token_audit_created_at_idx" ON "service_token_audit"("created_at");
