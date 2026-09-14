import { useState, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  KeyRound,
  Lock,
  Network,
  Server,
  ShieldAlert,
  TerminalSquare,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateWalletIntegrationGuide, walletEnvBlock } from './utils/walletIntegrationGuide';

type Tab = 'overview' | 'credentials' | 'endpoints' | 'hmac' | 'errors' | 'code';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Network },
  { id: 'credentials', label: 'Credentials', icon: KeyRound },
  { id: 'endpoints', label: 'Endpoints', icon: Server },
  { id: 'hmac', label: 'HMAC Auth', icon: Lock },
  { id: 'errors', label: 'Errors & Retry', icon: ShieldAlert },
  { id: 'code', label: 'Drop-In Code', icon: TerminalSquare },
];

export function WalletIntegrationModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const copyGuide = async () => {
    try {
      await navigator.clipboard.writeText(generateWalletIntegrationGuide());
      setCopiedGuide(true);
      setTimeout(() => setCopiedGuide(false), 1600);
    } catch {
      setCopiedGuide(false);
    }
  };

  const downloadGuide = () => {
    const blob = new Blob([generateWalletIntegrationGuide()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MCOM_WALLET_PARTNER_INTEGRATION_GUIDE.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <WalletIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">Wallet Partner Integration Guide</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Written Reference
                </span>
              </div>
              <p className="text-xs text-gray-400">
                How any registered app (Mall, Rewards, Spin, VemTap, 247GBS) integrates the MCOM wallet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadGuide}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-colors border border-white/10"
            >
              {downloaded ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
              {downloaded ? 'Saved' : 'Download .md'}
            </button>
            <button
              onClick={copyGuide}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black transition-all shadow-glow"
            >
              {copiedGuide ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedGuide ? 'Copied Guide' : 'Copy Full Guide'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-1 overflow-x-auto scrollbar-hide flex-shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap',
                  isActive
                    ? 'bg-white text-emerald-600 border-emerald-500 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 border-transparent hover:bg-gray-100/60',
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-emerald-500' : 'text-gray-400')} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'credentials' && <CredentialsTab />}
          {activeTab === 'endpoints' && <EndpointsTab />}
          {activeTab === 'hmac' && <HmacTab />}
          {activeTab === 'errors' && <ErrorsTab />}
          {activeTab === 'code' && <CodeTab />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span>Copy the guide and hand it to any platform engineering team.</span>
          </div>
          <button
            onClick={copyGuide}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors flex items-center gap-1.5"
          >
            {copiedGuide ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedGuide ? 'Copied' : 'Copy Guide'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared building blocks ──────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="font-black text-gray-900 font-display text-sm flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-black">✓</span>
        {title}
      </h4>
      {children}
    </div>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xs">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label || 'Code'}</span>
        <button onClick={copy} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] font-bold text-gray-200 transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-950 text-gray-100 text-[11px] leading-relaxed p-4 overflow-x-auto font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

function HeaderTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5">Header</th>
            <th className="px-4 py-2.5">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-emerald-600">{k}</td>
              <td className="px-4 py-2.5 text-[11px] text-gray-600">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EndpointTable({ rows }: { rows: Array<[string, string, string, string]> }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5">Method</th>
            <th className="px-4 py-2.5">Path</th>
            <th className="px-4 py-2.5">Purpose</th>
            <th className="px-4 py-2.5">Idempotency-Key</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([method, path, purpose, idem]) => (
            <tr key={method + path} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2.5">
                <span className={cn('px-2 py-0.5 rounded text-[10px] font-black', method === 'GET' ? 'bg-sky-50 text-sky-600' : 'bg-emerald-50 text-emerald-600')}>{method}</span>
              </td>
              <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-gray-800">{path}</td>
              <td className="px-4 py-2.5 text-[11px] text-gray-600">{purpose}</td>
              <td className={cn('px-4 py-2.5 text-[10px] font-bold', idem === 'Required' ? 'text-red-500' : 'text-gray-400')}>{idem}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ErrorTable({ rows }: { rows: Array<[string, string, string, string]> }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
      <table className="w-full text-left">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-2.5">HTTP</th>
            <th className="px-4 py-2.5">error</th>
            <th className="px-4 py-2.5">Meaning</th>
            <th className="px-4 py-2.5">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([http, code, meaning, action]) => (
            <tr key={http + code} className="border-b border-gray-100 last:border-0">
              <td className="px-4 py-2.5">
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-black',
                  http.startsWith('4') ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600',
                )}>{http}</span>
              </td>
              <td className="px-4 py-2.5 font-mono text-[11px] font-bold text-gray-800">{code}</td>
              <td className="px-4 py-2.5 text-[11px] text-gray-600">{meaning}</td>
              <td className="px-4 py-2.5 text-[11px] text-gray-600">{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <Section title="One wallet per user, usable across every MCOM platform">
        <p className="text-xs text-gray-600 leading-relaxed">
          Every McomSolutions user has a single MCOM wallet (balance in MCOM credits). Your app never creates or owns a
          wallet — it debits, credits, or holds the user's central wallet through the partner API. McomSolutions is the
          single source of truth for balances; your app should never store wallet balances.
        </p>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard n="1" title="Atomic ledger" color="bg-blue-50 text-brand-blue" body="Every debit/credit writes an immutable double-entry ledger row (balanceBefore/After) and updates the balance in one transaction." />
        <FeatureCard n="2" title="Idempotent" color="bg-emerald-50 text-emerald-600" body="Same X-Idempotency-Key on retries returns the original receipt — never a double charge." />
        <FeatureCard n="3" title="Locked & safe" color="bg-purple-50 text-purple-600" body="Concurrent operations on one wallet are serialized by a distributed Redis lock; amounts use exact Decimal math." />
      </div>

      <div className="bg-gray-900 rounded-2xl p-5 text-white space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
          <span>Integration Flow</span>
          <span className="text-emerald-400 font-mono">HTTPS + HMAC</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <FlowStep title="User tops up" desc="MCOM Wallet (Stripe) → wallet credited" />
          <FlowStep title="Your app backend" desc="POST /wallet/partner/debit (HMAC)" />
          <FlowStep title="McomSolutions" desc="lock → check → ledger + balance" />
          <FlowStep title="Receipt returned" desc="idempotent, retry-safe" />
        </div>
      </div>

      <Section title="When to use what">
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
          <li><b>Subscriptions / purchases / fees</b> → <code className="text-emerald-600 font-mono">/debit</code></li>
          <li><b>Cashback, rewards, refunds</b> → <code className="text-emerald-600 font-mono">/credit</code></li>
          <li><b>Reserve before confirming (e.g. order pre-auth)</b> → <code className="text-emerald-600 font-mono">/hold/place → /hold/capture</code></li>
          <li><b>Show balance in your UI</b> → <code className="text-emerald-600 font-mono">/balance/:userId</code> (cached 30s)</li>
        </ul>
      </Section>
    </div>
  );
}

function FeatureCard({ n, title, color, body }: { n: string; title: string; color: string; body: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm', color)}>{n}</div>
      <h5 className="font-bold text-gray-900 text-xs">{title}</h5>
      <p className="text-[11px] text-gray-500 leading-normal">{body}</p>
    </div>
  );
}

function FlowStep({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 text-center space-y-1">
      <div className="text-[10px] font-bold text-emerald-400 uppercase">{title}</div>
      <div className="text-[10px] text-gray-400">{desc}</div>
    </div>
  );
}

function CredentialsTab() {
  return (
    <div className="space-y-6">
      <Section title="Get your credentials from the MCOM Console">
        <p className="text-xs text-gray-600 leading-relaxed">
          Your app must be registered in <b>Admin → MCOM Console</b>. That gives you:
        </p>
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
          <li><code className="text-emerald-600 font-mono">clientId</code> — your public app identifier (e.g. <code className="text-emerald-600 font-mono">mcom-mall</code>)</li>
          <li><code className="text-emerald-600 font-mono">hmacSecret</code> — shown <b>once</b> at registration. Lost it? Use <b>Rotate HMAC Secret</b> in the Console.</li>
        </ul>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 leading-relaxed">
          <b>Security note:</b> older seeded apps may fall back to a shared secret until a per-app HMAC secret is issued.
          Issue one per platform before going live.
        </p>
      </Section>

      <Section title="Environment variables">
        <CodeBlock code={walletEnvBlock()} label=".env" />
      </Section>
    </div>
  );
}

function EndpointsTab() {
  const base = (import.meta.env.VITE_API_URL || 'https://api.mcomsolutions.com/api/v1').replace(/\/$/, '');
  return (
    <div className="space-y-6">
      <Section title="Partner endpoints — /api/v1/wallet/partner">
        <EndpointTable
          rows={[
            ['POST', '/debit', 'Debit a wallet (subscription, purchase, fee)', 'Required'],
            ['POST', '/credit', 'Credit a wallet (reward, refund, cashback)', 'Required'],
            ['POST', '/hold/place', 'Reserve funds before confirming', 'Optional'],
            ['POST', '/hold/capture', 'Convert a hold into a real debit', 'Optional'],
            ['POST', '/hold/release', 'Release a hold back to balance', '—'],
            ['GET', '/balance/:userId', 'Check a user balance (cached 30s)', '—'],
            ['GET', '/transactions/:userId', 'Transactions your platform originated', '—'],
            ['GET', '/transaction/:id', 'Lookup one of your transactions (?by=idempotencyKey)', '—'],
          ]}
        />
      </Section>

      <Section title="Required headers (every request)">
        <HeaderTable
          rows={[
            ['X-Mcom-Client-ID', 'your clientId (identity comes from this header, never the body)'],
            ['X-Mcom-Signature', 'sha256=HMAC-SHA256(body, hmacSecret)'],
            ['X-Idempotency-Key', 'unique per business event — required on every write'],
            ['Content-Type', 'application/json'],
          ]}
        />
      </Section>

      <Section title="Debit a wallet">
        <CodeBlock
          label="POST /api/v1/wallet/partner/debit"
          code={`POST ${base}/wallet/partner/debit
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<...>
X-Idempotency-Key: mcom-mall-sub-inv_0042_aug2026
Content-Type: application/json

{
  "userId": "user_abc123",
  "amount": 50,
  "category": "SUBSCRIPTION",
  "description": "MCOM Mall Gold Package - August 2026",
  "reference": "sub_inv_0042",
  "metadata": { "packageId": "gold-monthly" }
}

→ 201 {
  "success": true,
  "transactionId": "clx8p2qr10000x4vj3k5m7n9p",
  "type": "DEBIT",
  "amount": 50,
  "balanceBefore": 150,
  "balanceAfter": 100,
  "currency": "MCOM",
  "reference": "sub_inv_0042",
  "idempotencyKey": "mcom-mall-sub-inv_0042_aug2026",
  "processedAt": "2026-08-26T11:15:00.000Z"
}`}
        />
      </Section>

      <Section title="Check balance">
        <CodeBlock
          label="GET /api/v1/wallet/partner/balance/:userId"
          code={`GET ${base}/wallet/partner/balance/user_abc123
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<sign empty string>

→ 200 {
  "success": true,
  "balance": 100,
  "availableBalance": 50,
  "status": "ACTIVE",
  "currency": "MCOM"
}

// availableBalance = balance - active holds. Check it before charging.`}
        />
      </Section>

      <Section title="Holds (pre-authorization)">
        <ol className="text-xs text-gray-600 space-y-1.5 list-decimal pl-5">
          <li><code className="text-emerald-600 font-mono">POST /hold/place</code> → reserves funds, returns <code className="text-emerald-600 font-mono">holdId</code> + <code className="text-emerald-600 font-mono">expiresAt</code></li>
          <li><code className="text-emerald-600 font-mono">POST /hold/capture</code> → converts the hold into a real debit</li>
          <li><code className="text-emerald-600 font-mono">POST /hold/release</code> → returns funds to available balance</li>
          <li>Uncaptured holds auto-expire after 24h (system releases them — you don't need to)</li>
        </ol>
      </Section>
    </div>
  );
}

function HmacTab() {
  return (
    <div className="space-y-6">
      <Section title="Signing rules">
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
          <li><b>POST/PATCH:</b> sign the exact JSON body — <code className="text-emerald-600 font-mono">HMAC-SHA256(JSON.stringify(body), hmacSecret)</code></li>
          <li><b>GET:</b> there is no body — sign the <b>empty string</b> <code className="text-emerald-600 font-mono">""</code></li>
          <li>Prefix the hex with <code className="text-emerald-600 font-mono">sha256=</code></li>
        </ul>
      </Section>

      <Section title="TypeScript signing helper">
        <CodeBlock
          label="hmac.ts"
          code={`import * as crypto from 'crypto';

export function sign(body: unknown, hmacSecret: string): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return 'sha256=' + crypto.createHmac('sha256', hmacSecret).update(raw).digest('hex');
}

// POST — sign the body
const headers = {
  'Content-Type': 'application/json',
  'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
  'X-Mcom-Signature': sign(payload, process.env.MCOM_HMAC_SECRET),
  'X-Idempotency-Key': 'mcom-mall-purchase-ORDER_123',
};

// GET — sign the empty string
const getHeaders = {
  'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
  'X-Mcom-Signature': sign('', process.env.MCOM_HMAC_SECRET),
};`}
        />
      </Section>

      <Section title="Security notes">
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
          <li>Never send your <code className="text-emerald-600 font-mono">hmacSecret</code> to the frontend — signatures are computed server-side only.</li>
          <li>Signature verification on McomSolutions is constant-time (timing-safe) — no need to worry about side channels.</li>
          <li>Every platform's data is isolated: you can only read transactions your platform originated.</li>
        </ul>
      </Section>
    </div>
  );
}

function ErrorsTab() {
  return (
    <div className="space-y-6">
      <Section title="Error codes">
        <ErrorTable
          rows={[
            ['400', 'VALIDATION_ERROR', 'Bad request body', 'Fix request — don\'t retry'],
            ['400', '—', 'X-Idempotency-Key missing on a write', 'Add the header'],
            ['401', 'INVALID_SIGNATURE', 'Bad HMAC / unknown client', 'Check hmacSecret; rotate in Console'],
            ['403', 'WALLET_FROZEN', 'Wallet frozen (fraud)', 'Notify user to contact support'],
            ['403', 'WALLET_SUSPENDED', 'Wallet temporarily suspended', 'Notify user'],
            ['403', 'WALLET_CLOSED', 'Wallet closed', 'Notify user'],
            ['404', 'WALLET_NOT_FOUND', 'No wallet for user', 'Contact MCOM'],
            ['409', 'WALLET_LOCKED', 'Concurrent op in progress', 'Retry after 1–2s (same key)'],
            ['409', 'collision', 'Idempotency key belongs to another platform', 'Use a platform-scoped key'],
            ['422', 'INSUFFICIENT_BALANCE', 'Not enough available balance', 'Show top-up prompt'],
            ['422', 'DAILY_LIMIT_EXCEEDED / MONTHLY_LIMIT_EXCEEDED', 'User limit hit', 'Notify user'],
            ['422', 'AMOUNT_LIMIT_EXCEEDED', 'Above WALLET_MAX_SINGLE_TXN', 'Split or reject'],
            ['429', 'RATE_LIMITED', 'Too many requests', 'Exponential backoff'],
            ['500', 'INTERNAL_ERROR', 'Server error', 'Retry with backoff'],
            ['503', 'SERVICE_UNAVAILABLE', 'DB/Redis down', 'Retry with backoff'],
          ]}
        />
      </Section>

      <Section title="Handle INSUFFICIENT_BALANCE">
        <CodeBlock
          label="top-up prompt"
          code={`try {
  const receipt = await mcomWallet.debit(userId, amount, opts);
} catch (err) {
  if (err.code === 'INSUFFICIENT_BALANCE') {
    return res.status(402).json({
      error: 'WALLET_INSUFFICIENT_FUNDS',
      message: 'Top up your MCOM Wallet to continue.',
      topUpUrl: '${(import.meta.env.VITE_API_URL || 'https://api.mcomsolutions.com').replace(/\/api\/v1\/?$/, '')}/dashboard/wallet',
    });
  }
  throw err;
}`}
        />
      </Section>

      <Section title="Retry with backoff">
        <p className="text-xs text-gray-600 leading-relaxed">
          Permanent errors (<code className="text-emerald-600 font-mono">400/401/403/404/422</code>) should <b>not</b> be retried.
          Transient errors (<code className="text-emerald-600 font-mono">409/429/500/503</code>) should be retried with backoff,
          always using the <b>same idempotency key</b>.
        </p>
        <CodeBlock
          label="retry.ts"
          code={`async function debitWithRetry(payload, idempKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(\`\${MCOM_URL}/api/v1/wallet/partner/debit\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mcom-Client-ID': CLIENT_ID,
        'X-Mcom-Signature': sign(payload, HMAC_SECRET),
        'X-Idempotency-Key': idempKey, // SAME KEY every retry
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.json();
    if (![409, 429, 500, 503].includes(res.status)) throw await res.json(); // permanent
    if (attempt === maxRetries) throw await res.json();
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
}`}
        />
      </Section>
    </div>
  );
}

function CodeTab() {
  return (
    <div className="space-y-6">
      <Section title="Idempotency key generation">
        <CodeBlock
          label="keys.ts"
          code={`const key = \`\${CLIENT_ID}-sub-\${invoiceId}\`;        // subscriptions
const key = \`\${CLIENT_ID}-purchase-\${orderId}\`;     // purchases
const key = \`\${CLIENT_ID}-refund-\${originalTxnId}\`;  // refunds
const key = \`\${CLIENT_ID}-reward-\${campaignId}-\${userId}-\${date}\`;

// Rules:
// - Max 255 chars, ASCII only
// - Unique per BUSINESS EVENT, never per HTTP retry
// - Never reuse a key for a different amount or operation
// - Same key + same body on retry → original receipt, no double charge`}
        />
      </Section>

      <Section title="Drop-in NestJS service">
        <CodeBlock
          label="mcom-wallet.service.ts"
          code={`import * as crypto from 'crypto';

export class McomWalletError extends Error {
  constructor(public code: string, message: string, public httpStatus: number) {
    super(message);
    this.name = 'McomWalletError';
  }
}

@Injectable()
export class McomWalletService {
  private base = process.env.MCOM_SOLUTIONS_URL;
  private clientId = process.env.MCOM_CLIENT_ID;
  private hmacSecret = process.env.MCOM_HMAC_SECRET;

  private sign(body: unknown) {
    return 'sha256=' + crypto.createHmac('sha256', this.hmacSecret)
      .update(typeof body === 'string' ? body : JSON.stringify(body)).digest('hex');
  }

  private headers(body: unknown, idempKey?: string) {
    return {
      'Content-Type': 'application/json',
      'X-Mcom-Client-ID': this.clientId,
      'X-Mcom-Signature': this.sign(body),
      ...(idempKey ? { 'X-Idempotency-Key': idempKey } : {}),
    };
  }

  async getBalance(userId: string) {
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/balance/\${userId}\`, {
      headers: this.headers(''), // GET → sign empty string
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async debit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/debit\`, {
      method: 'POST',
      headers: this.headers(body, opts.idempotencyKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new McomWalletError(err.error || 'ERROR', err.message, res.status);
    }
    return res.json();
  }

  async credit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/credit\`, {
      method: 'POST',
      headers: this.headers(body, opts.idempotencyKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new McomWalletError(err.error || 'ERROR', err.message, res.status);
    }
    return res.json();
  }
}`}
        />
      </Section>

      <Section title="Go-live checklist">
        <ul className="text-xs text-gray-600 space-y-1.5 list-disc pl-5">
          <li>App registered in the MCOM Console with a per-app <code className="text-emerald-600 font-mono">hmacSecret</code></li>
          <li><code className="text-emerald-600 font-mono">MCOM_SOLUTIONS_URL</code>, <code className="text-emerald-600 font-mono">MCOM_CLIENT_ID</code>, <code className="text-emerald-600 font-mono">MCOM_HMAC_SECRET</code> in env</li>
          <li><code className="text-emerald-600 font-mono">getBalance</code> returns <code className="text-emerald-600 font-mono">ACTIVE</code> before charging</li>
          <li>Every debit/credit uses a deterministic idempotency key</li>
          <li><code className="text-emerald-600 font-mono">INSUFFICIENT_BALANCE</code> handled (top-up prompt)</li>
          <li>409/429/5xx retried with backoff, same key</li>
          <li>Captured holds are captured or released; rely on 24h auto-expiry as backstop</li>
        </ul>
      </Section>
    </div>
  );
}