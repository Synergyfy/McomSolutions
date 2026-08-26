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
   - Response payload will contain:
     \`\`\`json
     {
       "accessToken": "JWT_ACCESS_TOKEN",
       "refreshToken": "REFRESH_TOKEN",
       "user": {
         "id": "user_id",
         "email": "user@example.com",
         "name": "User Name",
         "role": "MEMBER",
         "membershipLevel": "Gold",
         "membershipStatus": "active",
         "permissions": {
           "canAccess_${platformSlug}": true
         }
       }
     }
     \`\`\`
3. Store the \`accessToken\`, \`refreshToken\`, and user profile in your application's session or issue a local JWT session.

### Task 3: Access Control & Dynamic Permission Gating
1. Protect your application's routes based on whether the user has active access to this platform.
2. Check the dynamic permission:
   \`\`\`typescript
   const hasAccess = user.permissions?.canAccess_${platformSlug} === true;
   if (!hasAccess) {
     // User has not purchased an active package for ${client.name}
     // Redirect to MCOM membership upgrade or show access denied banner
   }
   \`\`\`
3. (Optional) Call \`GET \${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/userinfo\` with \`Authorization: Bearer \${accessToken}\` whenever you need freshly synchronized package status.

${
  hasBilling
    ? `### Task 4: Billing API Plan Management Contract
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
    ? `### Task 5: Webhook Signature Verification
MCOM dispatches ecosystem lifecycle events to your webhook endpoint:
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

     const event = req.body; // { event: "user.registered", payload: { ... } }
     // Process event asynchronously...
     res.json({ received: true });
   });
   \`\`\`
`
    : ''
}
### Task 6: Server-to-Server Signed Requests (HMAC)
When your backend needs to call MCOM data-sharing APIs directly (e.g. \`/api/v1/data-sharing/*\`):
\`\`\`typescript
import * as crypto from 'crypto';
import axios from 'axios';

async function callMcomSignedApi(endpoint: string, data: object) {
  const rawBody = JSON.stringify(data);
  const signature = crypto
    .createHmac('sha256', process.env.MCOM_HMAC_SECRET!)
    .update(rawBody)
    .digest('hex');

  return axios.post(\`\${process.env.MCOM_SOLUTIONS_URL}\${endpoint}\`, data, {
    headers: {
      'Content-Type': 'application/json',
      'X-Mcom-Signature': \`sha256=\${signature}\`,
      'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
    },
  });
}
\`\`\`

---

## 3. Verification & Acceptance Criteria
1. Clicking **"Login with MCOM"** redirects cleanly to MCOM Solutions SSO.
2. After authenticating, the user is redirected back to \`${redirectUri}\` and logged in automatically.
3. User permissions show \`canAccess_${platformSlug}: true\` for subscribed accounts.
4. Token refresh handles expired access tokens seamlessly via \`/api/v1/auth/sso/token/refresh\`.
5. All secrets are kept on the server and never exposed in client-side bundles.
`;
}
