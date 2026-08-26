-- CreateIndex
CREATE INDEX "sso_sessions_client_id_idx" ON "sso_sessions"("client_id");

-- AddForeignKey
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "sso_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
