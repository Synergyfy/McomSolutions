# MCOM Service Integration — Backend SSO & Data Sharing Guide

This document describes how to implement the backend integration inside any partner service (e.g., MCOM Mall, MCOM Loyalty, 247GBS) to handle SSO authentication and exchange data with MCOM Central.

---

## 1. Required Environment Variables

Add these to your service's `.env` configuration file:
```bash
# 1. Base URL of MCOM Central
MCOM_CENTRAL_BASE_URL=https://auth.mcomsolutions.com
# (Use http://localhost:3010 in local development)

# 2. Your Service Credentials registered in MCOM Central
SSO_CLIENT_ID=your-service-client-id         # e.g., mcom-mall
SSO_CLIENT_SECRET=your-service-client-secret # Keep this secret!
SSO_API_SECRET=your-service-hmac-secret       # Shared secret used to sign HMAC requests

# 3. Shared JWT secret key (must match MCOM Central's SSO_SECRET)
SSO_SECRET=shared-sso-secret
```

---

## 2. Implementing the OAuth Callback Endpoint

When MCOM Central redirects a user back to your service with an authorization code, your backend callback endpoint must handle the code exchange.

* **Route**: `/api/auth/callback` (or `/auth/callback` depending on backend router)
* **Method**: `GET`
* **Query Parameters**:
  - `code` (string) - The temporary authorization code.
  - `state` (string) - The state parameter to verify against CSRF.

### Callback Handler Logic
```javascript
const axios = require('axios');
const db = require('./models'); // Your local database ORM

app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Verify CSRF State matches the one stored in session
  if (!state || state !== req.session.oauthState) {
    return res.status(400).json({ error: 'CSRF State mismatch. Potential request forgery.' });
  }
  // Clear the state from session
  delete req.session.oauthState;

  try {
    // 2. Exchange the temporary code for Tokens
    const tokenResponse = await axios.post(`${process.env.MCOM_CENTRAL_BASE_URL}/api/v1/auth/sso/token`, {
      client_id: process.env.SSO_CLIENT_ID,
      client_secret: process.env.SSO_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.YOUR_SERVICE_BASE_URL}/auth/callback`
    });

    const { accessToken, refreshToken, user } = tokenResponse.data;

    // 3. JIT (Just-In-Time) User Provisioning
    // Ensure the user exists in your local database with their MCOM profile details.
    let localUser = await db.User.findOne({ where: { email: user.email } });
    if (!localUser) {
      localUser = await db.User.create({
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role, // e.g. BUSINESS or CUSTOMER
        // Set other default fields
      });
    } else {
      // Sync names/roles if changed centrally
      await localUser.update({
        firstName: user.firstName || localUser.firstName,
        lastName: user.lastName || localUser.lastName,
        role: user.role
      });
    }

    // 4. Establish Local Session
    // Set local access/refresh tokens, or store session variables
    req.session.userId = localUser.id;
    req.session.email = localUser.email;
    req.session.centralAccessToken = accessToken; // (Optional: save if you need to make authenticated requests)

    // 5. Redirect frontend client to dashboard
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('SSO Token Exchange failed:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
});
```

---

## 3. Handling Direct Dashboard Redirections (Shared JWT Handshake)

When a user clicks on your app card in the MCOM Central Dashboard, MCOM Central signs a short-lived (60s) JWT containing the user's profile and redirects them directly to your app:

```
GET https://your-service.com/sso-login?token=<JWT_TOKEN>
```

Your backend must intercept this redirect, verify the signature locally, and establish the session.

### Direct Handshake Middleware/Route Handler
```javascript
const jwt = require('jsonwebtoken');
const db = require('./models');

app.get('/api/auth/sso-login', async (req, res) => {
  const token = req.query.token || req.query.sso_token;
  if (!token) {
    return res.status(400).json({ error: 'SSO Token is required' });
  }

  try {
    // 1. Verify the JWT signature using the shared secret
    const decoded = jwt.verify(token, process.env.SSO_SECRET || 'shared-sso-secret', {
      issuer: 'mcom-loyalty' // Must match central issuer identifier
    });

    // 2. JIT Provision the user
    let localUser = await db.User.findOne({ where: { email: decoded.email } });
    if (!localUser) {
      localUser = await db.User.create({
        email: decoded.email,
        firstName: decoded.name ? decoded.name.split(' ')[0] : '',
        lastName: decoded.name ? decoded.name.split(' ').slice(1).join(' ') : '',
        role: decoded.role === 'business' ? 'BUSINESS' : 'CUSTOMER'
      });
    }

    // 3. Establish Local Session
    req.session.userId = localUser.id;
    req.session.email = localUser.email;

    // 4. Return success to redirect frontend
    return res.json({ success: true, redirect: '/dashboard' });
  } catch (err) {
    console.error('Direct Handshake Verification failed:', err.message);
    return res.status(401).json({ error: 'SSO session invalid or expired' });
  }
});
```

---

## 4. Querying User Memberships & Active Packages (Data Sharing)

If your backend needs to check a user's subscription limits or active package permissions dynamically (e.g. check if a business is Gold and has the Mall package active), your request must be signed using HMAC-SHA256.

### HMAC Signature Generation
The signature is created by signing the payload `${serviceId}:${timestamp}` using your `SSO_API_SECRET` as the key. The timestamp is a Unix timestamp in seconds. Replay window allows for a max ±5-minute skew.

### Request Signing Example
```javascript
const axios = require('axios');
const crypto = require('crypto');

/**
 * Generates HMAC signature headers for secure data exchange
 */
function getHmacHeaders() {
  const serviceId = process.env.SSO_CLIENT_ID; // e.g. 'mcom-mall'
  const secret = process.env.SSO_API_SECRET;
  const timestamp = Math.floor(Date.now() / 1000).toString();

  // Create signature payload: "serviceId:timestamp"
  const message = `${serviceId}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return {
    'X-Service-Id': serviceId,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  };
}

async function checkUserMembership(userId) {
  try {
    const headers = getHmacHeaders();

    const res = await axios.get(`${process.env.MCOM_CENTRAL_BASE_URL}/api/v1/data/user`, {
      params: { userId },
      headers: headers
    });

    const userData = res.data.data;
    // Example: check if business user has active MCOM Mall package
    const hasActiveMall = userData.packages.some(
      pkg => pkg.platformName.toLowerCase() === 'mall' && pkg.status === 'active'
    );

    return {
      membershipLevel: userData.membershipLevel, // e.g. Gold
      membershipTier: userData.membershipTier,   // e.g. Pro
      hasActiveMall
    };
  } catch (err) {
    console.error('Failed to retrieve user context from Central:', err.response?.data || err.message);
    return null;
  }
}
```

### Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/data/user` | GET | Full user context (profile, membership, packages, permissions) |
| `/api/v1/data/user/:userId/membership` | GET | Membership level/tier/status only |
| `/api/v1/data/user/:userId/packages` | GET | Active platform packages only |
| `/api/v1/data/user/:userId/permissions` | GET | Calculated platform access permissions |
| `/api/v1/data/user/bulk` | POST | Bulk query multiple users |

### Query Parameters for `/api/v1/data/user`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | No* | Query by email address |
| `userId` | string | No* | Query by user ID |

*At least one of `email` or `userId` must be provided.

### Example Response (Single User Context)
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid-123",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "BUSINESS",
    "businessId": "business-uuid-456",
    "businessName": "Acme Corp",
    "membershipLevel": "Gold",
    "membershipTier": "Pro",
    "membershipStatus": "active",
    "packages": [
      {
        "platformName": "mall",
        "packageName": "Standard",
        "status": "active"
      }
    ],
    "permissions": {
      "canAccessMall": true,
      "canAccessRewards": true,
      "canAccessSpin": false,
      "canAccessAudit": false,
      "canAccessExpo": false
    }
  }
}
```

---

## 5. Development Credentials & Seed Data

Use these values for local development and testing:

| Service Name | Client ID | Client Secret | HMAC Secret (SSO_API_SECRET) |
|---|---|---|---|
| **MCOM Mall** | `mcom-mall` | `mall_secret_123` | `dev-hmac-secret` |
| **MCOM Loyalty** | `mcom-loyalty` | `loyalty_secret_123` | `dev-hmac-secret` |
| **247GBS** | `247gbs` | `gbs_secret_123` | `dev-hmac-secret` |
