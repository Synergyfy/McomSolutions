-- Give the canonical seeded memberships opaque primary keys.
--
-- The original seed used the display name as the primary key
-- (bronze/silver/gold/platinum), which leaked the membership name into admin
-- URLs such as /admin/memberships/gold/edit. Membership plans must be addressed
-- by an ID, not by their name.
--
-- This migration copies each affected plan to a fresh UUID, rewrites every
-- reference, then removes the old name-based row. It is safe to re-run: the
-- mapping only contains ids that still exist, and the whole block is a no-op
-- when there is nothing to migrate.

DO $$
DECLARE
  has_mapping BOOLEAN;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _membership_plan_id_map (
    old_id TEXT PRIMARY KEY,
    new_id TEXT NOT NULL UNIQUE
  ) ON COMMIT DROP;

  TRUNCATE _membership_plan_id_map;

  INSERT INTO _membership_plan_id_map (old_id, new_id)
  SELECT mp.id, gen_random_uuid()::text
  FROM "membership_plans" mp
  WHERE mp.id IN ('bronze', 'silver', 'gold', 'platinum');

  SELECT EXISTS (SELECT 1 FROM _membership_plan_id_map) INTO has_mapping;
  IF NOT has_mapping THEN
    RETURN;
  END IF;

  -- 1. Copy the plans under their new ids (all columns, including archived and
  --    soft-deleted rows, so no stale references survive).
  INSERT INTO "membership_plans"
  SELECT (jsonb_populate_record(
    NULL::"membership_plans",
    to_jsonb(mp) || jsonb_build_object('id', m.new_id)
  )).*
  FROM "membership_plans" mp
  JOIN _membership_plan_id_map m ON m.old_id = mp.id;

  -- 2. Relational children and foreign-key style references.
  UPDATE "membership_plan_tiers" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "membership_plan_app_bundles" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "membership_plan_whitelabel_accesses" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "coupon_membership_plans" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "task_reward_coupon_plans" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "coupon_redemptions" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  -- 3. String references (no FK constraint in the schema).
  UPDATE "recurring_subscriptions" child
  SET membership_plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.membership_plan_id = m.old_id;

  UPDATE "partner_grants" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  UPDATE "partner_grants" child
  SET metadata = jsonb_set(child.metadata::jsonb, '{planId}', to_jsonb(m.new_id), false)
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.new_id
    AND jsonb_typeof(child.metadata::jsonb) = 'object'
    AND child.metadata::jsonb ->> 'planId' = m.old_id;

  UPDATE "referral_commissions" child
  SET plan_id = m.new_id
  FROM _membership_plan_id_map m
  WHERE child.plan_id = m.old_id;

  -- 4. Plan id arrays on referral configs.
  UPDATE "referral_configs" config
  SET qualified_membership_plan_ids = ARRAY(
    SELECT COALESCE(m.new_id, plan_id)
    FROM unnest(config.qualified_membership_plan_ids) AS plan_id
    LEFT JOIN _membership_plan_id_map m ON m.old_id = plan_id
  )
  WHERE cardinality(config.qualified_membership_plan_ids) > 0
    AND EXISTS (
      SELECT 1
      FROM unnest(config.qualified_membership_plan_ids) AS plan_id
      JOIN _membership_plan_id_map m ON m.old_id = plan_id
    );

  -- 5. Old name-based rows are no longer referenced.
  DELETE FROM "membership_plans" mp
  USING _membership_plan_id_map m
  WHERE mp.id = m.old_id;
END $$;
