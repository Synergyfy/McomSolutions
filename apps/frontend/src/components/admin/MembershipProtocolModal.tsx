import { useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Gem,
  Globe,
  KeyRound,
  Layers,
  Network,
  Package,
  Plus,
  Puzzle,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { generateMembershipSkillPrompt } from './utils/membershipSkillGenerator';

interface MembershipProtocolModalProps {
  onClose: () => void;
}

type TabType = 'overview' | 'ai-skill' | 'bundles' | 'trial-engine' | 'api-reference' | 'snippets';

export default function MembershipProtocolModal({ onClose }: MembershipProtocolModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Protocol Architecture', icon: Network },
    { id: 'ai-skill', label: '🤖 AI Agent Skill / SKILL.md', icon: Bot },
    { id: 'bundles', label: 'Membership Plan Bundles', icon: Gem },
    { id: 'trial-engine', label: 'Task-Gated Trial Access', icon: Target },
    { id: 'api-reference', label: 'API & Schema Contract', icon: KeyRound },
    { id: 'snippets', label: 'Code Snippets', icon: Code2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Gem className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">
                  MCOM Membership & Trial Access Protocol
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-500/40">
                  Federated Entitlements & AI Blueprint
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Specifications for multi-app membership plan bundling and task-gated trial access.
              </p>
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

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'ai-skill' && <AiSkillTab />}
          {activeTab === 'bundles' && <BundlesTab />}
          {activeTab === 'trial-engine' && <TrialEngineTab />}
          {activeTab === 'api-reference' && <ApiReferenceTab />}
          {activeTab === 'snippets' && <SnippetsTab />}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 1: OVERVIEW & ARCHITECTURE                                            */
/* ========================================================================= */
function OverviewTab() {
  return (
    <div className="space-y-5">
      <div className="p-5 bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 rounded-2xl border border-blue-100/80 space-y-2">
        <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand-blue" />
          Dual Access Entitlement Architecture
        </h4>
        <p className="text-xs text-gray-600 leading-relaxed">
          MCOM Central is the authoritative identity provider and membership billing engine. When an external platform (like MCOM Mall, MCOM Rewards, or GBS Audit) authenticates a merchant via SSO, it relies on MCOM to determine what tier of access to provision.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Membership Bundling */}
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center font-bold">
            <Gem className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-gray-900 text-sm">1. Multi-App Membership Bundles</h5>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              In <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono text-gray-800">/admin/memberships</code>, admins customize memberships (Bronze, Silver, Gold, Platinum). Each membership bundles specific plans from platforms registered in Console.
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-gray-700">Gold Membership includes:</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">Active</span>
            </div>
            <div className="text-[11px] text-gray-500">• MCOM Mall: Pro Vendor Plan</div>
            <div className="text-[11px] text-gray-500">• MCOM Rewards: Merchant Plus Plan</div>
            <div className="text-[11px] text-red-500 font-medium">• GBS Audit: Not Included (Access Denied)</div>
          </div>
        </div>

        {/* Card 2: Task-Gated Trial */}
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-3">
          <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-gray-900 text-sm">2. Task-Gated Trial Access</h5>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              In <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px] font-mono text-gray-800">/admin/programme</code>, the admin sets a £1 verification fee granting trial access (e.g. 14 days).
            </p>
          </div>
          <div className="p-3 bg-violet-50/70 rounded-xl border border-violet-100 text-xs space-y-1">
            <span className="font-bold text-violet-900 block text-[11px]">The Task Engine Gate:</span>
            <p className="text-[11px] text-violet-700 leading-relaxed">
              Trial users receive access to an external platform <strong>ONLY IF</strong> that platform has an active task assigned to businesses under <em>Task Engine & Rewards</em>. If an app has no tasks, trial access is withheld.
            </p>
          </div>
        </div>
      </div>

      {/* Priority Resolution Hierarchy */}
      <div className="p-4 bg-gray-900 text-white rounded-2xl space-y-3">
        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400">
          Entitlement Evaluation Cascade (SsoService.resolveEntitlements)
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-3 bg-gray-800 rounded-xl border border-gray-700">
            <span className="text-amber-400 font-bold block mb-1">Step 1: Paid Plan</span>
            <span className="text-[11px] text-gray-300">Is platform in active membership bundle? If yes, GRANT <code className="text-emerald-400">PAID_MEMBERSHIP</code>.</span>
          </div>
          <div className="p-3 bg-gray-800 rounded-xl border border-gray-700">
            <span className="text-blue-400 font-bold block mb-1">Step 2: Direct Pack</span>
            <span className="text-[11px] text-gray-300">Does user have standalone direct package? If yes, GRANT <code className="text-emerald-400">DIRECT_PACKAGE</code>.</span>
          </div>
          <div className="p-3 bg-gray-800 rounded-xl border border-gray-700">
            <span className="text-violet-400 font-bold block mb-1">Step 3: Trial Task</span>
            <span className="text-[11px] text-gray-300">In verified trial & platform has active task? If yes, GRANT <code className="text-emerald-400">TRIAL_PROGRAMME</code>.</span>
          </div>
          <div className="p-3 bg-gray-800 rounded-xl border border-gray-700">
            <span className="text-red-400 font-bold block mb-1">Step 4: Deny Access</span>
            <span className="text-[11px] text-gray-300">No qualifying rule matched. Returns <code className="text-red-400">hasAccess: false</code> + upgrade link.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 2: AI AGENT SKILL (SKILL.md)                                          */
/* ========================================================================= */
function AiSkillTab() {
  const [copied, setCopied] = useState(false);
  const promptContent = generateMembershipSkillPrompt();

  const handleCopy = () => {
    navigator.clipboard?.writeText(promptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([promptContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MCOM_MEMBERSHIP_ENTITLEMENT_SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="p-5 bg-gradient-to-r from-amber-50 via-orange-50/70 to-yellow-50 rounded-2xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md flex-shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm font-display flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              AI Agent Integration Skill / SKILL.md
            </h4>
            <p className="text-xs text-gray-600 mt-0.5">
              Give this skill to Cursor, ChatGPT, Claude, Copilot, or Antigravity in an external platform codebase to implement the full entitlement and trial protocol.
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
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all shadow-glow"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard' : 'Copy AI Skill'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">1. Copy or Download</span>
          <p className="text-[11px] text-gray-500">Copy the prompt or save as <code className="font-mono text-gray-700">SKILL.md</code> in the external app's repository.</p>
        </div>
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">2. Paste into AI Assistant</span>
          <p className="text-[11px] text-gray-500">Instruct your AI agent: "Implement MCOM membership and trial access according to this skill."</p>
        </div>
        <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
          <span className="font-bold text-gray-900 block mb-1">3. Automated Integration</span>
          <p className="text-[11px] text-gray-500">The agent inspects <code className="font-mono text-gray-700">PlatformEntitlement</code>, gates routes, and displays tasks.</p>
        </div>
      </div>

      <pre className="p-4 bg-gray-900 rounded-2xl font-mono text-xs text-amber-200 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[380px] overflow-y-auto">
        {promptContent}
      </pre>
    </div>
  );
}

/* ========================================================================= */
/* TAB 3: MEMBERSHIP BUNDLES                                                 */
/* ========================================================================= */
function BundlesTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-blue-50/70 rounded-2xl border border-blue-100 text-xs text-blue-900 space-y-1.5">
        <h5 className="font-bold text-sm text-blue-950 flex items-center gap-1.5">
          <Gem className="w-4 h-4 text-brand-blue" />
          How Membership Bundling Works
        </h5>
        <p className="leading-relaxed">
          When an administrator creates or edits a membership in <code className="bg-white px-1.5 py-0.5 rounded font-mono text-brand-blue border border-blue-200">/admin/memberships</code>, they can bundle plans from any active platform registered in the Console.
        </p>
      </div>

      <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
        <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider">The Bundling Workflow</h5>
        <ol className="list-decimal pl-4 space-y-2 text-xs text-gray-600">
          <li>
            <strong>Console Registration:</strong> Platforms (e.g. MCOM Mall, MCOM Rewards) are registered in <code className="bg-gray-100 px-1 py-0.5 rounded">/admin/console</code> with <code className="font-mono text-gray-800">clientId</code> and <code className="font-mono text-gray-800">platformSlug</code>.
          </li>
          <li>
            <strong>Membership Editor (Step 5: Bundles):</strong> In the Membership Editor, the admin selects a platform from the dropdown and chooses which plan level to include (e.g., "Pro Vendor Plan").
          </li>
          <li>
            <strong>Automatic Provisioning:</strong> When a business pays for the membership, MCOM Central stores the bundle in <code className="font-mono text-gray-800">includedApps</code> and cross-provisions <code className="font-mono text-gray-800">PlatformPackage</code> records.
          </li>
          <li>
            <strong>SSO Token Transparency:</strong> When the merchant logs into that platform via SSO, MCOM's <code className="font-mono text-gray-800">PlatformEntitlement</code> informs the platform of the exact <code className="font-mono text-gray-800">planId</code> and quotas to apply.
          </li>
        </ol>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 4: TRIAL ACCESS & TASK ENGINE                                         */
/* ========================================================================= */
function TrialEngineTab() {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-100 text-xs text-violet-900 space-y-1.5">
        <h5 className="font-bold text-sm text-violet-950 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-violet-600" />
          The £1 Verification Fee & Task-Gated Trial
        </h5>
        <p className="leading-relaxed">
          Businesses pay a £1 verification fee during onboarding. This verifies their identity and unlocks a timed trial access window (e.g. 14 days, configurable in <code className="bg-white px-1.5 py-0.5 rounded font-mono text-violet-700 border border-violet-200">/admin/programme</code>).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Platform HAS Tasks in Programme
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            If the admin has created at least one task with <strong>External App (from Console) *</strong> pointing to this platform:
          </p>
          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
            <li><code className="text-emerald-700 font-bold">hasAccess: true</code> is returned.</li>
            <li><code className="text-emerald-700 font-bold">accessType: "TRIAL_PROGRAMME"</code></li>
            <li>The platform receives <code className="font-mono text-gray-800">programmeTasks</code> so it can show the merchant exactly what tasks to complete!</li>
          </ul>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-xs">
            <Shield className="w-4 h-4 text-amber-600" /> Platform Has NO Tasks in Programme
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            If the platform has no active tasks configured under <em>Task Engine & Rewards</em>:
          </p>
          <ul className="text-xs text-gray-600 list-disc pl-4 space-y-1">
            <li><code className="text-red-600 font-bold">hasAccess: false</code> is returned.</li>
            <li><code className="text-amber-700 font-bold">reason: "TRIAL_NO_TASKS"</code></li>
            <li>The platform prompts the user to upgrade to a paid membership that bundles this app.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 5: API REFERENCE                                                      */
/* ========================================================================= */
function ApiReferenceTab() {
  return (
    <div className="space-y-4">
      <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
        <h5 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-brand-blue" />
          1. OAuth Token Exchange (POST /api/v1/auth/sso/token)
        </h5>
        <p className="text-xs text-gray-600">
          Called during the OAuth callback by the external platform's backend. Returns the access token along with the scoped <code className="font-mono text-gray-800">entitlement</code> object.
        </p>
      </div>

      <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
        <h5 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Globe className="w-4 h-4 text-brand-blue" />
          2. Real-Time Introspection (GET /api/v1/auth/sso/entitlement)
        </h5>
        <p className="text-xs text-gray-600">
          Re-verify user entitlements without forcing a re-login. Accepts Bearer user token or <code className="font-mono text-gray-800">?client_id=...&user_id=...</code> with <code className="font-mono text-gray-800">X-API-Key</code>.
        </p>
      </div>

      <div className="border border-gray-200 rounded-2xl p-4 bg-white space-y-3">
        <h5 className="font-bold text-gray-900 text-xs flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          3. Webhooks Push Notifications
        </h5>
        <p className="text-xs text-gray-600">
          Dispatched to the app's registered <code className="font-mono text-gray-800">webhookUrl</code> on lifecycle events:
        </p>
        <div className="text-xs text-gray-600 space-y-1 pl-2">
          <div>• <code className="font-mono text-brand-blue">entitlement.trial_started</code>: Dispatched when £1 fee is paid.</div>
          <div>• <code className="font-mono text-brand-blue">entitlement.membership_assigned</code>: Dispatched on membership purchase.</div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 6: CODE SNIPPETS                                                      */
/* ========================================================================= */
function SnippetsTab() {
  const [lang, setLang] = useState<'express' | 'nextjs' | 'python'>('express');
  const [copied, setCopied] = useState(false);

  const snippets = {
    express: `// Express.js Route: /auth/callback
app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  const tokenRes = await axios.post('\${MCOM_URL}/api/v1/auth/sso/token', {
    client_id: process.env.MCOM_CLIENT_ID,
    client_secret: process.env.MCOM_CLIENT_SECRET,
    code,
    redirect_uri: process.env.MCOM_REDIRECT_URI,
  });

  const { entitlement, user } = tokenRes.data;

  // Enforce access
  if (!entitlement?.access?.hasAccess) {
    return res.redirect(\`/upgrade?url=\${encodeURIComponent(entitlement?.access?.upgradeUrl)}\`);
  }

  // Provision session
  req.session.user = {
    id: user.id,
    planId: entitlement.plan?.planId,
    isTrial: entitlement.access.accessType === 'TRIAL_PROGRAMME',
    tasks: entitlement.trialContext?.programmeTasks || [],
  };
  res.redirect('/dashboard');
});`,
    nextjs: `// app/api/auth/callback/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const res = await fetch(\`\${process.env.MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.MCOM_CLIENT_ID,
      client_secret: process.env.MCOM_CLIENT_SECRET,
      code,
      redirect_uri: process.env.MCOM_REDIRECT_URI,
    }),
  });

  const { entitlement, user } = await res.json();
  if (!entitlement?.access?.hasAccess) {
    return NextResponse.redirect(entitlement?.access?.upgradeUrl || '/pricing');
  }

  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set('mcom_plan', entitlement.plan?.planId || 'standard');
  return response;
}`,
    python: `# FastAPI / Python Implementation
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
import httpx

app = FastAPI()

@app.get("/auth/callback")
async def sso_callback(code: str, request: Request):
    async with httpx.AsyncClient() as client:
        res = await client.post(f"{MCOM_URL}/api/v1/auth/sso/token", json={
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "code": code,
            "redirect_uri": REDIRECT_URI
        })
        data = res.json()
        entitlement = data.get("entitlement", {})
        
        if not entitlement.get("access", {}).get("hasAccess"):
            upgrade_url = entitlement.get("access", {}).get("upgradeUrl")
            return RedirectResponse(url=upgrade_url)
            
        # Store user & plan in session
        return RedirectResponse(url="/dashboard")`,
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippets[lang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
          {(['express', 'nextjs', 'python'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                lang === l ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900',
              )}
            >
              {l === 'express' ? 'Node.js Express' : l === 'nextjs' ? 'Next.js App Router' : 'Python FastAPI'}
            </button>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied Snippet' : 'Copy Code'}
        </button>
      </div>

      <pre className="p-4 bg-gray-900 rounded-2xl font-mono text-xs text-blue-300 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[360px] overflow-y-auto">
        {snippets[lang]}
      </pre>
    </div>
  );
}
