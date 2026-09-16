import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Trash2, Edit3, Package, Gem, Archive, ExternalLink, Loader2, Trophy, Layers, Sparkles, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import PlanFormModal from './PlanFormModal';
import TieredPlanEditorModal from './TieredPlanEditorModal';
import LocalPackageEditorModal from './LocalPackageEditorModal';
import {
  useAdminPlans,
  useAdminPackages,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  useCreatePackage,
  useUpdatePackage,
  useDeletePackage,
  useExternalPlans,
  useExternalPlanSchema,
  useExternalPlatformSeasons,
  useCreateExternalPlan,
  useUpdateExternalPlan,
  useDeleteExternalPlan,
  useSupportedPlatforms,
} from '../../services/admin/hooks';
import type {
  CreatePlanInput,
  CreatePackageInput,
  CreateExternalPlanInput,
  ExternalPlan,
  ExternalSeason,
  PlatformInfo,
  PlanSchema,
  PlanSchemaField,
} from '../../services/admin/types';

export default function PlanManagementPanel() {
  const { data: plansRes, isLoading: plansLoading } = useAdminPlans();
  const { data: packagesRes, isLoading: packagesLoading } = useAdminPackages();
  const { data: platformsRes, isLoading: platformsLoading } = useSupportedPlatforms();

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const deletePlan = useDeletePlan();
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const deletePackage = useDeletePackage();
  const createExternalPlan = useCreateExternalPlan();
  const updateExternalPlan = useUpdateExternalPlan();
  const deleteExternalPlan = useDeleteExternalPlan();

  const [tab, setTab] = useState<'memberships' | 'packages'>('memberships');
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [editMembership, setEditMembership] = useState<string | null>(null);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editPackage, setEditPackage] = useState<number | null>(null);

  // Dynamic external plan modal state
  const [addPlatformPlan, setAddPlatformPlan] = useState<PlatformInfo | null>(null);
  const [editExternalPlan, setEditExternalPlan] = useState<{ plan: ExternalPlan; platform: PlatformInfo } | null>(null);
  const [confirmEditPlan, setConfirmEditPlan] = useState<{ plan: ExternalPlan; platform: PlatformInfo } | null>(null);
  const [deleteExternalPlanTarget, setDeleteExternalPlanTarget] = useState<{ plan: ExternalPlan; platform: PlatformInfo } | null>(null);

  const membershipPlans = plansRes?.data ?? [];
  const packages = packagesRes?.data ?? [];
  const platforms: PlatformInfo[] = platformsRes?.data ?? [];

  const externalPlatformNames = new Set(platforms.map((p) => p.name.toLowerCase()));
  const localPackages = packages.filter((p) => !externalPlatformNames.has((p.platform || '').toLowerCase()));

  return (
    <div>
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button
          onClick={() => setTab('memberships')}
          className={cn(
            "px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
            tab === 'memberships' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Gem className="w-4 h-4 inline mr-1.5" />
          Memberships
        </button>
        <button
          onClick={() => setTab('packages')}
          className={cn(
            "px-5 py-2.5 rounded-xl text-xs font-bold transition-all",
            tab === 'packages' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <Package className="w-4 h-4 inline mr-1.5" />
          Packages
        </button>
      </div>

      {tab === 'memberships' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500 font-medium">
              {plansLoading ? 'Loading memberships...' : `${membershipPlans.length} membership plans configured`}
            </p>
            <button
              onClick={() => setShowAddMembership(true)}
              className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Create Membership
            </button>
          </div>
          {plansLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading membership plans...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {membershipPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all",
                    plan.archived ? "opacity-50" : ""
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                        {plan.badge && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-extrabold uppercase tracking-wide">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      {plan.whoItIsFor && (
                        <p className="text-xs font-semibold text-brand-blue mt-0.5">{plan.whoItIsFor}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditMembership(plan.id)}
                        className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"
                        title="Edit"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => deletePlan.mutate(plan.id)}
                        className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => updatePlan.mutate({ id: plan.id, data: { archived: !plan.archived } })}
                        className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"
                        title={plan.archived ? "Unarchive" : "Archive"}
                      >
                        <Archive className={cn("w-3.5 h-3.5", plan.archived ? "text-amber-500" : "text-gray-400")} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 mb-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configured Tiers</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
                        <div className="text-[10px] font-bold text-gray-500 uppercase">Standard</div>
                        <div className="text-sm font-black text-gray-900">£{plan.tierPrices?.Standard ?? plan.monthlyPrice ?? plan.price}</div>
                        <div className="text-[9px] text-gray-400 font-semibold">90 Days</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-orange-200/80 shadow-2xs">
                        <div className="text-[10px] font-bold text-orange-600 uppercase">Pro</div>
                        <div className="text-sm font-black text-gray-900">£{plan.tierPrices?.Pro ?? Math.round((plan.monthlyPrice ?? plan.price) * 2.5)}</div>
                        <div className="text-[9px] text-orange-500 font-semibold">180 Days</div>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-purple-200/80 shadow-2xs">
                        <div className="text-[10px] font-bold text-purple-600 uppercase">Pro+</div>
                        <div className="text-sm font-black text-gray-900">£{plan.tierPrices?.['Pro+'] ?? plan.annualPrice ?? Math.round((plan.monthlyPrice ?? plan.price) * 5)}</div>
                        <div className="text-[9px] text-purple-500 font-semibold">Annual</div>
                      </div>
                    </div>
                    {Array.isArray(plan.tierEntitlements) && plan.tierEntitlements.length > 0 && (
                      <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                        <Shield className="w-3 h-3 text-emerald-600" />
                        {plan.tierEntitlements.length} resource quotas enforced live
                      </div>
                    )}
                  </div>

                  {/* Bundled App Plans */}
                  {plan.includedApps && plan.includedApps.length > 0 && (
                    <div className="mb-3 p-2.5 bg-blue-50/60 rounded-xl border border-blue-100">
                      <div className="text-[10px] font-bold text-brand-blue uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Layers className="w-3 h-3" /> Bundled Platform Plans ({plan.includedApps.length})
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.includedApps.map((app, i) => (
                          <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-gray-800 rounded-lg text-[10px] font-bold shadow-2xs">
                            <span className="text-brand-blue">{app.platform}:</span> {app.planName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Access</div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.platformAccess.map((p) => (
                        <span key={p} className="px-2 py-1 bg-blue-50 text-brand-blue rounded-lg text-[10px] font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Permissions</div>
                    <div className="flex flex-wrap gap-1.5">
                      {plan.permissions.map((p) => (
                        <span key={p} className="px-2 py-1 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'packages' && (
        <div>
          {platformsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading platform integrations...
            </div>
          ) : (
            platforms.map((platform) => (
              <PlatformPlansSection
                key={platform.name}
                platform={platform}
                onAddPlan={() => setAddPlatformPlan(platform)}
                onEditPlan={(plan) => setConfirmEditPlan({ plan, platform })}
                onDeletePlan={(plan) => setDeleteExternalPlanTarget({ plan, platform })}
              />
            ))
          )}

          {/* Local Packages Section (Non-external platforms) */}
          <div className="border-t border-gray-100 pt-8 mt-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-blue" />
                  Local Package Templates
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {packagesLoading ? 'Loading...' : `${localPackages.length} local templates configured`}
                </p>
              </div>
              <button
                onClick={() => setShowAddPackage(true)}
                className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Create Local Package
              </button>
            </div>

            {localPackages.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center mb-8">
                <Package className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">No local packages configured</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {localPackages.map((pkg) => (
                  <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-gray-900">{pkg.name}</h4>
                        <p className="text-xs text-gray-500">{pkg.description}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold">
                          {pkg.platform}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditPackage(pkg.id)}
                          className="p-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all"
                          title="Edit"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        <button
                          onClick={() => deletePackage.mutate(pkg.id.toString())}
                          className="p-1.5 bg-gray-50 rounded-lg hover:bg-red-50 transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configured Tiers</div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <div className="bg-white p-1.5 rounded-lg border border-gray-100 shadow-2xs">
                          <div className="text-[9px] font-bold text-gray-500">Standard</div>
                          <div className="text-xs font-black text-gray-900">£{pkg.tierPrices?.Standard ?? pkg.price}</div>
                          <div className="text-[8px] text-gray-400 font-semibold">90d</div>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-orange-200/80 shadow-2xs">
                          <div className="text-[9px] font-bold text-orange-600">Pro</div>
                          <div className="text-xs font-black text-gray-900">£{pkg.tierPrices?.Pro ?? Math.round(pkg.price * 2.5)}</div>
                          <div className="text-[8px] text-orange-500 font-semibold">180d</div>
                        </div>
                        <div className="bg-white p-1.5 rounded-lg border border-purple-200/80 shadow-2xs">
                          <div className="text-[9px] font-bold text-purple-600">Pro+</div>
                          <div className="text-xs font-black text-gray-900">£{pkg.tierPrices?.['Pro+'] ?? Math.round(pkg.price * 5)}</div>
                          <div className="text-[8px] text-purple-500 font-semibold">Annual</div>
                        </div>
                      </div>
                      {Array.isArray(pkg.tierEntitlements) && pkg.tierEntitlements.length > 0 && (
                        <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-1">
                          <Shield className="w-3 h-3 text-emerald-600" />
                          {pkg.tierEntitlements.length} resource quotas enforced
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {pkg.features.map((f) => (
                        <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {/* Memberships Modals */}
        {showAddMembership && (
          <TieredPlanEditorModal
            mode="membership"
            onClose={() => setShowAddMembership(false)}
            onSaveMembership={(data: CreatePlanInput) => {
              createPlan.mutate(data);
              setShowAddMembership(false);
            }}
          />
        )}
        {editMembership && (
          <TieredPlanEditorModal
            mode="membership"
            initialPlan={membershipPlans.find((p) => p.id === editMembership)}
            onClose={() => setEditMembership(null)}
            onSaveMembership={(data: CreatePlanInput) => {
              updatePlan.mutate({ id: editMembership!, data });
              setEditMembership(null);
            }}
          />
        )}

        {/* Local Package Modals */}
        {showAddPackage && (
          <LocalPackageEditorModal
            onClose={() => setShowAddPackage(false)}
            isSubmitting={createPackage.isPending}
            onSave={(data: CreatePackageInput) => {
              createPackage.mutate(data, {
                onSuccess: () => setShowAddPackage(false),
              });
            }}
          />
        )}
        {editPackage !== null && (
          <LocalPackageEditorModal
            initialPackage={packages.find((p) => p.id === editPackage)}
            onClose={() => setEditPackage(null)}
            isSubmitting={updatePackage.isPending}
            onSave={(data: CreatePackageInput) => {
              updatePackage.mutate(
                { id: editPackage!.toString(), data },
                { onSuccess: () => setEditPackage(null) }
              );
            }}
          />
        )}

        {/* Dynamic External Plan Modals */}
        {addPlatformPlan && (
          <ExternalPlanFormModal
            title={`Create ${addPlatformPlan.name} Plan`}
            platform={addPlatformPlan}
            onClose={() => setAddPlatformPlan(null)}
            onSave={(data: CreateExternalPlanInput) =>
              createExternalPlan.mutateAsync(data).then(() => true).catch(() => false)
            }
          />
        )}
        {editExternalPlan && (
          <ExternalPlanFormModal
            title={`Edit ${editExternalPlan.platform.name} Plan`}
            platform={editExternalPlan.platform}
            initial={editExternalPlan.plan}
            onClose={() => setEditExternalPlan(null)}
            onSave={(data: Partial<CreateExternalPlanInput>) =>
              updateExternalPlan
                .mutateAsync({ id: editExternalPlan.plan.id, platform: editExternalPlan.platform.name, data })
                .then(() => true)
                .catch(() => false)
            }
          />
        )}

        {/* Confirm External Plan Modals */}
        {confirmEditPlan && (
          <ConfirmModal
            title="Edit Plan"
            message={`You're about to edit "${confirmEditPlan.plan.name}" on ${confirmEditPlan.platform.name}. Do you want to proceed?`}
            confirmLabel="Yes, Edit"
            confirmColor="bg-brand-blue hover:bg-blue-600"
            isSubmitting={updateExternalPlan.isPending}
            onConfirm={() => {
              setEditExternalPlan(confirmEditPlan);
              setConfirmEditPlan(null);
            }}
            onClose={() => setConfirmEditPlan(null)}
          />
        )}
        {deleteExternalPlanTarget && (
          <ConfirmModal
            title="Delete Plan"
            message={`Are you sure you want to delete "${deleteExternalPlanTarget.plan.name}" from ${deleteExternalPlanTarget.platform.name}? This action cannot be undone.`}
            confirmLabel="Yes, Delete"
            isSubmitting={deleteExternalPlan.isPending}
            onConfirm={() => {
              deleteExternalPlan.mutate(
                { id: deleteExternalPlanTarget.plan.id, platform: deleteExternalPlanTarget.platform.name },
                { onSuccess: () => setDeleteExternalPlanTarget(null) }
              );
            }}
            onClose={() => setDeleteExternalPlanTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Platform Plans Section (Generic for all platforms) ───────────
function PlatformPlansSection({
  platform,
  onAddPlan,
  onEditPlan,
  onDeletePlan,
}: {
  key?: string;
  platform: PlatformInfo;
  onAddPlan: () => void;
  onEditPlan: (plan: ExternalPlan) => void;
  onDeletePlan: (plan: ExternalPlan) => void;
}) {
  const { data: plansRes, isLoading } = useExternalPlans(platform.name);
  const plans = plansRes?.data ?? [];

  const getPlatformIcon = (name: string) => {
    if (name.toLowerCase().includes('reward') || name.toLowerCase().includes('loyalty')) {
      return <Trophy className="w-4 h-4 text-yellow-500" />;
    }
    return <ExternalLink className="w-4 h-4 text-brand-blue" />;
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
          {getPlatformIcon(platform.name)}
          {platform.name}
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {platform.isNamed ? 'via Native API' : 'via Console Connector'}
          </span>
        </h3>
        <button
          onClick={onAddPlan}
          className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create {platform.name} Plan
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading {platform.name} plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          {getPlatformIcon(platform.name)}
          <p className="text-sm text-gray-400 font-medium mt-2">No plans configured on {platform.name} yet</p>
          <p className="text-xs text-gray-300 mt-1">Create your first plan to sync with the {platform.name} backend</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: ExternalPlan) => {
            const standardPrice = plan.tierPrices?.Standard ?? plan.monthlyPrice;
            const proPrice = plan.tierPrices?.Pro ?? plan.quarterlyPrice;
            const proPlusPrice = plan.tierPrices?.['Pro+'] ?? plan.annualPrice;

            return (
              <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-gray-900">{plan.name}</h4>
                    <p className="text-xs text-gray-500">{plan.description}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-brand-blue rounded text-[9px] font-bold">
                      {plan.type || '3-TIER MATRIX'}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEditPlan(plan)}
                      className="p-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all"
                      title="Edit Plan"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan)}
                      className="p-1.5 bg-gray-50 rounded-lg hover:bg-red-50 transition-all"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-3 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Configured Tiers</div>
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="bg-white p-1.5 rounded-lg border border-gray-100 shadow-2xs">
                      <div className="text-[9px] font-bold text-gray-500 uppercase">Standard</div>
                      <div className="text-xs font-black text-gray-900">
                        {standardPrice != null ? `£${standardPrice}` : '—'}
                      </div>
                      <div className="text-[8px] text-gray-400 font-semibold">90 Days</div>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-orange-200/80 shadow-2xs">
                      <div className="text-[9px] font-bold text-orange-600 uppercase">Pro</div>
                      <div className="text-xs font-black text-gray-900">
                        {proPrice != null ? `£${proPrice}` : '—'}
                      </div>
                      <div className="text-[8px] text-orange-500 font-semibold">180 Days</div>
                    </div>
                    <div className="bg-white p-1.5 rounded-lg border border-purple-200/80 shadow-2xs">
                      <div className="text-[9px] font-bold text-purple-600 uppercase">Pro+</div>
                      <div className="text-xs font-black text-gray-900">
                        {proPlusPrice != null ? `£${proPlusPrice}` : '—'}
                      </div>
                      <div className="text-[8px] text-purple-500 font-semibold">Annual</div>
                    </div>
                  </div>
                </div>

                {plan.features && plan.features.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {plan.features.slice(0, 3).map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        {f}
                      </div>
                    ))}
                    {plan.features.length > 3 && (
                      <div className="text-[10px] text-gray-400">+{plan.features.length - 3} more</div>
                    )}
                  </div>
                )}
                {plan.configuration?.quotas && Object.keys(plan.configuration.quotas).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Configured Quotas</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(plan.configuration.quotas).map(([k, val]) => {
                        if (val === undefined || val === null || typeof val === 'boolean') return null;
                        return (
                          <span key={k} className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded text-[9px]">
                            {k.replace(/^max/, '')}: {val === -1 ? '∞' : String(val)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmColor,
  onConfirm,
  onClose,
  isSubmitting,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmColor?: string;
  onConfirm: () => void;
  onClose: () => void;
  isSubmitting?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
      >
        <div className="px-6 py-5">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className={cn(
              "flex-1 py-3 text-white rounded-xl font-bold text-sm transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
              confirmColor || "bg-red-500 hover:bg-red-600"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Processing...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

type VariantTierKey = 'STANDARD' | 'PRO' | 'PRO_PLUS';

interface TierData {
  price: number | undefined;
  features: string[];
  quotas: Record<string, any>;
  featureFlags: Record<string, boolean>;
}

function ExternalPlanFormModal({
  title,
  platform,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  platform: PlatformInfo;
  initial?: ExternalPlan;
  onClose: () => void;
  onSave: (data: CreateExternalPlanInput) => Promise<boolean>;
}) {
  const platformName = platform.name;
  const { data: schemaRes, isLoading: schemaLoading } = useExternalPlanSchema(platformName);
  const { data: seasonsRes, isLoading: seasonsLoading } = useExternalPlatformSeasons(platformName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [manualSeasonMode, setManualSeasonMode] = useState(false);
  const [activeTier, setActiveTier] = useState<VariantTierKey>('STANDARD');

  const buildInitialTierData = (tierKey: VariantTierKey): TierData => {
    if (initial) {
      // Find variant by tier
      const variant = (initial.variants || []).find(
        (v) => (v.tier || '').toUpperCase().replace('-', '_') === tierKey
      );
      if (variant) {
        return {
          price: variant.price,
          features: variant.features ? [...variant.features] : [],
          quotas: variant.configuration?.quotas ? JSON.parse(JSON.stringify(variant.configuration.quotas)) : {},
          featureFlags: variant.configuration?.featureFlags ? JSON.parse(JSON.stringify(variant.configuration.featureFlags)) : {},
        };
      }

      // Fallback from top-level fields
      const price =
        tierKey === 'STANDARD'
          ? (initial.tierPrices?.Standard ?? initial.monthlyPrice)
          : tierKey === 'PRO'
          ? (initial.tierPrices?.Pro ?? initial.quarterlyPrice)
          : (initial.tierPrices?.['Pro+'] ?? initial.annualPrice);

      const feats =
        tierKey === 'STANDARD'
          ? (initial.tierFeatures?.Standard ?? initial.features ?? [])
          : tierKey === 'PRO'
          ? (initial.tierFeatures?.Pro ?? initial.features ?? [])
          : (initial.tierFeatures?.['Pro+'] ?? initial.features ?? []);

      return {
        price: price != null ? Number(price) : undefined,
        features: [...feats],
        quotas: initial.configuration?.quotas ? JSON.parse(JSON.stringify(initial.configuration.quotas)) : {},
        featureFlags: initial.configuration?.featureFlags ? JSON.parse(JSON.stringify(initial.configuration.featureFlags)) : {},
      };
    }

    return {
      price: undefined,
      features: [],
      quotas: {},
      featureFlags: {},
    };
  };

  const [tiers, setTiers] = useState<Record<VariantTierKey, TierData>>({
    STANDARD: buildInitialTierData('STANDARD'),
    PRO: buildInitialTierData('PRO'),
    PRO_PLUS: buildInitialTierData('PRO_PLUS'),
  });

  const [basicInfo, setBasicInfo] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    type: initial?.type || 'STANDARD',
    isActive: initial?.isActive ?? true,
    isDefault: initial?.isDefault ?? false,
    trialDuration: initial?.trialDuration ?? undefined,
    seasonId: initial?.seasonId || undefined,
  });

  const [featureInput, setFeatureInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMall = platformName.toLowerCase().includes('mall');
  const isRewards = platformName.toLowerCase().includes('reward') || platformName.toLowerCase().includes('loyalty');
  const availableSeasons: ExternalSeason[] = seasonsRes?.data ?? [];

  // Schema-driven vs hardcoded fallback field definitions.
  const schema: PlanSchema | null = schemaRes?.data ?? null;
  const hasSchema = !!schema && (schema.quotas.length > 0 || schema.featureFlags.length > 0);

  const schemaQuotaFields = hasSchema ? schema!.quotas : [];
  const schemaFlagFields = hasSchema ? schema!.featureFlags : [];

  // Fallback (no schema) definitions for Mall / Rewards.
  const fallbackQuotaFields: PlanSchemaField[] = isMall
    ? [
        { key: 'maxListings', label: 'Max Listings', type: 'number', unlimited: true },
        { key: 'maxProducts', label: 'Max Products', type: 'number', unlimited: true },
        { key: 'maxServices', label: 'Max Services', type: 'number', unlimited: true },
        { key: 'maxGiftCardTemplates', label: 'Gift Card Templates', type: 'number', unlimited: true },
        { key: 'maxCouponTemplates', label: 'Coupon Templates', type: 'number', unlimited: true },
        { key: 'maxLoyaltyPrograms', label: 'Loyalty Programs', type: 'number', unlimited: true },
        { key: 'maxImagesPerListing', label: 'Images Per Listing', type: 'number', unlimited: false },
        { key: 'featuredListingAllowance', label: 'Featured Allowance', type: 'number', unlimited: false },
        { key: 'allowProductListing', label: 'Allow Product Listing', type: 'boolean' },
        { key: 'allowServiceListing', label: 'Allow Service Listing', type: 'boolean' },
      ]
    : isRewards
      ? [
          { key: 'maxActiveCampaigns', label: 'Max Active Campaigns', type: 'number', unlimited: true },
          { key: 'maxActiveRewards', label: 'Max Active Rewards', type: 'number', unlimited: true },
          { key: 'maxRewardsPerCampaign', label: 'Max Rewards Per Campaign', type: 'number', unlimited: false },
          { key: 'monthlyPointsAllowance', label: 'Monthly Points Allowance', type: 'number', unlimited: false },
          { key: 'monthlyStampsAllowance', label: 'Monthly Stamps Allowance', type: 'number', unlimited: false },
          { key: 'monthlyRewardBudget', label: 'Monthly Reward Budget (GBP)', type: 'number', unlimited: false },
          { key: 'maxTeamMembers', label: 'Max Team Members', type: 'number', unlimited: true },
          { key: 'maxRewardPoints', label: 'Max Reward Points', type: 'number', unlimited: false },
        ]
      : [];

  const fallbackFlagFields: PlanSchemaField[] = isMall
    ? [
        { key: 'priorityInSearch', label: 'Priority in Search', type: 'boolean' },
        { key: 'advancedAnalytics', label: 'Advanced Analytics', type: 'boolean' },
        { key: 'dedicatedSupport', label: 'Dedicated Support', type: 'boolean' },
        { key: 'allowCustomBranding', label: 'Custom Branding', type: 'boolean' },
        { key: 'allowGroupCreation', label: 'Group Creation', type: 'boolean' },
      ]
    : isRewards
      ? [
          { key: 'canCreateCampaignFromScratch', label: 'Create Campaign From Scratch', type: 'boolean' },
          { key: 'canEditAdminTemplates', label: 'Edit Admin Templates', type: 'boolean' },
          { key: 'hasAccessToAdvancedAnalytics', label: 'Advanced Analytics', type: 'boolean' },
          { key: 'hasAccessToCRM', label: 'CRM Access', type: 'boolean' },
          { key: 'canUpdateReward', label: 'Update Reward', type: 'boolean' },
          { key: 'canCreateRewardFromScratch', label: 'Create Reward From Scratch', type: 'boolean' },
        ]
      : [];

  const [customQuotaFields, setCustomQuotaFields] = useState<PlanSchemaField[]>([]);
  const [customFlagFields, setCustomFlagFields] = useState<PlanSchemaField[]>([]);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [customType, setCustomType] = useState<'number' | 'boolean'>('number');

  const quotaFields = [...(hasSchema ? schemaQuotaFields : fallbackQuotaFields), ...customQuotaFields];
  const flagFields = [...(hasSchema ? schemaFlagFields : fallbackFlagFields), ...customFlagFields];

  const currentTierData = tiers[activeTier];

  const updateCurrentTier = (updater: (prev: TierData) => TierData) => {
    setTiers((prev) => ({
      ...prev,
      [activeTier]: updater(prev[activeTier]),
    }));
  };

  const copyFromStandard = () => {
    const standard = tiers.STANDARD;
    updateCurrentTier((prev) => ({
      ...prev,
      features: [...standard.features],
      quotas: JSON.parse(JSON.stringify(standard.quotas)),
      featureFlags: JSON.parse(JSON.stringify(standard.featureFlags)),
    }));
  };

  const addCustomField = () => {
    const key = customKeyInput.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key) return;
    if (customType === 'boolean') {
      if (!flagFields.some((f) => f.key === key)) {
        setCustomFlagFields((prev) => [...prev, { key, label: key, type: 'boolean' }]);
      }
    } else {
      if (!quotaFields.some((f) => f.key === key)) {
        setCustomQuotaFields((prev) => [...prev, { key, label: key, type: 'number', unlimited: false }]);
      }
    }
    setCustomKeyInput('');
  };

  const removeCustomField = (key: string) => {
    setCustomQuotaFields((prev) => prev.filter((f) => f.key !== key));
    setCustomFlagFields((prev) => prev.filter((f) => f.key !== key));
    setTiers((prev) => {
      const copy = { ...prev };
      for (const t of ['STANDARD', 'PRO', 'PRO_PLUS'] as VariantTierKey[]) {
        const q = { ...copy[t].quotas };
        const ff = { ...copy[t].featureFlags };
        delete q[key];
        delete ff[key];
        copy[t] = { ...copy[t], quotas: q, featureFlags: ff };
      }
      return copy;
    });
  };

  const addFeature = () => {
    const val = featureInput.trim();
    if (val && !currentTierData.features.includes(val)) {
      updateCurrentTier((prev) => ({ ...prev, features: [...prev.features, val] }));
      setFeatureInput('');
    }
  };

  const isUnlimited = (key: string): boolean => {
    return currentTierData.quotas?.[key] === -1;
  };

  const getQuotaDisplayValue = (key: string): string => {
    const val = currentTierData.quotas?.[key];
    if (val === -1 || val === undefined || typeof val === 'boolean') return '';
    return String(val);
  };

  const toggleUnlimited = (key: string) => {
    updateCurrentTier((prev) => {
      const currentVal = prev.quotas?.[key];
      const newVal = currentVal === -1 ? undefined : -1;
      return {
        ...prev,
        quotas: {
          ...prev.quotas,
          [key]: newVal,
        },
      };
    });
  };

  const updateQuota = (key: string, value: string) => {
    updateCurrentTier((prev) => {
      const numVal = value === '' ? undefined : parseInt(value);
      if (numVal !== undefined && numVal < 0) return prev;
      return {
        ...prev,
        quotas: {
          ...prev.quotas,
          [key]: numVal,
        },
      };
    });
  };

  const toggleQuotaBoolean = (key: string) => {
    updateCurrentTier((prev) => {
      const currentVal = prev.quotas?.[key];
      return {
        ...prev,
        quotas: {
          ...prev.quotas,
          [key]: currentVal ? undefined : true,
        },
      };
    });
  };

  const updateFeatureFlag = (key: string, value: boolean) => {
    updateCurrentTier((prev) => ({
      ...prev,
      featureFlags: {
        ...prev.featureFlags,
        [key]: value,
      },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!basicInfo.name.trim()) {
      newErrors.name = 'Plan family name is required';
    }

    if (basicInfo.type === 'TRIAL' && (!basicInfo.trialDuration || basicInfo.trialDuration < 1)) {
      newErrors.trialDuration = 'Trial duration is required (min 1 day)';
    }

    if (basicInfo.type === 'SEASONAL' && !basicInfo.seasonId) {
      newErrors.seasonId = 'Season ID is required for seasonal plans';
    }

    if (basicInfo.type !== 'TRIAL') {
      if (tiers.STANDARD.price === undefined) newErrors.standardPrice = 'Standard price is required';
      if (tiers.PRO.price === undefined) newErrors.proPrice = 'Pro price is required';
      if (tiers.PRO_PLUS.price === undefined) newErrors.proPlusPrice = 'Pro+ price is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const slug = basicInfo.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const payload: CreateExternalPlanInput = {
      name: basicInfo.name,
      slug,
      platform: platformName,
      description: basicInfo.description,
      type: basicInfo.type,
      isActive: basicInfo.isActive,
      isDefault: basicInfo.isDefault,
      trialDuration: basicInfo.trialDuration,
      seasonId: basicInfo.seasonId,
      // 3-variant matrix structure
      variants: [
        {
          tier: 'STANDARD',
          price: tiers.STANDARD.price ?? 0,
          features: tiers.STANDARD.features,
          configuration: {
            quotas: tiers.STANDARD.quotas,
            featureFlags: tiers.STANDARD.featureFlags,
          },
        },
        {
          tier: 'PRO',
          price: tiers.PRO.price ?? 0,
          features: tiers.PRO.features,
          configuration: {
            quotas: tiers.PRO.quotas,
            featureFlags: tiers.PRO.featureFlags,
          },
        },
        {
          tier: 'PRO_PLUS',
          price: tiers.PRO_PLUS.price ?? 0,
          features: tiers.PRO_PLUS.features,
          configuration: {
            quotas: tiers.PRO_PLUS.quotas,
            featureFlags: tiers.PRO_PLUS.featureFlags,
          },
        },
      ],
      // Backwards-compatible top-level properties
      monthlyPrice: tiers.STANDARD.price,
      quarterlyPrice: tiers.PRO.price,
      annualPrice: tiers.PRO_PLUS.price,
      features: tiers.STANDARD.features,
      configuration: {
        quotas: tiers.STANDARD.quotas,
        featureFlags: tiers.STANDARD.featureFlags,
      },
    };

    try {
      const success = await onSave(payload);
      if (success) onClose();
    } catch (e: any) {
      setSubmitError(e?.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20";
  const fieldErrorClass = "border-red-300 focus:ring-red-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-blue" />
            <div>
              <h4 className="text-lg font-bold">{title}</h4>
              <p className="text-xs text-gray-400 font-medium">Atomic 3-Variant Matrix (Standard, Pro, Pro+)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Plan Family Header */}
          <div className="space-y-4 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan Family Information</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Plan Family Name" error={errors.name}>
                <input
                  value={basicInfo.name}
                  onChange={(e) => {
                    setBasicInfo((prev) => ({ ...prev, name: e.target.value }));
                    setErrors((prev) => ({ ...prev, name: '' }));
                  }}
                  className={cn(fieldClass, "bg-white", errors.name && fieldErrorClass)}
                  placeholder="e.g. Gold, Starter, Growth"
                />
              </Field>
              <Field label="Type">
                <select
                  value={basicInfo.type}
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, type: e.target.value }))}
                  className={cn(fieldClass, "bg-white")}
                >
                  <option value="STANDARD">Standard Matrix</option>
                  <option value="TRIAL">Free Trial</option>
                  <option value="SEASONAL">Seasonal</option>
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input
                value={basicInfo.description}
                onChange={(e) => setBasicInfo((prev) => ({ ...prev, description: e.target.value }))}
                className={cn(fieldClass, "bg-white")}
                placeholder="High-level marketing summary of the plan family"
              />
            </Field>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={basicInfo.isActive}
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded text-brand-blue border-gray-300"
                />
                <span className="text-xs font-bold text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={basicInfo.isDefault}
                  onChange={(e) => setBasicInfo((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  className="w-4 h-4 rounded text-brand-blue border-gray-300"
                />
                <span className="text-xs font-bold text-gray-700">Default Tier</span>
              </label>
            </div>
          </div>

          {/* 3-Variant Tier Navigator */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand-blue" />
                Configure 3 Tier Variants
              </h5>
              {activeTier !== 'STANDARD' && (
                <button
                  type="button"
                  onClick={copyFromStandard}
                  className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
                >
                  Copy features & quotas from Standard
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 bg-gray-100 p-1.5 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setActiveTier('STANDARD')}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-0.5",
                  activeTier === 'STANDARD'
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <span>STANDARD</span>
                <span className="text-[9px] font-bold text-gray-400">90 Days</span>
                {tiers.STANDARD.price != null && (
                  <span className="text-[10px] font-black text-brand-blue">£{tiers.STANDARD.price}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTier('PRO')}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-0.5",
                  activeTier === 'PRO'
                    ? "bg-white text-orange-600 shadow-sm border border-orange-200"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <span>PRO</span>
                <span className="text-[9px] font-bold text-orange-400">180 Days</span>
                {tiers.PRO.price != null && (
                  <span className="text-[10px] font-black text-orange-600">£{tiers.PRO.price}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTier('PRO_PLUS')}
                className={cn(
                  "py-2.5 px-3 rounded-xl text-xs font-black transition-all flex flex-col items-center gap-0.5",
                  activeTier === 'PRO_PLUS'
                    ? "bg-white text-purple-600 shadow-sm border border-purple-200"
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                <span>PRO+</span>
                <span className="text-[9px] font-bold text-purple-400">Annual (Leap-Safe)</span>
                {tiers.PRO_PLUS.price != null && (
                  <span className="text-[10px] font-black text-purple-600">£{tiers.PRO_PLUS.price}</span>
                )}
              </button>
            </div>

            {/* Active Tier Configuration Box */}
            <div className="space-y-5 border border-gray-200 p-5 rounded-2xl bg-white shadow-2xs">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-black uppercase",
                    activeTier === 'STANDARD' ? "bg-blue-100 text-brand-blue" :
                    activeTier === 'PRO' ? "bg-orange-100 text-orange-700" :
                    "bg-purple-100 text-purple-700"
                  )}>
                    {activeTier === 'PRO_PLUS' ? 'Pro+' : activeTier} Variant
                  </span>
                  <span className="text-xs text-gray-400 font-semibold">
                    Duration: {activeTier === 'STANDARD' ? '90 Days' : activeTier === 'PRO' ? '180 Days' : '1 Calendar Year'}
                  </span>
                </div>
              </div>

              {/* Price */}
              <Field
                label={`Price for ${activeTier === 'PRO_PLUS' ? 'Pro+' : activeTier} Duration (£ GBP)`}
                error={
                  activeTier === 'STANDARD'
                    ? errors.standardPrice
                    : activeTier === 'PRO'
                    ? errors.proPrice
                    : errors.proPlusPrice
                }
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentTierData.price ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value) : undefined;
                    updateCurrentTier((prev) => ({ ...prev, price: val }));
                    setErrors((prev) => ({
                      ...prev,
                      standardPrice: '',
                      proPrice: '',
                      proPlusPrice: '',
                    }));
                  }}
                  className={cn(
                    fieldClass,
                    (activeTier === 'STANDARD' ? errors.standardPrice : activeTier === 'PRO' ? errors.proPrice : errors.proPlusPrice) && fieldErrorClass
                  )}
                  placeholder="e.g. 59.99"
                />
              </Field>

              {/* Display Features */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Display Bullet Points ({activeTier === 'PRO_PLUS' ? 'Pro+' : activeTier})
                </h5>
                <div className="space-y-2">
                  {currentTierData.features.map((f: string, i: number) => (
                    <div key={`${f}-${i}`} className="flex items-center gap-2">
                      <input
                        value={f}
                        onChange={(e) => {
                          const arr = [...currentTierData.features];
                          arr[i] = e.target.value;
                          updateCurrentTier((prev) => ({ ...prev, features: arr }));
                        }}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                      />
                      <button
                        onClick={() =>
                          updateCurrentTier((prev) => ({
                            ...prev,
                            features: prev.features.filter((_, j) => j !== i),
                          }))
                        }
                        className="p-2 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      placeholder={`Add a bullet for ${activeTier}...`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addFeature();
                        }
                      }}
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                    <button
                      type="button"
                      onClick={addFeature}
                      className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quotas & Flags */}
              {schemaLoading ? (
                <div className="flex items-center justify-center py-6 text-gray-400 bg-gray-50 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading plan schema...
                </div>
              ) : (
                <div className="space-y-4 pt-3 border-t border-gray-100">
                  {quotaFields.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Enforced Numeric Quotas ({activeTier === 'PRO_PLUS' ? 'Pro+' : activeTier})
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {quotaFields.map((field) =>
                          field.type === 'boolean' ? (
                            <button
                              key={field.key}
                              type="button"
                              onClick={() => toggleQuotaBoolean(field.key)}
                              className={cn(
                                "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between gap-2",
                                currentTierData.quotas?.[field.key]
                                  ? "bg-green-50 border-green-200 text-green-700"
                                  : "bg-gray-50 border-gray-200 text-gray-400"
                              )}
                            >
                              <span>{field.label}</span>
                            </button>
                          ) : (
                            <div key={field.key} className="bg-gray-50 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[9px] font-bold text-gray-400 uppercase">{field.label}</div>
                                {field.unlimited && (
                                  <label className="flex items-center gap-1 cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isUnlimited(field.key)}
                                      onChange={() => toggleUnlimited(field.key)}
                                      className="w-3 h-3 rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20"
                                    />
                                    <span className="text-[9px] font-bold text-gray-400">Unlimited</span>
                                  </label>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getQuotaDisplayValue(field.key)}
                                onChange={(e) => updateQuota(field.key, e.target.value)}
                                disabled={isUnlimited(field.key)}
                                placeholder={isUnlimited(field.key) ? 'Unlimited' : '0'}
                                className={cn(
                                  "w-full bg-transparent border-none focus:ring-0 text-sm font-bold",
                                  isUnlimited(field.key) && "opacity-40 cursor-not-allowed"
                                )}
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {flagFields.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        Feature Permissions & Capabilities
                      </h5>
                      <div className="grid grid-cols-2 gap-3">
                        {flagFields.map((field) => (
                          <button
                            key={field.key}
                            type="button"
                            onClick={() => updateFeatureFlag(field.key, !currentTierData.featureFlags?.[field.key])}
                            className={cn(
                              "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left flex items-center justify-between gap-2",
                              currentTierData.featureFlags?.[field.key]
                                ? "bg-green-50 border-green-200 text-green-700"
                                : "bg-gray-50 border-gray-200 text-gray-400"
                            )}
                          >
                            <span>{field.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 space-y-3 sticky bottom-0 bg-white z-20">
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs font-bold text-red-600">
              {submitError}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {initial ? 'Saving...' : 'Creating Plan Family...'}
                </>
              ) : initial ? (
                'Save All 3 Variants'
              ) : (
                `Create 3-Tier Plan on ${platformName}`
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PackageFormModal({ title, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(
    initial || {
      name: '',
      platform: 'MCOM Solutions',
      description: '',
      price: 0,
      monthlyPrice: 0,
      quarterlyPrice: 0,
      annualPrice: 0,
      billingCycle: 'Monthly',
      features: [],
      usageLimits: { members: 0, products: 0, orders: 0, spins: 0, prizes: 0, audits: 0, templates: 0, booth: 1, media: 0 },
      accessRights: [],
      archived: false,
    }
  );
  const [newFeature, setNewFeature] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h4 className="text-lg font-bold">{title}</h4>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Field label="Package Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Platform">
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {['MCOM Solutions', 'MCOM Rewards', 'MCOM Spin', 'GBS Audit', 'GBS Expo'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Billing Cycle">
              <select
                value={form.billingCycle}
                onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {['Monthly', 'Quarterly', 'Yearly'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-16 resize-none"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Monthly (£)">
              <input
                type="number"
                value={form.monthlyPrice ?? form.price ?? 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setForm({
                    ...form,
                    price: val,
                    monthlyPrice: val,
                    quarterlyPrice: form.quarterlyPrice || Math.floor(val * 0.9) * 3,
                    annualPrice: form.annualPrice || Math.floor(val * 0.8) * 12,
                  });
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </Field>
            <Field label="Quarterly (£)">
              <input
                type="number"
                value={form.quarterlyPrice ?? 0}
                onChange={(e) => setForm({ ...form, quarterlyPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </Field>
            <Field label="Annual (£)">
              <input
                type="number"
                value={form.annualPrice ?? 0}
                onChange={(e) => setForm({ ...form, annualPrice: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </Field>
          </div>
          <Field label="Features">
            <div className="space-y-2">
              {form.features.map((f: string, i: number) => (
                <div key={`${f}-${i}`} className="flex items-center gap-2">
                  <input
                    value={f}
                    onChange={(e) => {
                      const arr = [...form.features];
                      arr[i] = e.target.value;
                      setForm({ ...form, features: arr });
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <button
                    onClick={() =>
                      setForm({ ...form, features: form.features.filter((_: any, j: number) => j !== i) })
                    }
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  placeholder="Add feature..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newFeature.trim()) {
                      setForm({ ...form, features: [...form.features, newFeature.trim()] });
                      setNewFeature('');
                    }
                  }}
                  className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Field>
          <Field label="Access Rights">
            <MultiSelect
              options={[
                'Store Admin',
                'Marketing Admin',
                'Analytics',
                'View Analytics',
                'Export Data',
                'Spin Admin',
                'Audit Access',
                'Expo Admin',
              ]}
              selected={form.accessRights}
              onChange={(v: any) => setForm({ ...form, accessRights: v })}
            />
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow"
          >
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children, error }: { key?: string; label: string; children: ReactNode; error?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 block">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 font-medium pl-2">{error}</p>}
    </div>
  );
}

function MultiSelect({ options, selected, onChange }: any) {
  return <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">{
    options.map((o: string) => (
      <button key={o} type="button" onClick={() => onChange(selected.includes(o) ? selected.filter((x: string) => x !== o) : [...selected, o])}
        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", selected.includes(o) ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-100")}>{o}</button>
    ))
  }</div>;
}
