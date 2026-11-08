import { Gift, TrendingUp, Users } from 'lucide-react';
import { useReferralEarnings } from '../services/referrals/hooks';

function formatCredits(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

export default function ReferralEarningsCard({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { data, isLoading, isError } = useReferralEarnings(compact ? 5 : 10);
  const earnings = data?.data;

  return (
    <div
      className={`rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
            <Gift className="h-3.5 w-3.5 text-emerald-600" /> Referral earnings
          </p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {isLoading ? '…' : `${formatCredits(earnings?.summary.totalEarnedCredits ?? 0)} MCOM`}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Part of your MCOM wallet balance · not a separate balance
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-emerald-50 px-3 py-2">
            <Users className="mx-auto h-3.5 w-3.5 text-emerald-700" />
            <p className="mt-1 text-lg font-black text-emerald-800">
              {earnings?.summary.creditedReferrals ?? 0}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-700/70">
              earning referrals
            </p>
          </div>
          <div className="rounded-xl bg-orange-50 px-3 py-2">
            <TrendingUp className="mx-auto h-3.5 w-3.5 text-orange-600" />
            <p className="mt-1 text-lg font-black text-orange-800">
              {earnings?.summary.creditedCommissionCount ?? 0}
            </p>
            <p className="text-[9px] font-bold uppercase tracking-wide text-orange-700/70">
              commissions
            </p>
          </div>
        </div>
      </div>

      {isError ? (
        <p className="mt-4 text-xs text-red-600">Referral earnings could not be loaded.</p>
      ) : isLoading ? (
        <p className="mt-4 text-xs text-gray-500">Loading referral earning history…</p>
      ) : (earnings?.history.length ?? 0) === 0 ? (
        <p className="mt-4 text-xs text-gray-500">
          No referral commissions yet. Share your referral link to start earning from qualifying purchases.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-gray-50">
          {earnings?.history.map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-gray-900">
                  {entry.referredName || entry.referredEmail || 'Referred user'}
                </p>
                <p className="text-[10px] font-semibold text-gray-500">
                  {entry.sourceName || entry.sourceType.replaceAll('_', ' ').toLowerCase()} ·{' '}
                  {new Date(entry.createdAt).toLocaleDateString()}
                </p>
              </div>
              <p
                className={`shrink-0 text-xs font-black ${
                  entry.status === 'CREDITED' ? 'text-emerald-700' : 'text-gray-400'
                }`}
              >
                {entry.status === 'CREDITED' ? '+' : ''}
                {formatCredits(entry.commissionCredits)} MCOM
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
