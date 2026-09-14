import React, { useState, useMemo, type ReactNode, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Layers,
  ShoppingBag,
  Award,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useSupportedPlatforms,
  useAdminPackages,
  useExternalPlans,
} from '../../services/admin/hooks';
import type {
  CreatePlanInput,
  IncludedAppPlan,
  MembershipPlan,
  PackageTemplate,
  PlatformInfo,
  ExternalPlan,
} from '../../services/admin/types';

interface PlanFormModalProps {
  title: string;
  initial?: MembershipPlan;
  onClose: () => void;
  onSave: (data: CreatePlanInput) => void;
}

const COLOR_PRESETS = [
  { label: 'Bronze / Amber', value: 'border-amber-600/20 text-amber-600 bg-amber-50' },
  { label: 'Silver / Slate', value: 'border-slate-400/20 text-slate-500 bg-slate-50' },
  { label: 'Gold / Yellow', value: 'border-yellow-500/30 text-yellow-600 bg-yellow-50' },
  { label: 'Platinum / Blue', value: 'border-blue-600/20 text-blue-700 bg-blue-50' },
  { label: 'Emerald / Green', value: 'border-emerald-500/20 text-emerald-600 bg-emerald-50' },
  { label: 'Purple / Violet', value: 'border-purple-500/20 text-purple-600 bg-purple-50' },
];

export default function PlanFormModal({
  title,
  initial,
  onClose,
  onSave,
}: PlanFormModalProps) {
  const { data: platformsRes } = useSupportedPlatforms();
  const { data: packagesRes } = useAdminPackages();

  const platforms: PlatformInfo[] = platformsRes?.data ?? [
    { name: 'MCOM Mall', clientId: 'mcom-mall', platformSlug: 'mall', isNamed: true, hasBillingApi: true },
    { name: 'MCOM Rewards', clientId: 'mcom-loyalty', platformSlug: 'rewards', isNamed: true, hasBillingApi: true },
  ];
  const allPackages: PackageTemplate[] = packagesRes?.data ?? [];

  // Membership form state
  const [form, setForm] = useState<{
    name: string;
    description: string;
    whoItIsFor: string;
    badge: string;
    color: string;
    price: number;
    billingCycle: string;
    monthlyPrice: number;
    quarterlyPrice: number;
    annualPrice: number;
    features: string[];
    platformAccess: string[];
    permissions: string[];
    usageLimits: Record<string, number>;
    includedApps: IncludedAppPlan[];
  }>(() => {
    if (initial) {
      const monthly = initial.monthlyPrice ?? initial.price ?? 49;
      const quarterly = initial.quarterlyPrice ?? Math.floor(monthly * 0.9) * 3;
      const annual = initial.annualPrice ?? Math.floor(monthly * 0.8) * 12;
      return {
        name: initial.name || '',
        description: initial.description || '',
        whoItIsFor: initial.whoItIsFor || '',
        badge: initial.badge || '',
        color: initial.color || COLOR_PRESETS[0].value,
        price: monthly,
        billingCycle: initial.billingCycle || 'Monthly',
        monthlyPrice: monthly,
        quarterlyPrice: quarterly,
        annualPrice: annual,
        features: initial.features || [],
        platformAccess: initial.platformAccess || [],
        permissions: initial.permissions || ['Basic Dashboard', 'Standard Dashboard'],
        usageLimits: initial.usageLimits || { rewards: 0, campaigns: 0, stores: 0, spins: 0, audits: 0, expos: 0 },
        includedApps: initial.includedApps || [],
      };
    }
    return {
      name: '',
      description: '',
      whoItIsFor: '',
      badge: '',
      color: COLOR_PRESETS[2].value,
      price: 49,
      billingCycle: 'Monthly',
      monthlyPrice: 49,
      quarterlyPrice: 132,
      annualPrice: 470,
      features: [],
      platformAccess: [],
      permissions: ['Basic Dashboard', 'Standard Dashboard'],
      usageLimits: { rewards: 0, campaigns: 0, stores: 0, spins: 0, audits: 0, expos: 0 },
      includedApps: [],
    };
  });

  // Step-by-step bundle selector state
  const [selectedPlatform, setSelectedPlatform] = useState<string>('MCOM Solutions');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [newFeature, setNewFeature] = useState('');

  // Fetch external plans if an external platform is chosen
  const isExternalSelected = selectedPlatform !== 'MCOM Solutions';
  const { data: externalPlansRes, isLoading: externalLoading } = useExternalPlans(
    isExternalSelected ? selectedPlatform : ''
  );

  // Available plans for the currently chosen platform in the picker
  const availablePlansForPlatform = useMemo(() => {
    if (selectedPlatform === 'MCOM Solutions') {
      return allPackages.map((pkg) => ({
        id: pkg.id,
        name: pkg.name,
        price: pkg.monthlyPrice ?? pkg.price ?? 0,
        description: pkg.description,
        features: pkg.features,
      }));
    }
    const extPlans: ExternalPlan[] = externalPlansRes?.data ?? [];
    return extPlans.map((ep: ExternalPlan) => ({
      id: ep.id,
      name: ep.name,
      price: ep.monthlyPrice ?? 0,
      description: ep.description || '',
      features: ep.features || [],
    }));
  }, [selectedPlatform, allPackages, externalPlansRes]);

  // Combined standalone value
  const totalStandaloneValue = useMemo(() => {
    return form.includedApps.reduce((sum, item) => sum + (item.standalonePrice || 0), 0);
  }, [form.includedApps]);

  const handleAddPlanToBundle = () => {
    if (!selectedPlanId) return;
    const planObj = availablePlansForPlatform.find((p) => p.id.toString() === selectedPlanId);
    if (!planObj) return;

    // Check if already added
    const alreadyExists = form.includedApps.some(
      (app) => app.platform === selectedPlatform && app.planId === planObj.id.toString()
    );
    if (alreadyExists) return;

    const newIncluded: IncludedAppPlan = {
      platform: selectedPlatform,
      planId: planObj.id.toString(),
      planName: planObj.name,
      standalonePrice: planObj.price,
    };

    const nextIncluded = [...form.includedApps, newIncluded];
    const nextPlatforms = Array.from(
      new Set([...form.platformAccess, selectedPlatform.replace(/^MCOM\s*/i, '')])
    );

    // Auto-update base price if initial or 0
    const newSum = nextIncluded.reduce((s, i) => s + (i.standalonePrice || 0), 0);
    const suggestedPrice = form.price === 0 ? Math.round(newSum * 0.8) : form.price;

    setForm((prev) => ({
      ...prev,
      includedApps: nextIncluded,
      platformAccess: nextPlatforms,
      price: suggestedPrice,
      tierPrices: {
        Normal: suggestedPrice,
        Pro: Math.round(suggestedPrice * 1.5),
        'Pro+': Math.round(suggestedPrice * 2.2),
      },
    }));

    setSelectedPlanId('');
  };

  const handleRemovePlan = (index: number) => {
    const nextIncluded = form.includedApps.filter((_, i) => i !== index);
    const nextPlatforms = Array.from(
      new Set(nextIncluded.map((item) => item.platform.replace(/^MCOM\s*/i, '')))
    );
    setForm((prev) => ({
      ...prev,
      includedApps: nextIncluded,
      platformAccess: nextPlatforms,
    }));
  };

  const handleAutoPopulateFeatures = () => {
    const extractedFeatures: string[] = [];
    form.includedApps.forEach((item) => {
      extractedFeatures.push(`${item.platform} — Full ${item.planName} tier access`);
    });
    setForm((prev) => ({
      ...prev,
      features: Array.from(new Set([...prev.features, ...extractedFeatures])),
    }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    onSave({
      name: form.name.trim(),
      description: form.description,
      whoItIsFor: form.whoItIsFor,
      badge: form.badge || undefined,
      color: form.color,
      price: form.monthlyPrice,
      monthlyPrice: form.monthlyPrice,
      quarterlyPrice: form.quarterlyPrice,
      annualPrice: form.annualPrice,
      billingCycle: form.billingCycle,
      includedApps: form.includedApps,
      features: form.features,
      platformAccess: form.platformAccess,
      permissions: form.permissions,
      usageLimits: form.usageLimits,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <h4 className="text-lg font-bold text-gray-900">{title}</h4>
            <p className="text-xs text-gray-500">
              Bundle multi-platform plans into an attractive all-in-one membership package
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 1. Membership Identity */}
          <div className="space-y-4">
            <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
              1. Membership Package Identity
            </h5>

            <Field label="Membership Package Name (Typed by Admin — Displayed to Users)">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gold Omnichannel Growth, Bronze Starter, Platinum Enterprise"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                required
              />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Target Audience / Subtitle">
                <input
                  value={form.whoItIsFor}
                  onChange={(e) => setForm({ ...form, whoItIsFor: e.target.value })}
                  placeholder="e.g. Growing & Scaling businesses"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </Field>
              <Field label="Floating Badge (Optional)">
                <input
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="e.g. MOST POPULAR, BEST VALUE"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Brief summary of this membership and what merchants unlock..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-16 resize-none"
              />
            </Field>

            <Field label="Color Theme">
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setForm({ ...form, color: preset.value })}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5',
                      preset.value,
                      form.color === preset.value
                        ? 'ring-2 ring-brand-blue ring-offset-1 shadow-sm'
                        : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    {form.color === preset.value && <Check className="w-3 h-3" />}
                    {preset.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <div className="border-t border-gray-100" />

          {/* 2. Step-by-Step Multi-App Plan Picker */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-blue" />
                  2. Build Multi-App Bundle (Add Plans from Each Platform)
                </h5>
                <p className="text-xs text-gray-500 mt-0.5">
                  Select a platform, choose the plan you want to include, and add it to this membership deal.
                </p>
              </div>
            </div>

            {/* Picker Controls */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Select Platform
                  </label>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => {
                      setSelectedPlatform(e.target.value);
                      setSelectedPlanId('');
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  >
                    <option value="MCOM Solutions">MCOM Solutions (Standalone Suite)</option>
                    {platforms.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    Select Plan to Add
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    disabled={externalLoading || availablePlansForPlatform.length === 0}
                    className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 disabled:opacity-50"
                  >
                    <option value="">
                      {externalLoading
                        ? 'Loading plans...'
                        : availablePlansForPlatform.length === 0
                        ? `No plans configured for ${selectedPlatform}`
                        : '-- Choose a Plan --'}
                    </option>
                    {availablePlansForPlatform.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} (£{plan.price}/mo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddPlanToBundle}
                  disabled={!selectedPlanId}
                  className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" /> Add Plan to Membership
                </button>
              </div>
            </div>

            {/* List of Added Plans */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                Plans Included in this Deal ({form.includedApps.length})
              </label>

              {form.includedApps.length === 0 ? (
                <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-6 text-center">
                  <AlertCircle className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-500 font-medium">
                    No platform plans added yet. Select a platform and plan above to build your bundle.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {form.includedApps.map((item, idx) => (
                    <div
                      key={`${item.platform}-${item.planId}-${idx}`}
                      className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-blue-100 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-brand-blue flex items-center justify-center font-bold text-xs">
                          {item.platform.toLowerCase().includes('mall') ? (
                            <ShoppingBag className="w-4 h-4" />
                          ) : item.platform.toLowerCase().includes('reward') ||
                            item.platform.toLowerCase().includes('loyalty') ? (
                            <Award className="w-4 h-4" />
                          ) : (
                            <Layers className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900">{item.planName}</span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[9px] font-bold">
                              {item.platform}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400">
                            Standalone: £{item.standalonePrice ?? 0}/mo
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePlan(idx)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Remove from bundle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {/* Summary Box */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-emerald-800 font-bold">
                        Bundle Value Summary
                      </div>
                      <div className="text-[11px] text-emerald-600 mt-0.5">
                        Combined Standalone Value: <span className="font-bold">£{totalStandaloneValue}/mo</span>
                      </div>
                    </div>
                    {form.price < totalStandaloneValue && totalStandaloneValue > 0 && (
                      <div className="px-3 py-1 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                        Save £{totalStandaloneValue - form.price}/mo ({Math.round(((totalStandaloneValue - form.price) / totalStandaloneValue) * 100)}% Deal)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 3. Pricing & Billing Cadence */}
          <div className="space-y-4">
            <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
              3. Membership Pricing (£ GBP)
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 focus-within:border-brand-blue transition-all">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Monthly Price (£)
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-bold text-base">£</span>
                  <input
                    type="number"
                    min="0"
                    value={form.monthlyPrice}
                    onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      setForm({
                        ...form,
                        price: m,
                        monthlyPrice: m,
                        quarterlyPrice: Math.floor(m * 0.9) * 3,
                        annualPrice: Math.floor(m * 0.8) * 12,
                      });
                    }}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-lg font-extrabold text-gray-900"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium">Billed every month</span>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 focus-within:border-brand-blue transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Quarterly Price (£)
                  </span>
                  <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                    10% off
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-bold text-base">£</span>
                  <input
                    type="number"
                    min="0"
                    value={form.quarterlyPrice}
                    onChange={(e) => {
                      const q = parseInt(e.target.value) || 0;
                      setForm({ ...form, quarterlyPrice: q });
                    }}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-lg font-extrabold text-gray-900"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium">
                  (£{Math.round(form.quarterlyPrice / 3)}/mo equivalent)
                </span>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 focus-within:border-brand-blue transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Annual Price (£)
                  </span>
                  <span className="text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded-full">
                    20% off
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-bold text-base">£</span>
                  <input
                    type="number"
                    min="0"
                    value={form.annualPrice}
                    onChange={(e) => {
                      const a = parseInt(e.target.value) || 0;
                      setForm({ ...form, annualPrice: a });
                    }}
                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-lg font-extrabold text-gray-900"
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium">
                  (£{Math.round(form.annualPrice / 12)}/mo equivalent)
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* 4. Highlight Features */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                4. Features & Highlights
              </h5>
              {form.includedApps.length > 0 && (
                <button
                  type="button"
                  onClick={handleAutoPopulateFeatures}
                  className="text-xs font-bold text-brand-blue hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Auto-fill from Bundled Plans
                </button>
              )}
            </div>

            <div className="space-y-2">
              {form.features.map((feat, i) => (
                <div key={`${feat}-${i}`} className="flex items-center gap-2">
                  <input
                    value={feat}
                    onChange={(e) => {
                      const arr = [...form.features];
                      arr[i] = e.target.value;
                      setForm({ ...form, features: arr });
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, features: form.features.filter((_, idx) => idx !== i) })
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
                  placeholder="Add a key bundle highlight..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newFeature.trim()) {
                        setForm({ ...form, features: [...form.features, newFeature.trim()] });
                        setNewFeature('');
                      }
                    }
                  }}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
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

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!form.name.trim()}
            className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {initial ? 'Save Membership' : 'Create Membership'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
