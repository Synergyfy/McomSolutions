-- Phase 3 (REMEDIATION-PLAN): regular-auth refresh sessions + session version.
-- Refresh tokens are stored as SHA-256 hashes and rotated on every use.
-- User.token_version invalidates outstanding access tokens (tv claim) on
-- password reset / role change / ban-deactivate.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "refresh_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "hashed_token" TEXT NOT NULL,
    "access_jti" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by_id" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_sessions_jti_key" ON "refresh_sessions"("jti");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_sessions_hashed_token_key" ON "refresh_sessions"("hashed_token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_sessions_user_id_idx" ON "refresh_sessions"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_sessions_expires_at_idx" ON "refresh_sessions"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_sessions_access_jti_idx" ON "refresh_sessions"("access_jti");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refresh_sessions_user_id_fkey'
  ) THEN
    ALTER TABLE "refresh_sessions"
      ADD CONSTRAINT "refresh_sessions_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
