# MCOM Central — Partner SSO & Data Sharing Integration Guide

This guide describes how any partner service in the MCOM ecosystem (e.g., MCOM Mall, MCOM Loyalty, 247GBS) integrates with MCOM Central for universal authentication and user data sharing.

---

## 1. Environment Configuration

To allow flexible deployment across Local, Staging, and Production environments, all partner services must configure MCOM Central's base domain/URL in their environment variables.

Add the following to your service's `.env` file:
```bash
# The Base Domain/URL of MCOM Central (exclude the API path prefix)
MCOM_CENTRAL_BASE_URL=https://auth.mcomsolutions.com
```
*(For local development, set this to `MCOM_CENTRAL_BASE_URL=http://localhost:3010`)*

In addition, each partner service should define its own base URL:
```bash
# Your platform's own base URL
YOUR_SERVICE_BASE_URL=https://your-mcom-service.com
```
*(For local development, this could be `http://localhost:3002`, `http://localhost:3005`, etc.)*

---

## 2. Authentication Integration Options

MCOM Central supports two main methods for integrating authentication:
1. **Shared JWT Handshake Redirection Flow** (High performance, zero-network verification using a shared secret).
2. **OAuth 2.0 Authorization Code Flow** (Standard secure client-server authorization).

---

## 3. Option A: Shared JWT Handshake Redirection Flow

When a logged-in user launches your platform from the MCOM Central Dashboard, MCOM Central redirects the user's browser with a short-lived `sso_token` (or `token`) query parameter:

```
GET ${YOUR_SERVICE_BASE_URL}/sso-login?token=<SHORT_LIVED_JWT>
```

### Handshake JWT Verification
Because the token is signed as a standard JSON Web Token (JWT) with a shared secret, your service can verify the token **locally** without making a REST call back to MCOM Central.

1. **Algorithm**: HS256
2. **Shared Secret**: Configure `SSO_SECRET` in your service (defaults to `shared-sso-secret` in development).
3. **Expiry**: 60 seconds (enforced by the `exp` claim).

#### JWT Payload Structure:
```json
{
  "iss": "mcom-loyalty",
  "aud": "mcom-mall",
  "sub": "user-uuid-12345",
  "email": "user@example.com",
  "name": "Acme Corp",
  "role": "business",
  "phoneNumber": "+447911123456",
  "postcode": "SW1A 2AA",
  "address": "10 Downing Street",
  "iat": 1783857600,
  "exp": 1783857660
}
```

#### Example Verification (Node.js/Express):
```javascript
const jwt = require('jsonwebtoken');

app.get('/sso-login', (req, res) => {
  const token = req.query.token || req.query.sso_token;
  if (!token) return res.status(400).send('SSO Token is required');

  try {
    // Verify using the shared secret
    const decoded = jwt.verify(token, process.env.SSO_SECRET || 'shared-sso-secret', {
      issuer: 'mcom-loyalty'
    });

    // Establish session / issue local cookie
    req.session.userId = decoded.sub;
    req.session.user = {
      email: decoded.email,
      name: decoded.name,
      role: decoded.role
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Invalid SSO Token:', err.message);
    res.status(401).send('Unauthorized session or expired token');
  }
});
```

---

## 4. Option B: OAuth 2.0 Authorization Code Flow

For server-to-server secure logins where standard client redirection is desired.

### Step 1: Redirect User to Authorize
Redirect the user's browser to:
```
GET ${MCOM_CENTRAL_BASE_URL}/api/v1/auth/sso/authorize
  ?client_id=<YOUR_CLIENT_ID>
  &redirect_uri=<YOUR_CALLBACK_URL>
  &state=<RANDOM_STATE_STRING>
  &scope=profile email
```

### Step 2: Receive Code
MCOM Central redirects the browser back to your callback:
```
GET ${YOUR_SERVICE_BASE_URL}/auth/callback
  ?code=<AUTHORIZATION_CODE>
  &state=<THE_SAME_STATE_STRING>
```

### Step 3: Exchange Code for Access Token
Make a server-to-server POST request:
```http
POST ${MCOM_CENTRAL_BASE_URL}/api/v1/auth/sso/token
Content-Type: application/json

{
  "client_id": "<YOUR_CLIENT_ID>",
  "client_secret": "<YOUR_CLIENT_SECRET>",
  "code": "<THE_AUTHORIZATION_CODE>",
  "redirect_uri": "<THE_SAME_CALLBACK_URL>"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1...",
  "refreshToken": "eyJhbGciOiJIUzI1...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "BUSINESS",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

---

## 5. Server-to-Server Data Sharing REST API

To query user details, memberships, active packages, or permissions directly from MCOM Central, use the **Data Sharing API**.

### Authentication
All requests must include your service's API Key in the headers:
```http
X-Api-Key: <YOUR_SERVICE_API_KEY>
```

### Endpoints

#### 1. Get Full User Context
Fetch profile info, current active package entitlements, and computed permissions.
- **Method**: `GET`
- **Path**: `${MCOM_CENTRAL_BASE_URL}/api/v1/data/user`
- **Query Params**:
  - `email` (string, optional) - Query user by email address.
  - `userId` (string, optional) - Query user by unique ID.
- **Example Request**:
  ```http
  GET ${MCOM_CENTRAL_BASE_URL}/api/v1/data/user?email=john@example.com
  X-Api-Key: mcom_mall_api_key_secure_987
  ```
- **Example Response Envelope**:
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
          "platformName": "MCOM Mall",
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

#### 2. Get User Membership Details Only
- **Method**: `GET`
- **Path**: `${MCOM_CENTRAL_BASE_URL}/api/v1/data/user/:userId/membership`
- **Example Request**:
  ```http
  GET ${MCOM_CENTRAL_BASE_URL}/api/v1/data/user/user-uuid-123/membership
  X-Api-Key: mcom_mall_api_key_secure_987
  ```
- **Example Response**:
  ```json
  {
    "success": true,
    "data": {
      "userId": "user-uuid-123",
      "membershipLevel": "Gold",
      "membershipTier": "Pro",
      "membershipStatus": "active"
    }
  }
  ```

#### 3. Get User Platform Packages
- **Method**: `GET`
- **Path**: `${MCOM_CENTRAL_BASE_URL}/api/v1/data/user/:userId/packages`
- **Example Request**:
  ```http
  GET ${MCOM_CENTRAL_BASE_URL}/api/v1/data/user/user-uuid-123/packages
  X-Api-Key: mcom_mall_api_key_secure_987
  ```
- **Example Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "platformName": "MCOM Mall",
        "packageName": "Standard",
        "status": "active"
      }
    ]
  }
  ```

---

## 6. Code Examples (Node.js & Express)

### Client Callback Exchange
```javascript
const axios = require('axios');

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  // 1. Verify state matches stored state session value
  if (state !== req.session.oauthState) {
    return res.status(400).send('CSRF State mismatch');
  }

  try {
    const centralBaseUrl = process.env.MCOM_CENTRAL_BASE_URL || 'http://localhost:3010';

    // 2. Exchange authorization code for token
    const tokenResponse = await axios.post(`${centralBaseUrl}/api/v1/auth/sso/token`, {
      client_id: 'mcom-mall',
      client_secret: 'mall_secret_123',
      code: code,
      redirect_uri: 'http://localhost:3000/auth/callback'
    });

    const { accessToken, user } = tokenResponse.data;

    // 3. Save accessToken to session or cookie
    req.session.token = accessToken;
    req.session.user = user;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('SSO Exchange error', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});
```

---

## 7. Development Credentials & Seed Data

Use these values for local development and testing:

| Service Name | Client ID | Client Secret | REST API Key |
|---|---|---|---|
| **MCOM Mall** | `mcom-mall` | `mall_secret_123` | `mcom_mall_api_key_secure_987` |
| **MCOM Loyalty** | `mcom-loyalty` | `loyalty_secret_123` | `mcom_loyalty_api_key_secure_987` |
| **247GBS** | `247gbs` | `gbs_secret_123` | `gbs_api_key_secure_987` |
