# MCOM Solutions — Plans CRUD Integration

## Overview

MCOM Solutions admin can manage subscription plans by calling the MCOM Mall backend API. Plans map to the **Tier** entity (monthly/quarterly/annual pricing with feature quotas).

**Base URL:** `<MALL_API_BASE>/api/v1` (e.g. `https://mcom-mall-api.com/api/v1`)

**Auth Header:** `x-mcom-solution-api-key` — shared secret agreed between both teams.

---

## Authentication

Every request must include:

```
x-mcom-solution-api-key: <your-api-key>
```

If missing or invalid, the API returns `401 Unauthorized`.

> ⚠️ Keep this key secret — it grants admin-level access to create, update, and delete plans. Never expose it client-side.

---

## Endpoints

### Create a Plan

```
POST /system/plans
```

**Request body:**

```json
{
  "name": "Gold Plan",
  "description": "Premium tier for established businesses",
  "monthlyPrice": 29.99,
  "quarterlyPrice": 79.99,
  "annualPrice": 299.99,
  "features": ["Priority support", "Increased listing limit", "Custom domain"],
  "configuration": {
    "quotas": {
      "maxListings": 100,
      "allowProductListing": true,
      "allowServiceListing": true,
      "maxProducts": 50,
      "maxServices": 50,
      "maxGiftCardTemplates": 5,
      "maxCouponTemplates": 10,
      "maxLoyaltyPrograms": 1,
      "maxImagesPerListing": 5,
      "featuredListingAllowance": 2
    },
    "featureFlags": {
      "priorityInSearch": true,
      "advancedAnalytics": true,
      "dedicatedSupport": true,
      "allowCustomBranding": false,
      "allowGroupCreation": true
    }
  },
  "isActive": true,
  "isDefault": false,
  "type": "STANDARD",
  "stripeMonthlyPriceId": "price_abc123",
  "stripeQuarterlyPriceId": "price_def456",
  "stripeAnnualPriceId": "price_ghi789",
  "paypalMonthlyPlanId": "P-123456",
  "paypalQuarterlyPlanId": "P-789012",
  "paypalAnnualPlanId": "P-345678"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "name": "Gold Plan",
  "monthlyPrice": 29.99,
  "quarterlyPrice": 79.99,
  "annualPrice": 299.99,
  "features": ["Priority support", "Increased listing limit", "Custom domain"],
  "configuration": { "...": "..." },
  "isActive": true,
  "isDefault": false,
  "type": "STANDARD",
  "created_at": "2026-07-15T10:00:00.000Z",
  "updated_at": "2026-07-15T10:00:00.000Z"
}
```

---

### Get All Plans

```
GET /system/plans
```

Returns all plans (no pagination needed — plans are typically < 50).

**Response:** `200 OK`

```json
[
  {
    "id": "uuid-1",
    "name": "Gold Plan",
    "monthlyPrice": 29.99,
    "quarterlyPrice": 79.99,
    "annualPrice": 299.99,
    "type": "STANDARD",
    "isActive": true,
    "isDefault": true,
    "configuration": { "...": "..." },
    "features": ["..."],
    "created_at": "...",
    "updated_at": "..."
  },
  {
    "id": "uuid-2",
    "name": "Trial",
    "type": "TRIAL",
    "trialDuration": 14,
    "monthlyPrice": 0,
    "quarterlyPrice": 0,
    "annualPrice": 0,
    "isActive": true,
    "isDefault": false,
    "configuration": { "...": "..." },
    "created_at": "...",
    "updated_at": "..."
  }
]
```

---

### Get a Plan by ID

```
GET /system/plans/:id
```

**Response:** `200 OK` — single plan object, or `404 Not Found`

---

### Update a Plan

```
PATCH /system/plans/:id
```

Send only the fields you want to change:

```json
{
  "monthlyPrice": 34.99,
  "features": ["Priority support", "Unlimited listings"],
  "configuration": {
    "quotas": {
      "maxListings": -1
    }
  }
}
```

**Response:** `200 OK` — the updated plan object

---

### Delete a Plan

```
DELETE /system/plans/:id
```

**Response:** `200 OK`

---

## Public Endpoints (No Auth Required)

These already exist on the mall backend for customers/businesses to view plans:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tiers` | List all active plans |
| GET | `/tiers/:id` | Get plan details |

No API key needed — these are open to the public.

---

## Plan Types

| Type | Description | Required Extra Fields |
|------|-------------|----------------------|
| `STANDARD` | Regular paid plan | — |
| `TRIAL` | Free trial plan (only one allowed globally) | `trialDuration` (days, > 0) |
| `SEASONAL` | Time-limited plan | `seasonId` (valid UUID from seasons) |

---

## Configuration Object (`configuration`)

### `quotas`

| Field | Type | Description |
|-------|------|-------------|
| `maxListings` | number | `-1` for unlimited |
| `allowProductListing` | boolean | |
| `allowServiceListing` | boolean | |
| `maxProducts` | number | `-1` for unlimited |
| `maxServices` | number | `-1` for unlimited |
| `maxGiftCardTemplates` | number | `-1` for unlimited |
| `maxCouponTemplates` | number | `-1` for unlimited |
| `maxLoyaltyPrograms` | number | `-1` for unlimited |
| `maxImagesPerListing` | number | |
| `featuredListingAllowance` | number | |

### `featureFlags`

| Field | Type | Description |
|-------|------|-------------|
| `priorityInSearch` | boolean | |
| `advancedAnalytics` | boolean | |
| `dedicatedSupport` | boolean | |
| `allowCustomBranding` | boolean | |
| `allowGroupCreation` | boolean | |

---

## Error Responses

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid API key |
| `404` | Plan not found |
| `409` | Conflict (e.g. duplicate plan name, trial tier already exists) |
| `400` | Validation error (e.g. trial tier without `trialDuration`, seasonal tier without `seasonId`) |

Error body:

```json
{
  "message": "Tier with this name already exists",
  "error": "Conflict",
  "statusCode": 409
}
```

---

## Implementation Checklist for MCOM Solutions

1. Store `MCOM_SOLUTION_API_KEY` in your backend's environment variables / secrets manager
2. Build your admin UI to manage plans (name, pricing, features, quotas)
3. On each CRUD action, make an HTTP request to the mall API with the `x-mcom-solution-api-key` header
4. Handle errors gracefully (conflicts, validation failures, etc.)
5. After Stripe/PayPal price creation on your end, send back the price/plan IDs via the `stripe*PriceId` / `paypal*PlanId` fields
