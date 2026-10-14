-- Removes legacy demo/seed numbers so /admin dashboards show real data only.
-- Idempotent: exact-match DELETEs plus an unconditional counter reset.
--
-- Context:
-- * ecosystem_platforms.total_users held seeded demo numbers
--   (1240/890/2100/450/320/3100 = 8100). GET /admin/stats no longer reads
--   this column (it counts non-admin users live), so zero it everywhere.
-- * revenue_records / admin_payments / ecosystem_subscriptions held the exact
--   tuples inserted by prisma/seed.ts (now removed from the seed). Only those
--   exact tuples are deleted; real rows are untouched.

-- 1. Platform user counters: drop the seeded "8100 users" figure.
UPDATE "ecosystem_platforms" SET "total_users" = 0;

-- 2. Seeded revenue rows (exact seed tuples only).
DELETE FROM "revenue_records"
WHERE "date" = '2026-04-01' AND "amount" = 12800 AND "type" = 'Membership' AND "source" = 'Monthly billing';
DELETE FROM "revenue_records"
WHERE "date" = '2026-04-02' AND "amount" = 4500 AND "type" = 'Package' AND "source" = 'Package subscriptions';
DELETE FROM "revenue_records"
WHERE "date" = '2026-04-03' AND "amount" = 3200 AND "type" = 'One-time' AND "source" = 'Setup fees';

-- 3. Seeded payments (fake business ids + seed invoices only).
DELETE FROM "admin_payments"
WHERE "invoice" IN ('INV-001', 'INV-003')
  AND "business_id" IN ('global-retailers-id', 'eco-market-id');

-- 4. Seeded subscriptions (fake business ids that match no real profile).
DELETE FROM "ecosystem_subscriptions"
WHERE "business_id" IN ('global-retailers-id', 'eco-market-id');
