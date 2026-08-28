import { useState } from 'react';
import {
  AppWindow,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Download,
  FileCode,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Network,
  Puzzle,
  Radio,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateAiIntegrationPrompt } from './utils/aiPromptGenerator';

interface ConsoleArchitectureModalProps {
  onClose: () => void;
}

type TabType = 'overview' | 'ai-skill' | 'sso' | 'hmac' | 'permissions' | 'connector' | 'quickstart';

export default function ConsoleArchitectureModal({ onClose }: ConsoleArchitectureModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Ecosystem Architecture', icon: Network },
    { id: 'ai-skill', label: '🤖 AI Agent Skill / Blueprint', icon: Bot },
    { id: 'sso', label: 'OAuth 2.0 SSO Flow', icon: KeyRound },
    { id: 'hmac', label: 'Inter-Service HMAC', icon: Lock },
    { id: 'permissions', label: 'Dynamic Permissions', icon: Zap },
    { id: 'connector', label: 'Billing Connector', icon: Puzzle },
    { id: 'quickstart', label: 'Developer Quickstart', icon: Code2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue shadow-inner">
              <Workflow className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">MCOM Console Ecosystem Architecture</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue/30 text-blue-200 border border-brand-blue/40">
                  Engineering Guide & AI Blueprint
                </span>
              </div>
              <p className="text-xs text-gray-400">Zero-downtime dynamic platform onboarding & security specifications.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 bg-gray-50/80 border-b border-gray-100 flex items-center gap-1 overflow-x-auto scrollbar-hide flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all border-b-2 whitespace-nowrap',
                  isActive
                    ? 'bg-white text-brand-blue border-brand-blue shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 border-transparent hover:bg-gray-100/60',
                )}
              >
                <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-brand-blue' : 'text-gray-400')} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'ai-skill' && <AiSkillTab />}
          {activeTab === 'sso' && <SsoTab />}
          {activeTab === 'hmac' && <HmacTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
          {activeTab === 'connector' && <ConnectorTab />}
          {activeTab === 'quickstart' && <QuickstartTab />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Zero MCOM redeploy required for onboarding new apps</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white p-5 rounded-2xl border border-blue-100">
        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-brand-blue" />
          The Dynamic Onboarding Paradigm
        </h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          Previously, onboarding a platform (e.g. <i>Mcom Mall</i>, <i>Mcom Loyalty</i>, <i>247GBS</i>, <i>Mcom vCard</i>) required touching 6 separate files, modifying CORS headers in source code, adding new connector classes, and redeploying the backend. 
          With <b>Mcom Console</b>, McomSolutions acts as a dynamic identity and billing hub: registering an application in the Console issues instant credentials that work across SSO, CORS, HMAC, and plan synchronization immediately.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-sm">
            1
          </div>
          <h5 className="font-bold text-gray-900 text-xs">Identity & OAuth 2.0 SSO</h5>
          <p className="text-[11px] text-gray-500 leading-normal">
            Users authenticate through Mcom central login and receive verified profile, business, and subscription claims via standard OAuth 2.0 Auth Code grant.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
            2
          </div>
          <h5 className="font-bold text-gray-900 text-xs">Inter-Service HMAC & Data</h5>
          <p className="text-[11px] text-gray-500 leading-normal">
            Backend-to-backend communication uses 3-tier SHA-256 HMAC signatures with per-client secrets stored in encrypted form in the database.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            3
          </div>
          <h5 className="font-bold text-gray-900 text-xs">Generic Plan Connector</h5>
          <p className="text-[11px] text-gray-500 leading-normal">
            By pointing <code>billingApiUrl</code> to the platform backend, MCOM Solutions discovers and provisions plans with no custom TypeScript connectors.
          </p>
        </div>
      </div>

      {/* Visual Workflow Diagram */}
      <div className="bg-gray-900 rounded-2xl p-5 text-white space-y-3">
        <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
          <span>Ecosystem Interaction Model</span>
          <span className="text-emerald-400 font-mono">Live Multi-Tenant Mesh</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700 text-center space-y-1">
            <div className="text-[10px] font-bold text-brand-blue uppercase">Tenant App (Client)</div>
            <div className="text-xs font-bold text-white">vCard / Spin / Mall</div>
            <div className="text-[10px] text-gray-400 font-mono">Stores 4 .env keys</div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 text-center py-2">
            <div className="text-[10px] font-bold text-gray-300">HTTPS + HMAC / Bearer</div>
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold font-mono">
              ◄── Zero Redeploy ──►
            </div>
            <div className="text-[9px] text-gray-500">60s Dynamic CORS Polling</div>
          </div>
          <div className="p-3 bg-gray-800/80 rounded-xl border border-brand-blue/30 text-center space-y-1">
            <div className="text-[10px] font-bold text-brand-blue uppercase">Central Hub</div>
            <div className="text-xs font-bold text-white">McomSolutions API</div>
            <div className="text-[10px] text-emerald-400 font-mono">SSO · Billing · Auth</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AiSkillTab() {
  const [copied, setCopied] = useState(false);
  const samplePrompt = generateAiIntegrationPrompt({
    name: 'Sample Platform (e.g. Mcom vCard)',
    clientId: 'mcom-sample',
    platformSlug: 'sample',
    scopes: ['profile', 'email', 'business', 'membership', 'packages'],
    redirectUris: ['https://sample.mcom.com/auth/callback'],
    corsOrigins: ['https://sample.mcom.com'],
    billingApiUrl: 'https://api.sample.mcom.com',
    webhookUrl: 'https://api.sample.mcom.com/webhooks',
  });

  const handleCopy = () => {
    navigator.clipboard?.writeText(samplePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = () => {
    const blob = new Blob([samplePrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCOM_INTEGRATION_SKILL_TEMPLATE.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-purple-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-blue text-white flex items-center justify-center shadow-glow flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm font-display flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-blue" />
              AI Agent Integration Skill / Master Prompt
            </h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Copy this prompt and paste it directly into Cursor, Copilot, ChatGPT, Claude, or Antigravity in the new platform's repository!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5" /> Download SKILL.md
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-glow"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Prompt' : 'Copy Master Prompt'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">1. Register App in Console</span>
          <p className="text-[11px] text-gray-500">Go to App Details to get the prompt with your live secrets already populated.</p>
        </div>
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">2. Paste into AI Assistant</span>
          <p className="text-[11px] text-gray-500">Paste the prompt into Cursor, Copilot, ChatGPT, or Claude in the new app's repo.</p>
        </div>
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">3. Automated Implementation</span>
          <p className="text-[11px] text-gray-500">The AI implements the OAuth redirect, token exchange, permissions check, and Billing API.</p>
        </div>
      </div>

      <pre className="p-4 bg-gray-900 rounded-2xl font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[380px] overflow-y-auto">
        {samplePrompt}
      </pre>
    </div>
  );
}

function SsoTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-2">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-blue" />
          OAuth 2.0 Authorization Code Grant
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          Standard OAuth 2.0 flow. Users click "Login with MCOM" on the consumer platform, authenticate on McomSolutions, and are redirected back with a single-use authorization code.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            1
          </span>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-900">Redirect to Authorize Endpoint</p>
            <pre className="text-[11px] font-mono bg-gray-900 text-emerald-300 p-2 rounded-lg overflow-x-auto">
              GET /api/v1/auth/sso/authorize?client_id=&#123;clientId&#125;&redirect_uri=&#123;callbackUrl&#125;&scope=profile+email+business&state=&#123;state&#125;
            </pre>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            2
          </span>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-900">Exchange Code for Access & Refresh Tokens</p>
            <pre className="text-[11px] font-mono bg-gray-900 text-emerald-300 p-2 rounded-lg overflow-x-auto">
              POST /api/v1/auth/sso/token
              {"\n"}&#123; "client_id": "...", "client_secret": "...", "code": "...", "redirect_uri": "..." &#125;
            </pre>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <span className="w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            3
          </span>
          <div className="space-y-1">
            <p className="text-xs font-bold text-gray-900">Fetch User Profile & Platform Entitlements</p>
            <pre className="text-[11px] font-mono bg-gray-900 text-emerald-300 p-2 rounded-lg overflow-x-auto">
              GET /api/v1/auth/sso/userinfo
              {"\n"}Header: Authorization: Bearer &#123;accessToken&#125;
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function HmacTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-2">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-600" />
          3-Tier Inter-Service HMAC Authentication
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          Server-to-server endpoints (such as <code>/api/v1/data-sharing/*</code>) verify callers using SHA-256 HMAC signatures. The backend executes a backward-compatible 3-tier secret resolution chain:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-700 uppercase">Tier 1 (Highest)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="font-bold text-xs text-gray-900">Per-Client DB Secret</p>
          <p className="text-[11px] text-gray-500">
            Caller passes <code>X-Mcom-Client-ID</code>. Secret is decrypted via AES-256-GCM from the DB record.
          </p>
        </div>

        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-700 uppercase">Tier 2</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue" />
          </div>
          <p className="font-bold text-xs text-gray-900">Named Service Env</p>
          <p className="text-[11px] text-gray-500">
            Fallback to legacy environment variable (e.g. <code>MCOM_MALL_SECRET</code>).
          </p>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase">Tier 3 (Fallback)</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <p className="font-bold text-xs text-gray-900">Global Shared Secret</p>
          <p className="text-[11px] text-gray-500">
            Fallback to global <code>SSO_API_SECRET</code> for unmigrated legacy services.
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-3.5 text-emerald-300 font-mono text-[11px] overflow-x-auto">
        <p className="text-gray-400 mb-1">// Sending signed request from partner backend:</p>
        <p>const signature = crypto.createHmac('sha256', MCOM_HMAC_SECRET).update(rawBody).digest('hex');</p>
        <p className="mt-1">headers: &#123;</p>
        <p>&nbsp;&nbsp;'X-Mcom-Signature': `sha256=$&#123;signature&#125;`,</p>
        <p>&nbsp;&nbsp;'X-Mcom-Client-ID': MCOM_CLIENT_ID</p>
        <p>&#125;</p>
      </div>
    </div>
  );
}

function PermissionsTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-2">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Dynamic Platform Slugs & Permissions
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          When registering an application, you define a <code>platformSlug</code> (e.g. <code>vcard</code>, <code>spin</code>, <code>expo</code>). This automatically generates dynamic entitlement flags in the user token without changing core enum code.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase">Input Configuration</span>
          <div className="font-mono text-xs font-bold text-gray-900">platformSlug: "vcard"</div>
          <p className="text-[11px] text-gray-500">
            Admin enters <code>vcard</code> during registration.
          </p>
        </div>

        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 space-y-2">
          <span className="text-[10px] font-bold text-emerald-700 uppercase">Generated User Claim</span>
          <div className="font-mono text-xs font-bold text-emerald-900">canAccess_vcard: true</div>
          <p className="text-[11px] text-emerald-700">
            Returned in <code>/auth/sso/userinfo</code> when the user has an active package for this platform.
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
        <p className="font-bold">Backward Compatibility Guarantee:</p>
        <p className="text-blue-700 text-[11px]">
          Legacy permissions (<code>canAccessMall</code>, <code>canAccessRewards</code>, <code>canAccessSpin</code>, <code>canAccessAudit</code>, <code>canAccessExpo</code>) are always preserved for existing consumers.
        </p>
      </div>
    </div>
  );
}

function ConnectorTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-2">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Puzzle className="w-4 h-4 text-brand-blue" />
          Generic HTTP Billing Connector
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          If your platform offers dynamic subscription plans or features, implement 5 simple standard REST endpoints on your backend. McomSolutions will manage plans seamlessly using the <code>GenericHttpConnector</code>.
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-bold text-gray-400 uppercase">Contract Endpoints (Protected by API Key):</div>
        <div className="grid grid-cols-1 gap-1.5 font-mono text-[11px]">
          <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
            <span className="text-emerald-700 font-bold">GET</span>
            <span className="text-gray-700">/api/v1/system/plans</span>
            <span className="text-gray-400 text-[10px]">List all external plans</span>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
            <span className="text-blue-700 font-bold">POST</span>
            <span className="text-gray-700">/api/v1/system/plans</span>
            <span className="text-gray-400 text-[10px]">Create new external plan</span>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
            <span className="text-amber-700 font-bold">PATCH</span>
            <span className="text-gray-700">/api/v1/system/plans/:id</span>
            <span className="text-gray-400 text-[10px]">Update plan pricing/features</span>
          </div>
          <div className="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
            <span className="text-red-700 font-bold">DELETE</span>
            <span className="text-gray-700">/api/v1/system/plans/:id</span>
            <span className="text-gray-400 text-[10px]">Delete/archive external plan</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickstartTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm space-y-2">
        <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-600" />
          New App Consumer Checklist
        </h4>
        <p className="text-xs text-gray-500 leading-relaxed">
          Follow these 4 simple steps to integrate any new frontend/backend with the MCOM Ecosystem:
        </p>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            1
          </div>
          <div>
            <p className="font-bold text-gray-900">Register in Console & Copy Secrets</p>
            <p className="text-gray-500 text-[11px]">
              Click "Register New Application" in the Console. Copy all 4 secrets into your app's <code>.env</code> file.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            2
          </div>
          <div>
            <p className="font-bold text-gray-900">Configure Login Redirect Button</p>
            <p className="text-gray-500 text-[11px]">
              Direct users to <code>/api/v1/auth/sso/authorize</code> with your registered <code>clientId</code> and <code>redirectUri</code>.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            3
          </div>
          <div>
            <p className="font-bold text-gray-900">Handle Callback & Fetch Tokens</p>
            <p className="text-gray-500 text-[11px]">
              POST code and clientSecret from your backend to <code>/api/v1/auth/sso/token</code> to receive JWT access tokens.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
          <div className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
            4
          </div>
          <div>
            <p className="font-bold text-gray-900">Verify User Access Rights</p>
            <p className="text-gray-500 text-[11px]">
              Check <code>userInfo.permissions.canAccess_&#123;slug&#125;</code> to confirm active subscription status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
