/**
 * jest-setup.ts
 *
 * Loaded via jest.config.ts `setupFiles` — runs before any test file or module
 * is imported. Sets all environment variables needed for the test suite so that
 * NestJS config, Prisma, Redis and other services pick up test values instead of
 * whatever is in the developer's local .env.
 *
 * DATABASE_URL points at `mcom_mall_test` — the local test database.
 * The production `mcom_solutions` DB is never touched during tests.
 */

// ─── Node environment ────────────────────────────────────────────────────────
process.env.NODE_ENV = 'test';

// ─── Test database (mcom_mall_test) ──────────────────────────────────────────
process.env.DATABASE_URL =
  'postgresql://postgres:Nov52002%23@localhost:5432/mcom_mall_test';
// DIRECT_URL is required by the Prisma schema (used for connection pooling separation)
process.env.DIRECT_URL =
  'postgresql://postgres:Nov52002%23@localhost:5432/mcom_mall_test';

// ─── Auth / JWT ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.MOCK_OTP = 'true';

// ─── Redis (service skips connection in NODE_ENV=test) ────────────────────────
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
process.env.REDIS_PASSWORD = '';

// ─── SSO ─────────────────────────────────────────────────────────────────────
process.env.SSO_API_SECRET = 'test-hmac-secret';
process.env.SSO_JWT_SECRET = 'test-sso-jwt-secret';
process.env.SSO_CODE_TTL_SECONDS = '300';
process.env.SSO_ACCESS_TOKEN_TTL = '3600';
process.env.SSO_REFRESH_TOKEN_TTL = '604800';
process.env.MCOM_CENTRAL_ISSUER = 'mcom-central-test';

// ─── Service-to-service HMAC ─────────────────────────────────────────────────
process.env.MCOM_REWARDS_SECRET = 'mcom_rewards_dev_secret_change_in_prod';
process.env.MCOM_SPIN_SECRET = 'mcom_spin_dev_secret_change_in_prod';
process.env.MCOM_MALL_SECRET = 'mcom_mall_dev_secret_change_in_prod';
process.env.MCOM_AUDIT_SECRET = 'mcom_audit_dev_secret_change_in_prod';
process.env.MCOM_EXPO_SECRET = 'mcom_expo_dev_secret_change_in_prod';

// ─── External services (stubbed — no real calls in tests) ─────────────────────
process.env.STRIPE_SECRET_KEY = 'sk_test_stub_key_for_tests';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_stub';
process.env.PAYPAL_CLIENT_ID = 'paypal-test-client-id';
process.env.PAYPAL_CLIENT_SECRET = 'paypal-test-client-secret';
process.env.PAYPAL_ENV = 'sandbox';
process.env.GOOGLE_PLACES_API_KEY = 'test-google-places-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

// ─── SMTP (disabled — MOCK_OTP=true suppresses all email sending) ─────────────
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_FROM = 'no-reply@mcomsolutions.com';

// ─── App URLs ────────────────────────────────────────────────────────────────
process.env.APP_URL = 'http://localhost:3010';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.MCOM_MALL_API_URL = 'http://localhost:3001';
process.env.MCOM_REWARDS_API_URL = 'http://localhost:4000';
process.env.MCOM_SOLUTION_API_KEY = 'test-solution-api-key';
process.env.MCOM_REWARDS_API_KEY = 'test-rewards-api-key';

// ─── Mcom Console Encryption ──────────────────────────────────────────────────
process.env.CONSOLE_ENCRYPTION_KEY = '86d3b8c8ad1519806cd90234050daebe4d2dc95f1ea9d83d780cc73ebed00a3b';
