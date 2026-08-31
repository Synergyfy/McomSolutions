-- Phase 1 — Data integrity: phone columns, sector/category catalog, FX rates.

-- 1. Phone columns on admin profile tables (populated at registration).
ALTER TABLE "customer_profiles" ADD COLUMN "phone" TEXT;
ALTER TABLE "agent_profiles" ADD COLUMN "phone" TEXT;
ALTER TABLE "consultant_profiles" ADD COLUMN "phone" TEXT;
ALTER TABLE "account_manager_profiles" ADD COLUMN "phone" TEXT;

-- 2. Sector / Category / SubCategory catalog (drives onboarding picker + Google mapping).
CREATE TABLE "sectors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sub_categories" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "google_category_mappings" (
    "id" TEXT NOT NULL,
    "google_type" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "google_category_mappings_pkey" PRIMARY KEY ("id")
);

-- 3. FX rates (wallet top-up conversion).
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rate" DECIMAL(10,6) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes.
CREATE UNIQUE INDEX "sectors_slug_key" ON "sectors"("slug");
CREATE INDEX "sectors_sort_order_idx" ON "sectors"("sort_order");

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_sector_id_idx" ON "categories"("sector_id");
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

CREATE UNIQUE INDEX "sub_categories_slug_key" ON "sub_categories"("slug");
CREATE INDEX "sub_categories_category_id_idx" ON "sub_categories"("category_id");
CREATE INDEX "sub_categories_sort_order_idx" ON "sub_categories"("sort_order");

CREATE UNIQUE INDEX "google_category_mappings_google_type_key" ON "google_category_mappings"("google_type");
CREATE INDEX "google_category_mappings_category_id_idx" ON "google_category_mappings"("category_id");

CREATE UNIQUE INDEX "fx_rates_base_quote_key" ON "fx_rates"("base", "quote");

-- 5. Seed the base catalog.
INSERT INTO "sectors" (id, name, slug, sort_order, created_at, updated_at) VALUES
('sec-retail', 'Retail & Fashion', 'retail', 1, now(), now()),
('sec-food', 'Food & Drink', 'food-drink', 2, now(), now()),
('sec-beauty', 'Beauty & Fitness', 'beauty-fitness', 3, now(), now()),
('sec-other', 'Other', 'other', 99, now(), now());

INSERT INTO "categories" (id, sector_id, name, slug, sort_order, created_at, updated_at) VALUES
('cat-clothing', 'sec-retail', 'Clothing & Fashion', 'clothing', 1, now(), now()),
('cat-accessories', 'sec-retail', 'Accessories & Gifts', 'accessories', 2, now(), now()),
('cat-coffee', 'sec-food', 'Cafes & Coffee', 'cafes', 1, now(), now()),
('cat-bakery', 'sec-food', 'Bakeries', 'bakeries', 2, now(), now()),
('cat-restaurant', 'sec-food', 'Restaurants', 'restaurants', 3, now(), now()),
('cat-grocery', 'sec-food', 'Groceries & Supermarkets', 'groceries', 4, now(), now()),
('cat-hotel', 'sec-food', 'Hotels & Accommodation', 'hotels', 5, now(), now()),
('cat-barber', 'sec-beauty', 'Barbers & Hair', 'barbers', 1, now(), now()),
('cat-salon', 'sec-beauty', 'Beauty Salons', 'beauty-salons', 2, now(), now()),
('cat-gym', 'sec-beauty', 'Gyms & Fitness', 'gyms', 3, now(), now()),
('cat-other', 'sec-other', 'Other', 'other', 99, now(), now());

INSERT INTO "sub_categories" (id, category_id, name, slug, sort_order, created_at, updated_at) VALUES
('sub-clothing', 'cat-clothing', 'Clothing', 'clothing', 1, now(), now()),
('sub-boutique', 'cat-clothing', 'Boutiques', 'boutiques', 2, now(), now()),
('sub-accessories', 'cat-accessories', 'Accessories', 'accessories', 1, now(), now()),
('sub-coffee', 'cat-coffee', 'Coffee', 'coffee', 1, now(), now()),
('sub-tea', 'cat-coffee', 'Tea Rooms', 'tea-rooms', 2, now(), now()),
('sub-bakery', 'cat-bakery', 'Bakery', 'bakery', 1, now(), now()),
('sub-restaurant', 'cat-restaurant', 'Restaurant', 'restaurant', 1, now(), now()),
('sub-grocery', 'cat-grocery', 'Grocery', 'grocery', 1, now(), now()),
('sub-supermarket', 'cat-grocery', 'Supermarket', 'supermarket', 2, now(), now()),
('sub-hotel', 'cat-hotel', 'Hotel', 'hotel', 1, now(), now()),
('sub-barber', 'cat-barber', 'Barber', 'barber', 1, now(), now()),
('sub-hair', 'cat-barber', 'Hair Salon', 'hair-salon', 2, now(), now()),
('sub-salon', 'cat-salon', 'Beauty Salon', 'beauty-salon', 1, now(), now()),
('sub-gym', 'cat-gym', 'Gym', 'gym', 1, now(), now()),
('sub-other', 'cat-other', 'Other', 'other', 1, now(), now());

INSERT INTO "google_category_mappings" (id, google_type, category_id, created_at) VALUES
('gmap-001', 'coffee_shop', 'cat-coffee', now()),
('gmap-002', 'cafe', 'cat-coffee', now()),
('gmap-003', 'bakery', 'cat-bakery', now()),
('gmap-004', 'clothing_store', 'cat-clothing', now()),
('gmap-005', 'restaurant', 'cat-restaurant', now()),
('gmap-006', 'grocery_store', 'cat-grocery', now()),
('gmap-007', 'supermarket', 'cat-grocery', now()),
('gmap-008', 'barber_shop', 'cat-barber', now()),
('gmap-009', 'hair_salon', 'cat-barber', now()),
('gmap-010', 'beauty_salon', 'cat-salon', now()),
('gmap-011', 'gym', 'cat-gym', now()),
('gmap-012', 'hotel', 'cat-hotel', now());

-- 6. Seed default GBP → MCOM rate (adjustable at runtime; MCOM_GBP_RATE overrides at boot).
INSERT INTO "fx_rates" (id, base, quote, rate, created_at, updated_at)
SELECT 'fx-gbp-mcom', 'GBP', 'MCOM', 1, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "fx_rates" WHERE "base" = 'GBP' AND "quote" = 'MCOM');