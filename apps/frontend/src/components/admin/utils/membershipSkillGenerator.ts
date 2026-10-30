/**
 * Generates a comprehensive AI integration skill prompt (SKILL.md)
 * for external platforms to integrate with MCOM Membership Entitlements
 * and Programme Task-Gated Trial Access.
 */
export function generateMembershipSkillPrompt(): string {
  const mcomBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

  return `# MCOM Solutions: Membership Entitlement & Task-Gated Trial Integration Skill
> Standard Protocol Version: 2026-10-01
> Target: External Platform Engineers, Relying Parties & Autonomous AI Agents

This document is an executable AI Integration Skill. When integrating any platform (e.g., MCOM Mall, MCOM Rewards, GBS Audit, MCOM Spin, or custom ecosystem apps) with **MCOM Solutions Central**, follow this specification to enforce membership access and trial periods.

---

## 1. System Architecture & Roles

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                 MCOM SOLUTIONS CENTRAL                      │
│                                                             │
│  1. /admin/console     ── Registers External SSO Clients    │
│  2. /admin/memberships ── Bundles External Plans in Tiers   │
│  3. /admin/programme   ── Sets £1 Verification & Tasks      │
│  4. SsoService         ── Master Entitlement Authority      │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
     (SSO Login / UserInfo)         (Webhooks / Introspect)
               │                              │
               ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│              EXTERNAL PLATFORM (RELYING PARTY)              │
│                                                             │
│  - Receives PlatformEntitlement object                      │
│  - Checks access.hasAccess (true / false)                   │
│  - Provisions bundled planId & quotas                       │
│  - Enforces trial-gated tasks (programmeTasks)              │
│  - Shows upgradeUrl if not entitled                         │
└─────────────────────────────────────────────────────────────┘
\`\`\`

1. **MCOM Central (Identity & Governance Authority):**
   - Manages businesses, subscriptions, payments, and global memberships (Bronze, Silver, Gold, Platinum).
   - Sets the **Verification Fee** (e.g. £1) and **Trial Access Window** (e.g. 14 days) in \`/admin/programme\`.
   - Manages the **Task Engine & Rewards** where tasks can be created for an **External App (from Console)**.

2. **External Platform (Relying Party / Client):**
   - Authenticates users via OAuth 2.0 SSO (\`client_id\`, \`client_secret\`).
   - Receives a standardized **\`PlatformEntitlement\`** payload during login (\`POST /auth/sso/token\`), profile fetch (\`GET /auth/sso/userinfo\`), or real-time introspection (\`GET /auth/sso/entitlement\`).
   - Automatically gates platform access based on membership or active trial tasks.

---

## 2. Entitlement Resolution Rules Engine

When a merchant accesses your platform, MCOM Central resolves access according to this strict priority cascade:

1. **Priority 1: Active Paid Membership Bundle (\`PAID_MEMBERSHIP\`)**
   - The merchant has an explicit, active, and non-expired paid MCOM Membership subscription (e.g., Gold).
   - If your platform was added to that membership's bundle in \`/admin/memberships\` (Bundles step), access is **GRANTED**.
   - Your platform receives the bundled \`planId\` (e.g., \`"mall-pro-vendor"\`), plan name, and quotas.

2. **Priority 2: Direct Standalone Package (\`DIRECT_PACKAGE\`)**
   - The merchant holds a legacy/direct standalone package purchased specifically for your platform.
   - Access is **GRANTED** with direct package quotas.

3. **Priority 3: Task-Gated Trial Access (\`TRIAL_PROGRAMME\`)**
   - The merchant paid the £1 verification fee during onboarding (and has not purchased a recurring paid membership) and is within their trial window (\`now <= trialAccessExpiresAt\`).
   - **CRITICAL CONDITION:** Your platform grants trial access IF an admin has configured at least one active business task in \`/admin/programme\` Task Engine selecting your platform under *External App (from Console)*.
   - If your platform has active tasks: Access is **GRANTED** with \`accessType: 'TRIAL_PROGRAMME'\`, and your platform receives the 14-day trial expiration window (\`plan.expiresAt = trialExpiresAt\`) and the list of \`programmeTasks\` the user needs to complete!
   - If your platform has **no** active tasks: Trial access is **DENIED** with \`reason: 'TRIAL_NO_TASKS'\`.

4. **Fallback: Access Denied (\`hasAccess: false\`)**
   - The user has no qualifying entitlement.
   - Reason codes provided:
     - \`'PLATFORM_NOT_IN_MEMBERSHIP'\`: Member, but your platform wasn't included in their tier.
     - \`'TRIAL_NO_TASKS'\`: In trial, but no active tasks exist for your platform.
     - \`'TRIAL_EXPIRED'\`: Trial duration has expired.
     - \`'UNVERIFIED'\`: Verification fee unpaid.
     - \`'NO_ACTIVE_ENTITLEMENT'\`: No active membership or trial.
   - Pre-built \`upgradeUrl\` points the user to MCOM Central to upgrade or verify.

---

## 3. Data Contract: \`PlatformEntitlement\` Schema

Every SSO token exchange, userinfo request, and introspection check returns this exact JSON schema:

\`\`\`typescript
export interface PlatformEntitlement {
  version: '2026-10-01';

  targetPlatform: {
    clientId: string;            // e.g. "mcom-mall"
    platformSlug: string;        // e.g. "mall"
    name: string;                // e.g. "MCOM Mall"
  };

  access: {
    hasAccess: boolean;          // Primary decision flag (true/false)
    accessType: 'PAID_MEMBERSHIP' | 'TRIAL_PROGRAMME' | 'DIRECT_PACKAGE' | 'NONE';
    reason?:
      | 'PLATFORM_NOT_IN_MEMBERSHIP'
      | 'TRIAL_NO_TASKS'
      | 'TRIAL_EXPIRED'
      | 'UNVERIFIED'
      | 'MEMBERSHIP_EXPIRED'
      | 'NO_ACTIVE_ENTITLEMENT';
    upgradeUrl: string;          // Direct link to MCOM Central to pay or upgrade
  };

  plan: {
    planId: string;              // e.g. "mall-pro-vendor" or "trial_mall"
    planName: string;            // e.g. "Vendor Pro Plan" or "Programme Trial Access"
    source: 'membership' | 'trial' | 'direct';
    status: 'active' | 'trial' | 'expired';
    billingCycle?: string | null;
    expiresAt?: string | null;   // ISO timestamp
    quotas: Record<string, unknown>; // e.g. { productLimit: 100 }
    limits: Record<string, unknown>;
    features: string[];
  } | null;

  membershipContext: {
    membershipPlanName: string | null; // e.g. "Gold"
    membershipLevel: string;           // "Bronze" | "Silver" | "Gold" | "Platinum"
    membershipStatus: string;          // "active" | "trial"
    isIncludedInMembership: boolean;   // true if this app was bundled
  };

  trialContext: {
    isInTrial: boolean;
    hasPaidVerificationFee: boolean;
    trialExpiresAt: string | null;
    daysRemaining: number;
    programmeTasks: Array<{
      taskId: string;
      title: string;
      description: string;
      deadlineDays: number;
      rewardPoints: number;
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
    }>;
  };
}
\`\`\`

---

## 4. Endpoints & Protocol Implementation

### Endpoint 1: OAuth Code Exchange (\`POST /api/v1/auth/sso/token\`)
During the SSO redirect callback, exchange the authorization code:
\`\`\`http
POST ${mcomBaseUrl}/api/v1/auth/sso/token
Content-Type: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTH_CODE_FROM_URL",
  "redirect_uri": "https://your-platform.com/auth/callback"
}
\`\`\`

**Response:**
\`\`\`json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "4a7f8e...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "entitlement": {
    "version": "2026-10-01",
    "access": {
      "hasAccess": true,
      "accessType": "PAID_MEMBERSHIP",
      "upgradeUrl": "${mcomBaseUrl}/dashboard/memberships"
    },
    "plan": {
      "planId": "pro-tier",
      "planName": "Vendor Pro",
      "source": "membership",
      "status": "active",
      "quotas": { "productLimit": 100 },
      "features": ["priority_listing"]
    },
    "membershipContext": {
      "membershipPlanName": "Gold",
      "isIncludedInMembership": true
    },
    "trialContext": {
      "isInTrial": false,
      "programmeTasks": []
    }
  },
  "user": {
    "id": "usr_123",
    "sub": "usr_123",
    "email": "vendor@store.com",
    "role": "BUSINESS",
    "profileType": "BUSINESS",
    "isAffiliate": false,
    "firstName": "Jane",
    "lastName": "Doe",
    "fullName": "Jane Doe",
    "name": "Acme Coffee",
    "jobTitle": "Managing Director",
    "phone": "+44 20 1234 5678",
    "address": "1 High Street, London",
    "postcode": "EC1A 1BB",
    "country": "United Kingdom",
    "businessId": "biz_456",
    "businessName": "Acme Coffee",
    "avatarUrl": "https://cdn.mcom.com/logo.png",
    "businessProfile": {
      "id": "biz_456",
      "businessName": "Acme Coffee",
      "businessType": "Limited Company",
      "phone": "+44 20 1234 5678",
      "email": "hello@acmecoffee.co.uk",
      "address": "1 High Street, London",
      "postcode": "EC1A 1BB",
      "country": "United Kingdom",
      "industry": "Food & Beverage",
      "category": "Coffee Shop",
      "subCategory": "Cafe",
      "description": "Speciality coffee roastery",
      "website": "https://acmecoffee.co.uk",
      "logoUrl": "https://cdn.mcom.com/logo.png",
      "openingHours": "Mon-Sat 8am-6pm",
      "socialMedia": "{\\"instagram\\":\\"@acmecoffee\\"}",
      "membershipLevel": "Gold",
      "membershipStatus": "active",
      "membershipPlanName": "Gold",
      "packages": []
    },
    "customerProfile": null,
    "agentProfile": null,
    "consultantProfile": null,
    "accountManagerProfile": null,
    "permissions": { "canAccess_mall": true },
    "packages": []
  }
}
\`\`\`

#### Identity fields (returned for every role)

\`user\` is the canonical identity — provision your local account from it.
\`firstName\`, \`lastName\`, \`fullName\`, \`email\`, \`phone\`, \`address\`, \`postcode\`,
\`country\`, \`jobTitle\` and \`profileType\` are always present (nullable where the
profile does not store them). One role-specific profile is populated:

| \`profileType\` | Profile object | Key fields |
|---|---|---|
| \`BUSINESS\` | \`businessProfile\` | business name/type, phone, email, address, postcode, country, industry, category, description, website, logo, opening hours, socials, membership, packages |
| \`CUSTOMER\` | \`customerProfile\` | phone, loyalty points, platform usage, membership status |
| \`AGENT\` (includes affiliates) | \`agentProfile\` | phone, permissions, status |
| \`CONSULTANT\` | \`consultantProfile\` | phone, specialisation, status |
| \`ACCOUNT_MANAGER\` | \`accountManagerProfile\` | phone, assigned businesses, status |
| \`PARTNER\` | none | identity fields only |

\`isAffiliate\` is \`true\` for affiliate/partner-portal sign-ups. For businesses,
\`name\` is the business name — use \`fullName\` for the person.

#### Role response shapes

Branch on \`user.profileType\`; never assume \`businessProfile\` exists.

**\`BUSINESS\`** (merchant accounts):
\`\`\`json
{
  "role": "BUSINESS", "profileType": "BUSINESS", "isAffiliate": false,
  "firstName": "Jane", "lastName": "Doe", "fullName": "Jane Doe",
  "name": "Acme Coffee", "email": "owner@acme.com", "jobTitle": "Managing Director",
  "phone": "+44 20 1234 5678", "address": "1 High Street, London",
  "postcode": "EC1A 1BB", "country": "United Kingdom",
  "businessId": "biz_456", "businessName": "Acme Coffee",
  "businessProfile": {
    "businessName": "Acme Coffee", "businessType": "Limited Company",
    "phone": "+44 20 1234 5678", "email": "hello@acmecoffee.co.uk",
    "address": "1 High Street, London", "postcode": "EC1A 1BB",
    "country": "United Kingdom", "industry": "Food & Beverage",
    "category": "Coffee Shop", "website": "https://acmecoffee.co.uk",
    "logoUrl": "https://cdn.mcom.com/logo.png", "membershipLevel": "Gold",
    "membershipStatus": "active", "packages": []
  },
  "customerProfile": null, "agentProfile": null,
  "consultantProfile": null, "accountManagerProfile": null
}
\`\`\`

**\`CUSTOMER\`** (shoppers/consumers):
\`\`\`json
{
  "role": "CUSTOMER", "profileType": "CUSTOMER", "isAffiliate": false,
  "firstName": "Sam", "lastName": "Lee", "fullName": "Sam Lee", "name": "Sam Lee",
  "email": "shopper@example.com", "jobTitle": null, "phone": "+44 7700 900999",
  "address": null, "postcode": null, "country": null,
  "businessId": null, "businessName": null, "businessProfile": null,
  "customerProfile": {
    "phone": "+44 7700 900999", "loyaltyPoints": 120,
    "platformUsage": ["mall"], "membershipStatus": "None", "status": "Active"
  },
  "agentProfile": null, "consultantProfile": null, "accountManagerProfile": null
}
\`\`\`

**\`AGENT\` / affiliate** (247GBS affiliate portal):
\`\`\`json
{
  "role": "AGENT", "profileType": "AGENT", "isAffiliate": true,
  "firstName": "Ade", "lastName": "Okafor", "fullName": "Ade Okafor",
  "name": "Ade Okafor", "email": "ade@247gbs.com", "jobTitle": null,
  "phone": "+44 7700 900123", "address": null, "postcode": null, "country": null,
  "businessId": null, "businessName": null, "businessProfile": null,
  "customerProfile": null,
  "agentProfile": {
    "phone": "+44 7700 900123",
    "permissions": ["view_tasks", "submit_deliverables"], "status": "Active"
  },
  "consultantProfile": null, "accountManagerProfile": null
}
\`\`\`

**\`CONSULTANT\`** (affiliate portal):
\`\`\`json
{
  "role": "CONSULTANT", "profileType": "CONSULTANT", "isAffiliate": true,
  "firstName": "Mia", "lastName": "Frank", "fullName": "Mia Frank", "name": "Mia Frank",
  "email": "consultant@247gbs.com", "phone": "+44 7700 900456",
  "address": null, "postcode": null, "country": null,
  "businessProfile": null, "customerProfile": null, "agentProfile": null,
  "consultantProfile": {
    "phone": "+44 7700 900456", "specialisation": "Retail Growth", "status": "Active"
  },
  "accountManagerProfile": null
}
\`\`\`

**\`ACCOUNT_MANAGER\`** (staff):
\`\`\`json
{
  "role": "ACCOUNT_MANAGER", "profileType": "ACCOUNT_MANAGER", "isAffiliate": true,
  "firstName": "Tunde", "lastName": "Bello", "fullName": "Tunde Bello", "name": "Tunde Bello",
  "email": "manager@247gbs.com", "phone": "+44 7700 900789",
  "address": null, "postcode": null, "country": null,
  "businessProfile": null, "customerProfile": null, "agentProfile": null,
  "consultantProfile": null,
  "accountManagerProfile": {
    "phone": "+44 7700 900789", "assignedBusinesses": 12, "status": "Active"
  }
}
\`\`\`

**\`PARTNER\`** — identity/contact fields only; all profile objects are \`null\`.

> Merchant/consumer apps can branch only on \`BUSINESS\`/\`CUSTOMER\`; affiliate
> portals branch on \`AGENT\`/\`CONSULTANT\`/\`ACCOUNT_MANAGER\`.

---

### Endpoint 2: Real-time Entitlement Introspection (\`GET /api/v1/auth/sso/entitlement\`)
Check or refresh a user's entitlement without requiring them to log in again:

**Option A (Using User Bearer Token):**
\`\`\`http
GET ${mcomBaseUrl}/api/v1/auth/sso/entitlement
Authorization: Bearer <user_access_token>
\`\`\`

**Option B (Server-to-Server via API Key):**
\`\`\`http
GET ${mcomBaseUrl}/api/v1/auth/sso/entitlement?client_id=YOUR_CLIENT_ID&user_id=USER_OR_BUSINESS_ID
X-API-Key: YOUR_MCOM_API_KEY
\`\`\`

---

### Endpoint 3: Webhook Notification Listener (\`POST /webhooks/mcom\`)
Register your webhook endpoint in \`/admin/console\`. MCOM Central dispatches signed HMAC webhooks on entitlement lifecycle changes:

- \`entitlement.trial_started\`: Triggered when a business pays the £1 verification fee. Carries \`trialAccessDays\`, \`trialAccessExpiresAt\`, and the list of active tasks for your platform.
- \`entitlement.membership_assigned\`: Triggered when a business purchases or upgrades a membership bundling your app.

**Webhook Verification:**
Header: \`X-Mcom-Webhook-Signature: sha256_hex_hmac\`
Validate signature using your \`webhookSecret\`.

---

## 5. Ready-to-Use Code Snippets

### Node.js / Express Implementation

\`\`\`typescript
import express from 'express';
import axios from 'axios';

const app = express();
const MCOM_URL = process.env.MCOM_SOLUTIONS_URL || '${mcomBaseUrl}';
const CLIENT_ID = process.env.MCOM_CLIENT_ID;
const CLIENT_SECRET = process.env.MCOM_CLIENT_SECRET;
const REDIRECT_URI = process.env.MCOM_REDIRECT_URI;

// SSO Auth Callback Handler
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const tokenRes = await axios.post(\`\${MCOM_URL}/api/v1/auth/sso/token\`, {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    });

    const { entitlement, user, accessToken } = tokenRes.data;

    // 1. Verify access
    if (!entitlement?.access?.hasAccess) {
      const reason = entitlement?.access?.reason;
      const upgradeUrl = entitlement?.access?.upgradeUrl;
      return res.redirect(\`/upgrade?reason=\${reason}&upgradeUrl=\${encodeURIComponent(upgradeUrl)}\`);
    }

    // 2. Provision local session & store quotas
    const isTrial = entitlement.access.accessType === 'TRIAL_PROGRAMME';
    const planId = entitlement.plan?.planId;
    const quotas = entitlement.plan?.quotas || {};
    const tasks = entitlement.trialContext?.programmeTasks || [];

    req.session.user = {
      // ── Canonical identity (all roles) ────────────────────────────────
      id: user.id,
      email: user.email,
      role: user.role,                    // BUSINESS | CUSTOMER | AGENT | CONSULTANT | ...
      profileType: user.profileType,
      isAffiliate: user.isAffiliate,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      phone: user.phone,
      address: user.address,
      postcode: user.postcode,
      country: user.country,
      jobTitle: user.jobTitle,
      // ── Business profile (null for non-business roles) ────────────────
      businessId: user.businessId,
      businessName: user.businessProfile?.businessName,
      businessType: user.businessProfile?.businessType,
      businessIndustry: user.businessProfile?.industry,
      businessWebsite: user.businessProfile?.website,
      businessLogo: user.avatarUrl,
      // ── Entitlement ───────────────────────────────────────────────────
      planId,
      isTrial,
      quotas,
      tasks,
      accessToken,
    };

    return res.redirect('/dashboard');
  } catch (error) {
    console.error('SSO token exchange failed:', error);
    return res.status(500).send('Authentication failed');
  }
});
\`\`\`

### Next.js App Router Route Handler (\`app/api/auth/callback/route.ts\`)

\`\`\`typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url));

  const response = await fetch(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MCOM_CLIENT_ID,
      client_secret: process.env.MCOM_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MCOM_REDIRECT_URI,
    }),
  });

  const data = await response.json();
  const { entitlement, user } = data;

  if (!entitlement?.access?.hasAccess) {
    const upgradeUrl = entitlement?.access?.upgradeUrl || '/pricing';
    return NextResponse.redirect(upgradeUrl);
  }

  // Set session cookie and redirect
  const res = NextResponse.redirect(new URL('/dashboard', request.url));
  res.cookies.set('mcom_plan', entitlement.plan?.planId || 'standard', { httpOnly: true });
  res.cookies.set('is_trial', entitlement.access.accessType === 'TRIAL_PROGRAMME' ? 'true' : 'false');
  return res;
}
\`\`\`

---

## 6. Key Takeaways for Developers

* **Always check \`entitlement.access.hasAccess\` first.** Do not rely solely on user roles.
* **Provision identity from \`user\`.** It carries firstName, lastName, fullName, email, phone, address, postcode, country and the role-specific profile (business, customer, agent, consultant, account manager).
* **If \`hasAccess === false\`, direct the user to \`entitlement.access.upgradeUrl\`** so they can purchase the membership or pay the £1 verification fee.
* **During trial, display \`programmeTasks\` prominently.** This guides the merchant to complete their required onboarding missions to maximize engagement.
`;
}
