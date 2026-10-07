-- Memberships-only remodel: MCOM holds no plans of its own.
-- Drops the unused relational cluster (tiers, plans, plan_variants,
-- plan_prices, subscriptions) and MCOM's own plan catalog (package_templates).
-- Kept: membership_plans (bundles), external_plans (other platforms' plans
-- mirrored from console-registered apps), ecosystem tables.
-- Idempotent (IF EXISTS) per repo migration-hardening precedent.

-- ── Drop FK constraints first (children before parents) ──
ALTER TABLE IF EXISTS "plan_variants" DROP CONSTRAINT IF EXISTS "plan_variants_plan_id_fkey";
ALTER TABLE IF EXISTS "plan_variants" DROP CONSTRAINT IF EXISTS "plan_variants_tier_id_fkey";
ALTER TABLE IF EXISTS "plan_prices" DROP CONSTRAINT IF EXISTS "plan_prices_plan_variant_id_fkey";
ALTER TABLE IF EXISTS "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_business_id_fkey";
ALTER TABLE IF EXISTS "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_plan_variant_id_fkey";
ALTER TABLE IF EXISTS "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_price_id_fkey";

-- ── Drop tables (leaf tables first; indexes die with their tables) ──
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "plan_prices";
DROP TABLE IF EXISTS "plan_variants";
DROP TABLE IF EXISTS "plans";
DROP TABLE IF EXISTS "tiers";
DROP TABLE IF EXISTS "package_templates";
