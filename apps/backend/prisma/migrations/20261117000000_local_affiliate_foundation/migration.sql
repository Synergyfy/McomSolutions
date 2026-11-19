-- ═══════════════════════════════════════════════════════════════════════════
-- Local Affiliate programme — foundation schema.
--
-- Adds the consumer affiliate domain alongside (never inside) the agency
-- "Affiliate" domain (affiliate_tasks / affiliate_projects / settlements).
--
-- Key invariants:
--   • local_affiliate_profiles.user_id is UNIQUE — one affiliate per CHS user,
--     so Scenario A can never create a duplicate identity.
--   • affiliate_tracking_links is the unit of attribution; products never carry
--     an affiliate id.
--   • affiliate_reward_ledger is append-only (units are never updated).
--   • affiliate_provider_transactions (provider_account_id, provider_transaction_id)
--     is UNIQUE, so duplicate provider webhooks cannot credit twice.
-- ═══════════════════════════════════════════════════════════════════════════

-- Human-readable affiliate codes (LAF-000125). Monotonic and never reused so
-- historical share links keep resolving after closure. Gaps on rollback are
-- acceptable and intentional.
CREATE SEQUENCE IF NOT EXISTS local_affiliate_code_seq START WITH 125 INCREMENT BY 1;

-- CreateEnum
CREATE TYPE "LocalAffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LocalAffiliateCardStatus" AS ENUM ('NOT_LINKED', 'PENDING', 'LINKED', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateProviderType" AS ENUM ('INTERNAL_PLATFORM', 'EXTERNAL_CHECKOUT', 'AFFILIATE_NETWORK', 'EXTERNAL_BUSINESS');

-- CreateEnum
CREATE TYPE "AffiliateIntegrationLevel" AS ENUM ('LINK_ONLY', 'REDEMPTION_CODE', 'MANUAL_CONFIRMATION', 'PROVIDER_API', 'PROVIDER_WEBHOOK');

-- CreateEnum
CREATE TYPE "AffiliateProviderStatus" AS ENUM ('DRAFT', 'CONNECTED', 'DEGRADED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "AffiliateOfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AffiliateCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "AffiliateTrackingMethod" AS ENUM ('INTERNAL_REDIRECT', 'BUILT_AT_CLICK', 'STATIC_PROVIDER_LINK');

-- CreateEnum
CREATE TYPE "AffiliateQualifyingEvent" AS ENUM ('LINK_CLICK', 'QUALIFIED_VISIT', 'VERIFIED_LEAD', 'COMPLETED_BOOKING', 'APPROVED_PURCHASE', 'VERIFIED_REDEMPTION', 'CANCELLED_REFUNDED');

-- CreateEnum
CREATE TYPE "AffiliateRewardType" AS ENUM ('POINTS', 'CREDIT', 'VOUCHER', 'DISCOUNT', 'LOYALTY_STAMP', 'CAMPAIGN_BENEFIT');

-- CreateEnum
CREATE TYPE "AffiliateRewardCalculation" AS ENUM ('FIXED', 'PERCENTAGE', 'TIERED');

-- CreateEnum
CREATE TYPE "AffiliateRewardUnit" AS ENUM ('POINTS', 'CREDIT');

-- CreateEnum
CREATE TYPE "AffiliateApprovalMode" AS ENUM ('AUTOMATIC', 'PROVIDER_CONFIRMATION', 'ADMIN_CONFIRMATION', 'REDEMPTION_VALIDATION');

-- CreateEnum
CREATE TYPE "AffiliateReversalPolicy" AS ENUM ('REVERSE_ON_REFUND', 'NO_REVERSAL', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "AffiliateConversionStatus" AS ENUM ('RECEIVED', 'MATCHED', 'UNMATCHED', 'ATTRIBUTED', 'REJECTED', 'DUPLICATE', 'EXPIRED_UNATTRIBUTED');

-- CreateEnum
CREATE TYPE "AffiliateAttributionMethod" AS ENUM ('INTERNAL_LAST_CLICK', 'PROVIDER_LAST_CLICK', 'PROVIDER_DECISION', 'MANUAL');

-- CreateEnum
CREATE TYPE "AffiliateRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'AVAILABLE', 'REDEEMED', 'REJECTED', 'CANCELLED', 'REVERSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AffiliateLedgerEntryType" AS ENUM ('CREDIT', 'DEBIT', 'EXPIRY', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AffiliateVoucherStatus" AS ENUM ('ISSUED', 'PARTIALLY_REDEEMED', 'REDEEMED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AffiliateRedemptionStatus" AS ENUM ('VALIDATED', 'REJECTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AffiliateEligibilityScope" AS ENUM ('GLOBAL', 'CITY', 'BOROUGH', 'HIGH_STREET', 'LOCAL_MALL', 'MEMBERSHIP_TIER', 'AFFILIATE_STATUS');

-- CreateEnum
CREATE TYPE "AffiliateSyncStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateTransactionStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'DELETED', 'REFUNDED', 'AMENDED');

-- CreateTable
CREATE TABLE "local_affiliate_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "affiliate_code" TEXT NOT NULL,
    "status" "LocalAffiliateStatus" NOT NULL DEFAULT 'PENDING',
    "display_name" TEXT,
    "terms_version" TEXT NOT NULL,
    "terms_accepted_at" TIMESTAMP(3) NOT NULL,
    "activated_from" TEXT NOT NULL,
    "acquisition_source" TEXT,
    "acquisition_ref" TEXT,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "suspended_reason" TEXT,
    "first_click_at" TIMESTAMP(3),
    "first_reward_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_affiliate_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_affiliate_cards" (
    "id" TEXT NOT NULL,
    "local_affiliate_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_card_id" TEXT,
    "status" "LocalAffiliateCardStatus" NOT NULL DEFAULT 'NOT_LINKED',
    "linked_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_affiliate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AffiliateProviderType" NOT NULL,
    "integration_level" "AffiliateIntegrationLevel" NOT NULL,
    "status" "AffiliateProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "supported_events" "AffiliateQualifyingEvent"[] DEFAULT ARRAY[]::"AffiliateQualifyingEvent"[],
    "supported_reward_types" "AffiliateRewardType"[] DEFAULT ARRAY[]::"AffiliateRewardType"[],
    "requires_manual_approval" BOOLEAN NOT NULL DEFAULT false,
    "feature_flag" TEXT,
    "notes" TEXT,
    "last_successful_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_provider_accounts" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "external_account_id" TEXT NOT NULL,
    "credentials_encrypted" TEXT,
    "config" JSONB,
    "status" "AffiliateProviderStatus" NOT NULL DEFAULT 'DRAFT',
    "last_synced_at" TIMESTAMP(3),
    "sync_cursor" JSONB,
    "last_sync_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_businesses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "city_id" TEXT,
    "borough_id" TEXT,
    "high_street_id" TEXT,
    "local_mall_id" TEXT,
    "category" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verified_at" TIMESTAMP(3),
    "verified_by_user_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_offer_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_offer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_products" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "external_product_id" TEXT NOT NULL,
    "business_id" TEXT,
    "external_business_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "category" TEXT,
    "sub_category" TEXT,
    "product_type" TEXT NOT NULL DEFAULT 'PRODUCT',
    "destination_url" TEXT NOT NULL,
    "availability" JSONB,
    "source_payload" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_offers" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "product_id" TEXT,
    "business_id" TEXT,
    "external_business_id" TEXT,
    "category_id" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destination_url" TEXT NOT NULL,
    "integration_level" "AffiliateIntegrationLevel" NOT NULL,
    "tracking_method" "AffiliateTrackingMethod" NOT NULL DEFAULT 'INTERNAL_REDIRECT',
    "eligibility_scope" "AffiliateEligibilityScope" NOT NULL DEFAULT 'GLOBAL',
    "eligibility" JSONB,
    "customer_benefit" JSONB,
    "reward_rule_id" TEXT,
    "redemption_method" TEXT NOT NULL DEFAULT 'NONE',
    "hold_days" INTEGER NOT NULL DEFAULT 0,
    "status" "AffiliateOfferStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "identity_unverifiable" BOOLEAN NOT NULL DEFAULT false,
    "allow_owner_promotion" BOOLEAN NOT NULL DEFAULT false,
    "approved_by_user_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_affiliate_campaigns" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AffiliateCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "eligibility_scope" "AffiliateEligibilityScope" NOT NULL DEFAULT 'GLOBAL',
    "eligibility" JSONB,
    "reward_cap_units" DECIMAL(18,4),
    "reward_cap_unit" "AffiliateRewardUnit",
    "budget_units_issued" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "promotion_materials" JSONB,
    "default_reward_rule_id" TEXT,
    "default_attribution_window_days" INTEGER,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_affiliate_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_campaign_offers" (
    "campaign_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "reward_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_campaign_offers_pkey" PRIMARY KEY ("campaign_id","offer_id")
);

-- CreateTable
CREATE TABLE "affiliate_reward_rules" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "qualifying_event" "AffiliateQualifyingEvent" NOT NULL,
    "reward_type" "AffiliateRewardType" NOT NULL,
    "calculation" "AffiliateRewardCalculation" NOT NULL DEFAULT 'FIXED',
    "unit" "AffiliateRewardUnit" NOT NULL DEFAULT 'POINTS',
    "fixed_units" DECIMAL(18,4),
    "percentage" DECIMAL(7,4),
    "points_per_currency_unit" DECIMAL(18,6),
    "tiers" JSONB,
    "max_reward_units" DECIMAL(18,4),
    "min_purchase_minor" INTEGER,
    "approval_mode" "AffiliateApprovalMode" NOT NULL DEFAULT 'ADMIN_CONFIRMATION',
    "reversal_policy" "AffiliateReversalPolicy" NOT NULL DEFAULT 'REVERSE_ON_REFUND',
    "expiry_days" INTEGER,
    "cap_per_affiliate_units" DECIMAL(18,4),
    "cap_per_campaign_units" DECIMAL(18,4),
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_tracking_links" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "local_affiliate_id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "campaign_key" TEXT NOT NULL DEFAULT '',
    "provider_id" TEXT NOT NULL,
    "provider_link_url" TEXT,
    "provider_click_ref" TEXT,
    "destination_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "click_count" INTEGER NOT NULL DEFAULT 0,
    "last_click_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_tracking_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "tracking_link_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "referrer" TEXT,
    "visitor_fingerprint" TEXT,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL_REDIRECT',
    "converted_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_provider_events" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "signature_valid" BOOLEAN NOT NULL DEFAULT false,
    "raw_body" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "processing_status" "AffiliateProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,

    CONSTRAINT "affiliate_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_provider_transactions" (
    "id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "provider_transaction_id" TEXT NOT NULL,
    "provider_order_ref" TEXT,
    "status" "AffiliateTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "amount_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "commission_amount_minor" INTEGER,
    "commission_groups" JSONB,
    "click_ref" TEXT,
    "validation_date" TIMESTAMP(3),
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "affiliate_provider_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_conversions" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "tracking_link_id" TEXT,
    "local_affiliate_id" TEXT,
    "offer_id" TEXT,
    "campaign_id" TEXT,
    "provider_transaction_id" TEXT,
    "provider_order_ref" TEXT,
    "event_type" "AffiliateQualifyingEvent" NOT NULL,
    "amount_minor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "status" "AffiliateConversionStatus" NOT NULL DEFAULT 'RECEIVED',
    "attribution_method" "AffiliateAttributionMethod",
    "attribution_window_days" INTEGER,
    "customer_user_id" TEXT,
    "customer_email_hash" TEXT,
    "raw_event_id" TEXT,
    "rejection_reason" TEXT,
    "explanation_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_attributions" (
    "id" TEXT NOT NULL,
    "conversion_id" TEXT NOT NULL,
    "tracking_link_id" TEXT NOT NULL,
    "local_affiliate_id" TEXT NOT NULL,
    "attribution_method" "AffiliateAttributionMethod" NOT NULL,
    "window_days" INTEGER NOT NULL,
    "clicked_at" TIMESTAMP(3),
    "converted_at" TIMESTAMP(3) NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "reason" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by_user_id" TEXT,
    "superseded_by_attribution_id" TEXT,

    CONSTRAINT "affiliate_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_reward_ledger" (
    "id" TEXT NOT NULL,
    "local_affiliate_id" TEXT NOT NULL,
    "conversion_id" TEXT,
    "reward_rule_id" TEXT,
    "reward_rule_version" INTEGER,
    "campaign_id" TEXT,
    "offer_id" TEXT,
    "entry_type" "AffiliateLedgerEntryType" NOT NULL,
    "unit" "AffiliateRewardUnit" NOT NULL DEFAULT 'POINTS',
    "units" DECIMAL(18,4) NOT NULL,
    "status" "AffiliateRewardStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "explanation_code" TEXT,
    "explanation_text" TEXT,
    "metadata" JSONB,
    "expires_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "available_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reverses_ledger_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_reward_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_ledger_events" (
    "id" TEXT NOT NULL,
    "ledger_id" TEXT NOT NULL,
    "from_status" "AffiliateRewardStatus",
    "to_status" "AffiliateRewardStatus" NOT NULL,
    "actor_type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actor_user_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_ledger_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_reward_redemptions" (
    "id" TEXT NOT NULL,
    "local_affiliate_id" TEXT NOT NULL,
    "reward_type" "AffiliateRewardType" NOT NULL,
    "unit" "AffiliateRewardUnit" NOT NULL DEFAULT 'POINTS',
    "units_spent" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "voucher_id" TEXT,
    "wallet_transaction_id" TEXT,
    "allocation" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_at" TIMESTAMP(3),

    CONSTRAINT "affiliate_reward_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "offer_id" TEXT,
    "campaign_id" TEXT,
    "issued_to_user_id" TEXT,
    "benefit" JSONB NOT NULL DEFAULT '{}',
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "max_uses_per_customer" INTEGER NOT NULL DEFAULT 1,
    "status" "AffiliateVoucherStatus" NOT NULL DEFAULT 'ISSUED',
    "expires_at" TIMESTAMP(3),
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_redemptions" (
    "id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "customer_user_id" TEXT,
    "customer_key" TEXT NOT NULL,
    "status" "AffiliateRedemptionStatus" NOT NULL DEFAULT 'VALIDATED',
    "channel" TEXT NOT NULL DEFAULT 'API',
    "validated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validated_by_user_id" TEXT,
    "validated_by_business_id" TEXT,
    "amount_minor" INTEGER,
    "pos_reference" TEXT,
    "ip_hash" TEXT,
    "rejection_reason" TEXT,
    "reversed_at" TIMESTAMP(3),

    CONSTRAINT "affiliate_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_sync_logs" (
    "id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "window_start" TIMESTAMP(3),
    "window_end" TIMESTAMP(3),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errored" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "status" "AffiliateSyncStatus" NOT NULL DEFAULT 'SUCCESS',
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "affiliate_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_affiliate_profiles_user_id_key" ON "local_affiliate_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_affiliate_profiles_affiliate_code_key" ON "local_affiliate_profiles"("affiliate_code");

-- CreateIndex
CREATE INDEX "local_affiliate_profiles_status_idx" ON "local_affiliate_profiles"("status");

-- CreateIndex
CREATE INDEX "local_affiliate_profiles_created_at_idx" ON "local_affiliate_profiles"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "local_affiliate_cards_local_affiliate_id_provider_key" ON "local_affiliate_cards"("local_affiliate_id", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_providers_code_key" ON "affiliate_providers"("code");

-- CreateIndex
CREATE INDEX "affiliate_providers_type_idx" ON "affiliate_providers"("type");

-- CreateIndex
CREATE INDEX "affiliate_providers_status_idx" ON "affiliate_providers"("status");

-- CreateIndex
CREATE INDEX "affiliate_provider_accounts_status_idx" ON "affiliate_provider_accounts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_provider_accounts_provider_id_external_account_id_key" ON "affiliate_provider_accounts"("provider_id", "external_account_id");

-- CreateIndex
CREATE INDEX "external_businesses_verification_status_idx" ON "external_businesses"("verification_status");

-- CreateIndex
CREATE INDEX "external_businesses_city_id_idx" ON "external_businesses"("city_id");

-- CreateIndex
CREATE INDEX "external_businesses_borough_id_idx" ON "external_businesses"("borough_id");

-- CreateIndex
CREATE INDEX "external_businesses_local_mall_id_idx" ON "external_businesses"("local_mall_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_offer_categories_slug_key" ON "affiliate_offer_categories"("slug");

-- CreateIndex
CREATE INDEX "affiliate_products_provider_id_is_active_idx" ON "affiliate_products"("provider_id", "is_active");

-- CreateIndex
CREATE INDEX "affiliate_products_business_id_idx" ON "affiliate_products"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_products_provider_id_external_product_id_key" ON "affiliate_products"("provider_id", "external_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_offers_slug_key" ON "affiliate_offers"("slug");

-- CreateIndex
CREATE INDEX "affiliate_offers_status_starts_at_ends_at_idx" ON "affiliate_offers"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "affiliate_offers_provider_id_idx" ON "affiliate_offers"("provider_id");

-- CreateIndex
CREATE INDEX "affiliate_offers_category_id_idx" ON "affiliate_offers"("category_id");

-- CreateIndex
CREATE INDEX "affiliate_offers_business_id_idx" ON "affiliate_offers"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "local_affiliate_campaigns_code_key" ON "local_affiliate_campaigns"("code");

-- CreateIndex
CREATE INDEX "local_affiliate_campaigns_status_starts_at_ends_at_idx" ON "local_affiliate_campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "affiliate_campaign_offers_offer_id_idx" ON "affiliate_campaign_offers"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_reward_rules_version_key" ON "affiliate_reward_rules"("version");

-- CreateIndex
CREATE INDEX "affiliate_reward_rules_is_current_idx" ON "affiliate_reward_rules"("is_current");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_tracking_links_code_key" ON "affiliate_tracking_links"("code");

-- CreateIndex
CREATE INDEX "affiliate_tracking_links_local_affiliate_id_created_at_idx" ON "affiliate_tracking_links"("local_affiliate_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "affiliate_tracking_links_offer_id_idx" ON "affiliate_tracking_links"("offer_id");

-- CreateIndex
CREATE INDEX "affiliate_tracking_links_code_idx" ON "affiliate_tracking_links"("code");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_tracking_links_local_affiliate_id_offer_id_campai_key" ON "affiliate_tracking_links"("local_affiliate_id", "offer_id", "campaign_key");

-- CreateIndex
CREATE INDEX "affiliate_clicks_tracking_link_id_occurred_at_idx" ON "affiliate_clicks"("tracking_link_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "affiliate_clicks_occurred_at_idx" ON "affiliate_clicks"("occurred_at");

-- CreateIndex
CREATE INDEX "affiliate_provider_events_processing_status_received_at_idx" ON "affiliate_provider_events"("processing_status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_provider_events_provider_id_external_event_id_key" ON "affiliate_provider_events"("provider_id", "external_event_id");

-- CreateIndex
CREATE INDEX "affiliate_provider_transactions_provider_id_status_transact_idx" ON "affiliate_provider_transactions"("provider_id", "status", "transaction_date");

-- CreateIndex
CREATE INDEX "affiliate_provider_transactions_click_ref_idx" ON "affiliate_provider_transactions"("click_ref");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_provider_transactions_provider_account_id_provide_key" ON "affiliate_provider_transactions"("provider_account_id", "provider_transaction_id");

-- CreateIndex
CREATE INDEX "affiliate_conversions_local_affiliate_id_occurred_at_idx" ON "affiliate_conversions"("local_affiliate_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "affiliate_conversions_status_occurred_at_idx" ON "affiliate_conversions"("status", "occurred_at");

-- CreateIndex
CREATE INDEX "affiliate_conversions_offer_id_idx" ON "affiliate_conversions"("offer_id");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_conversions_provider_id_provider_transaction_id_e_key" ON "affiliate_conversions"("provider_id", "provider_transaction_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_attributions_conversion_id_key" ON "affiliate_attributions"("conversion_id");

-- CreateIndex
CREATE INDEX "affiliate_attributions_local_affiliate_id_decided_at_idx" ON "affiliate_attributions"("local_affiliate_id", "decided_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_reward_ledger_idempotency_key_key" ON "affiliate_reward_ledger"("idempotency_key");

-- CreateIndex
CREATE INDEX "affiliate_reward_ledger_local_affiliate_id_status_idx" ON "affiliate_reward_ledger"("local_affiliate_id", "status");

-- CreateIndex
CREATE INDEX "affiliate_reward_ledger_status_expires_at_idx" ON "affiliate_reward_ledger"("status", "expires_at");

-- CreateIndex
CREATE INDEX "affiliate_reward_ledger_conversion_id_idx" ON "affiliate_reward_ledger"("conversion_id");

-- CreateIndex
CREATE INDEX "affiliate_reward_ledger_campaign_id_status_idx" ON "affiliate_reward_ledger"("campaign_id", "status");

-- CreateIndex
CREATE INDEX "affiliate_ledger_events_ledger_id_created_at_idx" ON "affiliate_ledger_events"("ledger_id", "created_at");

-- CreateIndex
CREATE INDEX "affiliate_reward_redemptions_local_affiliate_id_created_at_idx" ON "affiliate_reward_redemptions"("local_affiliate_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_vouchers_code_key" ON "affiliate_vouchers"("code");

-- CreateIndex
CREATE INDEX "affiliate_vouchers_status_expires_at_idx" ON "affiliate_vouchers"("status", "expires_at");

-- CreateIndex
CREATE INDEX "affiliate_vouchers_offer_id_idx" ON "affiliate_vouchers"("offer_id");

-- CreateIndex
CREATE INDEX "affiliate_redemptions_voucher_id_status_idx" ON "affiliate_redemptions"("voucher_id", "status");

-- CreateIndex
CREATE INDEX "affiliate_redemptions_validated_at_idx" ON "affiliate_redemptions"("validated_at");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_redemptions_voucher_id_customer_key_key" ON "affiliate_redemptions"("voucher_id", "customer_key");

-- CreateIndex
CREATE INDEX "affiliate_sync_logs_provider_account_id_started_at_idx" ON "affiliate_sync_logs"("provider_account_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "local_affiliate_profiles" ADD CONSTRAINT "local_affiliate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_affiliate_cards" ADD CONSTRAINT "local_affiliate_cards_local_affiliate_id_fkey" FOREIGN KEY ("local_affiliate_id") REFERENCES "local_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_provider_accounts" ADD CONSTRAINT "affiliate_provider_accounts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "affiliate_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_products" ADD CONSTRAINT "affiliate_products_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "affiliate_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "affiliate_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "affiliate_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_external_business_id_fkey" FOREIGN KEY ("external_business_id") REFERENCES "external_businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_offers" ADD CONSTRAINT "affiliate_offers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "affiliate_offer_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_campaign_offers" ADD CONSTRAINT "affiliate_campaign_offers_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "local_affiliate_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_campaign_offers" ADD CONSTRAINT "affiliate_campaign_offers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "affiliate_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tracking_links" ADD CONSTRAINT "affiliate_tracking_links_local_affiliate_id_fkey" FOREIGN KEY ("local_affiliate_id") REFERENCES "local_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_tracking_links" ADD CONSTRAINT "affiliate_tracking_links_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "affiliate_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_tracking_link_id_fkey" FOREIGN KEY ("tracking_link_id") REFERENCES "affiliate_tracking_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_provider_events" ADD CONSTRAINT "affiliate_provider_events_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "affiliate_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_provider_transactions" ADD CONSTRAINT "affiliate_provider_transactions_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "affiliate_provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_tracking_link_id_fkey" FOREIGN KEY ("tracking_link_id") REFERENCES "affiliate_tracking_links"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "affiliate_conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_attributions" ADD CONSTRAINT "affiliate_attributions_tracking_link_id_fkey" FOREIGN KEY ("tracking_link_id") REFERENCES "affiliate_tracking_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reward_ledger" ADD CONSTRAINT "affiliate_reward_ledger_local_affiliate_id_fkey" FOREIGN KEY ("local_affiliate_id") REFERENCES "local_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reward_ledger" ADD CONSTRAINT "affiliate_reward_ledger_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "affiliate_conversions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ledger_events" ADD CONSTRAINT "affiliate_ledger_events_ledger_id_fkey" FOREIGN KEY ("ledger_id") REFERENCES "affiliate_reward_ledger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_reward_redemptions" ADD CONSTRAINT "affiliate_reward_redemptions_local_affiliate_id_fkey" FOREIGN KEY ("local_affiliate_id") REFERENCES "local_affiliate_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_vouchers" ADD CONSTRAINT "affiliate_vouchers_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "affiliate_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_redemptions" ADD CONSTRAINT "affiliate_redemptions_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "affiliate_vouchers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_sync_logs" ADD CONSTRAINT "affiliate_sync_logs_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "affiliate_provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

