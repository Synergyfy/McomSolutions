import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  CreditCard,
  Tag,
  ArrowUpDown,
  Settings as SettingsIcon,
  Check,
  Layers,
  Sparkles,
  Info,
  Calendar,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useSupportedPlatforms,
  useAdminPackages,
  useExternalPlans,
} from '../../services/admin/hooks';
import type {
  CreatePlanInput,
  CreatePackageInput,
  MembershipPlan,
  PackageTemplate,
  PlatformInfo,
  ExternalPlan,
  IncludedAppPlan,
  TierEntitlementResource,
} from '../../services/admin/types';

export type PlanEditorMode = 'membership' | 'package';

interface TieredPlanEditorModalProps {
  mode: PlanEditorMode;
  initialPlan?: MembershipPlan;
  initialPackage?: PackageTemplate;
  onClose: () => void;
  onSaveMembership?: (data: CreatePlanInput) => void;
  onSavePackage?: (data: CreatePackageInput) => void;
}

const COLOR_PRESETS = [
  { label: 'Bronze / Amber', value: 'border-amber-600/20 text-amber-600 bg-amber-50', dotColor: 'bg-amber-500' },
  { label: 'Silver / Slate', value: 'border-slate-400/20 text-slate-500 bg-slate-50', dotColor: 'bg-slate-400' },
  { label: 'Gold / Yellow', value: 'border-yellow-500/30 text-yellow-600 bg-yellow-50', dotColor: 'bg-yellow-500' },
  { label: 'Platinum / Blue', value: 'border-blue-600/20 text-blue-700 bg-blue-50', dotColor: 'bg-blue-600' },
  { label: 'Emerald / Green', value: 'border-emerald-500/20 text-emerald-600 bg-emerald-50', dotColor: 'bg-emerald-500' },
  { label: 'Purple / Violet', value: 'border-purple-500/20 text-purple-600 bg-purple-50', dotColor: 'bg-purple-500' },
];

const DEFAULT_ENTITLEMENTS: TierEntitlementResource[] = [];

export default function TieredPlanEditorModal({
  mode,
  initialPlan,
  initialPackage,
  onClose,
  onSaveMembership,
  onSavePackage,
}: TieredPlanEditorModalProps) {
  const [activeTab, setActiveTab] = useState<'pricing' | 'entitlements' | 'promotions' | 'upgrades' | 'settings'>('pricing');

  // Metadata & basic info
  const [name, setName] = useState(() => {
    if (mode === 'membership') return initialPlan?.name || 'Bronze';
    return initialPackage?.name || 'MCOM Solutions Suite';
  });
  const [description, setDescription] = useState(() => {
    if (mode === 'membership') return initialPlan?.description || 'Essential ecosystem plan';
    return initialPackage?.description || 'Full solutions toolkit for business';
  });
  const [whoItIsFor, setWhoItIsFor] = useState(() => initialPlan?.whoItIsFor || 'Small & Medium Businesses');
  const [badge, setBadge] = useState(() => initialPlan?.badge || (name.toLowerCase() === 'gold' ? 'POPULAR' : ''));
  const [colorPreset, setColorPreset] = useState(() => initialPlan?.color || COLOR_PRESETS[0].value);
  const [platform, setPlatform] = useState(() => initialPackage?.platform || 'MCOM Solutions');

  // Tier pricing (Standard: 90 days, Pro: 180 days, Pro+: Annually leap-year aware)
  const [tierPrices, setTierPrices] = useState<{ Standard: number; Pro: number; 'Pro+': number }>(() => {
    const raw = (mode === 'membership' ? initialPlan?.tierPrices : initialPackage?.tierPrices) as any;
    const base = Number(mode === 'membership' ? (initialPlan?.monthlyPrice ?? initialPlan?.price ?? 49) : (initialPackage?.price ?? 49));
    return {
      Standard: raw?.Standard ?? (raw?.Normal != null ? Number(raw.Normal) : base),
      Pro: raw?.Pro != null ? Number(raw.Pro) : Math.round(base * 2.5),
      'Pro+': raw?.['Pro+'] != null ? Number(raw['Pro+']) : Math.round(base * 5),
    };
  });

  // Features per tier
  const [tierFeatures, setTierFeatures] = useState<{ Standard: string[]; Pro: string[]; 'Pro+': string[] }>(() => {
    const raw = (mode === 'membership' ? initialPlan?.tierFeatures : initialPackage?.tierFeatures) as any;
    const baseFeatures = (mode === 'membership' ? initialPlan?.features : initialPackage?.features) || [];
    return {
      Standard: raw?.Standard || baseFeatures || [],
      Pro: raw?.Pro || (initialPlan || initialPackage ? baseFeatures : []),
      'Pro+': raw?.['Pro+'] || (initialPlan || initialPackage ? baseFeatures : []),
    };
  });

  // Entitlements matrix
  const [entitlements, setEntitlements] = useState<TierEntitlementResource[]>(() => {
    const raw = (mode === 'membership' ? initialPlan?.tierEntitlements : initialPackage?.tierEntitlements);
    if (Array.isArray(raw) && raw.length > 0) {
      return raw;
    }
    return DEFAULT_ENTITLEMENTS;
  });

  // Bundled platform apps (for memberships)
  const [includedApps, setIncludedApps] = useState<IncludedAppPlan[]>(() => initialPlan?.includedApps || []);
  const [selectedBundlePlatform, setSelectedBundlePlatform] = useState<string>('');
  const [selectedBundlePlanId, setSelectedBundlePlanId] = useState<string>('');

  // Promotions tab state
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoBadge, setPromoBadge] = useState<string>('');
  const [trialDays, setTrialDays] = useState<number>(mode === 'package' ? (initialPackage?.trialDuration ?? 0) : 0);

  // Upgrades / Downgrades tab state
  const [instantProration, setInstantProration] = useState<boolean>(true);
  const [allowDowngradeAtPeriodEnd, setAllowDowngradeAtPeriodEnd] = useState<boolean>(true);

  // New resource modal state
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceDescription, setNewResourceDescription] = useState('');
  const [newResourceStandard, setNewResourceStandard] = useState<number | string>(10);
  const [newResourcePro, setNewResourcePro] = useState<number | string>(25);
  const [newResourceProPlus, setNewResourceProPlus] = useState<number | string>(50);
  const [newResourceUsedOn, setNewResourceUsedOn] = useState('');

  // Feature input state per tier
  const [newFeatureText, setNewFeatureText] = useState<{ Standard: string; Pro: string; 'Pro+': string }>({
    Standard: '',
    Pro: '',
    'Pro+': '',
  });

  // External platforms and packages hooks
  const { data: platformsRes } = useSupportedPlatforms();
  const { data: packagesRes } = useAdminPackages();
  const platforms: PlatformInfo[] = platformsRes?.data ?? [];
  const allPackages: PackageTemplate[] = packagesRes?.data ?? [];

  const isExternalSelected = selectedBundlePlatform !== 'MCOM Solutions';
  const { data: externalPlansRes } = useExternalPlans(isExternalSelected ? selectedBundlePlatform : '');

  const availablePlansForPlatform = useMemo(() => {
    if (selectedBundlePlatform === 'MCOM Solutions') {
      return allPackages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        price: pkg.monthlyPrice ?? pkg.price ?? 0,
        tierPrices: pkg.tierPrices,
        tierFeatures: pkg.tierFeatures,
        quotas: pkg.usageLimits,
      }));
    }
    const extPlans: ExternalPlan[] = externalPlansRes?.data ?? [];
    return extPlans.map((ep: ExternalPlan) => ({
      id: ep.id,
      name: ep.name,
      price: ep.tierPrices?.Standard ?? ep.monthlyPrice ?? 0,
      variants: ep.variants,
      tierPrices: ep.tierPrices,
      tierFeatures: ep.tierFeatures,
      quotas: ep.configuration?.quotas,
      featureFlags: ep.configuration?.featureFlags,
    }));
  }, [selectedBundlePlatform, allPackages, externalPlansRes]);

  const handleUpdateEntitlementValue = (index: number, field: 'standard' | 'pro' | 'proPlus', value: string) => {
    const updated = [...entitlements];
    updated[index] = { ...updated[index], [field]: value };
    setEntitlements(updated);
  };

  const handleRemoveEntitlement = (index: number) => {
    setEntitlements(entitlements.filter((_, i) => i !== index));
  };

  const handleAddCustomResource = () => {
    if (!newResourceName.trim()) return;
    const key = newResourceName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const usedOnArray = newResourceUsedOn
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const newRes: TierEntitlementResource = {
      resourceKey: key,
      name: newResourceName.trim(),
      description: newResourceDescription.trim() || undefined,
      badge: '0 used',
      standard: newResourceStandard,
      pro: newResourcePro,
      proPlus: newResourceProPlus,
      usedOn: usedOnArray.length > 0 ? usedOnArray : [newResourceName.trim()],
    };

    setEntitlements([...entitlements, newRes]);
    setNewResourceName('');
    setNewResourceDescription('');
    setNewResourceStandard(10);
    setNewResourcePro(25);
    setNewResourceProPlus(50);
    setNewResourceUsedOn('');
    setShowAddResourceModal(false);
  };

  const handleAddFeature = (tier: 'Standard' | 'Pro' | 'Pro+') => {
    const text = newFeatureText[tier]?.trim();
    if (!text) return;
    setTierFeatures({
      ...tierFeatures,
      [tier]: [...tierFeatures[tier], text],
    });
    setNewFeatureText({ ...newFeatureText, [tier]: '' });
  };

  const handleRemoveFeature = (tier: 'Standard' | 'Pro' | 'Pro+', index: number) => {
    setTierFeatures({
      ...tierFeatures,
      [tier]: tierFeatures[tier].filter((_, i) => i !== index),
    });
  };

  const handleAddBundledApp = () => {
    if (!selectedBundlePlanId) return;
    const planObj = availablePlansForPlatform.find((p) => p.id === selectedBundlePlanId);
    if (!planObj) return;

    if (includedApps.some((a) => a.platform === selectedBundlePlatform && a.planId === planObj.id)) {
      return;
    }

    setIncludedApps([
      ...includedApps,
      {
        platform: selectedBundlePlatform,
        planId: planObj.id,
        planName: planObj.name,
        standalonePrice: planObj.price,
        variants: (planObj as any).variants,
        tierPrices: (planObj as any).tierPrices,
        tierFeatures: (planObj as any).tierFeatures,
        quotas: (planObj as any).quotas,
        featureFlags: (planObj as any).featureFlags,
      } as any,
    ]);
    setSelectedBundlePlanId('');
  };

  const handleRemoveBundledApp = (index: number) => {
    setIncludedApps(includedApps.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const tierDurations = {
      Standard: 90,
      Pro: 180,
      'Pro+': 365,
    };

    if (mode === 'membership') {
      const platformAccess = Array.from(
        new Set(['MCOM Solutions', ...includedApps.map((a) => a.platform)]),
      );

      const payload: CreatePlanInput = {
        name,
        description,
        whoItIsFor,
        badge: badge || undefined,
        color: colorPreset,
        price: tierPrices.Standard,
        monthlyPrice: tierPrices.Standard,
        quarterlyPrice: tierPrices.Standard,
        annualPrice: tierPrices['Pro+'],
        billingCycle: 'Quarterly',
        features: tierFeatures.Standard,
        platformAccess,
        permissions: ['Basic Dashboard', 'Standard Dashboard'],
        usageLimits: {},
        includedApps,
        tierPrices,
        tierFeatures,
        tierEntitlements: entitlements,
        tierDurations,
      };

      onSaveMembership?.(payload);
    } else {
      const payload: CreatePackageInput = {
        name,
        platform,
        description,
        price: tierPrices.Standard,
        monthlyPrice: tierPrices.Standard,
        quarterlyPrice: tierPrices.Standard,
        annualPrice: tierPrices['Pro+'],
        billingCycle: 'Quarterly',
        features: tierFeatures.Standard,
        tierPrices,
        tierFeatures,
        tierEntitlements: entitlements,
        tierDurations,
        isDefault: false,
        type: 'TIERED',
        trialDuration: trialDays || undefined,
        usageLimits: {},
        accessRights: ['standard_access'],
      };

      onSavePackage?.(payload);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100"
      >
        {/* Top Bar Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span className={cn("w-3 h-3 rounded-full shrink-0 shadow-sm", COLOR_PRESETS.find(c => c.value === colorPreset)?.dotColor || "bg-orange-500")} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 capitalize tracking-tight flex items-center gap-2">
                {name || (mode === 'membership' ? 'New Membership' : 'New Package')}
                <span className="text-sm font-normal text-gray-400 lowercase">
                  {mode === 'membership' ? 'plan' : 'package'}
                </span>
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Set a value for each tier · saved with &apos;Save Pricing&apos;
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/70 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Enforced live across the dashboard
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Body with Sidebar + Tab Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Navigation Sidebar */}
          <aside className="w-64 bg-gray-50/70 border-r border-gray-100 p-4 flex flex-col gap-1.5 shrink-0 select-none">
            <button
              onClick={() => setActiveTab('pricing')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left w-full",
                activeTab === 'pricing'
                  ? "bg-[#ea580c] text-white shadow-md shadow-orange-600/20 font-extrabold"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <CreditCard className="w-4 h-4 shrink-0" />
              <span>Plans &amp; Pricing</span>
            </button>

            <button
              onClick={() => setActiveTab('entitlements')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left w-full",
                activeTab === 'entitlements'
                  ? "bg-[#ea580c] text-white shadow-md shadow-orange-600/20 font-extrabold"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Entitlements</span>
            </button>

            <button
              onClick={() => setActiveTab('promotions')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left w-full",
                activeTab === 'promotions'
                  ? "bg-[#ea580c] text-white shadow-md shadow-orange-600/20 font-extrabold"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <Tag className="w-4 h-4 shrink-0" />
              <span>Promotions</span>
            </button>

            <button
              onClick={() => setActiveTab('upgrades')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left w-full",
                activeTab === 'upgrades'
                  ? "bg-[#ea580c] text-white shadow-md shadow-orange-600/20 font-extrabold"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <ArrowUpDown className="w-4 h-4 shrink-0" />
              <span>Upgrades &amp; Downgrades</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left w-full",
                activeTab === 'settings'
                  ? "bg-[#ea580c] text-white shadow-md shadow-orange-600/20 font-extrabold"
                  : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
              )}
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </button>
          </aside>

          {/* Right Tab Content Area */}
          <main className="flex-1 overflow-y-auto p-6 bg-white">
            {/* TAB: ENTITLEMENTS (Matrix Table matching screenshot) */}
            {activeTab === 'entitlements' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                      Resource Quotas &amp; Entitlements
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Configure resource limits enforced per tier across MCOM ecosystem applications.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddResourceModal(true)}
                    className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-orange-200/60"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Resource
                  </button>
                </div>

                {/* Table */}
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-[28%]">
                            RESOURCE
                          </th>
                          <th className="py-3 px-4 w-[16%]">
                            <div className="font-bold text-xs text-gray-900">Standard</div>
                            <div className="text-[10px] text-gray-400 font-normal">Get started (90d)</div>
                          </th>
                          <th className="py-3 px-4 w-[16%]">
                            <div className="font-bold text-xs text-gray-900">Pro</div>
                            <div className="text-[10px] text-gray-400 font-normal">Best value (180d)</div>
                          </th>
                          <th className="py-3 px-4 w-[16%]">
                            <div className="font-bold text-xs text-gray-900">Pro+</div>
                            <div className="text-[10px] text-gray-400 font-normal">Maximum power (Annual)</div>
                          </th>
                          <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider w-[24%]">
                            USED ON
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {entitlements.map((res, index) => (
                          <tr key={res.resourceKey || index} className="hover:bg-gray-50/40 transition-colors group">
                            {/* Resource Info */}
                            <td className="py-4 px-4 align-top">
                              <div className="flex items-start justify-between gap-1">
                                <div>
                                  <div className="font-bold text-gray-900 text-sm">{res.name}</div>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold uppercase">
                                      All
                                    </span>
                                    {res.badge && (
                                      <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[9px] font-bold">
                                        <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                        {res.badge}
                                      </span>
                                    )}
                                  </div>
                                  {res.description && (
                                    <p className="text-[11px] text-gray-400 mt-1 leading-snug">
                                      {res.description}
                                    </p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleRemoveEntitlement(index)}
                                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 rounded transition-all"
                                  title="Delete resource"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Standard Input */}
                            <td className="py-4 px-4 align-top">
                              <input
                                type="text"
                                value={res.standard}
                                onChange={(e) => handleUpdateEntitlementValue(index, 'standard', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs transition-all"
                              />
                            </td>

                            {/* Pro Input */}
                            <td className="py-4 px-4 align-top">
                              <input
                                type="text"
                                value={res.pro}
                                onChange={(e) => handleUpdateEntitlementValue(index, 'pro', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs transition-all"
                              />
                            </td>

                            {/* Pro+ Input */}
                            <td className="py-4 px-4 align-top">
                              <input
                                type="text"
                                value={res.proPlus}
                                onChange={(e) => handleUpdateEntitlementValue(index, 'proPlus', e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 shadow-2xs transition-all"
                              />
                            </td>

                            {/* Used On Links */}
                            <td className="py-4 px-4 align-top">
                              <div className="flex flex-col gap-1">
                                {(res.usedOn || [res.name]).map((link, lIdx) => (
                                  <span
                                    key={lIdx}
                                    className="text-orange-600 hover:text-orange-700 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                  >
                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                    <span>{link}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PLANS & PRICING */}
            {activeTab === 'pricing' && (
              <div className="space-y-6">
                {/* Basic Plan Metadata */}
                <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-orange-600" />
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Membership Plan Details
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Plan Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Bronze, Silver, Gold, Platinum"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Badge (Optional)
                      </label>
                      <input
                        type="text"
                        value={badge}
                        onChange={(e) => setBadge(e.target.value)}
                        placeholder="e.g. POPULAR, BEST VALUE"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Who It Is For
                      </label>
                      <input
                        type="text"
                        value={whoItIsFor}
                        onChange={(e) => setWhoItIsFor(e.target.value)}
                        placeholder="e.g. Small & Medium Businesses"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Commercial description of the membership tier..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Color Theme
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setColorPreset(preset.value)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5",
                            colorPreset === preset.value
                              ? "border-orange-500 bg-orange-50 text-orange-700 shadow-2xs"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          )}
                        >
                          <span className={cn("w-2.5 h-2.5 rounded-full", preset.dotColor)} />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Automatic 3-Tier Multi-Period Pricing Matrix
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure pricing and features for Standard (90 days), Pro (180 days), and Pro+ (Annual with leap-year awareness).
                  </p>
                </div>

                {/* 3 Tier Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Standard */}
                  <div className="border border-gray-200 rounded-2xl p-5 bg-white shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-800 rounded-lg text-xs font-extrabold uppercase">
                        Standard
                      </span>
                      <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 90 Days
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Get started version</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-base font-bold text-gray-500">£</span>
                        <input
                          type="number"
                          min={0}
                          value={tierPrices.Standard}
                          onChange={(e) => setTierPrices({ ...tierPrices, Standard: Number(e.target.value) || 0 })}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xl font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Valid for 90 days from activation</p>
                    </div>

                    <div className="border-t border-gray-100 pt-3">
                      <div className="text-[11px] font-bold text-gray-600 uppercase mb-2">Features Included</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tierFeatures.Standard.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg">
                            <span className="text-gray-700 flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-green-500 shrink-0" />
                              {f}
                            </span>
                            <button
                              onClick={() => handleRemoveFeature('Standard', i)}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <input
                          placeholder="Add standard feature..."
                          value={newFeatureText.Standard}
                          onChange={(e) => setNewFeatureText({ ...newFeatureText, Standard: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFeature('Standard')}
                          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => handleAddFeature('Standard')}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pro */}
                  <div className="border-2 border-orange-500/30 rounded-2xl p-5 bg-orange-50/20 shadow-sm space-y-4 relative">
                    <div className="absolute -top-2.5 right-4 px-2 py-0.5 bg-orange-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm">
                      Best Value
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg text-xs font-extrabold uppercase">
                        Pro
                      </span>
                      <span className="text-[11px] font-bold text-orange-600 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> 180 Days
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Mid-tier scaling version</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-base font-bold text-gray-500">£</span>
                        <input
                          type="number"
                          min={0}
                          value={tierPrices.Pro}
                          onChange={(e) => setTierPrices({ ...tierPrices, Pro: Number(e.target.value) || 0 })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xl font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Valid for 180 days (semi-annually)</p>
                    </div>

                    <div className="border-t border-orange-100 pt-3">
                      <div className="text-[11px] font-bold text-gray-600 uppercase mb-2">Features Included</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tierFeatures.Pro.map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-orange-100">
                            <span className="text-gray-700 flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-orange-500 shrink-0" />
                              {f}
                            </span>
                            <button
                              onClick={() => handleRemoveFeature('Pro', i)}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <input
                          placeholder="Add pro feature..."
                          value={newFeatureText.Pro}
                          onChange={(e) => setNewFeatureText({ ...newFeatureText, Pro: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFeature('Pro')}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => handleAddFeature('Pro')}
                          className="p-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pro+ */}
                  <div className="border border-purple-200 rounded-2xl p-5 bg-purple-50/15 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-extrabold uppercase">
                        Pro+
                      </span>
                      <span className="text-[11px] font-bold text-purple-600 flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Annual (Leap Year)
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Maximum power version</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-base font-bold text-gray-500">£</span>
                        <input
                          type="number"
                          min={0}
                          value={tierPrices['Pro+']}
                          onChange={(e) => setTierPrices({ ...tierPrices, 'Pro+': Number(e.target.value) || 0 })}
                          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xl font-extrabold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        366 days in leap years, 365 days otherwise
                      </p>
                    </div>

                    <div className="border-t border-purple-100 pt-3">
                      <div className="text-[11px] font-bold text-gray-600 uppercase mb-2">Features Included</div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {tierFeatures['Pro+'].map((f, i) => (
                          <div key={i} className="flex items-center justify-between text-xs bg-white px-2.5 py-1.5 rounded-lg border border-purple-100">
                            <span className="text-gray-700 flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                              {f}
                            </span>
                            <button
                              onClick={() => handleRemoveFeature('Pro+', i)}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <input
                          placeholder="Add pro+ feature..."
                          value={newFeatureText['Pro+']}
                          onChange={(e) => setNewFeatureText({ ...newFeatureText, 'Pro+': e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFeature('Pro+')}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => handleAddFeature('Pro+')}
                          className="p-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Membership Specific: Bundled Platform Plans */}
                {mode === 'membership' && (
                  <div className="border border-blue-100 bg-blue-50/40 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-600" />
                          Bundled Platform Apps &amp; Plans
                        </h4>
                        <p className="text-xs text-blue-600/80 mt-0.5">
                          When users purchase this membership, automatically provision these platform plans.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      <select
                        value={selectedBundlePlatform}
                        onChange={(e) => {
                          setSelectedBundlePlatform(e.target.value);
                          setSelectedBundlePlanId('');
                        }}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800"
                      >
                        <option value="MCOM Solutions">MCOM Solutions (Local Packages)</option>
                        {platforms.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedBundlePlanId}
                        onChange={(e) => setSelectedBundlePlanId(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-800 min-w-[200px]"
                      >
                        <option value="">-- Choose Plan to Bundle --</option>
                        {availablePlansForPlatform.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (£{p.price}/mo)
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={handleAddBundledApp}
                        disabled={!selectedBundlePlanId}
                        className="px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Bundle Plan
                      </button>
                    </div>

                    {includedApps.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {includedApps.map((app, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-blue-200 text-gray-800 rounded-xl text-xs font-bold shadow-2xs"
                          >
                            <span className="text-brand-blue font-semibold">{app.platform}:</span> {app.planName}
                            <button
                              onClick={() => handleRemoveBundledApp(idx)}
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Package Specific: Platform Selector */}
                {mode === 'package' && (
                  <div className="border border-gray-100 rounded-2xl p-5 bg-gray-50/50 space-y-3">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                      Target Platform
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value)}
                      className="w-full max-w-md bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    >
                      {['MCOM Solutions', 'MCOM Rewards', 'MCOM Spin', 'GBS Audit', 'GBS Expo'].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* TAB: PROMOTIONS */}
            {activeTab === 'promotions' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Promotional Campaign Settings
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Offer limited-time launch discounts, trial windows, and highlighted badges.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Promotional Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={promoDiscount}
                      onChange={(e) => setPromoDiscount(Number(e.target.value) || 0)}
                      placeholder="e.g. 20"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Promo Badge Text
                    </label>
                    <input
                      type="text"
                      value={promoBadge}
                      onChange={(e) => setPromoBadge(e.target.value)}
                      placeholder="e.g. 20% OFF FIRST PERIOD"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Free Trial Duration (Days)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value) || 0)}
                      placeholder="0 for immediate billing"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: UPGRADES & DOWNGRADES */}
            {activeTab === 'upgrades' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Tier Migration &amp; Transition Rules
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Define how users move between Standard (90d), Pro (180d), and Pro+ (Annual).
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <div className="text-xs font-bold text-gray-900">Instant Proration Credit</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Apply unused days credit immediately when upgrading from Standard to Pro or Pro+.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={instantProration}
                      onChange={(e) => setInstantProration(e.target.checked)}
                      className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div>
                      <div className="text-xs font-bold text-gray-900">Downgrades at Period End</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Keep higher tier entitlements active until the full duration ends before applying downgrade.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={allowDowngradeAtPeriodEnd}
                      onChange={(e) => setAllowDowngradeAtPeriodEnd(e.target.checked)}
                      className="w-5 h-5 accent-orange-600 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    General Plan Settings
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure names, audience targeting, badges, and visual branding.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Plan Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Bronze, Silver, Gold"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief overview of the plan..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Target Audience / Who it is for
                    </label>
                    <input
                      type="text"
                      value={whoItIsFor}
                      onChange={(e) => setWhoItIsFor(e.target.value)}
                      placeholder="e.g. Retailers &amp; High Street Shops"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Header Badge
                    </label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="e.g. MOST POPULAR, BEST VALUE"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">
                      Color Theme Preset
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setColorPreset(p.value)}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold text-left transition-all",
                            colorPreset === p.value
                              ? "border-orange-500 bg-orange-50/50 text-orange-900 shadow-2xs"
                              : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                          )}
                        >
                          <span className={cn("w-3 h-3 rounded-full", p.dotColor)} />
                          <span>{p.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Footer Action Bar */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="text-xs text-gray-400">
            All 3 tiers (Standard, Pro, Pro+) will be auto-generated and active.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save Pricing
            </button>
          </div>
        </div>
      </motion.div>

      {/* Add Custom Resource Inline Modal */}
      <AnimatePresence>
        {showAddResourceModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-900">Add Custom Entitlement Resource</h4>
                <button
                  onClick={() => setShowAddResourceModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Resource Name</label>
                  <input
                    value={newResourceName}
                    onChange={(e) => setNewResourceName(e.target.value)}
                    placeholder="e.g. API Rate Limit / Day"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Description</label>
                  <input
                    value={newResourceDescription}
                    onChange={(e) => setNewResourceDescription(e.target.value)}
                    placeholder="Description shown to business admins"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Standard (90d)</label>
                    <input
                      value={newResourceStandard}
                      onChange={(e) => setNewResourceStandard(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Pro (180d)</label>
                    <input
                      value={newResourcePro}
                      onChange={(e) => setNewResourcePro(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Pro+ (Annual)</label>
                    <input
                      value={newResourceProPlus}
                      onChange={(e) => setNewResourceProPlus(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Used On Tags (comma separated)
                  </label>
                  <input
                    value={newResourceUsedOn}
                    onChange={(e) => setNewResourceUsedOn(e.target.value)}
                    placeholder="e.g. Admin - API Portal, Consumer - App"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowAddResourceModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCustomResource}
                  disabled={!newResourceName.trim()}
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all"
                >
                  Add Resource
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
