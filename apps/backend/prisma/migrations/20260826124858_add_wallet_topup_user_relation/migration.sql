-- AddForeignKey
ALTER TABLE "wallet_top_up_requests" ADD CONSTRAINT "wallet_top_up_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
