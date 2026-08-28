/* eslint-disable no-console */
/**
 * End-to-end wallet smoke test against a RUNNING backend.
 *
 *   cd apps/backend
 *   npx dotenv -e .env -- npx ts-node scripts/wallet-smoke.ts
 *
 * Exercises: register → auto-created wallet → partner credit (HMAC) → partner
 * debit → idempotent retry → insufficient balance → user transaction history.
 *
 * HMAC secret resolution mirrors WalletHmacGuard: MCOM_MALL_SECRET env (tier 2),
 * falling back to SSO_API_SECRET. Use the same secret the server resolves.
 */
import * as crypto from 'crypto';

const BASE = process.env.APP_URL || 'http://localhost:3010';
const API = `${BASE}/api/v1`;
const CLIENT_ID = process.env.MCOM_WALLET_TEST_CLIENT_ID || 'mcom-mall';
const HMAC_SECRET = process.env.MCOM_MALL_SECRET || process.env.SSO_API_SECRET || '';

function sign(body: unknown): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return 'sha256=' + crypto.createHmac('sha256', HMAC_SECRET).update(raw).digest('hex');
}

function partnerHeaders(body: unknown, idempotencyKey?: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Mcom-Client-ID': CLIENT_ID,
    'X-Mcom-Signature': sign(body),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
  };
}

async function call(path: string, method: string, headers: Record<string, string>, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

function check(label: string, ok: boolean, detail?: any) {
  console.log(`${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${JSON.stringify(detail)}`}`);
  return ok;
}

async function main() {
  const uniq = Date.now();
  const email = `smoke-${uniq}@test.com`;

  if (!HMAC_SECRET) {
    console.error('No HMAC secret found — set MCOM_MALL_SECRET or SSO_API_SECRET in .env');
    process.exit(1);
  }

  // 1. Register a customer → wallet auto-created
  const reg = await call('/auth/register', 'POST', { 'Content-Type': 'application/json' }, {
    email, password: 'TestPass123!', role: 'CUSTOMER', firstName: 'Smoke', lastName: 'Test',
  });
  const token = reg.json?.accessToken;
  const userId = reg.json?.user?.id;
  if (!check('register user (201)', reg.status === 201, reg.json) || !token || !userId) process.exit(1);

  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. User wallet exists with zero balance
  const w0 = await call('/wallet', 'GET', auth);
  check('wallet auto-created, balance 0', w0.status === 200 && w0.json.balance === 0, w0.json);

  // 3. Partner credit 100 (HMAC-signed)
  const creditBody = { userId, amount: 100, category: 'REWARD', description: 'Smoke cashback', reference: `smoke-cb-${uniq}` };
  const credit = await call('/wallet/partner/credit', 'POST', partnerHeaders(creditBody, `smoke-credit-${uniq}`), creditBody);
  check('partner credit 100 (201)', credit.status === 201, credit.json);
  const creditId = credit.json?.transactionId;

  // 4. Partner debit 40
  const debitBody = { userId, amount: 40, category: 'PURCHASE', description: 'Smoke purchase', reference: `smoke-pur-${uniq}` };
  const debit = await call('/wallet/partner/debit', 'POST', partnerHeaders(debitBody, `smoke-debit-${uniq}`), debitBody);
  check('partner debit 40 (201)', debit.status === 201, debit.json);

  // 5. User wallet now shows 60
  const w1 = await call('/wallet', 'GET', auth);
  check('balance is 60', w1.status === 200 && w1.json.balance === 60, w1.json);

  // 6. Idempotent retry — same key returns same transaction, no double debit
  const retry = await call('/wallet/partner/debit', 'POST', partnerHeaders(debitBody, `smoke-debit-${uniq}`), debitBody);
  check('idempotent retry (same txnId)', retry.status === 201 && retry.json.transactionId === debit.json.transactionId, retry.json);
  const w2 = await call('/wallet', 'GET', auth);
  check('no double debit (still 60)', w2.json.balance === 60, w2.json);

  // 7. Missing idempotency key → 400
  const noKey = await call('/wallet/partner/debit', 'POST', partnerHeaders(debitBody), debitBody);
  check('debit without X-Idempotency-Key → 400', noKey.status === 400, noKey.json);

  // 8. Insufficient balance → 422
  const bigBody = { userId, amount: 9999, category: 'PURCHASE', description: 'Too big' };
  const big = await call('/wallet/partner/debit', 'POST', partnerHeaders(bigBody, `smoke-big-${uniq}`), bigBody);
  check('insufficient balance → 422', big.status === 422 && big.json.error === 'INSUFFICIENT_BALANCE', big.json);

  // 9. No HMAC → 401
  const noHmac = await call('/wallet/partner/debit', 'POST', { 'Content-Type': 'application/json' }, debitBody);
  check('no HMAC headers → 401', noHmac.status === 401, noHmac.json);

  // 10. Transaction history via user endpoint
  const txs = await call('/wallet/transactions', 'GET', auth);
  check('transaction history (2 txns)', txs.status === 200 && txs.json.total === 2, txs.json);

  // 11. Partner balance check (GET signs the empty body)
  const bal = await call(`/wallet/partner/balance/${userId}`, 'GET', {
    'Content-Type': 'application/json',
    'X-Mcom-Client-ID': CLIENT_ID,
    'X-Mcom-Signature': sign(''),
  });
  check('partner balance 60', bal.status === 200 && bal.json.balance === 60, bal.json);

  console.log('\nDone. Transaction ids:', { creditId, debitId: debit.json.transactionId });
}

main().catch((e) => { console.error(e); process.exit(1); });