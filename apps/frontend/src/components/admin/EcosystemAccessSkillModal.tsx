import { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  Download,
  Gem,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from 'lucide-react';
import { generateEcosystemAccessSkillPrompt } from './utils/ecosystemAccessSkillGenerator';

interface EcosystemAccessSkillModalProps {
  onClose: () => void;
}

export default function EcosystemAccessSkillModal({ onClose }: EcosystemAccessSkillModalProps) {
  const [copied, setCopied] = useState(false);
  const skillContent = generateEcosystemAccessSkillPrompt();

  const handleCopy = () => {
    navigator.clipboard?.writeText(skillContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([skillContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'MCOM_ECOSYSTEM_ACCESS_SKILL.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">
                  Ecosystem Access Verification Skill
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
                  SKILL.md
                </span>
              </div>
              <p className="text-xs text-gray-400">
                One skill covering memberships, access passes, and dashboard/trial access over SSO.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close access verification skill"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          <div className="p-5 bg-gradient-to-r from-indigo-50 via-blue-50/70 to-violet-50 rounded-2xl border border-indigo-100 space-y-2">
            <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              One skill, every access source
            </h4>
            <p className="text-xs text-gray-600 leading-relaxed">
              Hand this to the engineers or AI agent building any platform registered in{' '}
              <code className="bg-white px-1 py-0.5 rounded text-[11px] font-mono text-gray-800 border border-indigo-100">
                /admin/console
              </code>
              . When a user logs in via Central Hub SSO, the platform can tell whether access comes from a membership,
              an access pass, or a trial — and exactly which plan/pass ID, expiry, and limits to apply.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
              <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                <Gem className="w-4 h-4 text-indigo-600" /> Membership
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                A bundle of platform plans. Look for{' '}
                <code className="font-mono text-gray-700">accessType: 'PAID_MEMBERSHIP'</code> and{' '}
                <code className="font-mono text-gray-700">isIncludedInMembership: true</code>.
              </p>
            </div>
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
              <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                <KeyRound className="w-4 h-4 text-indigo-600" /> Access pass
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                A one-time bundle of platform passes. Look for{' '}
                <code className="font-mono text-gray-700">accessType: 'DIRECT_PACKAGE'</code>,{' '}
                <code className="font-mono text-gray-700">plan.planId</code>, and{' '}
                <code className="font-mono text-gray-700">plan.expiresAt</code>.
              </p>
            </div>
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/70">
              <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
                <Target className="w-4 h-4 text-indigo-600" /> Trial / dashboard access
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                A timed trial gated by programme tasks. Look for{' '}
                <code className="font-mono text-gray-700">accessType: 'TRIAL_PROGRAMME'</code> and{' '}
                <code className="font-mono text-gray-700">trialContext</code>.
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600" /> Resolution priority
            </div>
            <p className="leading-relaxed">
              Membership first, then access pass, then trial. <code className="font-mono">access.hasAccess</code> is
              always the final decision — never infer access from roles or cached data.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-gray-900">Generated skill document</h4>
              <p className="text-xs text-gray-500">
                Paste it into Cursor, Claude, ChatGPT, Copilot, or your platform's repo as{' '}
                <code className="font-mono text-gray-700">SKILL.md</code>.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all shadow-xs min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5" /> Download SKILL.md
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-glow min-h-[40px]"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied to Clipboard' : 'Copy AI Skill'}
              </button>
            </div>
          </div>

          <pre className="p-4 bg-gray-900 rounded-2xl font-mono text-xs text-indigo-200 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[420px] overflow-y-auto">
            {skillContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
