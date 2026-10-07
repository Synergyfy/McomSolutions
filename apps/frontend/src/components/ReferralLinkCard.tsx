import { useState } from 'react';
import { Check, Copy, Link2, Mail, MessageCircle, Share2 } from 'lucide-react';

interface ReferralLinkCardProps {
  referralLink: string | null | undefined;
  referralCode?: string | null | undefined;
  isLoading?: boolean;
  description?: string;
}

export default function ReferralLinkCard({
  referralLink,
  referralCode,
  isLoading,
  description,
}: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      // Clipboard API unavailable (permissions) — fall back to selection.
      const input = document.getElementById('referral-link-input') as HTMLInputElement | null;
      input?.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralLink) return;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({
          title: 'Join me on MCOM',
          text: 'Sign up with my referral link:',
          url: referralLink,
        });
      } catch {
        // User dismissed the share sheet — ignore.
      }
    } else {
      handleCopy();
    }
  };

  const shareTargets = referralLink
    ? [
        {
          label: 'WhatsApp',
          href: `https://wa.me/?text=${encodeURIComponent(`Join me on MCOM: ${referralLink}`)}`,
        },
        {
          label: 'X',
          href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join me on MCOM: ${referralLink}`)}`,
        },
        {
          label: 'Email',
          href: `mailto:?subject=${encodeURIComponent('Join me on MCOM')}&body=${encodeURIComponent(`Sign up with my referral link: ${referralLink}`)}`,
        },
      ]
    : [];

  return (
    <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
      <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-orange-500" /> Your Referral Link
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        {description ??
          'Share this link — anyone who registers with it is counted as your referral.'}
      </p>

      {isLoading ? (
        <div className="flex items-center gap-3 py-3">
          <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-gray-500">Loading your referral link...</span>
        </div>
      ) : referralLink ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="referral-link-input"
              readOnly
              value={referralLink}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-xs text-gray-700"
            />
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold text-xs transition shadow-md shadow-orange-500/10"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {referralCode && (
            <p className="text-xs text-gray-500">
              Your code: <span className="font-mono font-bold text-gray-800">{referralCode}</span>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition"
            >
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
            {shareTargets.map((target) => (
              <a
                key={target.label}
                href={target.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-xs transition"
              >
                {target.label === 'Email' ? (
                  <Mail className="w-3.5 h-3.5" />
                ) : (
                  <MessageCircle className="w-3.5 h-3.5" />
                )}
                {target.label}
              </a>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm font-semibold text-gray-400">
          Your referral link will appear here once your account is ready.
        </p>
      )}
    </div>
  );
}
