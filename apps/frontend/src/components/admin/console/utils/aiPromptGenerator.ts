import type { PlainSecrets, SsoClientDetail } from '../../../../services/admin/types';

export function generateAiIntegrationPrompt(
  client: Partial<SsoClientDetail> & { clientId: string; name: string },
  plainSecrets?: PlainSecrets,
): string {
  const mcomBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

  const clientSecret = plainSecrets?.clientSecret ?? '<MCOM_CLIENT_SECRET>';
  const apiKey = plainSecrets?.apiKey ?? '<MCOM_API_KEY>';
  const hmacSecret = plainSecrets?.hmacSecret ?? '<MCOM_HMAC_SECRET>';
  const webhookSecret = plainSecrets?.webhookSecret ?? '<MCOM_WEBHOOK_SECRET>';
  const platformSlug = client.platformSlug || client.clientId.replace(/^mcom-?/i, '');
  const redirectUri = client.redirectUris?.[0] || 'https://your-app.com/auth/callback';
  const corsOrigin = client.corsOrigins?.[0] || 'https://your-app.com';
  const scopes = client.scopes?.join(' ') || 'profile email business';
  const hasBilling = !!client.billingApiUrl;
  const hasWebhook = !!client.webhookUrl;

  return `# AI Developer Prompt: Integrate ${client.name} with MCOM Solutions Ecosystem

You are an expert full-stack engineer. Your task is to integrate this application (${client.name}) with the **MCOM Solutions Central Identity, SSO, and Billing Ecosystem**.

---

## 1. Credentials & Configuration

Add the following environment variables to your application (\`.env\` / \`.env.local\`):

\`\`\`env
# MCOM Solutions Central Hub API
MCOM_SOLUTIONS_URL="${mcomBaseUrl}"

# Application OAuth 2.0 Credentials
MCOM_CLIENT_ID="${client.clientId}"
MCOM_CLIENT_SECRET="${clientSecret}"

# Server-to-Server Inter-Service Security
MCOM_API_KEY="${apiKey}"
MCOM_HMAC_SECRET="${hmacSecret}"

# Webhook Verification Secret
MCOM_WEBHOOK_SECRET="${webhookSecret}"

# Configured App Settings
MCOM_PLATFORM_SLUG="${platformSlug}"
MCOM_REDIRECT_URI="${redirectUri}"
MCOM_SCOPES="${scopes}"
\`\`\`

---

## 2. Integration Tasks & Architectural Requirements

Implement the following modules in this codebase:

### Task 1: SSO Login Redirect (OAuth 2.0 Authorization Code Grant)
1. Add a **"Login with MCOM"** button in the frontend / auth module.
2. When the user clicks login, generate a random 32-byte CSRF \`state\` token, store it in the user session/cookie, and redirect the user's browser to:
   \`\`\`
   \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/authorize?client_id=\${MCOM_CLIENT_ID}&redirect_uri=\${encodeURIComponent(MCOM_REDIRECT_URI)}&scope=\${encodeURIComponent(MCOM_SCOPES)}&state=\${state}
   \`\`\`

### Task 2: Auth Callback Handler & Token Exchange
1. Create the callback endpoint at \`${new URL(redirectUri).pathname || '/auth/callback'}\`.
2. When MCOM redirects back with \`?code=...&state=...\`:
   - Validate that \`state\` matches the stored session/cookie state (prevent CSRF).
   - Exchange the authorization code server-side by making a POST request:
     \`\`\`http
     POST \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token
     Content-Type: application/json

     {
       "client_id": "\${MCOM_CLIENT_ID}",
       "client_secret": "\${MCOM_CLIENT_SECRET}",
       "code": "AUTH_CODE_FROM_QUERY",
       "redirect_uri": "\${MCOM_REDIRECT_URI}"
     }
     \`\`\`
   - Response payload immediately returns the tokens and user profile, including their resolved plan for **${client.name}**:
     \`\`\`json
     {
       "accessToken": "JWT_ACCESS_TOKEN",
       "refreshToken": "REFRESH_TOKEN",
       "expiresIn": 3600,
       "tokenType": "Bearer",
       "user": {
         "id": "usr_12345",
         "email": "user@example.com",
         "role": "BUSINESS",
         "firstName": "Jane",
         "lastName": "Doe",
         "businessProfile": {
           "id": "biz_12345",
           "businessName": "Acme Retail Ltd",
           "membershipLevel": "Gold",
           "membershipStatus": "active",
           "membershipPlanName": "Gold",
           "appPlan": {
             "source": "membership",
             "platform": "${client.name}",
             "clientId": "${client.clientId}",
             "planId": "tier-1",
             "planName": "Standard Plan",
             "status": "active",
             "quotas": {
               "maxProducts": 50,
               "customFeatures": true
             },
             "limits": {
               "maxProducts": 50
             },
             "membershipPlanName": "Gold",
             "expiresAt": "2027-09-14T08:00:00.000Z",
             "directPlan": null,
             "membershipPlan": {
               "planId": "tier-1",
               "planName": "Standard Plan",
               "quotas": { "maxProducts": 50 },
               "membershipPlanName": "Gold"
             }
           }
         }
       }
     }
     \`\`\`
3. Store the \`accessToken\`, \`refreshToken\`, and user profile in your application's session or issue a local JWT session.

### Task 3: Unified Entitlement & Trial Access Protocol
MCOM Solutions delivers a standardized **PlatformEntitlement** object inside both \`POST /auth/sso/token\` and \`GET /auth/sso/userinfo\` (and via \`GET /auth/sso/entitlement\`):

1. **Paid Ecosystem Membership Bundle**:
   - The merchant holds an active MCOM Membership (e.g. Gold, Silver, Platinum) that bundles access to ${client.name}.
   - \`entitlement.access.hasAccess === true\`
   - \`entitlement.access.accessType === 'PAID_MEMBERSHIP'\`
   - \`entitlement.plan.planId\` contains the plan level bundled for this app.
   - \`entitlement.membershipContext.isIncludedInMembership === true\`.

2. **Programme Trial Access (Task-Gated)**:
   - When a business pays the £1 verification fee in MCOM Central, they receive a timed trial (e.g. 14 days).
   - If an admin created an active task in the **Task Engine & Rewards** (/admin/programme) selecting **${client.name}** under *External App (from Console)*, the business automatically unlocks trial access to this platform!
   - \`entitlement.access.hasAccess === true\`
   - \`entitlement.access.accessType === 'TRIAL_PROGRAMME'\`
   - \`entitlement.trialContext.isInTrial === true\`
   - \`entitlement.trialContext.programmeTasks\` contains the list of tasks the merchant must complete on your platform!

3. **No Access / Upgrade Required**:
   - If the merchant has no membership bundling ${client.name}, or trial is expired / platform has no programme tasks:
   - \`entitlement.access.hasAccess === false\`
   - \`entitlement.access.accessType === 'NONE'\`
   - \`entitlement.access.reason\`:
     - \`'PLATFORM_NOT_IN_MEMBERSHIP'\`: Member, but this app wasn't bundled.
     - \`'TRIAL_NO_TASKS'\`: In trial, but no active tasks exist for this platform.
     - \`'TRIAL_EXPIRED'\`: Trial window has ended.
     - \`'UNVERIFIED'\`: Verification fee unpaid.
   - \`entitlement.access.upgradeUrl\`: Pre-built link back to MCOM Central for instant upgrade/payment.

#### Handling Entitlements in Your Backend:
\`\`\`typescript
// Extract entitlement from the SSO token response or /auth/sso/entitlement
const { entitlement, user } = response.data;

if (!entitlement?.access?.hasAccess) {
  // Merchant does not have access to this platform
  const reason = entitlement?.access?.reason;
  const upgradeUrl = entitlement?.access?.upgradeUrl;
  console.warn(\`Access denied for \${user.email}: \${reason}\`);
  return res.redirect(\`/upgrade?reason=\${reason}&upgradeUrl=\${encodeURIComponent(upgradeUrl)}\`);
}

// User is entitled! Provision based on whether it is a Paid Membership or Trial:
const isTrial = entitlement.access.accessType === 'TRIAL_PROGRAMME';
const planId = entitlement.plan?.planId;
const planName = entitlement.plan?.planName;
const quotas = entitlement.plan?.quotas || {};
const tasksToComplete = entitlement.trialContext?.programmeTasks || [];

await db.Subscription.upsert({
  where: { userId: user.id },
  update: {
    planId,
    planName,
    quotas,
    isTrial,
    tasksToComplete,
    isActive: true,
    updatedAt: new Date(),
  },
  create: {
    userId: user.id,
    planId,
    planName,
    quotas,
    isTrial,
    tasksToComplete,
    isActive: true,
  },
});
\`\`\`

### Task 4: Real-time Entitlement Introspection API
Whenever your backend needs to re-verify a user's subscription or check active trial tasks without forcing a re-login:
\`\`\`http
GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/entitlement?client_id=\${MCOM_CLIENT_ID}&user_id=\${userId}
X-API-Key: \${MCOM_API_KEY}
\`\`\`
Or with the user's Bearer token:
\`\`\`http
GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/entitlement
Authorization: Bearer \${accessToken}
\`\`\`

${
  hasBilling
    ? `### Task 5: Billing API Plan Management Contract
MCOM Solutions will manage subscription plans for ${client.name} using the Generic HTTP Connector.
Implement the following 5 REST endpoints in your backend protected by the API key:

\`\`\`typescript
// Middleware to verify incoming MCOM Solution requests:
app.use('/api/v1/system/plans', (req, res, next) => {
  const apiKey = req.headers['x-mcom-solution-api-key'];
  if (apiKey !== process.env.MCOM_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid MCOM API Key' });
  }
  next();
});

// 1. GET /api/v1/system/plans -> Return list of ExternalPlan objects
// 2. POST /api/v1/system/plans -> Create a new plan from { name, monthlyPrice, annualPrice, features, ... }
// 3. GET /api/v1/system/plans/:id -> Return a single plan by ID
// 4. PATCH /api/v1/system/plans/:id -> Update plan details
// 5. DELETE /api/v1/system/plans/:id -> Archive or delete plan
\`\`\`
`
    : ''
}
${
  hasWebhook
    ? `### Task 6: Webhook Signature Verification
MCOM dispatches ecosystem lifecycle events (e.g. \`package.created\`, \`package.renewed\`, \`package.expired\`) to your webhook endpoint:
1. Create a POST endpoint at \`${client.webhookUrl || '/webhooks'}\`.
2. Verify incoming webhook requests using SHA-256 HMAC signature:
   \`\`\`typescript
   import * as crypto from 'crypto';

   app.post('${new URL(client.webhookUrl || 'https://app.com/webhooks').pathname}', (req, res) => {
     const signatureHeader = req.headers['x-mcom-signature'] as string; // "sha256=<hex>"
     const rawBody = req.rawBody; // Make sure to use raw unparsed body buffer/string

     const expectedSig = crypto
       .createHmac('sha256', process.env.MCOM_WEBHOOK_SECRET!)
       .update(rawBody)
       .digest('hex');

     const receivedSig = signatureHeader.replace(/^sha256=/, '');
     const isValid = crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'));

     if (!isValid) return res.status(401).json({ error: 'Invalid HMAC signature' });

     const event = req.body; // { event: "package.created", data: { ... } }
     // Process lifecycle event...
     res.json({ received: true });
   });
   \`\`\`
`
    : ''
}
### Task 7: Server-to-Server Signed Requests (HMAC Data Sharing)
When your backend needs to query user details or verify membership without an access token:
\`\`\`typescript
import * as crypto from 'crypto';
import axios from 'axios';

async function checkUserMembership(userId: string) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const serviceId = process.env.MCOM_CLIENT_ID;
  const message = \`\${serviceId}:\${timestamp}\`;

  const signature = crypto
    .createHmac('sha256', process.env.MCOM_HMAC_SECRET!)
    .update(message)
    .digest('hex');

  return axios.get(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/data/user\`, {
    params: { userId },
    headers: {
      'X-Service-Id': serviceId,
      'X-Timestamp': timestamp,
      'X-Signature': signature,
    },
  });
}
\`\`\`

---

## 3. Verification & Acceptance Criteria
1. Clicking **"Login with MCOM"** redirects cleanly to MCOM Solutions SSO.
2. After authenticating, the user is redirected back to \`${redirectUri}\` and logged in automatically.
3. \`user.businessProfile.appPlan\` correctly indicates either:
   - \`source: "direct"\` for standalone platform subscriptions
   - \`source: "membership"\` for users whose MCOM Membership bundles this app
4. The target app applies the user's plan tier (\`planId\`) and quotas (\`quotas\`) correctly.
5. User permissions show \`canAccess_${platformSlug}: true\` for authorized accounts.
6. Token refresh handles expired access tokens seamlessly via \`/api/v1/auth/sso/token/refresh\`.
7. All secrets are kept on the server and never exposed in client-side bundles.
`;
}
