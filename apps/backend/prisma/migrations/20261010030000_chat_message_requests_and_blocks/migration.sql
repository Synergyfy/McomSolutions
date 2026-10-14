-- CreateEnum
CREATE TYPE "MessageRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_message_requests" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "status" "MessageRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "rejection_count" INTEGER NOT NULL DEFAULT 0,
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_message_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "chat_blocks" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_message_requests_sender_id_receiver_id_key" ON "chat_message_requests"("sender_id", "receiver_id");
CREATE INDEX IF NOT EXISTS "chat_message_requests_receiver_id_status_idx" ON "chat_message_requests"("receiver_id", "status");
CREATE INDEX IF NOT EXISTS "chat_message_requests_sender_id_status_idx" ON "chat_message_requests"("sender_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "chat_blocks_blocker_id_blocked_id_key" ON "chat_blocks"("blocker_id", "blocked_id");
CREATE INDEX IF NOT EXISTS "chat_blocks_blocker_id_idx" ON "chat_blocks"("blocker_id");
CREATE INDEX IF NOT EXISTS "chat_blocks_blocked_id_idx" ON "chat_blocks"("blocked_id");

-- AddForeignKey
ALTER TABLE "chat_message_requests" ADD CONSTRAINT "chat_message_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_message_requests" ADD CONSTRAINT "chat_message_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
