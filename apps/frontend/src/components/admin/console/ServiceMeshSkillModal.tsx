import { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Download,
  Network,
  Play,
  Shield,
  Sparkles,
  Terminal,
  Workflow,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { SsoClientListItem } from '../../../services/admin/types';
import { generateServiceMeshSkillPrompt } from './utils/meshSkillGenerator';

interface PolicyEntry {
  allowedAudiences: string[];
  allowedCallers: string[];
}
type PolicyMap = Record<string, PolicyEntry>;

export default function ServiceMeshSkillModal({
  apps,
  policy,
  onClose,
}: {
  apps: SsoClientListItem[];
  policy: PolicyMap;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'skill' | 'smoke-test' | 'matrix'>('skill');

  const skillPrompt = generateServiceMeshSkillPrompt(apps, policy);

  const handleCopy = () => {
    navigator.clipboard?.writeText(skillPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([skillPrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MCOM_BACKEND_TO_BACKEND_M2M_SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const mcomBaseUrl =
    import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

  const sampleCaller = apps[0]?.clientId || 'mcom-caller';
  const sampleTarget = apps[1]?.clientId || apps[0]?.clientId || 'mcom-target';

  const smokeTestCode = `// test-service-mesh.mjs — Zero-dependency Cross-App Mesh Test
const MCOM_URL = process.env.MCOM_SOLUTIONS_URL || '${mcomBaseUrl}';
const CALLER_ID = process.env.MCOM_CLIENT_ID || '${sampleCaller}';
const CALLER_SECRET = process.env.MCOM_CLIENT_SECRET || '<CALLER_CLIENT_SECRET>';
const TARGET_ID = process.env.TARGET_PEER_ID || '${sampleTarget}';

console.log('🚀 Testing MCOM Service Mesh connectivity:');
console.log('   Caller App:', CALLER_ID);
console.log('   Target Peer:', TARGET_ID);
console.log('   Central Hub:', MCOM_URL);

try {
  // 1. Fetch Discovery
  const discRes = await fetch(\`\${MCOM_URL}/api/v1/ecosystem/discovery\`);
  const discovery = await discRes.json();
  console.log('\\n✅ [1/3] Discovery OK! Alg:', discovery.signing_alg, '| Registry:', discovery.registry_endpoint);

  // 2. Fetch Active Service Registry
  const regRes = await fetch(\`\${MCOM_URL}/api/v1/ecosystem/services\`);
  const services = await regRes.json();
  console.log('✅ [2/3] Registry loaded! Active ecosystem apps registered:', services.length);

  // 3. Request RS256 Service Token for Target Audience
  console.log(\`\\n🔑 [3/3] Minting RS256 token for caller "\${CALLER_ID}" -> audience "\${TARGET_ID}"...\`);
  const basicAuth = Buffer.from(\`\${CALLER_ID}:\${CALLER_SECRET}\`).toString('base64');
  const tokenRes = await fetch(\`\${MCOM_URL}/api/v1/auth/service-token\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: \`Basic \${basicAuth}\`,
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      audience: TARGET_ID,
      scope: 'service:read',
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenRes.ok) {
    console.log('🎉 SUCCESS! Service Token minted:');
    console.log('   - Type:', tokenData.token_type);
    console.log('   - Expires In:', tokenData.expires_in + 's');
    console.log('   - Token:', tokenData.access_token.slice(0, 36) + '...');
    console.log('\\n💡 Ready to make DIRECT HTTP call to target app with:');
    console.log(\`   Authorization: Bearer \${tokenData.access_token.slice(0, 16)}...\`);
  } else {
    console.error('❌ Token issuance failed (' + tokenRes.status + '):', tokenData);
  }
} catch (err) {
  console.error('❌ Connection error:', err.message);
}
`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 text-white flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue shadow-inner flex-shrink-0">
              <Bot className="w-6 h-6 text-brand-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">
                  Backend-to-Backend (M2M) Communication Skill & Blueprint
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue text-white shadow-xs">
                  Zero-Hop Service Mesh
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Instruction skill for AI agents & engineers explaining direct app-to-app communication, offline JWKS token verification, and why webhook keys are NOT needed for peer calls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold border border-gray-700 transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Download SKILL.md
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-glow"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied to Clipboard' : 'Copy Mesh AI Skill'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Feature Highlights Ribbon */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center flex-shrink-0 mt-0.5">
              <Network className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Zero-Hop Architecture</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Apps talk directly peer-to-peer. Requests never proxy through MCOM Central.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">No Webhook Keys Needed</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Console credentials (<code className="font-mono text-[10px]">clientId</code> + <code className="font-mono text-[10px]">clientSecret</code>) are all you need.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">Offline JWKS Verification</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Target apps verify RS256 signatures locally with cached public keys from <code className="font-mono text-[10px]">/.well-known/jwks.json</code>.
              </p>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-gray-200/80 shadow-xs flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="font-bold text-gray-900">30s Smoke Test Script</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Includes zero-dependency Node.js test script to verify token minting immediately.
              </p>
            </div>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 border-b border-gray-100 bg-white">
          <button
            onClick={() => setActiveTab('skill')}
            className={cn(
              'pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5',
              activeTab === 'skill'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Bot className="w-4 h-4" />
            <span>Full AI Agent Skill (SKILL.md)</span>
          </button>
          <button
            onClick={() => setActiveTab('smoke-test')}
            className={cn(
              'pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5',
              activeTab === 'smoke-test'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Terminal className="w-4 h-4" />
            <span>30-Second Smoke Test (test-service-mesh.mjs)</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              'pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5',
              activeTab === 'matrix'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-gray-500 hover:text-gray-900',
            )}
          >
            <Workflow className="w-4 h-4" />
            <span>Current Mesh Topology ({apps.length} Apps)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          {activeTab === 'skill' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Copy this skill into any ecosystem app repository or AI prompt (Cursor, Claude, Antigravity, Copilot):</span>
                <span className="font-mono text-[11px] text-gray-400">format: GitHub Flavored Markdown</span>
              </div>
              <pre className="p-5 bg-gray-950 text-emerald-300 font-mono text-xs rounded-2xl overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[460px] leading-relaxed">
                {skillPrompt}
              </pre>
            </div>
          )}

          {activeTab === 'smoke-test' && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between gap-3 text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Play className="w-4 h-4 text-brand-blue flex-shrink-0" />
                  <span>
                    Save this snippet as <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-blue-200">test-service-mesh.mjs</code> and run <code className="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-blue-200">node test-service-mesh.mjs</code> to test edge validation live!
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(smokeTestCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-white text-brand-blue border border-blue-200 rounded-xl font-bold hover:bg-blue-50 transition-colors flex-shrink-0 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Test Script
                </button>
              </div>
              <pre className="p-5 bg-gray-950 text-emerald-300 font-mono text-xs rounded-2xl overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[440px] leading-relaxed">
                {smokeTestCode}
              </pre>
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Direct connections currently permitted in the active Service Mesh policy:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {apps.map((app) => {
                  const p = policy[app.clientId];
                  const egress = p?.allowedAudiences ?? [];
                  const ingress = p?.allowedCallers ?? [];

                  return (
                    <div
                      key={app.clientId}
                      className="p-4 bg-white rounded-2xl border border-gray-200 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{app.name}</h4>
                          <span className="font-mono text-[10px] text-gray-400">{app.clientId}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Active Peer
                        </span>
                      </div>
                      <div className="text-[11px] space-y-1 pt-2 border-t border-gray-100">
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400">Can Call (Egress):</span>
                          <span className="font-semibold text-gray-900">
                            {egress.includes('*') ? 'Anyone (*)' : egress.length > 0 ? egress.join(', ') : 'None'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-gray-600">
                          <span className="text-gray-400">Accepts From (Ingress):</span>
                          <span className="font-semibold text-gray-900">
                            {ingress.includes('*') ? 'Anyone (*)' : ingress.length > 0 ? ingress.join(', ') : 'None'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-white border-t border-gray-100 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            Pass this skill to Cursor, Copilot, Claude, or ChatGPT in any registered app codebase.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-glow"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Full Skill' : 'Copy Mesh AI Skill'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
