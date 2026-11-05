-- Business acquisition & attribution for the 247GBS Affiliates network.
-- Keeps the introducing affiliate, the onboarding assistant and the account
-- manager as separate relationships with a full history trail.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AffiliateBusinessAcquisitionStatus') THEN
    CREATE TYPE "AffiliateBusinessAcquisitionStatus" AS ENUM ('PROSPECT', 'INVITED', 'REGISTERED', 'ONBOARDING_COMPLETED', 'VERIFIED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessRelationshipType') THEN
    CREATE TYPE "BusinessRelationshipType" AS ENUM ('ACQUISITION', 'ONBOARDING_ASSISTANCE', 'ACCOUNT_MANAGEMENT', 'CONSULTANT_ASSIGNMENT', 'TASK_ASSIGNMENT', 'ATTRIBUTION_CHANGE');
  END IF;
END $$;

ALTER TABLE "BusinessProfile"
  ADD COLUMN IF NOT EXISTS "acquired_by_affiliate_id" TEXT,
  ADD COLUMN IF NOT EXISTS "acquired_by_affiliate_external_id" TEXT,
  ADD COLUMN IF NOT EXISTS "acquired_by_affiliate_name" TEXT,
  ADD COLUMN IF NOT EXISTS "acquired_by_affiliate_role" TEXT,
  ADD COLUMN IF NOT EXISTS "onboarded_by_affiliate_id" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_source" TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS "acquisition_invitation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "acquisition_status" "AffiliateBusinessAcquisitionStatus",
  ADD COLUMN IF NOT EXISTS "acquisition_attributed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acquisition_verified_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acquisition_verified_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "BusinessProfile_acquired_by_affiliate_id_idx" ON "BusinessProfile"("acquired_by_affiliate_id");
CREATE INDEX IF NOT EXISTS "BusinessProfile_acquired_by_affiliate_external_id_idx" ON "BusinessProfile"("acquired_by_affiliate_external_id");
CREATE INDEX IF NOT EXISTS "BusinessProfile_acquisition_status_idx" ON "BusinessProfile"("acquisition_status");

CREATE TABLE IF NOT EXISTS "affiliate_business_invitations" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "affiliate_user_id" TEXT,
  "affiliate_external_id" TEXT,
  "affiliate_name" TEXT NOT NULL,
  "affiliate_email" TEXT NOT NULL,
  "affiliate_role" TEXT NOT NULL,
  "prospect_external_id" TEXT,
  "business_name" TEXT NOT NULL,
  "contact_name" TEXT,
  "business_phone" TEXT,
  "business_email" TEXT,
  "postcode" TEXT,
  "address" TEXT,
  "category" TEXT,
  "notes" TEXT,
  "status" "AffiliateBusinessAcquisitionStatus" NOT NULL DEFAULT 'INVITED',
  "business_id" TEXT,
  "registered_user_id" TEXT,
  "registered_at" TIMESTAMP(3),
  "onboarding_completed_at" TIMESTAMP(3),
  "verified_at" TIMESTAMP(3),
  "verified_by_user_id" TEXT,
  "cancelled_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "affiliate_business_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_business_invitations_token_key" ON "affiliate_business_invitations"("token");
CREATE INDEX IF NOT EXISTS "affiliate_business_invitations_affiliate_user_id_idx" ON "affiliate_business_invitations"("affiliate_user_id");
CREATE INDEX IF NOT EXISTS "affiliate_business_invitations_affiliate_external_id_idx" ON "affiliate_business_invitations"("affiliate_external_id");
CREATE INDEX IF NOT EXISTS "affiliate_business_invitations_prospect_external_id_idx" ON "affiliate_business_invitations"("prospect_external_id");
CREATE INDEX IF NOT EXISTS "affiliate_business_invitations_status_idx" ON "affiliate_business_invitations"("status");
CREATE INDEX IF NOT EXISTS "affiliate_business_invitations_business_id_idx" ON "affiliate_business_invitations"("business_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_business_invitations_business_id_fkey') THEN
    ALTER TABLE "affiliate_business_invitations"
      ADD CONSTRAINT "affiliate_business_invitations_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_business_claims" (
  "id" TEXT NOT NULL,
  "business_id" TEXT,
  "business_email" TEXT,
  "business_name" TEXT,
  "affiliate_user_id" TEXT,
  "affiliate_external_id" TEXT,
  "affiliate_name" TEXT NOT NULL,
  "affiliate_email" TEXT NOT NULL,
  "affiliate_role" TEXT NOT NULL,
  "prospect_external_id" TEXT,
  "evidence" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewed_by_user_id" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "affiliate_business_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "affiliate_business_claims_status_idx" ON "affiliate_business_claims"("status");
CREATE INDEX IF NOT EXISTS "affiliate_business_claims_business_id_idx" ON "affiliate_business_claims"("business_id");
CREATE INDEX IF NOT EXISTS "affiliate_business_claims_affiliate_user_id_idx" ON "affiliate_business_claims"("affiliate_user_id");
CREATE INDEX IF NOT EXISTS "affiliate_business_claims_affiliate_external_id_idx" ON "affiliate_business_claims"("affiliate_external_id");

CREATE TABLE IF NOT EXISTS "business_relationship_history" (
  "id" TEXT NOT NULL,
  "business_id" TEXT NOT NULL,
  "relationship_type" "BusinessRelationshipType" NOT NULL,
  "affiliate_user_id" TEXT,
  "affiliate_external_id" TEXT,
  "actor_user_id" TEXT,
  "previous_value" TEXT,
  "new_value" TEXT,
  "metadata" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "business_relationship_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "business_relationship_history_business_id_relationship_type_idx" ON "business_relationship_history"("business_id", "relationship_type");
CREATE INDEX IF NOT EXISTS "business_relationship_history_affiliate_user_id_idx" ON "business_relationship_history"("affiliate_user_id");
CREATE INDEX IF NOT EXISTS "business_relationship_history_affiliate_external_id_idx" ON "business_relationship_history"("affiliate_external_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_relationship_history_business_id_fkey') THEN
    ALTER TABLE "business_relationship_history"
      ADD CONSTRAINT "business_relationship_history_business_id_fkey"
      FOREIGN KEY ("business_id") REFERENCES "BusinessProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
