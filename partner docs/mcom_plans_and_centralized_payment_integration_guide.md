# MCOM Ecosystem Guide: Plans CRUD & Centralized In-App Payment Integration

A complete, all-in-one technical manual for integrating any partner service (e.g., MCOM Mall, MCOM VCards, MCOM Loyalty, 247GBS) with **MCOM Solutions**. 

This document explains:
1. **How to structure your Plan CRUD endpoints** so the MCOM Console can manage pricing, quotas, and tiers dynamically.
2. **How to handle Centralized In-App Payments** so users can buy or upgrade plans directly inside your platform without ever leaving your UI.
3. **How to process lifecycle webhooks** to activate, renew, and expire user entitlements in real-time.

---

## 1. High-Level Architecture

MCOM operates on a **hub-and-spoke** model:
- **MCOM Solutions (Central):** The authoritative merchant of record, payment processor (Stripe, PayPal, Centralized Wallet), SSO identity provider, and governance console.
- **Partner Service (e.g. MCOM Mall):** Provides domain-specific features (stores, products, loyalty, vcards), displays plans to users, embeds the payment form, and enforces quotas.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 MCOM SOLUTIONS (CENTRAL)                               │
│                                                                                        │
│   ┌─────────────────────┐   ┌───────────────────────────────┐   ┌──────────────────┐   │
│   │     MCOM Console    │   │      Central Payment Hub      │   │  Identity & SSO  │   │
│   │    (Admin Portal)   │   │ (Stripe, PayPal, MCOM Wallet) │   │   (OAuth2/JWT)   │   │
│   └──────────┬──────────┘   └───────────────┬───────────────┘   └────────┬─────────┘   │
└──────────────┼──────────────────────────────┼────────────────────────────┼─────────────┘
               │                              │                            │
   1. Console  │                              │ 3. Proxied                 │ 2. SSO Token
   Plan CRUD   │                              │    In-App Checkout         │    Linkage
   API Calls   │                              │    & Confirm               │
               ▼                              ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PARTNER PLATFORM (e.g. MCOM Mall)                         │
│                                                                                        │
│   ┌──────────────────────────────────────────┐  ┌──────────────────────────────────┐   │
│   │             Partner Backend              │  │         Partner Frontend         │   │
│   │  - /api/v1/system/plans (Admin CRUD)     │  │  - Native Pricing Table          │   │
│   │  - /api/v1/mcom/packages/purchase/...    │  │  - Embedded Stripe Elements Form │   │
│   │  - /api/v1/mcom/webhook (Lifecycle)      │  │  - Zero-Redirect Checkout Flow   │   │
│   └──────────────────────────────────────────┘  └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables Matrix

Add these configuration values to your partner service's `.env` file:

```bash
# ── MCOM CENTRAL CONNECTIVITY ──────────────────────────────────────────────────
# Central Base URL (Local: http://localhost:3010 | Staging: https://staging.auth.mcomsolutions.com | Prod: https://auth.mcomsolutions.com)
MCOM_SOLUTIONS_URL=https://auth.mcomsolutions.com

# Your Platform Identifier (Registered in MCOM Console, e.g., 'mall', 'vcard', 'loyalty')
MCOM_PLATFORM_SLUG=mall

# ── SECURITY CREDENTIALS (Generated from MCOM Console Admin) ───────────────────
# 1. System API Key: Authorizes MCOM Solutions when it calls your /system/plans CRUD endpoints
MCOM_SOLUTION_API_KEY=key_shared_system_api_key_here

# 2. OAuth2 Client Credentials: Used to authenticate SSO user sessions
MCOM_CLIENT_ID=mcom-mall
MCOM_CLIENT_SECRET=sec_oauth_client_secret_here

# 3. Webhook Secret: Used to verify signatures of inbound events from Central
MCOM_WEBHOOK_SECRET=sec_webhook_signing_secret_here

# ── PUBLIC APP URLS ────────────────────────────────────────────────────────────
WEB_PUBLIC_URL=https://mall.mcomsolutions.com
```

---

## 3. Part 1: Structuring the Plan CRUD API (`/system/plans`)

MCOM Solutions Console empowers administrators to manage plan pricing, feature quotas, trial lengths, and seasonal campaigns for your service. Your backend must expose a standardized set of endpoints.

### 3.1 Authentication
Every request from the MCOM Console to your backend contains the `x-mcom-solution-api-key` header:
```http
x-mcom-solution-api-key: your-configured-mcom-solution-api-key
```
If the header is missing or does not match `process.env.MCOM_SOLUTION_API_KEY`, immediately return `401 Unauthorized`.

---

### 3.2 Plan Data Structure & Schema
Your database/ORM `Plan` (or `Tier`) entity should follow this format:

```typescript
interface PlanDto {
  id: string;                      // Unique Plan ID (UUID or slug)
  name: string;                    // e.g. "Gold Plan", "Pro Business"
  description?: string;            // Short description
  monthlyPrice: number;            // GBP amount (e.g. 29.99)
  quarterlyPrice: number;          // GBP amount (e.g. 79.99)
  annualPrice: number;             // GBP amount (e.g. 299.99)
  features: string[];              // Marketing bullet points
  configuration: {
    quotas: Record<string, number | boolean>; // Quotas: number (-1 = unlimited) or boolean
    featureFlags: Record<string, boolean>;     // Feature toggles
  };
  isActive: boolean;               // True if visible & purchasable
  isDefault: boolean;              // True if this is the fallback free plan
  type: 'STANDARD' | 'TRIAL' | 'SEASONAL';
  trialDuration?: number;          // In days (required if type === 'TRIAL')
  seasonId?: string;               // UUID of season (required if type === 'SEASONAL')
  stripeMonthlyPriceId?: string;   // Synced Stripe Price ID
  stripeQuarterlyPriceId?: string; // Synced Stripe Price ID
  stripeAnnualPriceId?: string;    // Synced Stripe Price ID
  paypalMonthlyPlanId?: string;    // Synced PayPal Plan ID
  paypalQuarterlyPlanId?: string;  // Synced PayPal Plan ID
  paypalAnnualPlanId?: string;     // Synced PayPal Plan ID
  created_at: string;
  updated_at: string;
}
```

---

### 3.3 The 5 Core CRUD Endpoints

All endpoints are relative to `<YOUR_BILLING_API_URL>/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/system/plans` | Return all plans (active and inactive). |
| `GET` | `/system/plans/:id` | Return a single plan by ID. |
| `POST` | `/system/plans` | Create a new plan. |
| `PATCH` | `/system/plans/:id` | Update an existing plan (pricing, quotas, toggles). |
| `DELETE` | `/system/plans/:id` | Archive or soft-delete a plan. |

#### 1. List All Plans: `GET /system/plans`
- **Response:** `200 OK`
```json
[
  {
    "id": "7b093f1d-192a-4ce4-8e12-32a89345091a",
    "name": "Gold Plan",
    "description": "For high-volume retail businesses",
    "monthlyPrice": 49.99,
    "quarterlyPrice": 129.99,
    "annualPrice": 499.99,
    "features": [
      "Up to 100 listings",
      "Custom domain support",
      "Priority customer service"
    ],
    "configuration": {
      "quotas": {
        "maxListings": 100,
        "maxProducts": 50,
        "maxGiftCardTemplates": 10,
        "allowProductListing": true
      },
      "featureFlags": {
        "priorityInSearch": true,
        "advancedAnalytics": true,
        "allowCustomBranding": true
      }
    },
    "isActive": true,
    "isDefault": false,
    "type": "STANDARD",
    "stripeMonthlyPriceId": "price_1Pk...",
    "created_at": "2026-08-15T12:00:00.000Z",
    "updated_at": "2026-08-15T12:00:00.000Z"
  }
]
```

#### 2. Create Plan: `POST /system/plans`
- **Request Body:**
```json
{
  "name": "Silver Starter",
  "description": "Standard business plan",
  "monthlyPrice": 19.99,
  "quarterlyPrice": 49.99,
  "annualPrice": 199.99,
  "features": ["20 listings", "Basic analytics"],
  "configuration": {
    "quotas": {
      "maxListings": 20,
      "maxProducts": 10
    },
    "featureFlags": {
      "advancedAnalytics": false
    }
  },
  "isActive": true,
  "isDefault": false,
  "type": "STANDARD"
}
```
- **Response:** `201 Created` returning the saved plan object.

#### 3. Update Plan: `PATCH /system/plans/:id`
- **Request Body (Partial update):**
```json
{
  "monthlyPrice": 24.99,
  "configuration": {
    "quotas": {
      "maxListings": 30
    }
  }
}
```
- **Response:** `200 OK` returning the updated plan object.

#### 4. Delete Plan: `DELETE /system/plans/:id`
- **Response:** `200 OK` `{"success": true}`

---

### 3.4 Dynamic Schema Discovery: `GET /system/plans/schema` (Recommended)

To make MCOM Console automatically generate dynamic input fields for your platform's specific quotas and feature toggles, expose this endpoint:

- **Endpoint:** `GET /system/plans/schema`
- **Auth:** `x-mcom-solution-api-key`
- **Response:** `200 OK`

```json
{
  "quotas": [
    { "key": "maxListings", "label": "Max Listings Allowance", "type": "number", "unlimited": true },
    { "key": "maxProducts", "label": "Max Products in Catalog", "type": "number", "unlimited": true },
    { "key": "allowProductListing", "label": "Enable Product Listings", "type": "boolean" },
    { "key": "allowServiceListing", "label": "Enable Service Listings", "type": "boolean" }
  ],
  "featureFlags": [
    { "key": "priorityInSearch", "label": "Search Priority Boost", "type": "boolean" },
    { "key": "advancedAnalytics", "label": "Advanced Analytics Dashboard", "type": "boolean" },
    { "key": "allowCustomBranding", "label": "Custom Brand Colors & Domain", "type": "boolean" }
  ]
}
```

---

## 4. Part 2: Centralized In-App Payments (Embedded Checkout)

Users must be able to upgrade or purchase plans **directly on your platform without redirecting to an external site**. MCOM Solutions acts as the central payment processor and Merchant of Record.

```
┌────────────────────────┐         ┌────────────────────────┐         ┌────────────────────────┐
│    Partner Frontend    │         │    Partner Backend     │         │ MCOM Solutions Central │
│                        │         │                        │         │                        │
│ 1. User picks plan     │         │                        │         │                        │
│ 2. Initiates payment   │────────▶│ Proxies to Central     │────────▶│ Creates Stripe Intent/ │
│                        │         │ (with user's token)    │         │ PayPal Order           │
│ 3. Receives Secret     │◀────────│ Returns clientSecret   │◀────────│                        │
│ 4. Renders Elements UI │         │                        │         │                        │
│ 5. Confirms with Card  │         │                        │         │                        │
│ 6. Submits confirmation│────────▶│ Calls Central Confirm  │────────▶│ Validates Intent &     │
│                        │         │                        │         │ creates PlatformPackage│
│ 7. Instant unlock!     │◀────────│ Returns { activated }  │◀────────│                        │
└────────────────────────┘         └────────────────────────┘         └────────────────────────┘
```

---

### 4.1 Step 1: Initiate Payment (Partner Backend Proxy)

When the user clicks "Subscribe" or "Upgrade", the partner frontend calls the partner backend. The backend forwards the request to MCOM Central including the user's decrypted MCOM Central OAuth access token.

#### Partner Backend Route: `POST /api/v1/mcom/packages/purchase/initiate`
- **Request Body:**
```json
{
  "externalPlanId": "7b093f1d-192a-4ce4-8e12-32a89345091a",
  "billingCycle": "monthly",
  "provider": "stripe"
}
```

#### Backend Implementation:
```typescript
import axios from 'axios';

export async function initiatePurchase(userId: string, body: {
  externalPlanId: string;
  billingCycle: 'monthly' | 'quarterly' | 'annual';
  provider: 'stripe' | 'paypal' | 'wallet';
  returnUrl?: string;
  cancelUrl?: string;
}) {
  // 1. Retrieve the user's linked MCOM Central OAuth Access Token
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.mcomAccessToken) {
    throw new Error('User is not authenticated with MCOM SSO');
  }
  
  const centralToken = decryptToken(user.mcomAccessToken);
  const platformSlug = process.env.MCOM_PLATFORM_SLUG; // e.g. 'mall'

  // 2. Call Central to initiate payment
  const res = await axios.post(
    `${process.env.MCOM_SOLUTIONS_URL}/api/v1/payment/platform/${body.provider}/initiate`,
    {
      platform: platformSlug,
      externalPlanId: body.externalPlanId,
      billingCycle: body.billingCycle,
      returnUrl: body.returnUrl || `${process.env.WEB_PUBLIC_URL}/payment/success`,
      cancelUrl: body.cancelUrl || `${process.env.WEB_PUBLIC_URL}/payment/cancel`,
    },
    {
      headers: {
        Authorization: `Bearer ${centralToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  // For Stripe: returns { clientSecret: 'pi_xxx_secret_yyy', type: 'payment', plan: { ... } }
  // For Trials: returns { clientSecret: 'seti_xxx_secret_yyy', type: 'setup', plan: { ... } }
  return res.data;
}
```

---

### 4.2 Step 2: Embedded Payment UI in Frontend (Stripe Elements)

The partner frontend mounts the native Stripe Elements `<PaymentElement />` in a modal or checkout card using the returned `clientSecret`.

```tsx
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function InAppCheckoutModal({ clientSecret, planId, billingCycle, onSuccess, onClose }) {
  return (
    <div className="checkout-modal-backdrop">
      <div className="checkout-modal-card">
        <h3>Complete Your Subscription</h3>
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <CheckoutForm 
            planId={planId} 
            billingCycle={billingCycle} 
            onSuccess={onSuccess} 
            onClose={onClose} 
          />
        </Elements>
      </div>
    </div>
  );
}

function CheckoutForm({ planId, billingCycle, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    // 1. Confirm payment directly with Stripe (in-place, no full-page redirect)
    const { error, paymentIntent, setupIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed');
      setIsProcessing(false);
      return;
    }

    const intentId = paymentIntent?.id || setupIntent?.id;

    try {
      // 2. Notify your backend to activate entitlements via Central
      const response = await fetch('/api/v1/mcom/packages/purchase/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalPlanId: planId,
          billingCycle,
          paymentIntentId: intentId,
        }),
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(result.package);
      } else {
        setErrorMessage('Failed to activate subscription. Please contact support.');
      }
    } catch (err) {
      setErrorMessage('Network error during confirmation.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {errorMessage && <div className="error-banner">{errorMessage}</div>}
      <div className="button-group">
        <button type="button" onClick={onClose} disabled={isProcessing}>Cancel</button>
        <button type="submit" disabled={!stripe || isProcessing}>
          {isProcessing ? 'Activating...' : 'Pay & Activate'}
        </button>
      </div>
    </form>
  );
}
```

---

### 4.3 Step 3: Confirm Purchase & Activate Entitlements (Partner Backend)

#### Partner Backend Route: `POST /api/v1/mcom/packages/purchase/confirm`
The partner backend forwards the confirmation to Central, which registers the `PlatformPackage`, updates subscription status, and returns the active package.

```typescript
export async function confirmStripePurchase(userId: string, body: {
  externalPlanId: string;
  billingCycle: string;
  paymentIntentId: string;
}) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const centralToken = decryptToken(user.mcomAccessToken);

  // 1. Confirm with Central
  const res = await axios.post(
    `${process.env.MCOM_SOLUTIONS_URL}/api/v1/payment/platform/stripe/confirm`,
    {
      platform: process.env.MCOM_PLATFORM_SLUG,
      externalPlanId: body.externalPlanId,
      billingCycle: body.billingCycle,
      paymentIntentId: body.paymentIntentId,
    },
    {
      headers: { Authorization: `Bearer ${centralToken}` }
    }
  );

  // 2. Update local user quotas & tier immediately
  const localPlan = await db.plan.findUnique({ where: { id: body.externalPlanId } });
  await db.user.update({
    where: { id: userId },
    data: {
      activePlanId: localPlan.id,
      quotas: localPlan.configuration.quotas,
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });

  return { success: true, package: res.data };
}
```

---

## 5. Part 3: Real-Time Lifecycle Webhooks (`/mcom/webhook`)

When recurring subscriptions renew, cancel, or expire, MCOM Central sends an HMAC-signed webhook to your service.

### 5.1 Webhook Verification
Your endpoint must verify the `X-Mcom-Webhook-Signature` header:

```typescript
import crypto from 'crypto';

export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expectedSignature = signatureHeader.replace('sha256=', '');
  const calculatedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(calculatedSignature));
}
```

### 5.2 Webhook Handler Implementation

```typescript
// POST /api/v1/mcom/webhook
app.post('/api/v1/mcom/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-mcom-webhook-signature'] as string;
  const isValid = verifyWebhookSignature(req.body, signature, process.env.MCOM_WEBHOOK_SECRET!);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = JSON.parse(req.body.toString());
  const { event: eventType, data } = event;

  switch (eventType) {
    case 'package.created':
    case 'package.renewed': {
      // Find local user by MCOM Central User ID
      const user = await db.user.findOne({ where: { mcomUserId: data.mcomUserId } });
      if (user) {
        await user.update({
          activePlanId: data.externalPlanId,
          planExpiresAt: new Date(data.expiresAt),
          status: 'active'
        });
      }
      break;
    }

    case 'package.cancelled': {
      const user = await db.user.findOne({ where: { mcomUserId: data.mcomUserId } });
      if (user) {
        await user.update({ autoRenew: false });
      }
      break;
    }

    case 'package.expired': {
      const user = await db.user.findOne({ where: { mcomUserId: data.mcomUserId } });
      if (user) {
        // Downgrade to default free plan
        const defaultPlan = await db.plan.findOne({ where: { isDefault: true } });
        await user.update({
          activePlanId: defaultPlan?.id || null,
          status: 'expired'
        });
      }
      break;
    }
  }

  return res.status(200).json({ received: true });
});
```

---

## 6. Integration Checklist

Before deploying your integration, ensure you have completed and verified each item:

- [ ] Registered your application in **MCOM Solutions Console** and obtained `MCOM_PLATFORM_SLUG`, `MCOM_SOLUTION_API_KEY`, and `MCOM_WEBHOOK_SECRET`.
- [ ] Implemented `/api/v1/system/plans` CRUD endpoints and verified that MCOM Console can create, read, update, and delete plans.
- [ ] *(Optional)* Implemented `/api/v1/system/plans/schema` so the MCOM Console generates platform-specific quota fields.
- [ ] Implemented the backend payment proxy `/api/v1/mcom/packages/purchase/initiate` forwarding to Central with user's OAuth token.
- [ ] Embedded **Stripe Elements** in the frontend to process payment with `redirect: 'if_required'`.
- [ ] Implemented `/api/v1/mcom/packages/purchase/confirm` to confirm with Central and immediately unlock quotas.
- [ ] Implemented the `/api/v1/mcom/webhook` handler with HMAC signature validation to handle background renewals, cancellations, and expirations.
