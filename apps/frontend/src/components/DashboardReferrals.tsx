import { useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import ReferralLinkCard from './ReferralLinkCard';
import { useReferralInfo, useReferrals, useReferralStats } from '../services/referrals/hooks';

const PAGE_SIZE = 20;

function displayName(user: { firstName: string | null; lastName: string | null; email: string }) {
  const full = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return full || user.email.split('@')[0];
}

export default function DashboardReferrals() {
  const [page, setPage] = useState(1);
  const { data: info, isLoading: infoLoading } = useReferralInfo();
  const { data: stats } = useReferralStats();
  const { data: list, isLoading: listLoading } = useReferrals(page, PAGE_SIZE);

  const totalPages = list?.totalPages ?? 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Referrals</h2>
          <p className="text-gray-500">
            Invite others with your link and track everyone who joined through you.
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
                    <th className="pb-3 text-right">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.map((user) => (
                    <tr key={user.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 pr-4 font-bold text-gray-900">{displayName(user)}</td>
                      <td className="py-3 pr-4 text-gray-500">{user.email}</td>
                      <td className="py-3 pr-4">
                        <span className="inline-block bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3 text-right text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
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
    </div>
  );
}
