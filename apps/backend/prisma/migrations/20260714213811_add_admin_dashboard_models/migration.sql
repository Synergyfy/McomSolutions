-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'AGENT';
ALTER TYPE "Role" ADD VALUE 'CONSULTANT';
ALTER TYPE "Role" ADD VALUE 'ACCOUNT_MANAGER';
ALTER TYPE "Role" ADD VALUE 'PARTNER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" TEXT;

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "platform_usage" TEXT[],
    "membership_status" TEXT NOT NULL DEFAULT 'None',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permissions" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultant_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "specialisation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_manager_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_businesses" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_manager_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "platform_access" TEXT[],
    "usage_limits" JSONB NOT NULL,
    "permissions" TEXT[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "features" TEXT[],
    "usage_limits" JSONB NOT NULL,
    "access_rights" TEXT[],
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecosystem_subscriptions" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "billing_cycle" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecosystem_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ecosystem_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Enabled',
    "icon" TEXT NOT NULL,
    "launch_date" TIMESTAMP(3) NOT NULL,
    "total_users" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ecosystem_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_roles" (
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE "admin_payments" (
    "id" TEXT NOT NULL,
    "business_id" TEXT,
    "business_name" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoice" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broadcast_notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "audience" TEXT[],
    "scheduled_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Sent',
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "from_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "assigned_to" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_name" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "brand_name" TEXT NOT NULL DEFAULT 'MCOMSolutions',
    "support_email" TEXT NOT NULL DEFAULT 'support@mcomsolutions.co.uk',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "session_timeout" INTEGER NOT NULL DEFAULT 60,
    "max_login_attempts" INTEGER NOT NULL DEFAULT 5,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payment_gateway" TEXT NOT NULL DEFAULT 'Stripe',
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "allow_registration" BOOLEAN NOT NULL DEFAULT true,
    "auth_config" JSONB,
    "registration_flow" JSONB,
    "business_profile_config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_launch_rules" (
    "id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "required_membership" TEXT NOT NULL,
    "required_package" TEXT NOT NULL,
    "required_permissions" TEXT[],
    "launch_conditions" TEXT NOT NULL,
    "redirect_rule" TEXT NOT NULL,
    "access_rule" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_launch_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_sync" TIMESTAMP(3),
    "connected_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "permissions" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'Active',
    "last_used" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_records" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boroughs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "population_activity" TEXT NOT NULL,
    "business_count" INTEGER NOT NULL DEFAULT 0,
    "active_campaigns" INTEGER NOT NULL DEFAULT 0,
    "rewards_participation" TEXT NOT NULL,
    "health_score" INTEGER NOT NULL,
    "manager" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "engagement" TEXT NOT NULL,
    "health" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "boroughs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "high_streets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "borough" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "business_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "high_streets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_malls" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postcodes" TEXT[],
    "borough" TEXT NOT NULL,
    "primary_high_street" TEXT NOT NULL,
    "additional_high_streets" TEXT[],
    "businesses" INTEGER NOT NULL DEFAULT 0,
    "customers" INTEGER NOT NULL DEFAULT 0,
    "campaigns" INTEGER NOT NULL DEFAULT 0,
    "events" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "long_description" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "cover_banner" TEXT,
    "mobile_banner" TEXT,
    "primary_colour" TEXT NOT NULL,
    "secondary_colour" TEXT NOT NULL,
    "welcome_message" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "radius_coverage" TEXT NOT NULL,
    "allow_businesses_outside_postcode" BOOLEAN NOT NULL DEFAULT false,
    "allow_virtual_businesses" BOOLEAN NOT NULL DEFAULT true,
    "allow_home_businesses" BOOLEAN NOT NULL DEFAULT true,
    "require_verification" BOOLEAN NOT NULL DEFAULT true,
    "require_audit_completion" BOOLEAN NOT NULL DEFAULT false,
    "require_membership_approval" BOOLEAN NOT NULL DEFAULT true,
    "lead_consultant" TEXT,
    "lead_consultant_id" TEXT,
    "assigned_account_managers" TEXT[],
    "assigned_account_manager_ids" TEXT[],
    "assigned_agents" TEXT[],
    "assigned_agent_ids" TEXT[],
    "support_team" TEXT[],
    "enable_audit" BOOLEAN NOT NULL DEFAULT true,
    "enable_rewards" BOOLEAN NOT NULL DEFAULT true,
    "enable_loyalty" BOOLEAN NOT NULL DEFAULT true,
    "enable_q_links" BOOLEAN NOT NULL DEFAULT true,
    "enable_spin" BOOLEAN NOT NULL DEFAULT true,
    "enable_events" BOOLEAN NOT NULL DEFAULT true,
    "enable_campaigns" BOOLEAN NOT NULL DEFAULT true,
    "enable_push_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_marketplace" BOOLEAN NOT NULL DEFAULT false,
    "allow_guest_browsing" BOOLEAN NOT NULL DEFAULT true,
    "require_registration_for_rewards" BOOLEAN NOT NULL DEFAULT true,
    "require_registration_for_spin" BOOLEAN NOT NULL DEFAULT true,
    "enable_auto_location_detection" BOOLEAN NOT NULL DEFAULT true,
    "allow_manual_local_mall_switching" BOOLEAN NOT NULL DEFAULT true,
    "auto_approve_businesses" BOOLEAN NOT NULL DEFAULT false,
    "manual_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "require_document_verification" BOOLEAN NOT NULL DEFAULT true,
    "require_google_business_match" BOOLEAN NOT NULL DEFAULT false,
    "require_audit_completion_for_business" BOOLEAN NOT NULL DEFAULT true,
    "default_membership_package" TEXT,
    "featured_businesses" TEXT[],
    "featured_categories" TEXT[],
    "featured_campaigns" TEXT[],
    "featured_events" TEXT[],
    "featured_rewards" TEXT[],
    "featured_spin_campaigns" TEXT[],
    "featured_high_streets" TEXT[],
    "category_priorities" JSONB,
    "allow_borough_campaigns" BOOLEAN NOT NULL DEFAULT true,
    "allow_high_street_campaigns" BOOLEAN NOT NULL DEFAULT true,
    "allow_joint_campaigns" BOOLEAN NOT NULL DEFAULT false,
    "allow_seasonal_campaigns" BOOLEAN NOT NULL DEFAULT true,
    "campaign_approval_required" BOOLEAN NOT NULL DEFAULT true,
    "enable_events_module" BOOLEAN NOT NULL DEFAULT true,
    "require_event_approval" BOOLEAN NOT NULL DEFAULT true,
    "max_events_per_business" INTEGER NOT NULL DEFAULT 5,
    "allow_community_events" BOOLEAN NOT NULL DEFAULT true,
    "allow_business_events" BOOLEAN NOT NULL DEFAULT true,
    "enable_rewards_module" BOOLEAN NOT NULL DEFAULT true,
    "enable_loyalty_module" BOOLEAN NOT NULL DEFAULT true,
    "enable_bonus_campaigns" BOOLEAN NOT NULL DEFAULT false,
    "enable_double_point_days" BOOLEAN NOT NULL DEFAULT true,
    "enable_seasonal_rewards" BOOLEAN NOT NULL DEFAULT true,
    "enable_spin_module" BOOLEAN NOT NULL DEFAULT true,
    "allow_business_sponsored_spins" BOOLEAN NOT NULL DEFAULT true,
    "allow_borough_spins" BOOLEAN NOT NULL DEFAULT false,
    "allow_seasonal_spins" BOOLEAN NOT NULL DEFAULT true,
    "max_spins_per_customer" INTEGER NOT NULL DEFAULT 3,
    "enable_rotator" BOOLEAN NOT NULL DEFAULT true,
    "enable_local_feed_distribution" BOOLEAN NOT NULL DEFAULT true,
    "enable_borough_feed_distribution" BOOLEAN NOT NULL DEFAULT false,
    "enable_featured_placement" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_malls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_user_id_key" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "customer_profiles_user_id_idx" ON "customer_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_profiles_user_id_key" ON "agent_profiles"("user_id");

-- CreateIndex
CREATE INDEX "agent_profiles_user_id_idx" ON "agent_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultant_profiles_user_id_key" ON "consultant_profiles"("user_id");

-- CreateIndex
CREATE INDEX "consultant_profiles_user_id_idx" ON "consultant_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_manager_profiles_user_id_key" ON "account_manager_profiles"("user_id");

-- CreateIndex
CREATE INDEX "account_manager_profiles_user_id_idx" ON "account_manager_profiles"("user_id");

-- CreateIndex
CREATE INDEX "ecosystem_subscriptions_business_id_idx" ON "ecosystem_subscriptions"("business_id");

-- CreateIndex
CREATE INDEX "admin_payments_business_id_idx" ON "admin_payments"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "system_api_keys_key_key" ON "system_api_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "boroughs_name_key" ON "boroughs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "local_malls_slug_key" ON "local_malls"("slug");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_profiles" ADD CONSTRAINT "agent_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultant_profiles" ADD CONSTRAINT "consultant_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_manager_profiles" ADD CONSTRAINT "account_manager_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
