/*
  Warnings:

  - You are about to drop the `PasswordResetCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SsoAuthCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SsoClient` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SsoSession` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PasswordResetCode" DROP CONSTRAINT "PasswordResetCode_userId_fkey";

-- DropForeignKey
ALTER TABLE "SsoAuthCode" DROP CONSTRAINT "SsoAuthCode_clientId_fkey";

-- DropForeignKey
ALTER TABLE "SsoSession" DROP CONSTRAINT "SsoSession_userId_fkey";

-- DropTable
DROP TABLE "PasswordResetCode";

-- DropTable
DROP TABLE "SsoAuthCode";

-- DropTable
DROP TABLE "SsoClient";

-- DropTable
DROP TABLE "SsoSession";

-- CreateTable
CREATE TABLE "sso_clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirect_uris" TEXT[],
    "scopes" TEXT[],
    "logo_url" TEXT,
    "api_key" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_auth_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "redirect_uri" TEXT NOT NULL,
    "scopes" TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sso_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sso_clients_client_id_key" ON "sso_clients"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "sso_clients_api_key_key" ON "sso_clients"("api_key");

-- CreateIndex
CREATE INDEX "sso_clients_client_id_idx" ON "sso_clients"("client_id");

-- CreateIndex
CREATE INDEX "sso_clients_api_key_idx" ON "sso_clients"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "sso_auth_codes_code_key" ON "sso_auth_codes"("code");

-- CreateIndex
CREATE INDEX "sso_auth_codes_code_idx" ON "sso_auth_codes"("code");

-- CreateIndex
CREATE INDEX "sso_auth_codes_user_id_idx" ON "sso_auth_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sso_sessions_access_token_key" ON "sso_sessions"("access_token");

-- CreateIndex
CREATE UNIQUE INDEX "sso_sessions_refresh_token_key" ON "sso_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sso_sessions_user_id_idx" ON "sso_sessions"("user_id");

-- CreateIndex
CREATE INDEX "sso_sessions_access_token_idx" ON "sso_sessions"("access_token");

-- CreateIndex
CREATE INDEX "sso_sessions_refresh_token_idx" ON "sso_sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "password_reset_codes_code_idx" ON "password_reset_codes"("code");

-- CreateIndex
CREATE INDEX "password_reset_codes_user_id_idx" ON "password_reset_codes"("user_id");

-- AddForeignKey
ALTER TABLE "sso_auth_codes" ADD CONSTRAINT "sso_auth_codes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "sso_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_sessions" ADD CONSTRAINT "sso_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_codes" ADD CONSTRAINT "password_reset_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
