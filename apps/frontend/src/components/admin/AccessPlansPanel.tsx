import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  Bot,
  Calendar,
  Edit3,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  Shield,
  Trash2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminAccessPlans,
  useDeleteAccessPlan,
  usePartnerAccessCodes,
  useUpdateAccessPlan,
} from '../../services/admin/hooks';
import type { AccessPlan } from '../../services/admin/types';
import EcosystemAccessSkillModal from './EcosystemAccessSkillModal';

export default function AccessPlansPanel() {
  const navigate = useNavigate();
  const { data: plansRes, isLoading } = useAdminAccessPlans();
  const { data: partnerCodesRes } = usePartnerAccessCodes({ sourceApp: 'mcom-rewards', limit: 10 });
  const partnerCodes = partnerCodesRes?.data ?? [];
  const updatePlan = useUpdateAccessPlan();
  const deletePlan = useDeleteAccessPlan();
  const [showSkillModal, setShowSkillModal] = useState(false);

  const plans: AccessPlan[] = plansRes?.data ?? [];

  const handleDelete = (plan: AccessPlan) => {
    if (window.confirm(`Delete "${plan.name}"? This is a soft delete and can be restored by support if needed.`)) {
      deletePlan.mutate(plan.id);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-sm text-gray-500 font-medium">
            {isLoading ? 'Loading access passes...' : `${plans.length} access pass${plans.length === 1 ? '' : 'es'} configured`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            One-time passes that unlock bundled platform plans for a fixed number of days.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSkillModal(true)}
            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl font-bold text-xs transition-all shadow-xs hover:shadow flex items-center gap-2 min-h-[44px]"
            title="AI skill that explains how platforms verify memberships, access passes, and trials over SSO"
          >
            <Bot className="w-4 h-4 text-indigo-600" />
            Access Verification Skill
          </button>
          <button
            onClick={() => navigate('/admin/access/new')}
            className="px-4 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2 min-h-[44px]"
          >
            <Plus className="w-4 h-4" /> Create Access Pass
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading access passes...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <KeyRound className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-black text-gray-900">No access passes yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Create a fixed-duration pass and bundle the platform plans it unlocks.
          </p>
          <button
            onClick={() => navigate('/admin/access/new')}
            className="mt-5 px-4 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Access Pass
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                'bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all',
                plan.archived ? 'opacity-50' : '',
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-lg text-gray-900 truncate">{plan.name}</h3>
                    {plan.badge && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                        {plan.badge}
                      </span>
                    )}
                    {plan.archived && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                        Archived
                      </span>
                    )}
                  </div>
                  {plan.whoItIsFor && (
                    <p className="text-xs font-semibold text-brand-blue mt-0.5">{plan.whoItIsFor}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{plan.description}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => navigate(`/admin/access/${plan.id}/edit`)}
                    className="p-2.5 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Edit"
                    aria-label={`Edit ${plan.name}`}
                  >
                    <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => updatePlan.mutate({ id: plan.id, data: { archived: !plan.archived } })}
                    className="p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title={plan.archived ? 'Unarchive' : 'Archive'}
                    aria-label={`${plan.archived ? 'Unarchive' : 'Archive'} ${plan.name}`}
                  >
                    <Archive className={cn('w-3.5 h-3.5', plan.archived ? 'text-amber-500' : 'text-gray-400')} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan)}
                    className="p-2.5 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Delete"
                    aria-label={`Delete ${plan.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Price</div>
                  <div className="text-lg font-black text-gray-900">£{plan.price}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">one-time</div>
                </div>
                <div className="bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</div>
                  <div className="text-lg font-black text-gray-900">{plan.durationDays}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">longest bundle</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Bundled Platform Plans ({plan.appBundles?.length ?? 0})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(plan.appBundles ?? []).map((bundle, i) => (
                    <span key={`${bundle.platform}-${i}`} className="px-2 py-0.5 bg-blue-50 border border-blue-100 text-gray-800 rounded-lg text-[10px] font-bold">
                      <span className="text-brand-blue">{bundle.platform}:</span> {bundle.packageName}
                      {bundle.durationDays ? ` · ${bundle.durationDays}d` : ''}
                      {bundle.variantTier ? ` (${bundle.variantTier === 'ProPlus' ? 'Pro+' : bundle.variantTier})` : ''}
                    </span>
                  ))}
                  {(plan.appBundles?.length ?? 0) === 0 && (
                    <span className="text-[11px] text-gray-400">No platform plans configured</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> up to {plan.durationDays} days
                </span>
                {plan.features?.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-500" /> {plan.features.length} included features
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-blue" /> Partner-issued access codes
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Codes issued by MCOM Rewards. Recipients redeem them in Central; access remains business-only.
            </p>
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
            MCOM Rewards
          </span>
        </div>
        {partnerCodes.length === 0 ? (
          <div className="px-5 py-6 text-xs text-gray-400">No partner-issued codes yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  <th className="py-2.5 px-5">Code</th>
                  <th className="py-2.5 px-5">Plan</th>
                  <th className="py-2.5 px-5">Recipient</th>
                  <th className="py-2.5 px-5">Issuance</th>
                  <th className="py-2.5 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {partnerCodes.map((code) => (
                  <tr key={code.id} className="hover:bg-gray-50/60">
                    <td className="py-2.5 px-5 font-mono font-black text-gray-900">{code.code}</td>
                    <td className="py-2.5 px-5 text-gray-600">{code.planName}</td>
                    <td className="py-2.5 px-5 text-gray-600">{code.recipientEmail ?? '—'}</td>
                    <td className="py-2.5 px-5 text-gray-500 font-mono text-[10px] truncate max-w-[160px]">
                      {code.externalRef ?? '—'}
                    </td>
                    <td className="py-2.5 px-5">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-md font-black text-[10px]',
                          code.status === 'UNUSED' && 'bg-emerald-50 text-emerald-700',
                          code.status === 'REDEEMED' && 'bg-blue-50 text-blue-700',
                          code.status === 'REVOKED' && 'bg-red-50 text-red-600',
                          code.status === 'PENDING_PAYMENT' && 'bg-amber-50 text-amber-700',
                        )}
                      >
                        {code.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showSkillModal && (
        <EcosystemAccessSkillModal onClose={() => setShowSkillModal(false)} />
      )}
    </div>
  );
}
