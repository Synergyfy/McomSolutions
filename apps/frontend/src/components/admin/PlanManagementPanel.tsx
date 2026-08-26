import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Trash2, Edit3, Package, Gem, Archive, ExternalLink, Loader2, Trophy, Layers } from 'lucide-react';
import { cn } from '../../lib/utils';
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
  PlatformInfo,
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
  const [addPlatformPlan, setAddPlatformPlan] = useState<string | null>(null);
  const [editExternalPlan, setEditExternalPlan] = useState<{ plan: ExternalPlan; platform: string } | null>(null);
  const [confirmEditPlan, setConfirmEditPlan] = useState<{ plan: ExternalPlan; platform: string } | null>(null);
  const [deleteExternalPlanTarget, setDeleteExternalPlanTarget] = useState<{ plan: ExternalPlan; platform: string } | null>(null);

  const membershipPlans = plansRes?.data ?? [];
  const packages = packagesRes?.data ?? [];
  const platforms: PlatformInfo[] = platformsRes?.data ?? [
    { name: 'MCOM Mall', clientId: 'mcom-mall', platformSlug: 'mall', isNamed: true, hasBillingApi: true },
    { name: 'MCOM Rewards', clientId: 'mcom-loyalty', platformSlug: 'rewards', isNamed: true, hasBillingApi: true },
  ];

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
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
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
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold text-gray-900">£{plan.price}</span>
                    <span className="text-xs text-gray-400">/{plan.billingCycle.toLowerCase()}</span>
                  </div>
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
                onAddPlan={() => setAddPlatformPlan(platform.name)}
                onEditPlan={(plan) => setConfirmEditPlan({ plan, platform: platform.name })}
                onDeletePlan={(plan) => setDeleteExternalPlanTarget({ plan, platform: platform.name })}
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
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-xl font-bold">£{pkg.price}</span>
                      <span className="text-xs text-gray-400">/{pkg.billingCycle.toLowerCase()}</span>
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
          <PlanFormModal
            title="Create Membership"
            onClose={() => setShowAddMembership(false)}
            onSave={(data: CreatePlanInput) => {
              createPlan.mutate(data);
              setShowAddMembership(false);
            }}
          />
        )}
        {editMembership && (
          <PlanFormModal
            title="Edit Membership"
            initial={membershipPlans.find((p) => p.id === editMembership)}
            onClose={() => setEditMembership(null)}
            onSave={(data: Partial<CreatePlanInput>) => {
              updatePlan.mutate({ id: editMembership!, data });
              setEditMembership(null);
            }}
          />
        )}

        {/* Local Package Modals */}
        {showAddPackage && (
          <PackageFormModal
            title="Create Local Package"
            onClose={() => setShowAddPackage(false)}
            onSave={(data: CreatePackageInput) => {
              createPackage.mutate(data);
              setShowAddPackage(false);
            }}
          />
        )}
        {editPackage !== null && (
          <PackageFormModal
            title="Edit Local Package"
            initial={packages.find((p) => p.id === editPackage)}
            onClose={() => setEditPackage(null)}
            onSave={(data: Partial<CreatePackageInput>) => {
              updatePackage.mutate({ id: editPackage!.toString(), data });
              setEditPackage(null);
            }}
          />
        )}

        {/* Dynamic External Plan Modals */}
        {addPlatformPlan && (
          <ExternalPlanFormModal
            title={`Create ${addPlatformPlan} Plan`}
            platformName={addPlatformPlan}
            onClose={() => setAddPlatformPlan(null)}
            onSave={(data: CreateExternalPlanInput) =>
              createExternalPlan.mutateAsync(data).then(() => true).catch(() => false)
            }
          />
        )}
        {editExternalPlan && (
          <ExternalPlanFormModal
            title={`Edit ${editExternalPlan.platform} Plan`}
            platformName={editExternalPlan.platform}
            initial={editExternalPlan.plan}
            onClose={() => setEditExternalPlan(null)}
            onSave={(data: Partial<CreateExternalPlanInput>) =>
              updateExternalPlan
                .mutateAsync({ id: editExternalPlan.plan.id, platform: editExternalPlan.platform, data })
                .then(() => true)
                .catch(() => false)
            }
          />
        )}

        {/* Confirm External Plan Modals */}
        {confirmEditPlan && (
          <ConfirmModal
            title="Edit Plan"
            message={`You're about to edit "${confirmEditPlan.plan.name}" on ${confirmEditPlan.platform}. Do you want to proceed?`}
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
            message={`Are you sure you want to delete "${deleteExternalPlanTarget.plan.name}" from ${deleteExternalPlanTarget.platform}? This action cannot be undone.`}
            confirmLabel="Yes, Delete"
            isSubmitting={deleteExternalPlan.isPending}
            onConfirm={() => {
              deleteExternalPlan.mutate(
                { id: deleteExternalPlanTarget.plan.id, platform: deleteExternalPlanTarget.platform },
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
          {plans.map((plan: ExternalPlan) => (
            <div key={plan.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-bold text-gray-900">{plan.name}</h4>
                  <p className="text-xs text-gray-500">{plan.description}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-brand-blue rounded text-[9px] font-bold">
                    {plan.type || 'STANDARD'}
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
              <div className="flex items-baseline gap-3 mb-3">
                {plan.monthlyPrice != null && (
                  <div>
                    <span className="text-xl font-bold">£{plan.monthlyPrice}</span>
                    <span className="text-[10px] text-gray-400">/mo</span>
                  </div>
                )}
                {plan.quarterlyPrice != null && (
                  <div>
                    <span className="text-xl font-bold">£{plan.quarterlyPrice}</span>
                    <span className="text-[10px] text-gray-400">/qtr</span>
                  </div>
                )}
                {plan.annualPrice != null && (
                  <div>
                    <span className="text-xl font-bold">£{plan.annualPrice}</span>
                    <span className="text-[10px] text-gray-400">/yr</span>
                  </div>
                )}
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
          ))}
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

function ExternalPlanFormModal({
  title,
  platformName,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  platformName: string;
  initial?: ExternalPlan;
  onClose: () => void;
  onSave: (data: CreateExternalPlanInput) => Promise<boolean>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const buildInitialState = (): CreateExternalPlanInput => {
    if (initial) {
      return {
        name: initial.name || '',
        platform: platformName,
        description: initial.description || '',
        monthlyPrice: initial.monthlyPrice ?? undefined,
        quarterlyPrice: initial.quarterlyPrice ?? undefined,
        annualPrice: initial.annualPrice ?? undefined,
        features: initial.features ? [...initial.features] : [],
        configuration: initial.configuration ? JSON.parse(JSON.stringify(initial.configuration)) : {},
        isActive: initial.isActive ?? true,
        isDefault: initial.isDefault ?? false,
        type: initial.type || 'STANDARD',
        trialDuration: initial.trialDuration ?? undefined,
        seasonId: initial.seasonId || undefined,
      };
    }
    return {
      name: '',
      platform: platformName,
      description: '',
      monthlyPrice: undefined,
      quarterlyPrice: undefined,
      annualPrice: undefined,
      features: [],
      configuration: {},
      isActive: true,
      isDefault: false,
      type: 'STANDARD',
    };
  };

  const [form, setForm] = useState<CreateExternalPlanInput>(buildInitialState);
  const [featureInput, setFeatureInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isMall = platformName.toLowerCase().includes('mall');
  const isRewards = platformName.toLowerCase().includes('reward') || platformName.toLowerCase().includes('loyalty');

  const addFeature = () => {
    const val = featureInput.trim();
    if (val && !form.features?.includes(val)) {
      setForm((prev) => ({ ...prev, features: [...(prev.features || []), val] }));
      setFeatureInput('');
    }
  };

  const removeFeature = (f: string) =>
    setForm((prev) => ({ ...prev, features: (prev.features || []).filter((x) => x !== f) }));

  const isUnlimited = (key: string): boolean => {
    return form.configuration?.quotas?.[key as keyof typeof form.configuration.quotas] === -1;
  };

  const getQuotaDisplayValue = (key: string): string => {
    const val = form.configuration?.quotas?.[key as keyof typeof form.configuration.quotas];
    if (val === -1 || val === undefined || typeof val === 'boolean') return '';
    return String(val);
  };

  const toggleUnlimited = (key: string) => {
    setForm((prev) => {
      const currentVal = prev.configuration?.quotas?.[key as keyof typeof prev.configuration.quotas];
      const newVal = currentVal === -1 ? undefined : -1;
      return {
        ...prev,
        configuration: {
          ...prev.configuration,
          quotas: {
            ...prev.configuration?.quotas,
            [key]: newVal,
          },
        },
      };
    });
  };

  const updateQuota = (key: string, value: string) => {
    setForm((prev) => {
      const numVal = value === '' ? undefined : parseInt(value);
      if (numVal !== undefined && numVal < 0) return prev;
      return {
        ...prev,
        configuration: {
          ...prev.configuration,
          quotas: {
            ...prev.configuration?.quotas,
            [key]: numVal,
          },
        },
      };
    });
  };

  const updateFeatureFlag = (key: string, value: boolean) => {
    setForm((prev) => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        featureFlags: {
          ...prev.configuration?.featureFlags,
          [key]: value,
        },
      },
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'Plan name is required';
    }

    if (form.type === 'TRIAL' && (!form.trialDuration || form.trialDuration < 1)) {
      newErrors.trialDuration = 'Trial duration is required (min 1 day)';
    }

    if (form.type === 'SEASONAL' && !form.seasonId) {
      newErrors.seasonId = 'Season ID is required for seasonal plans';
    }

    const hasAnyPrice = form.monthlyPrice != null || form.quarterlyPrice != null || form.annualPrice != null;
    if (!hasAnyPrice && form.type !== 'TRIAL') {
      newErrors.pricing = 'At least one price is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const success = await onSave(form);
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

  // Mall Quota definitions
  const mallQuotas = [
    { key: 'maxListings', label: 'Max Listings', unlimited: true },
    { key: 'maxProducts', label: 'Max Products', unlimited: true },
    { key: 'maxServices', label: 'Max Services', unlimited: true },
    { key: 'maxGiftCardTemplates', label: 'Gift Card Templates', unlimited: true },
    { key: 'maxCouponTemplates', label: 'Coupon Templates', unlimited: true },
    { key: 'maxLoyaltyPrograms', label: 'Loyalty Programs', unlimited: true },
    { key: 'maxImagesPerListing', label: 'Images Per Listing', unlimited: false },
    { key: 'featuredListingAllowance', label: 'Featured Allowance', unlimited: false },
  ];

  // Rewards Quota definitions
  const rewardsQuotas = [
    { key: 'maxActiveCampaigns', label: 'Max Active Campaigns', unlimited: true },
    { key: 'maxActiveRewards', label: 'Max Active Rewards', unlimited: true },
    { key: 'maxRewardsPerCampaign', label: 'Max Rewards Per Campaign', unlimited: false },
    { key: 'monthlyPointsAllowance', label: 'Monthly Points Allowance', unlimited: false },
    { key: 'monthlyStampsAllowance', label: 'Monthly Stamps Allowance', unlimited: false },
    { key: 'monthlyRewardBudget', label: 'Monthly Reward Budget (GBP)', unlimited: false },
    { key: 'maxTeamMembers', label: 'Max Team Members', unlimited: true },
    { key: 'maxRewardPoints', label: 'Max Reward Points', unlimited: false },
  ];

  const mallFlags = [
    { key: 'priorityInSearch', label: 'Priority in Search' },
    { key: 'advancedAnalytics', label: 'Advanced Analytics' },
    { key: 'dedicatedSupport', label: 'Dedicated Support' },
    { key: 'allowCustomBranding', label: 'Custom Branding' },
    { key: 'allowGroupCreation', label: 'Group Creation' },
  ];

  const rewardsFlags = [
    { key: 'canCreateCampaignFromScratch', label: 'Create Campaign From Scratch' },
    { key: 'canEditAdminTemplates', label: 'Edit Admin Templates' },
    { key: 'hasAccessToAdvancedAnalytics', label: 'Advanced Analytics' },
    { key: 'hasAccessToCRM', label: 'CRM Access' },
    { key: 'canUpdateReward', label: 'Update Reward' },
    { key: 'canCreateRewardFromScratch', label: 'Create Reward From Scratch' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-brand-blue" />
            <h4 className="text-lg font-bold">{title}</h4>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Basic Info */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Basic Info</h5>
            <Field label="Plan Name" error={errors.name}>
              <input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                  setErrors((prev) => ({ ...prev, name: '' }));
                }}
                className={cn(fieldClass, errors.name && fieldErrorClass)}
                placeholder={`e.g. ${platformName} Starter`}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={form.description || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className={cn(fieldClass, "h-20 resize-none")}
                placeholder="Tier description and summary"
              />
            </Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Type">
                <select
                  value={form.type || 'STANDARD'}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, type: e.target.value }));
                    setErrors((prev) => ({ ...prev, trialDuration: '', seasonId: '' }));
                  }}
                  className={fieldClass}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="TRIAL">Trial</option>
                  <option value="SEASONAL">Seasonal</option>
                </select>
              </Field>
              <Field label="Active">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold border transition-all",
                    form.isActive
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  )}
                >
                  {form.isActive ? 'Yes' : 'No'}
                </button>
              </Field>
              <Field label="Default">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, isDefault: !prev.isDefault }))}
                  className={cn(
                    "w-full py-3 rounded-xl text-sm font-bold border transition-all",
                    form.isDefault
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  )}
                >
                  {form.isDefault ? 'Yes' : 'No'}
                </button>
              </Field>
            </div>
            {form.type === 'TRIAL' && (
              <Field label="Trial Duration (days)" error={errors.trialDuration}>
                <input
                  type="number"
                  min="1"
                  value={form.trialDuration || ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, trialDuration: parseInt(e.target.value) || undefined }));
                    setErrors((prev) => ({ ...prev, trialDuration: '' }));
                  }}
                  className={cn(fieldClass, errors.trialDuration && fieldErrorClass)}
                  placeholder="14"
                />
              </Field>
            )}
            {form.type === 'SEASONAL' && (
              <Field label="Season ID" error={errors.seasonId}>
                <input
                  value={form.seasonId || ''}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, seasonId: e.target.value }));
                    setErrors((prev) => ({ ...prev, seasonId: '' }));
                  }}
                  className={cn(fieldClass, errors.seasonId && fieldErrorClass)}
                  placeholder="Valid season UUID"
                />
              </Field>
            )}
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pricing (£ GBP)</h5>
            {errors.pricing && <p className="text-xs text-red-500 font-medium">{errors.pricing}</p>}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Monthly (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthlyPrice ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      monthlyPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }));
                    setErrors((prev) => ({ ...prev, pricing: '' }));
                  }}
                  className={cn(fieldClass, errors.pricing && fieldErrorClass)}
                  placeholder="29.99"
                />
              </Field>
              <Field label="Quarterly (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.quarterlyPrice ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      quarterlyPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }));
                    setErrors((prev) => ({ ...prev, pricing: '' }));
                  }}
                  className={cn(fieldClass, errors.pricing && fieldErrorClass)}
                  placeholder="79.99"
                />
              </Field>
              <Field label="Annual (£)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.annualPrice ?? ''}
                  onChange={(e) => {
                    setForm((prev) => ({
                      ...prev,
                      annualPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                    }));
                    setErrors((prev) => ({ ...prev, pricing: '' }));
                  }}
                  className={cn(fieldClass, errors.pricing && fieldErrorClass)}
                  placeholder="299.99"
                />
              </Field>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Features</h5>
            <div className="space-y-2">
              {(form.features || []).map((f: string, i: number) => (
                <div key={`${f}-${i}`} className="flex items-center gap-2">
                  <input
                    value={f}
                    onChange={(e) => {
                      const arr = [...(form.features || [])];
                      arr[i] = e.target.value;
                      setForm((prev) => ({ ...prev, features: arr }));
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <button
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        features: (prev.features || []).filter((_: any, j: number) => j !== i),
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
                  placeholder="Add a feature..."
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

          {/* Quotas for Mall */}
          {isMall && (
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mall Quotas</h5>
              <div className="grid grid-cols-2 gap-3">
                {mallQuotas.map(({ key, label, unlimited }) => {
                  const isUnlimitedChecked = isUnlimited(key);
                  return (
                    <div key={key} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[9px] font-bold text-gray-400 uppercase">{label}</div>
                        {unlimited && (
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isUnlimitedChecked}
                              onChange={() => toggleUnlimited(key)}
                              className="w-3 h-3 rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20"
                            />
                            <span className="text-[9px] font-bold text-gray-400">Unlimited</span>
                          </label>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={getQuotaDisplayValue(key)}
                        onChange={(e) => updateQuota(key, e.target.value)}
                        disabled={isUnlimitedChecked}
                        placeholder={isUnlimitedChecked ? 'Unlimited' : '0'}
                        className={cn(
                          "w-full bg-transparent border-none focus:ring-0 text-sm font-bold",
                          isUnlimitedChecked && "opacity-40 cursor-not-allowed"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'allowProductListing', label: 'Allow Product Listing' },
                  { key: 'allowServiceListing', label: 'Allow Service Listing' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      const currentVal = form.configuration?.quotas?.[key as keyof typeof form.configuration.quotas];
                      setForm((prev) => ({
                        ...prev,
                        configuration: {
                          ...prev.configuration,
                          quotas: {
                            ...prev.configuration?.quotas,
                            [key]: currentVal ? undefined : true,
                          },
                        },
                      }));
                    }}
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left",
                      form.configuration?.quotas?.[key as keyof typeof form.configuration.quotas]
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quotas for Rewards */}
          {isRewards && (
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rewards Quotas</h5>
              <div className="grid grid-cols-2 gap-3">
                {rewardsQuotas.map(({ key: quotaKey, label, unlimited }) => {
                  const isUnlimitedChecked = isUnlimited(quotaKey);
                  return (
                    <div key={quotaKey} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[9px] font-bold text-gray-400 uppercase">{label}</div>
                        {unlimited && (
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isUnlimitedChecked}
                              onChange={() => toggleUnlimited(quotaKey)}
                              className="w-3 h-3 rounded border-gray-300 text-brand-blue focus:ring-brand-blue/20"
                            />
                            <span className="text-[9px] font-bold text-gray-400">Unlimited</span>
                          </label>
                        )}
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={getQuotaDisplayValue(quotaKey)}
                        onChange={(e) => updateQuota(quotaKey, e.target.value)}
                        disabled={isUnlimitedChecked}
                        placeholder={isUnlimitedChecked ? 'Unlimited' : '0'}
                        className={cn(
                          "w-full bg-transparent border-none focus:ring-0 text-sm font-bold",
                          isUnlimitedChecked && "opacity-40 cursor-not-allowed"
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Feature Flags */}
          {(isMall || isRewards) && (
            <div className="space-y-4">
              <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Feature Flags</h5>
              <div className="grid grid-cols-2 gap-3">
                {(isMall ? mallFlags : rewardsFlags).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateFeatureFlag(
                        key,
                        !form.configuration?.featureFlags?.[key as keyof typeof form.configuration.featureFlags]
                      )
                    }
                    className={cn(
                      "py-2 px-3 rounded-xl text-xs font-bold border transition-all text-left",
                      form.configuration?.featureFlags?.[key as keyof typeof form.configuration.featureFlags]
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-gray-50 border-gray-200 text-gray-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 space-y-3 sticky bottom-0 bg-white">
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
                  {initial ? 'Saving...' : 'Creating...'}
                </>
              ) : initial ? (
                'Save Changes'
              ) : (
                `Create on ${platformName}`
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PlanFormModal({ title, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(initial || { name: '', description: '', price: 0, billingCycle: 'Monthly', platformAccess: [], usageLimits: { rewards: 0, campaigns: 0, stores: 0, spins: 0, audits: 0, expos: 0 }, permissions: [], archived: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white"><h4 className="text-lg font-bold">{title}</h4><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-6 space-y-4">
          <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-20 resize-none" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (£)"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
            <Field label="Billing Cycle"><select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['Monthly', 'Quarterly', 'Yearly'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          </div>
          <Field label="Platform Access"><MultiSelect options={['Loyalty', 'Mall', 'Rewards', 'Spin', 'Audit', 'Expo']} selected={form.platformAccess} onChange={v => setForm({ ...form, platformAccess: v })} /></Field>
          <Field label="Permissions"><MultiSelect options={['Basic Dashboard', 'Standard Dashboard', 'Full Dashboard', 'API Access', 'Priority Support', 'Dedicated AM', 'Executive Reports', 'Campaign Access']} selected={form.permissions} onChange={v => setForm({ ...form, permissions: v })} /></Field>
          <Field label="Usage Limits">
            <div className="grid grid-cols-3 gap-2">
              {['rewards', 'campaigns', 'stores', 'spins', 'audits', 'expos'].map(key => (
                <div key={key} className="bg-gray-50 rounded-xl p-2"><div className="text-[9px] font-bold text-gray-400 uppercase mb-1">{key}</div><input type="number" value={(form.usageLimits as any)[key] || 0} onChange={e => setForm({ ...form, usageLimits: { ...form.usageLimits, [key]: parseInt(e.target.value) || 0 } })} className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold" /></div>
              ))}
            </div>
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">{initial ? 'Save' : 'Create'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function PackageFormModal({ title, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(initial || { name: '', platform: 'MCOM Rewards', description: '', price: 0, billingCycle: 'Monthly', features: [], usageLimits: { members: 0, products: 0, orders: 0, spins: 0, prizes: 0, audits: 0, templates: 0, booth: 1, media: 0 }, accessRights: [], archived: false });
  const [newFeature, setNewFeature] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white"><h4 className="text-lg font-bold">{title}</h4><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-6 space-y-4">
          <Field label="Package Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Platform"><select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['MCOM Rewards', 'MCOM Spin', 'GBS Audit', 'GBS Expo'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
            <Field label="Billing Cycle"><select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['Monthly', 'Quarterly', 'Yearly'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          </div>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-16 resize-none" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (£)"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          </div>
          <Field label="Features">
            <div className="space-y-2">
              {form.features.map((f: string, i: number) => (
                <div key={`${f}-${i}`} className="flex items-center gap-2">
                  <input value={f} onChange={e => { const arr = [...form.features]; arr[i] = e.target.value; setForm({ ...form, features: arr }); }} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                  <button onClick={() => setForm({ ...form, features: form.features.filter((_: any, j: number) => j !== i) })} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Add feature..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                <button onClick={() => { if (newFeature.trim()) { setForm({ ...form, features: [...form.features, newFeature.trim()] }); setNewFeature(''); } }} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </Field>
          <Field label="Access Rights"><MultiSelect options={['Store Admin', 'Marketing Admin', 'Analytics', 'View Analytics', 'Export Data', 'Spin Admin', 'Audit Access', 'Expo Admin']} selected={form.accessRights} onChange={v => setForm({ ...form, accessRights: v })} /></Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">{initial ? 'Save' : 'Create'}</button>
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
