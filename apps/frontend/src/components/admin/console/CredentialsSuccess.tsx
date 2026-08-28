import { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FileCode,
  KeyRound,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateAiIntegrationPrompt } from './utils/aiPromptGenerator';
import type { RegisterAppResult } from '../../../services/admin/types';

interface CredentialsSuccessProps {
  result: RegisterAppResult;
  onClose: () => void;
}

const SECRET_ROWS: {
  label: string;
  key: 'clientSecret' | 'apiKey' | 'hmacSecret' | 'webhookSecret';
  desc: string;
  storage: string;
}[] = [
  {
    label: 'Client Secret',
    key: 'clientSecret',
    desc: 'Used to exchange OAuth authorization codes for JWT tokens (OAuth 2.0 Auth Code Grant)',
    storage: 'Bcrypt Hashed in DB',
  },
  {
    label: 'API Key',
    key: 'apiKey',
    desc: 'Passed in x-mcom-solution-api-key for billing API plan synchronization',
    storage: 'Protected Admin Key',
  },
  {
    label: 'HMAC Secret',
    key: 'hmacSecret',
    desc: 'Used to sign inter-service backend requests (SHA-256 HMAC signature)',
    storage: 'AES-256-GCM Encrypted',
  },
  {
    label: 'Webhook Secret',
    key: 'webhookSecret',
    desc: 'Used to verify incoming MCOM ecosystem lifecycle events on your webhook endpoint',
    storage: 'AES-256-GCM Encrypted',
  },
];

const copy = (value: string) => navigator.clipboard?.writeText(value);

const mcomBaseUrl =
  import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

export default function CredentialsSuccess({ result, onClose }: CredentialsSuccessProps) {
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [acknowledged, setAcknowledged] = useState(false);
  const { client, plainSecrets } = result;

  const handleCopy = (label: string, value: string) => {
    copy(value);
    setCopied((prev) => ({ ...prev, [label]: true }));
    setTimeout(() => setCopied((prev) => ({ ...prev, [label]: false })), 1500);
  };

  const envLines = [
    `# =========================================================================`,
    `# MCOM Solutions Integration Credentials — ${client.name}`,
    `# Generated: ${new Date().toISOString()}`,
    `# =========================================================================`,
    `MCOM_SOLUTIONS_URL="${mcomBaseUrl}"`,
    `MCOM_CLIENT_ID="${client.clientId}"`,
    `MCOM_CLIENT_SECRET="${plainSecrets.clientSecret}"`,
    `MCOM_API_KEY="${plainSecrets.apiKey}"`,
    `MCOM_HMAC_SECRET="${plainSecrets.hmacSecret}"`,
    `MCOM_WEBHOOK_SECRET="${plainSecrets.webhookSecret}"`,
  ].join('\n');

  const aiPrompt = generateAiIntegrationPrompt(client, plainSecrets);

  const handleDownloadEnv = () => {
    const blob = new Blob([envLines], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${client.clientId}.env`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([aiPrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCOM_INTEGRATION_SKILL_${client.clientId.toUpperCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Vault Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 px-6 py-5 text-white flex-shrink-0 border-b border-gray-800">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base font-display">Credentials Vault Generated</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Ready to Deploy
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Application: <span className="text-white font-bold">{client.name}</span> ({client.clientId})
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Vault Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Security Alert Banner */}
          <div className="flex items-start gap-3 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-900">One-Time Credential Reveal</p>
              <p className="text-[11px] text-amber-800/90 mt-0.5 leading-relaxed">
                These secrets will <b>never be displayed in plain text again</b>. Copy them now or download the pre-configured <code>.env</code> file or <b>AI Agent Prompt</b> before closing this window.
              </p>
            </div>
          </div>

          {/* AI Integration Copilot Card Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-purple-50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-blue text-white flex items-center justify-center shadow-glow flex-shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 font-display">
                  <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                  AI Agent Integration Blueprint
                </h5>
                <p className="text-[11px] text-gray-600">
                  Pass this prompt to Cursor, Copilot, ChatGPT, or Claude on the target app to build the integration automatically!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleDownloadPrompt}
                title="Download prompt as markdown skill file"
                className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-700 text-xs font-bold transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleCopy('ai-prompt', aiPrompt)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-glow"
              >
                {copied['ai-prompt'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied['ai-prompt'] ? 'Copied AI Prompt' : 'Copy AI Prompt'}
              </button>
            </div>
          </div>

          {/* Client ID */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-200/70">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                Public Identifier
              </span>
              <span className="font-mono text-xs font-bold text-gray-900">{client.clientId}</span>
            </div>
            <button
              onClick={() => handleCopy('client-id', client.clientId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {copied['client-id'] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied['client-id'] ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Generated Secrets List */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              Generated Application Secrets
            </span>

            {SECRET_ROWS.map(({ label, key, desc, storage }) => (
              <div
                key={key}
                className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-200/70 hover:border-gray-300 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{label}</span>
                    <span className="px-1.5 py-0.2 bg-gray-200 text-gray-600 rounded text-[9px] font-mono font-bold">
                      {storage}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(label, plainSecrets[key])}
                    className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200/80 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {copied[label] ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    {copied[label] ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="bg-white px-3 py-2 rounded-xl border border-gray-200/60 font-mono text-xs font-bold text-brand-blue break-all select-all">
                  {plainSecrets[key]}
                </div>
                <p className="text-[10px] text-gray-400 leading-tight">{desc}</p>
              </div>
            ))}
          </div>

          {/* .env Download & Quickstart Section */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Terminal className="w-3 h-3" /> Environment Snippet (.env)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadEnv}
                  className="flex items-center gap-1 text-xs font-bold text-brand-blue hover:underline"
                >
                  <Download className="w-3.5 h-3.5" /> Download .env
                </button>
                <button
                  onClick={() => handleCopy('.env', envLines)}
                  className="flex items-center gap-1 text-xs font-bold text-brand-blue hover:underline"
                >
                  {copied['.env'] ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copy All
                </button>
              </div>
            </div>

            <pre className="p-3.5 bg-gray-900 rounded-2xl text-[11px] font-mono text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800">
              {envLines}
            </pre>
          </div>

          {/* Acknowledgment Gate */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-brand-blue cursor-pointer"
              />
              <span className="text-xs font-semibold text-gray-700 leading-snug">
                I confirm that I have copied and securely saved all secrets to my application's environment configuration.
              </span>
            </label>
          </div>
        </div>

        {/* Vault Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={!acknowledged}
            className={cn(
              'w-full py-3 rounded-2xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2',
              acknowledged
                ? 'bg-gray-900 text-white hover:bg-gray-800 cursor-pointer'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed',
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            {acknowledged ? 'I Have Stored the Credentials — Close Vault' : 'Check confirmation above to close'}
          </button>
        </div>
      </div>
    </div>
  );
}