import type { SsoClientListItem } from '../../../../services/admin/types';

/**
 * Generates the copy-pasteable white-label SSO skill for platform repositories.
 *
 * A white-label platform is one registered in the MCOM Console with
 * `allowWhitelabel: true`. Access is grant-only: an admin grants a specific
 * business access in /admin/users → Businesses → Give Access. Grants bypass
 * membership and access-pass checks entirely.
 */
export function generateWhitelabelSkillPrompt(apps: SsoClientListItem[] = []): string {
  const mcomBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

  const whitelabelApps = apps.filter((app) => app.allowWhitelabel);
  const platformList = whitelabelApps.length
    ? whitelabelApps
        .map(
          (app) =>
            `- **${app.name}** · clientId: \`${app.clientId}\`${
              app.platformSlug ? ` · slug: \`${app.platformSlug}\`` : ''
            }`,
        )
        .join('\n')
    : '_No white-label platforms registered yet. Register one in /admin/console and enable “Allow White-Label Access”._';

  const sampleClientId = whitelabelApps[0]?.clientId || '247gbs-rewards';
  const sampleSlug = whitelabelApps[0]?.platformSlug || '247gbs_rewards';

  return `---
name: mcom-whitelabel-sso-skill
description: Executable AI implementation skill for white-label platforms in the MCOM ecosystem — business-only grant-gated SSO, entitlement contract, and zero membership/access-pass checks
version: 1.0.0
protocol_version: 2026-10-01
target_role: Full-Stack Engineer / Autonomous AI Coding Agent (Cursor, Copilot, Antigravity, Claude)
mode: executable-agent-directive
---

# 🔓 MCOM White-Label SSO Integration Skill

> **AI AGENT MANDATE**
> Implement white-label SSO exactly as specified. A white-label platform admits **only
> businesses that an MCOM admin has explicitly granted access to**. Membership tiers,
> packages, access passes and payment status are **irrelevant** — a grant is the whole
> entitlement. Never gate a granted business behind a membership or plan check.

---

## 1. What “white-label” means here

A platform becomes white-label when an admin toggles **Allow White-Label Access** in
\`/admin/console\` (stored as \`allowWhitelabel: true\` on the registered app).

Access is then **grant-only**:

1. Admin opens \`/admin/users\` → **Businesses** → **Give Access**.
2. Admin picks this platform from the list of white-label-enabled platforms.
3. The business can now sign in to this platform via SSO and lands **straight on the
   dashboard**.

Rules enforced by MCOM Central:

| Rule | Behaviour |
|:--|:--|
| Account type | Only \`BUSINESS\` accounts can receive / use white-label access. Customers, agents, consultants and account managers are rejected. |
| Grant | A \`WhitelabelAccess\` row must exist for **this business + this platform**. No grant = no token. |
| Membership | **Not checked.** Tier, packages, access passes, verification fee, trial state are all ignored. |
| Revocation | Removing the grant (or turning off white-label mode) kills live SSO sessions and blocks the next token refresh. |

---

## 2. White-label platforms currently registered

${platformList}

The example below uses \`${sampleClientId}\` (slug \`${sampleSlug}\`). Replace with your
own registered \`clientId\`.

---

## 3. End-to-end flow

\`\`\`
Business clicks “Login with MCOM”
        │
        ▼
GET {MCOM}/api/v1/auth/sso/authorize
    ?client_id=<your clientId>
    &redirect_uri=<your registered callback>
    &state=<csrf state>
    &scope=profile email business
        │
        ├─ Not logged in ──► MCOM login page ──► POST /auth/sso/authorize
        │
        ├─ Logged in + BUSINESS + grant exists ──► redirect back ?code=...&state=...
        │
        └─ Logged in but no grant / not a business
                 ├─ browser: redirects to MCOM login with ?sso_error=whitelabel_denied
                 └─ API: 403 Forbidden
        │
        ▼
Your backend: POST {MCOM}/api/v1/auth/sso/token
    { client_id, client_secret, code, redirect_uri }
        │
        ▼
MCOM re-checks the grant, then returns access/refresh tokens + \`user\`
        │
        ▼
Your backend verifies \`user.entitlement.access.hasAccess === true\`
and \`user.profileType === 'BUSINESS'\`, provisions a local session,
and redirects to YOUR dashboard. No plan picker, no checkout, no membership gate.
\`\`\`

**MCOM re-checks the grant at three points** — authorization-code issuance, token
exchange, and refresh. Your app does not need to call a separate permission endpoint.

---

## 4. Entitlement contract (what your app receives)

After \`POST /api/v1/auth/sso/token\`, the response contains the standard \`user\` object
plus an \`entitlement\` block. For a granted business it looks like this:

\`\`\`json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "usr_...",
    "email": "owner@business.com",
    "role": "BUSINESS",
    "profileType": "BUSINESS",
    "firstName": "Ada",
    "lastName": "Okafor",
    "fullName": "Ada Okafor",
    "name": "Ada’s Stores",
    "businessId": "biz_...",
    "businessName": "Ada’s Stores",
    "businessProfile": { "...": "full business profile" },
    "entitlement": {
      "version": "2026-10-01",
      "targetPlatform": {
        "clientId": "${sampleClientId}",
        "platformSlug": "${sampleSlug}",
        "name": "247GBS Rewards"
      },
      "access": {
        "hasAccess": true,
        "accessType": "WHITELABEL"
      },
      "plan": {
        "planId": "whitelabel_${sampleSlug}",
        "planName": "White-label Access",
        "source": "whitelabel",
        "status": "active",
        "quotas": {},
        "limits": {},
        "features": []
      },
      "whitelabel": {
        "enabled": true,
        "granted": true,
        "grantedAt": "2026-10-30T12:00:00.000Z",
        "roleEligible": true
      },
      "membershipContext": {
        "isIncludedInMembership": false
      },
      "trialContext": {
        "isInTrial": false
      }
    },
    "permissions": {
      "canAccess_${sampleSlug}": true
    }
  }
}
\`\`\`

### The single gate you must implement

\`\`\`ts
const entitled =
  user.profileType === 'BUSINESS' &&
  user.entitlement?.access?.hasAccess === true &&
  user.entitlement.access.accessType === 'WHITELABEL' &&
  user.entitlement.whitelabel?.granted === true;
\`\`\`

If \`entitled\` is false, **do not create a local session** and **do not show the
dashboard**. Show an access-denied screen with a support contact.

### Explicitly do NOT do

- ❌ Do **not** call membership plans, package, access-pass or billing endpoints to
  decide admission.
- ❌ Do **not** show an upgrade/checkout flow for a granted business.
- ❌ Do **not** accept customers/agents/consultants/account managers on a white-label
  login, even if they somehow reach your callback.
- ❌ Do **not** trust a userId/businessId supplied by the browser. Only trust the
  server-to-server token exchange result.

---

## 5. Backend implementation (Node / Express example)

### 5.1 Environment

\`\`\`bash
MCOM_SOLUTIONS_URL=${mcomBaseUrl}
MCOM_CLIENT_ID=${sampleClientId}
MCOM_CLIENT_SECRET=cs_live_...
MCOM_REDIRECT_URI=https://app.yourplatform.com/auth/callback
\`\`\`

### 5.2 Login redirect

\`\`\`ts
import { randomUUID } from 'crypto';

app.get('/auth/login', (req, res) => {
  const state = randomUUID();
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.MCOM_CLIENT_ID!,
    redirect_uri: process.env.MCOM_REDIRECT_URI!,
    state,
    scope: 'profile email business',
  });

  res.redirect(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/authorize?\${params}\`);
});
\`\`\`

### 5.3 Callback + token exchange + admission gate

\`\`\`ts
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  // 1. CSRF: state must match the value we issued.
  if (!code || !state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state');
  }
  delete req.session.oauthState;

  // 2. Exchange the single-use code server-to-server. Never expose the
  //    client secret to the browser.
  const tokenRes = await fetch(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MCOM_CLIENT_ID,
      client_secret: process.env.MCOM_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MCOM_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) {
    return res.status(403).send('MCOM rejected this sign-in');
  }

  const { accessToken, refreshToken, user } = await tokenRes.json();

  // 3. WHITE-LABEL ADMISSION GATE — the only gate that matters.
  const entitled =
    user.profileType === 'BUSINESS' &&
    user.entitlement?.access?.hasAccess === true &&
    user.entitlement.access.accessType === 'WHITELABEL' &&
    user.entitlement.whitelabel?.granted === true;

  if (!entitled) {
    return res.status(403).send('White-label access has not been granted for this business');
  }

  // 4. Provision your local business account from the canonical MCOM identity.
  //    No membership, package or access-pass lookup is required.
  const localUser = await upsertBusinessFromMcom(user);

  // 5. Start YOUR session and go straight to the dashboard.
  req.session.userId = localUser.id;
  req.session.mcomAccessToken = accessToken;
  req.session.mcomRefreshToken = refreshToken;
  res.redirect('/dashboard');
});
\`\`\`

### 5.4 Refresh handling

MCOM re-checks the grant on refresh. If the admin revoked access, the refresh call
fails and you must log the user out locally.

\`\`\`ts
async function refreshMcomSession(refreshToken: string) {
  const res = await fetch(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token/refresh\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (res.status === 401 || res.status === 403) return null; // revoked / expired
  return res.json();
}
\`\`\`

---

## 6. Frontend implementation (React example)

\`\`\`tsx
// components/WhiteLabelGate.tsx
export function WhiteLabelGate({ user, children }: { user: any; children: React.ReactNode }) {
  const entitled =
    user?.profileType === 'BUSINESS' &&
    user?.entitlement?.access?.hasAccess === true &&
    user?.entitlement?.access?.accessType === 'WHITELABEL' &&
    user?.entitlement?.whitelabel?.granted === true;

  if (!entitled) {
    return (
      <div className="p-8 text-center">
        <h1>Access not granted</h1>
        <p>This platform is available to approved businesses only. Contact MCOM support.</p>
      </div>
    );
  }

  return <>{children}</>;
}
\`\`\`

The login button on your landing page should simply navigate to your backend
\`/auth/login\` (which performs the redirect above). Do not build a local email/password
form for white-label access.

---

## 7. Failure modes & UX

| Situation | What MCOM returns | What your app should do |
|:--|:--|:--|
| Not logged in | MCOM login page | Let the user authenticate; flow continues automatically. |
| Logged in, not a BUSINESS | \`403\` on authorization (or MCOM login with \`?sso_error=whitelabel_denied\` when an existing session is re-used) | Show “white-label access is for business accounts only”. |
| Business has no grant | \`403\` on authorization (or MCOM login with \`?sso_error=whitelabel_denied\` when an existing session is re-used) | Show “access has not been granted — contact MCOM”. Do not retry in a loop. |
| Grant revoked mid-session | Refresh returns \`401/403\` | Clear the local session and return to the login screen. |
| White-label mode turned off in Console | Authorize/token/refresh all fail | Treat as access denied. |
| Invalid/expired code | \`401 Unauthorized\` | Restart the OAuth flow; never reuse a code. |

Recommended user-facing copy:

> “Your business has not been granted access to this platform. Please contact the MCOM
> team if you believe this is a mistake.”

---

## 8. How admins manage grants (support runbook)

1. Register the platform in \`/admin/console\` and enable **Allow White-Label Access**.
2. Copy the generated \`clientId\` / \`clientSecret\` into the platform’s server env.
3. To grant a business: \`/admin/users\` → **Businesses** → **Give Access** → tick the
   platform → **Save Access**.
4. To revoke: untick the platform → **Save Access**. Live sessions for that
   business/platform are terminated and the next refresh is denied.
5. Turning white-label mode **off** for a platform revokes **all** business grants for
   that platform.

Admin API (for tooling):

\`\`\`
GET  /api/v1/admin/users/businesses/:businessId/whitelabel
PUT  /api/v1/admin/users/businesses/:businessId/whitelabel
     { "clientIds": ["${sampleClientId}"] }
\`\`\`

---

## 9. Acceptance checklist

- [ ] Login button redirects to \`/api/v1/auth/sso/authorize\` with the registered
      \`client_id\`, \`redirect_uri\` and a random \`state\`.
- [ ] \`state\` is verified on callback.
- [ ] Code is exchanged server-to-server only; \`client_secret\` never reaches the browser.
- [ ] Admission requires \`profileType === 'BUSINESS'\`, \`hasAccess === true\`,
      \`accessType === 'WHITELABEL'\` and \`whitelabel.granted === true\`.
- [ ] No membership / package / access-pass / billing check gates entry.
- [ ] Granted business lands directly on the dashboard.
- [ ] Denied users see a clear access-denied screen (not a checkout or upgrade page).
- [ ] Refresh failure (revocation) clears the local session.
- [ ] Customers, agents, consultants and account managers are rejected.
`;
}
