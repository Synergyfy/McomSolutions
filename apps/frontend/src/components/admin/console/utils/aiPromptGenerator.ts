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
  const serviceEnabled = client.serviceEnabled !== false;
  const serviceBaseUrl = client.serviceBaseUrl || client.billingApiUrl || 'https://api.your-app.com';
  const serviceScopes = client.serviceScopes?.length
    ? client.serviceScopes.join(' ')
    : 'profile email service:read service:write';

  const allowedAudiences = client.allowedAudiences ?? [];
  const allowedCallers = client.allowedCallers ?? [];

  const audiencesDisplay = allowedAudiences.length === 0
    ? 'NONE (Deny-by-default — configure in Console under Service Mesh Policy)'
    : allowedAudiences.includes('*')
      ? '* (Wildcard — permitted to call ANY registered peer in ecosystem)'
      : allowedAudiences.join(', ');

  const callersDisplay = allowedCallers.length === 0
    ? 'NONE (Deny-by-default — configure in Console under Service Mesh Policy)'
    : allowedCallers.includes('*')
      ? '* (Wildcard — accepts calls from ANY registered peer in ecosystem)'
      : allowedCallers.join(', ');

  // Pick a realistic sample peer to call for test scripts
  const sampleTargetPeer =
    allowedAudiences.find((a) => a !== '*' && a !== client.clientId) || 'mcom-rewards';

  return `---
name: mcom-ecosystem-integration
description: Complete executable AI integration skill for ${client.name} with MCOM Solutions Central Hub and Ecosystem Service Mesh
version: 2.0.0
target_platform: ${client.name} (${client.clientId})
protocol_version: 2026-10-01
mode: executable-agent-directive
---

# 🚀 AI AGENT DIRECTIVE: Integrate ${client.name} with MCOM Ecosystem

> **READ THIS BEFORE CODING:**
> You are an autonomous AI coding assistant working in the codebase of **${client.name}**.
> Your mission is to connect this application with **MCOM Solutions Central** (Identity, SSO, Entitlements) and the **Ecosystem Service Mesh** (Direct App-to-App M2M Communication).
>
> ⚡ **ACTION RULE:** Do NOT merely summarize this document. You MUST:
> 1. Run the **Immediate 30-Second Smoke Test** in Phase 1 right now to verify live credentials and mesh access.
> 2. Create the required config (\`.env\`) and integration modules.
> 3. Verify all acceptance criteria.

---

## ⚡ PHASE 1: Immediate 30-Second Smoke Test (TRY THIS OUT RIGHT NOW)

Before writing full application routes, prove connectivity to MCOM Central Hub and verify that your app can mint service tokens to talk to peer apps.

### Option A: Run directly in terminal (Node.js 18+)
Save the following as \`test-mcom-mesh.mjs\` in your project root and execute it:

\`\`\`javascript
// test-mcom-mesh.mjs — Zero-dependency MCOM Mesh & Auth Smoke Test
const MCOM_URL = process.env.MCOM_SOLUTIONS_URL || '${mcomBaseUrl}';
const CLIENT_ID = process.env.MCOM_CLIENT_ID || '${client.clientId}';
const CLIENT_SECRET = process.env.MCOM_CLIENT_SECRET || '${clientSecret}';
const TARGET_PEER = '${sampleTargetPeer}';

console.log('\\n🔍 [1/3] Testing Ecosystem Discovery at ' + MCOM_URL + '...');
try {
  const discRes = await fetch(MCOM_URL + '/api/v1/ecosystem/discovery');
  const discovery = await discRes.json();
  console.log('✅ Discovery OK! Issuer:', discovery.issuer, '| Signing Alg:', discovery.signing_alg);

  console.log('\\n🔑 [2/3] Requesting RS256 Service Token for audience "' + TARGET_PEER + '"...');
  const basicAuth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
  const tokenRes = await fetch(MCOM_URL + '/api/v1/auth/service-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + basicAuth,
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      audience: TARGET_PEER,
      scope: '${serviceScopes.split(' ')[0] || 'service:read'}',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('❌ Service Token Failed (' + tokenRes.status + '):', tokenData);
    console.log('💡 HINT: If 403 Forbidden, check if "' + TARGET_PEER + '" is in your Allowed Audiences in MCOM Console.');
  } else {
    console.log('✅ Service Token Minted Successfully!');
    console.log('   - Type:', tokenData.token_type);
    console.log('   - Expires In:', tokenData.expires_in + 's');
    console.log('   - Token Preview:', tokenData.access_token.substring(0, 32) + '...');

    console.log('\\n🌐 [3/3] Fetching Ecosystem Peer Directory...');
    const peerRes = await fetch(MCOM_URL + '/api/v1/ecosystem/services');
    const peers = await peerRes.json();
    console.log('✅ Connected to Ecosystem Mesh! Total active peer services registered:', peers.length);
    console.log('   Peers found:', peers.map(p => p.clientId).join(', '));
  }
} catch (err) {
  console.error('❌ Connectivity test failed:', err.message);
}
\`\`\`

Run it:
\`\`\`bash
node test-mcom-mesh.mjs
\`\`\`

---

## 🛠️ PHASE 2: Environment Configuration

Save these environment variables into your application's \`.env\` or \`.env.local\`:

\`\`\`env
# =========================================================================
# MCOM SOLUTIONS ECOSYSTEM CONFIGURATION — ${client.name.toUpperCase()}
# =========================================================================

# Central Hub API Gateway
MCOM_SOLUTIONS_URL="${mcomBaseUrl}"

# OAuth 2.0 SSO & Service Credentials
MCOM_CLIENT_ID="${client.clientId}"
MCOM_CLIENT_SECRET="${clientSecret}"

# Server-to-Server Security (HMAC Data Sync & Webhooks)
MCOM_API_KEY="${apiKey}"
MCOM_HMAC_SECRET="${hmacSecret}"
MCOM_WEBHOOK_SECRET="${webhookSecret}"

# Client App Settings
MCOM_PLATFORM_SLUG="${platformSlug}"
MCOM_REDIRECT_URI="${redirectUri}"
MCOM_SCOPES="${scopes}"

# -------------------------------------------------------------------------
# DIRECT APP-TO-APP COMMUNICATION (SERVICE MESH M2M)
# -------------------------------------------------------------------------
# Direct peer-to-peer calls NEVER transit MCOM Central in the data path.
# MCOM issues short-lived RS256 tokens; peers verify offline via JWKS.
MCOM_SERVICE_ENABLED="${serviceEnabled}"
MCOM_SERVICE_BASE_URL="${serviceBaseUrl}"
MCOM_SERVICE_SCOPES="${serviceScopes}"

# Service Mesh Access Rules Configured in Console:
# Peers this app can call (Egress): ${audiencesDisplay}
# Peers allowed to call this app (Ingress): ${callersDisplay}
\`\`\`

---

## 🌐 PHASE 3: Inter-App Communication (How Registered Apps Talk to Each Other)

### Architecture: Zero-Hop / Direct Peer-to-Peer
Registered applications in the MCOM ecosystem talk directly to each other **without proxying requests through MCOM Central**.

\`\`\`
┌────────────────────────────────────────────────────────┐
│             MCOM Central Hub (Control Plane)           │
│                                                        │
│  - Issues short-lived RS256 service tokens             │
│  - Publishes public JWKS at /.well-known/jwks.json    │
│  - Publishes service registry at /api/v1/ecosystem/services
└───────────▲───────────────────────────────▲────────────┘
            │ 1. Mint Service Token         │ (JWKS cached offline)
            │    (RS256, 5-min TTL)         │
┌───────────┴───────────────┐               │
│      CALLING APP          │               │
│     (${client.clientId})   │               │
└───────────┬───────────────┘               │
            │                               │
            │ 2. DIRECT HTTP Call           │
            │    (Bearer <service_token>)   │
            │    [NEVER TRANSITS MCOM]      │
            ▼                               ▼
┌────────────────────────────────────────────────────────┐
│                 TARGET PEER APP                        │
│                                                        │
│  - Verifies token OFFLINE via cached JWKS              │
│  - Checks Ingress: is caller in allowedCallers?        │
│  - Processes request and returns direct response       │
└────────────────────────────────────────────────────────┘
\`\`\`

### Rule of Mesh Access: Deny-by-Default
1. **Egress (Calling a peer):** Your app must have the peer's \`clientId\` (or \`*\`) in its **Allowed Audiences**.
2. **Ingress (Accepting calls from a peer):** The caller's \`clientId\` (or \`*\`) must be in your **Allowed Callers**.
3. **Identity Claim:**
   - For machine-to-machine calls: \`payload.sub\` is the calling app's \`clientId\`.
   - For user-delegated calls: \`payload.sub\` is the \`userId\`, and \`payload.act.sub\` is the calling app's \`clientId\`.

---

### Task 3.1: Outbound Peer Caller Client (\`src/mcom/peerClient.ts\`)
Implement this reusable client with automatic in-memory token caching:

\`\`\`typescript
import axios, { AxiosRequestConfig } from 'axios';

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedToken>();

/**
 * Mint or retrieve cached short-lived RS256 service token for a target peer.
 */
export async function getServiceToken(audience: string, scope = 'service:read'): Promise<string> {
  const cacheKey = \`\${audience}:\${scope}\`;
  const cached = tokenCache.get(cacheKey);

  // Return cached token if valid for at least another 60 seconds
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const clientId = process.env.MCOM_CLIENT_ID!;
  const clientSecret = process.env.MCOM_CLIENT_SECRET!;
  const mcomUrl = process.env.MCOM_SOLUTIONS_URL!;

  const basicAuth = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString('base64');

  const { data } = await axios.post(
    \`\${mcomUrl}/api/v1/auth/service-token\`,
    {
      grant_type: 'client_credentials',
      audience,
      scope,
    },
    {
      headers: {
        Authorization: \`Basic \${basicAuth}\`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    },
  );

  const expiresAt = Date.now() + (data.expires_in || 300) * 1000;
  tokenCache.set(cacheKey, { token: data.access_token, expiresAt });

  return data.access_token;
}

/**
 * Call a peer application DIRECTLY (bypassing MCOM Central).
 * @param peerBaseUrl Base URL of target peer (e.g. "https://api.mcomrewards.com")
 * @param targetAudience Client ID of peer (e.g. "mcom-rewards")
 * @param path Request path (e.g. "/api/v1/points/balance")
 */
export async function callPeer<T = any>(
  peerBaseUrl: string,
  targetAudience: string,
  path: string,
  options: AxiosRequestConfig = {},
): Promise<T> {
  const token = await getServiceToken(targetAudience);

  const url = \`\${peerBaseUrl.replace(/\\/+$/, '')}/\${path.replace(/^\\/+/, '')}\`;

  const response = await axios({
    ...options,
    url,
    headers: {
      ...options.headers,
      Authorization: \`Bearer \${token}\`,
      'X-Origin-App': process.env.MCOM_CLIENT_ID,
    },
  });

  return response.data;
}
\`\`\`

---

### Task 3.2: Inbound Token Verification Middleware (\`src/mcom/serviceAuthMiddleware.ts\`)
Implement this middleware to protect endpoints that peer apps call:

\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import axios from 'axios';

// Remote JWKS fetched once and cached automatically with background rotation
const mcomUrl = process.env.MCOM_SOLUTIONS_URL || 'https://api.mcomsolutions.com';
const JWKS = createRemoteJWKSet(new URL(\`\${mcomUrl}/.well-known/jwks.json\`));

let allowedCallersCache: { callers: string[]; expiresAt: number } | null = null;

async function getAllowedCallers(): Promise<string[]> {
  // Configured in environment or fetched from central registry
  if (process.env.MCOM_ALLOWED_CALLERS) {
    return process.env.MCOM_ALLOWED_CALLERS.split(',').map((s) => s.trim());
  }

  // Refresh from central registry every 60 seconds
  if (allowedCallersCache && allowedCallersCache.expiresAt > Date.now()) {
    return allowedCallersCache.callers;
  }

  try {
    const { data } = await axios.get(\`\${mcomUrl}/api/v1/ecosystem/services\`, { timeout: 3000 });
    const myApp = (data as any[]).find((s) => s.clientId === process.env.MCOM_CLIENT_ID);
    const callers = myApp?.allowedCallers || [];
    allowedCallersCache = { callers, expiresAt: Date.now() + 60_000 };
    return callers;
  } catch (err) {
    console.warn('Failed to refresh allowed callers from registry, using fallback');
    return allowedCallersCache?.callers || [];
  }
}

export interface AuthenticatedServiceRequest extends Request {
  serviceCaller?: {
    callerAppId: string;
    isDelegated: boolean;
    userId?: string;
    scopes: string[];
    payload: JWTPayload;
  };
}

/**
 * Express middleware to verify incoming direct calls from peer apps.
 */
export async function requireServiceAuth(
  req: AuthenticatedServiceRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer service token' });
  }

  try {
    // 1. Verify RS256 signature and audience OFFLINE using cached JWKS
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: 'mcom-solutions',
      audience: process.env.MCOM_CLIENT_ID, // Must match this app's own clientId
    });

    // 2. Resolve caller identity
    // If delegated token: act.sub = caller app id, sub = user id
    // If standard service token: sub = caller app id
    const isDelegated = payload.typ === 'delegated';
    const callerAppId = (payload.act?.sub as string) || (payload.sub as string);

    // 3. Deny-by-default ingress policy check
    const allowed = await getAllowedCallers();
    const isPermitted = allowed.includes('*') || allowed.includes(callerAppId);

    if (!isPermitted) {
      console.warn(\`Ingress blocked: Caller "\${callerAppId}" not in allowedCallers for \${process.env.MCOM_CLIENT_ID}\`);
      return res.status(403).json({
        error: \`Forbidden: Caller "\${callerAppId}" is not permitted to call this service\`,
      });
    }

    // Attach caller context to request
    req.serviceCaller = {
      callerAppId,
      isDelegated,
      userId: isDelegated ? (payload.sub as string) : undefined,
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
      payload,
    };

    next();
  } catch (err: any) {
    console.error('Service token verification failed:', err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired service token' });
  }
}
\`\`\`

---

### Task 3.3: User-Delegated Calls (RFC 8693 Token Exchange)
When a user is logged into **${client.name}** and your backend needs to perform an action on a peer app **on behalf of that user**:

\`\`\`typescript
export async function getDelegatedUserToken(
  userSsoAccessToken: string,
  targetAudience: string,
  scope = 'service:read',
): Promise<string> {
  const clientId = process.env.MCOM_CLIENT_ID!;
  const clientSecret = process.env.MCOM_CLIENT_SECRET!;
  const mcomUrl = process.env.MCOM_SOLUTIONS_URL!;

  const basicAuth = Buffer.from(\`\${clientId}:\${clientSecret}\`).toString('base64');

  const { data } = await axios.post(
    \`\${mcomUrl}/api/v1/auth/service-token/exchange\`,
    {
      subject_token: userSsoAccessToken,
      audience: targetAudience,
      scope,
    },
    {
      headers: {
        Authorization: \`Basic \${basicAuth}\`,
        'Content-Type': 'application/json',
      },
    },
  );

  return data.access_token;
}
\`\`\`

---

## 🔐 PHASE 4: Single Sign-On (SSO) & Unified Entitlement Engine

### Task 4.1: SSO Login Redirect
1. Add a **"Login with MCOM"** button in your login view.
2. Generate a random 32-byte CSRF \`state\` token, save in session/cookie, and redirect to:
   \`\`\`http
   GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/authorize?client_id=\${MCOM_CLIENT_ID}&redirect_uri=\${encodeURIComponent(MCOM_REDIRECT_URI)}&scope=\${encodeURIComponent(MCOM_SCOPES)}&state=\${state}
   \`\`\`

### Task 4.2: Auth Callback & Entitlement Processing
Create the route at \`${new URL(redirectUri).pathname || '/auth/callback'}\`:

\`\`\`typescript
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Verify CSRF state
  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('Invalid OAuth state parameter');
  }

  // 2. Exchange code for tokens
  const tokenRes = await axios.post(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token\`, {
    client_id: process.env.MCOM_CLIENT_ID,
    client_secret: process.env.MCOM_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MCOM_REDIRECT_URI,
  });

  const { accessToken, refreshToken, user, entitlement } = tokenRes.data;

  // 3. ENFORCE UNIFIED ENTITLEMENT
  // MCOM Central provides standardized access rules:
  if (!entitlement?.access?.hasAccess) {
    const reason = entitlement?.access?.reason; // e.g. 'PLATFORM_NOT_IN_MEMBERSHIP', 'TRIAL_EXPIRED', 'UNVERIFIED'
    const upgradeUrl = entitlement?.access?.upgradeUrl;
    console.warn(\`Access denied for \${user.email}: \${reason}\`);
    return res.redirect(\`/upgrade?reason=\${reason}&upgradeUrl=\${encodeURIComponent(upgradeUrl)}\`);
  }

  // User is entitled! Provision session according to plan:
  const isTrial = entitlement.access.accessType === 'TRIAL_PROGRAMME';
  const planId = entitlement.plan?.planId;
  const planName = entitlement.plan?.planName;
  const quotas = entitlement.plan?.quotas || {};
  const programmeTasks = entitlement.trialContext?.programmeTasks || [];

  console.log(\`Provisioning \${user.email}: Plan="\${planName}" (\${planId}), Trial=\${isTrial}\`);

  // Store user session and tokens locally...
  req.session.user = user;
  req.session.accessToken = accessToken;

  res.redirect('/dashboard');
});
\`\`\`

### Task 4.3: Real-Time Entitlement Introspection
Whenever you need to check if a user is still entitled or fetch their updated trial tasks:
\`\`\`http
GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/entitlement?client_id=\${MCOM_CLIENT_ID}&user_id=\${userId}
X-API-Key: \${MCOM_API_KEY}
\`\`\`
Or with the user's Bearer token:
\`\`\`http
GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/entitlement
Authorization: Bearer \${accessToken}
\`\`\`

---

${
  hasBilling
    ? `## 💳 PHASE 5: Generic Billing API Connector
MCOM Solutions manages subscription tiers for **${client.name}** via REST. Implement these 5 endpoints protected by \`X-API-Key\`:

\`\`\`typescript
// Verify incoming API key from MCOM Solutions
app.use('/api/v1/system/plans', (req, res, next) => {
  const key = req.headers['x-mcom-solution-api-key'] || req.headers['x-api-key'];
  if (key !== process.env.MCOM_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid MCOM API Key' });
  }
  next();
});

// 1. GET    /api/v1/system/plans      -> Return array of ExternalPlan objects
// 2. POST   /api/v1/system/plans      -> Create plan ({ name, monthlyPrice, annualPrice, features, quotas })
// 3. GET    /api/v1/system/plans/:id  -> Get single plan by ID
// 4. PATCH  /api/v1/system/plans/:id  -> Update plan details
// 5. DELETE /api/v1/system/plans/:id  -> Archive or delete plan
\`\`\`

---
`
    : ''
}${
  hasWebhook
    ? `## 🔔 PHASE 6: Webhook Signature Verification
MCOM dispatches lifecycle events (e.g. \`package.created\`, \`package.renewed\`, \`package.expired\`) to \`${client.webhookUrl}\`:

\`\`\`typescript
import * as crypto from 'crypto';

app.post('${new URL(client.webhookUrl || 'https://app.com/webhooks').pathname}', (req, res) => {
  const signatureHeader = req.headers['x-mcom-signature'] as string; // "sha256=<hex>"
  const rawBody = (req as any).rawBody; // Must be raw unparsed Buffer or string

  const expectedSig = crypto
    .createHmac('sha256', process.env.MCOM_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  const receivedSig = (signatureHeader || '').replace(/^sha256=/, '');
  const isValid = receivedSig.length === expectedSig.length &&
    crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'));

  if (!isValid) return res.status(401).json({ error: 'Invalid HMAC webhook signature' });

  const event = req.body;
  console.log('Received MCOM webhook event:', event.event);

  res.json({ received: true });
});
\`\`\`

---
`
    : ''
}## 📋 ACCEPTANCE CHECKLIST & TROUBLESHOOTING

### Agent Verification Checklist:
- [ ] Ran \`node test-mcom-mesh.mjs\` and saw \`✅ Service Token Minted Successfully!\`.
- [ ] \`.env\` file has all required variables filled in.
- [ ] \`callPeer\` utility is created and tested with audience \`"${sampleTargetPeer}"\`.
- [ ] \`requireServiceAuth\` middleware is configured on inbound API routes.
- [ ] Inbound calls reject tokens with mismatched audience or unauthorized callers with \`403 Forbidden\`.
- [ ] SSO Login redirects cleanly to \`/api/v1/auth/sso/authorize\`.
- [ ] Callback handles \`entitlement.access.hasAccess\` and gates features accordingly.

### Troubleshooting Quick Guide:
| Error Symptom | Root Cause | Fix |
|:---|:---|:---|
| \`403 Client is not permitted to call <peer>\` | Outbound peer not in \`allowedAudiences\` | Open **MCOM Console → Service Mesh Policy**, tick the cell connecting your app to target peer, and click **Save Policy**. |
| \`403 Caller is not permitted to call this service\` | Inbound caller not in target's \`allowedCallers\` | In **MCOM Console**, ensure target peer allows your \`clientId\` in Ingress, or set wildcard \`*\`. |
| \`401 Invalid client credentials\` | \`MCOM_CLIENT_ID\` or \`MCOM_CLIENT_SECRET\` invalid | Verify credentials in MCOM Console → App Details → Credentials Vault. |
| \`JWTExpired\` | Service token exceeded its 5-minute TTL | Ensure your client re-fetches or refreshes the token using \`getServiceToken\`. |
`;
}
