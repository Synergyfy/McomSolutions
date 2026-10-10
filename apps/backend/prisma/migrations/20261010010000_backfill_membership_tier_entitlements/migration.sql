-- Backfill membership_tier_entitlements from the legacy tier_entitlements JSON.
--
-- The earlier migration (20261008000000_membership_tier_payment_options) attempted
-- this backfill but assumed a flat element shape [{ resourceKey, standard, pro,
-- proPlus }]. The seeded data instead uses the legacy shape:
--   [{ "tier": "Standard", "quotas": { "rewards": 100, ... }, "durationDays": 90 }, ...]
-- so that attempt matched zero rows and left membership_tier_entitlements empty.
--
-- This migration parses the legacy shape (and the flat shape defensively) into one
-- row per (tier, resource key). It is fully idempotent:
--   * only reads plans where deleted_at IS NULL
--   * ON CONFLICT (tier_id, resource_key) DO NOTHING
-- so re-runs never duplicate or overwrite existing quota rows.

-- ── Legacy shape: one element per tier with a nested "quotas" object ─────────
INSERT INTO "membership_tier_entitlements" ("id", "tier_id", "resource_key", "quota_value")
SELECT
  t."id" || '__ent__' || q."key",
  t."id",
  q."key",
  q."value"
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(mp."tier_entitlements") = 'array' THEN mp."tier_entitlements" ELSE '[]'::jsonb END
) AS e("elem")
CROSS JOIN LATERAL jsonb_each_text(e."elem" -> 'quotas') AS q("key", "value")
WHERE mp."deleted_at" IS NULL
  AND e."elem" ->> 'tier' IS NOT NULL
  AND jsonb_typeof(e."elem" -> 'quotas') = 'object'
  AND t."tier"::text = CASE
        WHEN lower(e."elem" ->> 'tier') = 'normal' THEN 'Standard'
        ELSE e."elem" ->> 'tier'
      END
ON CONFLICT ("tier_id", "resource_key") DO NOTHING;

-- ── Flat shape (defensive): [{ resourceKey, standard, pro, proPlus }] ────────
INSERT INTO "membership_tier_entitlements" ("id", "tier_id", "resource_key", "quota_value")
SELECT
  t."id" || '__ent__' || COALESCE(e."elem" ->> 'resourceKey', e."elem" ->> 'name'),
  t."id",
  COALESCE(e."elem" ->> 'resourceKey', e."elem" ->> 'name'),
  CASE t."tier"
    WHEN 'Pro+'::"PlanTier" THEN COALESCE(e."elem" ->> 'proPlus', e."elem" ->> 'pro', e."elem" ->> 'standard')
    WHEN 'Pro'::"PlanTier"  THEN COALESCE(e."elem" ->> 'pro', e."elem" ->> 'standard')
    ELSE e."elem" ->> 'standard'
  END
FROM "membership_plan_tiers" t
JOIN "membership_plans" mp ON mp."id" = t."plan_id"
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(mp."tier_entitlements") = 'array' THEN mp."tier_entitlements" ELSE '[]'::jsonb END
) AS e("elem")
WHERE mp."deleted_at" IS NULL
  AND e."elem" ->> 'tier' IS NULL
  AND COALESCE(e."elem" ->> 'resourceKey', e."elem" ->> 'name') IS NOT NULL
  AND CASE t."tier"
        WHEN 'Pro+'::"PlanTier" THEN COALESCE(e."elem" ->> 'proPlus', e."elem" ->> 'pro', e."elem" ->> 'standard')
        WHEN 'Pro'::"PlanTier"  THEN COALESCE(e."elem" ->> 'pro', e."elem" ->> 'standard')
        ELSE e."elem" ->> 'standard'
      END IS NOT NULL
ON CONFLICT ("tier_id", "resource_key") DO NOTHING;
