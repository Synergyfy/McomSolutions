/**
 * Generates the single, unified AI integration skill (SKILL.md) for the MCOM
 * ecosystem. It explains every way a user can gain access to a platform
 * registered in /admin/console — membership bundles, access passes, and
 * dashboard/trial access — and how to verify and provision each one over SSO.
 *
 * The same skill is shown on /admin/memberships, /admin/access, and
 * /admin/dashboard-access so every platform team gets one source of truth.
 */
export function generateEcosystemAccessSkillPrompt(): string {
  const mcomBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

  return `# MCOM Central: Ecosystem Access Verification Skill
> Protocol version: 2026-10-01
> Audience: external platform engineers, relying parties, and autonomous AI agents

This is the single integration skill for every platform registered in **MCOM Central Console** (\`/admin/console\`) — MCOM Mall, MCOM Rewards, MCOM Spin, GBS Audit, GBS Expo, or any custom ecosystem app.

When a user signs in through **MCOM Central SSO**, your platform must be able to answer:

1. Does this user have access to **my** platform at all?
2. **Why** do they have access — a membership bundle, an access pass, or a dashboard/trial window?
3. **Which plan or pass** do they hold, and what is its ID?
4. **When does it expire?**
5. **What should I provision** — quotas, limits, and features?

MCOM Central is the single source of truth. Your platform does not need to track purchases, memberships, or trials. Read the \`PlatformEntitlement\` object returned by SSO.

---

## 1. The three ways a user gets access

| Access model | What the user bought | Where admins configure it | \`access.accessType\` | \`plan.source\` |
|---|---|---|---|---|
| **Membership** | A recurring/term membership (e.g. Gold) that bundles plans from multiple platforms | \`/admin/memberships\` | \`PAID_MEMBERSHIP\` | \`membership\` |
| **Access pass** | A one-time central-hub pass that bundles fixed-duration access passes from multiple platforms | \`/admin/access\` | \`DIRECT_PACKAGE\` | \`direct\` |
| **Dashboard access / Trial** | The verification fee (or a free trial when verification is optional) that opens a timed trial window | \`/admin/dashboard-access\` | \`TRIAL_PROGRAMME\` | \`trial\` |
| **No access** | None of the above applies to your platform | — | \`NONE\` | \`null\` |

All three grant access through the **same** \`PlatformEntitlement\` shape. The difference is which fields explain the source.

### How each source is provisioned

- **Membership:** the admin bundles a plan from your platform into a membership. When the business buys or renews that membership, your plan is included for the membership term.
- **Access pass:** the admin bundles one of your published access passes into a central-hub pass in \`/admin/access\`. On purchase, Central Hub provisions a \`PlatformPackage\` for your platform with \`externalPlanId\` = your pass ID, \`status: "active"\`, and \`expiresAt\` = purchase date + your published duration.
- **Dashboard access / Trial:** the business pays the verification fee (or starts a free trial if verification is disabled). Trial access to your platform is granted **only if** an admin has at least one active task in \`/admin/programme\` targeting your app for businesses. If your app has no active tasks, trial access is withheld with \`reason: "TRIAL_NO_TASKS"\`.

---

## 2. Resolution priority (when more than one applies)

Central Hub resolves access in this strict order:

\`\`\`
1. Active membership that bundles your platform   → PAID_MEMBERSHIP
2. Active direct access pass for your platform    → DIRECT_PACKAGE
3. Valid trial window + active tasks for your app  → TRIAL_PROGRAMME
4. Nothing matched                                 → NONE (hasAccess: false)
\`\`\`

**Important:** if a user holds both a membership that bundles your platform and an access pass for it, the entitlement returns \`PAID_MEMBERSHIP\` and \`plan\` describes the membership's plan. Access is still granted. The access-pass record still exists — read \`packages\` from the userinfo endpoint if you need its exact \`externalPlanId\` and \`expiresAt\` (that entry may be labelled \`source: 'membership'\` when the membership also covers your platform, but its \`externalPlanId\` and \`expiresAt\` still identify the pass).

A membership that does **not** include your platform does not block an access pass or trial. In that case \`accessType\` is \`DIRECT_PACKAGE\` or \`TRIAL_PROGRAMME\`, and \`membershipContext.membershipPlanName\` may still show the user's membership (e.g. \`"Gold"\`) with \`isIncludedInMembership: false\`.

---

## 3. The contract: \`PlatformEntitlement\`

Returned by the SSO token exchange, the userinfo endpoint, and the introspection endpoint.

\`\`\`typescript
export interface PlatformEntitlement {
  version: '2026-10-01';

  targetPlatform: {
    clientId: string | null;      // your registered client id
    platformSlug: string | null;  // e.g. "mall"
    name: string | null;          // e.g. "MCOM Mall"
  };

  access: {
    hasAccess: boolean;           // THE authoritative access decision
    accessType: 'PAID_MEMBERSHIP' | 'DIRECT_PACKAGE' | 'TRIAL_PROGRAMME' | 'NONE';
    reason?:
      | 'PLATFORM_NOT_IN_MEMBERSHIP' // has a membership, but your plan is not bundled
      | 'TRIAL_NO_TASKS'             // in trial window, but no active tasks for your app
      | 'TRIAL_EXPIRED'
      | 'UNVERIFIED'                 // verification fee not paid
      | 'MEMBERSHIP_EXPIRED'
      | 'NO_ACTIVE_ENTITLEMENT';
    upgradeUrl: string;           // where to send users who need to buy access
  };

  // The plan/pass resolved FOR YOUR PLATFORM. null when hasAccess is false.
  plan: {
    planId: string;               // membership plan id, access pass id, or trial_<slug>
    planName: string;
    source: 'membership' | 'direct' | 'trial';
    status: 'active' | 'trial' | string;
    billingCycle?: string | null;
    expiresAt?: string | null;    // ISO date for passes/trials; null for membership bundles
    quotas: Record<string, unknown>;
    limits: Record<string, unknown>;
    features: string[];
  } | null;

  membershipContext: {
    membershipPlanName: string | null; // their paid membership name, if any (independent of access source)
    membershipLevel: string;           // "Bronze" | "Silver" | "Gold" | "Platinum"
    membershipStatus: string;          // "active" | "trial" | "past_due" | ...
    isIncludedInMembership: boolean;   // true only if YOUR plan is bundled into their membership
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
      status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED' | string;
    }>;
  };
}
\`\`\`

---

## 4. Identifying which access the user has

### Membership
\`\`\`typescript
const isMembershipAccess =
  entitlement.access.hasAccess &&
  entitlement.access.accessType === 'PAID_MEMBERSHIP' &&
  entitlement.membershipContext.isIncludedInMembership === true &&
  entitlement.plan?.source === 'membership';
\`\`\`
- \`membershipContext.membershipPlanName\` = the membership they bought (e.g. \`"Gold"\`).
- \`membershipContext.membershipLevel\` = tier/level.
- \`plan.planId\` = the plan your platform contributed to that membership.
- \`plan.expiresAt\` is \`null\` — validity follows the membership itself. Use \`access.hasAccess\` and \`membershipContext.membershipStatus\`.

### Access pass
\`\`\`typescript
const isAccessPass =
  entitlement.access.hasAccess &&
  entitlement.access.accessType === 'DIRECT_PACKAGE' &&
  entitlement.plan?.source === 'direct';
\`\`\`
- \`plan.planId\` = the \`externalPlanId\` you published in your access pass catalogue.
- \`plan.expiresAt\` = when **your** pass expires.
- \`plan.quotas\` / \`plan.limits\` = quotas and feature flags from your catalogue configuration.
- \`plan.features\` is currently \`[]\` for direct passes; read flags from quotas/limits.

### Dashboard access / Trial
\`\`\`typescript
const isTrialAccess =
  entitlement.access.hasAccess &&
  entitlement.access.accessType === 'TRIAL_PROGRAMME' &&
  entitlement.plan?.source === 'trial';
\`\`\`
- \`plan.planId\` = \`trial_<platformSlug | clientId | app>\`.
- \`plan.expiresAt\` = \`trialContext.trialExpiresAt\`.
- \`trialContext.daysRemaining\` = days left in the trial.
- \`trialContext.programmeTasks\` = the tasks the business must complete for this app.

### No access
\`\`\`typescript
const hasNoAccess = !entitlement.access.hasAccess || entitlement.plan === null;
\`\`\`
Read \`access.reason\` and redirect to \`access.upgradeUrl\`.

---

## 5. What to provision for each source

| You need | Membership | Access pass | Trial |
|---|---|---|---|
| **Plan/pass ID** | \`plan.planId\` | \`plan.planId\` (your \`externalPlanId\`) | \`plan.planId\` (\`trial_…\`) |
| **Plan name** | \`plan.planName\` | \`plan.planName\` | \`plan.planName\` ("Programme Trial Access") |
| **Membership name** | \`membershipContext.membershipPlanName\` | Usually null, or their membership if unrelated | Usually null, or their membership if unrelated |
| **Expiry** | \`null\` — follows membership; use \`access.hasAccess\` | \`plan.expiresAt\` | \`plan.expiresAt\` / \`trialContext.trialExpiresAt\` |
| **Limits** | \`plan.quotas\` / \`plan.limits\` | \`plan.quotas\` / \`plan.limits\` | \`plan.quotas\` (\`trialAccess\`, \`daysRemaining\`) |
| **Tasks to show** | — | — | \`trialContext.programmeTasks\` |

> \`plan.planName\` / \`plan.planId\` describe **your** plan or pass, not the central-hub bundle the user bought. The central bundle's marketing name is not part of the entitlement.

---

## 6. How to obtain the entitlement

### Option A — SSO code exchange (on login)
\`\`\`http
POST ${mcomBaseUrl}/api/v1/auth/sso/token
Content-Type: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTH_CODE_FROM_CALLBACK",
  "redirect_uri": "https://your-platform.com/auth/callback"
}
\`\`\`

Response (trimmed):
\`\`\`json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "4a7f8e...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "entitlement": { "...": "PlatformEntitlement" },
  "user": {
    "id": "usr_123",
    "email": "owner@acme.com",
    "role": "BUSINESS",
    "businessProfile": { "id": "biz_456", "businessName": "Acme Coffee" }
  }
}
\`\`\`

The entitlement is already scoped to your \`client_id\` — read it directly from this response.

### Option B — Userinfo (Bearer token)
\`\`\`http
GET ${mcomBaseUrl}/api/v1/auth/sso/userinfo?client_id=YOUR_CLIENT_ID
Authorization: Bearer <user_access_token>
\`\`\`
Returns \`entitlement\`, \`membership\`, \`packages\` (every platform package the business holds), \`appPlan\`, and \`permissions\`.

### Option C — Real-time introspection (server-to-server)
\`\`\`http
GET ${mcomBaseUrl}/api/v1/auth/sso/entitlement?client_id=YOUR_CLIENT_ID&user_id=USER_OR_BUSINESS_ID
X-API-Key: YOUR_MCOM_API_KEY
\`\`\`
or with a user token:
\`\`\`http
GET ${mcomBaseUrl}/api/v1/auth/sso/entitlement?client_id=YOUR_CLIENT_ID
Authorization: Bearer <user_access_token>
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "entitlement": { "...": "PlatformEntitlement" },
  "appPlan": { "...": "resolved plan for your platform" },
  "membership": {
    "planName": "Gold",
    "level": "Gold",
    "status": "active",
    "hasActiveMembership": true,
    "appPlans": [
      { "platform": "MCOM Mall", "planId": "mall-pro-vendor", "planName": "Vendor Pro", "quotas": {} },
      { "platform": "MCOM Rewards", "planId": "rewards-plus", "planName": "Merchant Plus", "quotas": {} }
    ]
  },
  "user": { "id": "usr_123", "email": "owner@acme.com", "role": "BUSINESS" }
}
\`\`\`

\`membership.appPlans\` lists every platform plan bundled into the user's membership. Use it if you need to show the full membership, not just your slice.

---

## 7. Response examples you must handle

### Membership that includes your platform
\`\`\`json
{
  "access": { "hasAccess": true, "accessType": "PAID_MEMBERSHIP" },
  "plan": {
    "planId": "mall-pro-vendor",
    "planName": "Vendor Pro",
    "source": "membership",
    "status": "active",
    "expiresAt": null,
    "quotas": { "maxListings": 500 }
  },
  "membershipContext": {
    "membershipPlanName": "Gold",
    "membershipLevel": "Gold",
    "membershipStatus": "active",
    "isIncludedInMembership": true
  }
}
\`\`\`
→ Grant the Vendor Pro plan for the membership term; label it "Included in your Gold membership".

### Access pass for your platform
\`\`\`json
{
  "access": { "hasAccess": true, "accessType": "DIRECT_PACKAGE" },
  "plan": {
    "planId": "mall-7day-pass",
    "planName": "7-Day Mall Pass",
    "source": "direct",
    "status": "active",
    "expiresAt": "2026-11-01T12:00:00.000Z",
    "quotas": { "maxListings": 50 },
    "features": []
  },
  "membershipContext": { "membershipPlanName": null, "isIncludedInMembership": false }
}
\`\`\`
→ Look up \`mall-7day-pass\` in your catalogue, grant it, and show the expiry date.

### Trial (dashboard access)
\`\`\`json
{
  "access": { "hasAccess": true, "accessType": "TRIAL_PROGRAMME" },
  "plan": {
    "planId": "trial_mall",
    "planName": "Programme Trial Access",
    "source": "trial",
    "status": "trial",
    "expiresAt": "2026-11-08T12:00:00.000Z",
    "quotas": { "trialAccess": true, "daysRemaining": 14 }
  },
  "trialContext": {
    "isInTrial": true,
    "hasPaidVerificationFee": true,
    "trialExpiresAt": "2026-11-08T12:00:00.000Z",
    "daysRemaining": 14,
    "programmeTasks": [
      {
        "taskId": "task_1",
        "title": "Publish your first listing",
        "description": "Create a product listing to activate your storefront.",
        "deadlineDays": 7,
        "rewardPoints": 50,
        "status": "PENDING"
      }
    ]
  }
}
\`\`\`
→ Grant trial-level access, show the countdown, and surface \`programmeTasks\`.

### Membership exists but your platform is not included
\`\`\`json
{
  "access": {
    "hasAccess": false,
    "accessType": "NONE",
    "reason": "PLATFORM_NOT_IN_MEMBERSHIP",
    "upgradeUrl": "${mcomBaseUrl}/dashboard/memberships"
  },
  "plan": null,
  "membershipContext": { "membershipPlanName": "Gold", "isIncludedInMembership": false }
}
\`\`\`
→ Deny access and send the user to \`access.upgradeUrl\`.

### Trial window but no tasks for your app
\`\`\`json
{
  "access": { "hasAccess": false, "accessType": "NONE", "reason": "TRIAL_NO_TASKS", "upgradeUrl": "..." },
  "plan": null,
  "trialContext": { "isInTrial": true, "programmeTasks": [] }
}
\`\`\`
→ Deny access. The platform needs an active task in \`/admin/programme\` to receive trial users.

### Expired / unverified / no entitlement
\`\`\`json
{ "access": { "hasAccess": false, "accessType": "NONE", "reason": "TRIAL_EXPIRED", "upgradeUrl": "..." }, "plan": null }
\`\`\`
\`\`\`json
{ "access": { "hasAccess": false, "accessType": "NONE", "reason": "UNVERIFIED", "upgradeUrl": "..." }, "plan": null }
\`\`\`
\`\`\`json
{ "access": { "hasAccess": false, "accessType": "NONE", "reason": "NO_ACTIVE_ENTITLEMENT", "upgradeUrl": "..." }, "plan": null }
\`\`\`
→ Deny access; show the upgrade/verification CTA.

---

## 8. Reference implementation (TypeScript)

\`\`\`typescript
export type AccessSource = 'membership' | 'access_pass' | 'trial' | 'none';

export interface AccessDecision {
  allowed: boolean;
  source: AccessSource;
  planId: string | null;
  planName: string | null;
  membershipName: string | null;
  expiresAt: string | null;
  quotas: Record<string, unknown>;
  limits: Record<string, unknown>;
  features: string[];
  trialDaysRemaining: number;
  tasks: PlatformEntitlement['trialContext']['programmeTasks'];
  reason?: string;
  upgradeUrl?: string;
}

export function decideAccess(entitlement: PlatformEntitlement): AccessDecision {
  const { access, plan, membershipContext, trialContext } = entitlement;

  if (!access.hasAccess || !plan) {
    return {
      allowed: false,
      source: 'none',
      planId: null,
      planName: null,
      membershipName: membershipContext.membershipPlanName,
      expiresAt: null,
      quotas: {},
      limits: {},
      features: [],
      trialDaysRemaining: trialContext.daysRemaining,
      tasks: trialContext.programmeTasks,
      reason: access.reason,
      upgradeUrl: access.upgradeUrl,
    };
  }

  const expired = plan.expiresAt ? new Date(plan.expiresAt).getTime() <= Date.now() : false;
  if (expired || plan.status === 'expired' || plan.status === 'cancelled') {
    return {
      allowed: false,
      source: 'none',
      planId: null,
      planName: null,
      membershipName: membershipContext.membershipPlanName,
      expiresAt: plan.expiresAt ?? null,
      quotas: {},
      limits: {},
      features: [],
      trialDaysRemaining: 0,
      tasks: [],
      reason: 'NO_ACTIVE_ENTITLEMENT',
      upgradeUrl: access.upgradeUrl,
    };
  }

  const source: AccessSource =
    access.accessType === 'PAID_MEMBERSHIP'
      ? 'membership'
      : access.accessType === 'DIRECT_PACKAGE'
        ? 'access_pass'
        : access.accessType === 'TRIAL_PROGRAMME'
          ? 'trial'
          : 'none';

  return {
    allowed: true,
    source,
    planId: plan.planId,
    planName: plan.planName,
    membershipName: membershipContext.membershipPlanName,
    expiresAt:
      source === 'trial'
        ? plan.expiresAt ?? trialContext.trialExpiresAt ?? null
        : plan.expiresAt ?? null,
    quotas: plan.quotas ?? {},
    limits: plan.limits ?? {},
    features: plan.features ?? [],
    trialDaysRemaining: source === 'trial' ? trialContext.daysRemaining : 0,
    tasks: source === 'trial' ? trialContext.programmeTasks : [],
  };
}
\`\`\`

### Express callback handler
\`\`\`typescript
app.get('/auth/callback', async (req, res) => {
  const tokenRes = await axios.post(\`\${MCOM_URL}/api/v1/auth/sso/token\`, {
    client_id: process.env.MCOM_CLIENT_ID,
    client_secret: process.env.MCOM_CLIENT_SECRET,
    code: req.query.code,
    redirect_uri: process.env.MCOM_REDIRECT_URI,
  });

  const { entitlement, user, accessToken } = tokenRes.data;
  const decision = decideAccess(entitlement);

  if (!decision.allowed) {
    return res.redirect(
      \`/upgrade?reason=\${decision.reason ?? 'NO_ACTIVE_ENTITLEMENT'}&url=\${encodeURIComponent(decision.upgradeUrl ?? '')}\`,
    );
  }

  req.session.user = {
    id: user.id,
    email: user.email,
    accessSource: decision.source,        // 'membership' | 'access_pass' | 'trial'
    planId: decision.planId,              // map this to your catalogue
    planName: decision.planName,
    membershipName: decision.membershipName,
    expiresAt: decision.expiresAt,
    quotas: decision.quotas,
    tasks: decision.tasks,
    accessToken,
  };

  return res.redirect('/dashboard');
});
\`\`\`

### Revalidation (for sessions that outlive the entitlement)
\`\`\`typescript
async function revalidate(req, res, next) {
  const cached = req.session.entitlementCache;
  if (cached && Date.now() - cached.checkedAt < 5 * 60 * 1000) return next();

  const { data } = await axios.get(
    \`\${MCOM_URL}/api/v1/auth/sso/entitlement?client_id=\${process.env.MCOM_CLIENT_ID}\`,
    { headers: { Authorization: \`Bearer \${req.session.user.accessToken}\` } },
  );

  req.session.entitlementCache = { ...data.entitlement, checkedAt: Date.now() };

  const decision = decideAccess(data.entitlement);
  if (!decision.allowed) return res.redirect('/upgrade');
  next();
}
\`\`\`

---

## 9. Expiry, caching, and webhooks

- Cache the entitlement for **minutes, not days**, and revalidate before sensitive actions.
- Revoke locally when \`plan.expiresAt\` passes, even if your cache still says active.
- Membership bundles report \`plan.expiresAt: null\`; rely on \`access.hasAccess\` and \`membershipContext.membershipStatus\`, and revalidate periodically.
- Trial access ends at \`trialContext.trialExpiresAt\`; show \`daysRemaining\` to the user.
- MCOM dispatches signed webhooks for some lifecycle events (e.g. \`entitlement.trial_started\`) to the \`webhookUrl\` registered in \`/admin/console\`. Treat a webhook as a signal to **re-introspect**, not as the source of truth.
- Verify the \`X-Mcom-Webhook-Signature\` HMAC with your \`webhookSecret\` before acting.

---

## 10. Rules the AI agent must follow

1. **Verify server-side only.** Never let the browser decide \`hasAccess\`.
2. **Always scope the lookup to your own \`client_id\`.** Otherwise Central cannot resolve your platform's plan, pass, or trial.
3. **\`access.hasAccess === false\` always means deny.** Do not fall back to cached data or role checks.
4. **Use \`access.accessType\` and \`plan.source\` together** to know whether the user has a membership, an access pass, or a trial.
5. **Use \`plan.planId\` as the key** into your own catalogue. Treat it as opaque and keep old IDs mapped.
6. **Apply \`plan.quotas\` / \`plan.limits\` exactly as returned.** Do not invent limits. For direct passes, feature flags live in these objects, not in \`plan.features\`.
7. **Show the source to the user**: "Included in your Gold membership", "Your 7-Day Mall Pass", or "Trial · 14 days left".
8. **For trials, display \`programmeTasks\` prominently** so the business completes onboarding missions.
9. **Send denied users to \`access.upgradeUrl\`** so they can buy a membership/pass or verify.
10. **Never log** access tokens, client secrets, or API keys.
11. **When \`entitlement\` is missing**, call \`GET /api/v1/auth/sso/entitlement\` instead of guessing.

---

## 11. Integration checklist

- [ ] Register your platform in \`/admin/console\` and note your \`client_id\`, \`client_secret\`, and API key.
- [ ] Publish stable plan/access-pass IDs and durations in your catalogue.
- [ ] Ask an admin to bundle your plan into a membership (\`/admin/memberships\`) and/or an access pass (\`/admin/access\`).
- [ ] For trial traffic, ensure at least one active task targets your app in \`/admin/programme\`.
- [ ] Exchange the SSO code at \`POST /api/v1/auth/sso/token\` and read \`entitlement\`.
- [ ] Implement \`decideAccess()\` and gate every protected route with it.
- [ ] Map \`plan.planId\` to your catalogue and provision the matching access.
- [ ] Show the access source, plan/pass name, and expiry (or trial countdown) in your UI.
- [ ] Revalidate via \`GET /api/v1/auth/sso/entitlement\` before sensitive actions.
- [ ] Redirect denied users to \`access.upgradeUrl\`.
- [ ] (Optional) Register a webhook URL and re-introspect on lifecycle events.
`;
}
