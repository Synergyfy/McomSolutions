import { useState } from 'react';
import { ChevronLeft, ChevronRight, Users, Wallet, Trophy, Receipt } from 'lucide-react';
import ReferralLinkCard from './ReferralLinkCard';
import {
  useReferralEarnings,
  useReferralInfo,
  useReferrals,
  useReferralStats,
} from '../services/referrals/hooks';

const PAGE_SIZE = 20;

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.email.split('@')[0];
}

function formatCredits(value: number) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function commissionStatusLabel(status: string) {
  return status.replaceAll('_', ' ').toLowerCase();
}

export default function DashboardReferrals() {
  const [page, setPage] = useState(1);
  const { data: info, isLoading: infoLoading } = useReferralInfo();
  const { data: stats } = useReferralStats();
  const { data: list, isLoading: listLoading } = useReferrals(page, PAGE_SIZE);
  const { data: earningsResponse, isLoading: earningsLoading } =
    useReferralEarnings(20);
  const earnings = earningsResponse?.data;
  const earningsByReferred = new Map(
    (earnings?.referredUsers ?? []).map((user) => [user.id, user] as const),
  );

  const totalPages = list?.totalPages ?? 1;
  const rule = earnings?.config;
  const ruleLabel = !rule
    ? 'Referral rewards not configured yet'
    : rule.rewardType === 'PERCENTAGE'
      ? `${rule.percentage ?? 0}% of qualifying purchases`
      : `£${Number(rule.fixedAmountGbp ?? 0).toFixed(2)} per qualifying purchase`;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Referrals</h2>
          <p className="text-gray-500">
            Invite others with your link, track who joined, and see what you earned from each person.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-700 px-5 py-3 rounded-full text-sm font-bold">
          <Users className="w-4 h-4" />
          {stats?.totalReferrals ?? 0} referred
        </div>
      </div>

      <ReferralLinkCard
        referralLink={info?.referralLink}
        referralCode={info?.referralCode}
        isLoading={infoLoading}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Wallet className="h-3.5 w-3.5 text-emerald-600" /> Referral earnings
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {earningsLoading ? '…' : `${formatCredits(earnings?.summary.totalEarnedCredits ?? 0)} MCOM`}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            £{Number(earnings?.summary.totalEarnedGbp ?? 0).toFixed(2)} commission value · part of your wallet balance
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Trophy className="h-3.5 w-3.5 text-orange-500" /> Earning referrals
          </div>
          <p className="mt-2 text-2xl font-black text-gray-900">
            {earnings?.summary.creditedReferrals ?? 0}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {earnings?.summary.creditedCommissionCount ?? 0} commission{earnings?.summary.creditedCommissionCount === 1 ? '' : 's'} credited
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            <Receipt className="h-3.5 w-3.5 text-blue-600" /> Current rule
          </div>
          <p className="mt-2 text-sm font-bold text-gray-900">{ruleLabel}</p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {rule
              ? `${rule.commissionFrequency === 'RECURRING' ? 'Recurring' : 'One-time'} · version ${rule.version}`
              : 'An administrator has not published a referral rule yet.'}
          </p>
        </div>
      </div>

      {/* Referred users */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" /> People You Referred
        </h3>

        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-gray-500 font-semibold text-sm">Loading referrals...</p>
          </div>
        ) : !list || list.data.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <Users className="w-7 h-7" />
            </div>
            <p className="font-bold text-gray-900 mb-1">No referrals yet</p>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              Share your referral link above — anyone who registers with it will appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Email</th>
                    <th className="pb-3 pr-4">Role</th>
                    <th className="pb-3 pr-4 text-right">Earned</th>
                    <th className="pb-3 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((user) => {
                    const earned = earningsByReferred.get(user.id);
                    return (
                      <tr key={user.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-3 pr-4 font-bold text-gray-900">{displayName(user)}</td>
                        <td className="py-3 pr-4 text-gray-500">{user.email}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-block bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase">
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <span
                            className={`font-bold ${
                              (earned?.earnedCredits ?? 0) > 0
                                ? 'text-emerald-700'
                                : 'text-gray-400'
                            }`}
                          >
                            {formatCredits(earned?.earnedCredits ?? 0)} MCOM
                          </span>
                          <span className="mt-0.5 block text-[10px] text-gray-400">
                            £{Number(earned?.earnedGbp ?? 0).toFixed(2)} commission
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-500">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6">
                <p className="text-xs font-semibold text-gray-500">
                  Page {list.page} of {totalPages} · {list.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Commission history */}
      <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-5 md:p-8">
        <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-orange-500" /> Referral earning history
        </h3>
        <p className="mb-5 text-sm text-gray-500">
          Every qualifying membership or access-pass purchase from someone you referred.
        </p>
        {earningsLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading earning history...</p>
        ) : (earnings?.history.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            No referral commissions yet. Earnings appear after a referred business or customer buys a qualifying plan.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100">
                  <th className="pb-3 pr-4">Referred person</th>
                  <th className="pb-3 pr-4">Purchase</th>
                  <th className="pb-3 pr-4">Source amount</th>
                  <th className="pb-3 pr-4">Commission</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {earnings?.history.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-gray-900">
                        {entry.referredName || entry.referredEmail || 'Referred user'}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {entry.sourceName || entry.sourceType.replaceAll('_', ' ').toLowerCase()}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      £{Number(entry.purchaseAmountGbp).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-bold ${
                          entry.status === 'CREDITED' ? 'text-emerald-700' : 'text-gray-500'
                        }`}
                      >
                        {formatCredits(entry.commissionCredits)} MCOM
                      </span>
                      <span className="mt-0.5 block text-[10px] text-gray-400">
                        £{Number(entry.commissionAmountGbp).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          entry.status === 'CREDITED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {commissionStatusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="py-3 text-right text-gray-500">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
