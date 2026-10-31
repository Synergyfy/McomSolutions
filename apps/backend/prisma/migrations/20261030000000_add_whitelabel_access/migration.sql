-- White-label platform opt-in (Console) + per-business access grants.
-- Additive and safe: existing clients default to allow_whitelabel = false,
-- so their SSO behaviour is unchanged until an admin opts them in.

-- AlterTable
ALTER TABLE "sso_clients" ADD COLUMN "allow_whitelabel" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "whitelabel_accesses" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whitelabel_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whitelabel_accesses_business_id_client_id_key" ON "whitelabel_accesses"("business_id", "client_id");

-- CreateIndex
CREATE INDEX "whitelabel_accesses_business_id_idx" ON "whitelabel_accesses"("business_id");

-- CreateIndex
CREATE INDEX "whitelabel_accesses_client_id_idx" ON "whitelabel_accesses"("client_id");

-- CreateIndex
CREATE INDEX "sso_clients_allow_whitelabel_idx" ON "sso_clients"("allow_whitelabel");

-- AddForeignKey
ALTER TABLE "whitelabel_accesses" ADD CONSTRAINT "whitelabel_accesses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whitelabel_accesses" ADD CONSTRAINT "whitelabel_accesses_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "sso_clients"("client_id") ON DELETE CASCADE ON UPDATE CASCADE;
