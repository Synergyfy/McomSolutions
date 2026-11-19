-- Storefront artwork collected during business onboarding: cover banner and
-- the storefront exterior / gallery images sent as `payload.media`.
ALTER TABLE "BusinessProfile"
  ADD COLUMN "banner_url" TEXT,
  ADD COLUMN "media" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
