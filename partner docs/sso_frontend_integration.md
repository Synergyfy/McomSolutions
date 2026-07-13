# MCOM Service Integration — Frontend SSO & Redirection Guide

This document describes how to implement the frontend user flows inside any partner service (e.g., MCOM Mall, MCOM Loyalty, 247GBS) to support single sign-on redirection and direct launch handling from MCOM Central.

---

## 1. Environment Configuration

Define the base URLs in your frontend client's env file (e.g., `.env` or `.env.local`):
```bash
# MCOM Central frontend dashboard URL
VITE_MCOM_CENTRAL_URL=https://auth.mcomsolutions.com

# MCOM Central API backend base URL
VITE_MCOM_CENTRAL_API=https://auth.mcomsolutions.com/api/v1

# Your service's Client ID registered in MCOM Central
VITE_SSO_CLIENT_ID=mcom-mall
```

---

## 2. Initiating Login Redirection

When a user clicks a "Login" or "Sign Up" button on your frontend, or attempts to access a protected dashboard route while unauthenticated, redirect them to MCOM Central's OAuth Authorization screen.

### Example Redirection Function (React/TypeScript):
```typescript
function redirectToCentralLogin() {
  const centralUrl = import.meta.env.VITE_MCOM_CENTRAL_URL || 'http://localhost:5173';
  const clientId = import.meta.env.VITE_SSO_CLIENT_ID;
  
  // The callback route on your frontend that handles the code redirect
  const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback`);
  
  // Generate a random string to prevent CSRF attacks
  const state = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('oauth_state', state);

  // Send the state to your backend session so your server-side callback can verify it
  // (Alternatively, set a temporary client-side validation cookie)

  // Redirect to MCOM Central SSO
  window.location.href = `${centralUrl}/login?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20email`;
}
```

---

## 3. Handling the Redirect Callback

Your frontend needs a dedicated route (e.g., `/auth/callback`) mapped to a component that handles the incoming `code` and `state` parameters from MCOM Central, forwards them to your backend, and handles session initiation.

### Example Callback Component (React):
```tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const savedState = localStorage.getItem('oauth_state');

    // 1. Verify CSRF state
    if (!state || state !== savedState) {
      setError('OAuth State mismatch. Security verification failed.');
      return;
    }
    localStorage.removeItem('oauth_state');

    if (!code) {
      setError('No authorization code provided.');
      return;
    }

    // 2. Call your backend helper to exchange code for session cookies/token
    axios.get(`/api/auth/callback`, { params: { code, state } })
      .then((res) => {
        // Success: backend established local session cookie/tokens
        navigate('/dashboard');
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Authentication failed');
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Authentication Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => navigate('/login')} className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-600 font-semibold">Completing MCOM Secure Login...</p>
    </div>
  );
}
```

---

## 4. Handling Direct Dashboard Redirections (SSO Token Handshake)

When a user clicks your platform launcher card from MCOM Central's Dashboard, MCOM Central redirects them to your login page with a short-lived `sso_token` (or `token`) in the URL.

```
GET https://your-service.com/sso-login?token=<SHORT_LIVED_JWT>
```

Your frontend must inspect the URL, extract the token, send it to your backend for validation, and proceed to the dashboard.

### Example Direct Handshake Component (React):
```tsx
import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

export default function SsoLoginGate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token') || searchParams.get('sso_token');
    
    if (token) {
      // Send to your backend to decode and sign local session cookies
      axios.get(`/api/auth/sso-login`, { params: { token } })
        .then((res) => {
          navigate(res.data.redirect || '/dashboard');
        })
        .catch((err) => {
          console.error('SSO handshake verification failed', err);
          navigate('/login');
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-600 font-semibold">Authorizing SSO Session...</p>
    </div>
  );
}
```
 Josephine's setup: Set your route path `/sso-login` or `/sso` to mount this `SsoLoginGate` component.
