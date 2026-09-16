import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Layers,
  Sparkles,
  Calendar,
  Package,
  Shield,
  Copy,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  CreatePackageInput,
  PackageTemplate,
} from '../../services/admin/types';

interface LocalPackageEditorModalProps {
  initialPackage?: PackageTemplate;
  onClose: () => void;
  onSave: (data: CreatePackageInput) => void;
  isSubmitting?: boolean;
}

type TierKey = 'STANDARD' | 'PRO' | 'PRO_PLUS';

interface TierState {
  price: number;
  features: string[];
  quotas: Record<string, number | string>;
}

export default function LocalPackageEditorModal({
  initialPackage,
  onClose,
  onSave,
  isSubmitting = false,
}: LocalPackageEditorModalProps) {
  // Basic package information
  const [name, setName] = useState(initialPackage?.name || '');
  const [platform, setPlatform] = useState(initialPackage?.platform || 'MCOM Solutions');
  const [description, setDescription] = useState(initialPackage?.description || '');
  const [type, setType] = useState(initialPackage?.type || 'STANDARD');
  const [isDefault, setIsDefault] = useState(initialPackage?.isDefault ?? false);
  const [trialDuration, setTrialDuration] = useState<number>(initialPackage?.trialDuration ?? 0);

  // Error state
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 3-tier variant configurations
  const [tiers, setTiers] = useState<Record<TierKey, TierState>>(() => {
    const rawPrices = (initialPackage?.tierPrices || {}) as Record<string, any>;
    const rawFeatures = (initialPackage?.tierFeatures || {}) as Record<string, any>;
    const basePrice = Number(initialPackage?.price || 49);
    const baseFeatures = initialPackage?.features || [];

    return {
      STANDARD: {
        price: rawPrices.Standard ?? (rawPrices.Normal != null ? Number(rawPrices.Normal) : basePrice),
        features: rawFeatures.Standard || baseFeatures || [],
        quotas: initialPackage?.usageLimits || {},
      },
      PRO: {
        price: rawPrices.Pro != null ? Number(rawPrices.Pro) : Math.round(basePrice * 2.5),
        features: rawFeatures.Pro || (initialPackage ? baseFeatures : []),
        quotas: initialPackage?.usageLimits || {},
      },
      PRO_PLUS: {
        price: rawPrices['Pro+'] != null ? Number(rawPrices['Pro+']) : Math.round(basePrice * 5),
        features: rawFeatures['Pro+'] || (initialPackage ? baseFeatures : []),
        quotas: initialPackage?.usageLimits || {},
      },
    };
  });

  // Feature input per tier
  const [featureInputs, setFeatureInputs] = useState<Record<TierKey, string>>({
    STANDARD: '',
    PRO: '',
    PRO_PLUS: '',
  });

  // Quota inputs per tier
  const [quotaKeyInputs, setQuotaKeyInputs] = useState<Record<TierKey, string>>({
    STANDARD: '',
    PRO: '',
    PRO_PLUS: '',
  });
  const [quotaValInputs, setQuotaValInputs] = useState<Record<TierKey, string>>({
    STANDARD: '',
    PRO: '',
    PRO_PLUS: '',
  });

  // Add feature to tier
  const handleAddFeature = (tier: TierKey) => {
    const text = featureInputs[tier]?.trim();
    if (!text) return;
    setTiers((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        features: [...prev[tier].features, text],
      },
    }));
    setFeatureInputs((prev) => ({ ...prev, [tier]: '' }));
  };

  // Remove feature from tier
  const handleRemoveFeature = (tier: TierKey, index: number) => {
    setTiers((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        features: prev[tier].features.filter((_, i) => i !== index),
      },
    }));
  };

  // Copy features from one tier to another
  const handleCopyFeatures = (fromTier: TierKey, toTier: TierKey) => {
    setTiers((prev) => ({
      ...prev,
      [toTier]: {
        ...prev[toTier],
        features: [...prev[fromTier].features],
        quotas: { ...prev[fromTier].quotas },
      },
    }));
  };

  // Add custom quota to tier
  const handleAddQuota = (tier: TierKey) => {
    const key = quotaKeyInputs[tier]?.trim();
    if (!key) return;
    const rawVal = quotaValInputs[tier];
    const val = Number.isNaN(Number(rawVal)) ? rawVal.trim() : Number(rawVal);

    setTiers((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        quotas: {
          ...prev[tier].quotas,
          [key]: val,
        },
      },
    }));
    setQuotaKeyInputs((prev) => ({ ...prev, [tier]: '' }));
    setQuotaValInputs((prev) => ({ ...prev, [tier]: '' }));
  };

  // Remove quota
  const handleRemoveQuota = (tier: TierKey, key: string) => {
    setTiers((prev) => {
      const updated = { ...prev[tier].quotas };
      delete updated[key];
      return {
        ...prev,
        [tier]: {
          ...prev[tier],
          quotas: updated,
        },
      };
    });
  };

  // Validate and submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Package name is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const tierPrices = {
      Standard: Number(tiers.STANDARD.price) || 0,
      Pro: Number(tiers.PRO.price) || 0,
      'Pro+': Number(tiers.PRO_PLUS.price) || 0,
    };

    const tierFeatures = {
      Standard: tiers.STANDARD.features,
      Pro: tiers.PRO.features,
      'Pro+': tiers.PRO_PLUS.features,
    };

    const tierDurations = {
      Standard: 90,
      Pro: 180,
      'Pro+': 365,
    };

    const payload: CreatePackageInput = {
      name: name.trim(),
      platform: (platform || initialPackage?.platform || 'MCOM Solutions').trim(),
      description: description.trim() || undefined,
      price: tierPrices.Standard,
      monthlyPrice: tierPrices.Standard,
      quarterlyPrice: tierPrices.Pro,
      annualPrice: tierPrices['Pro+'],
      billingCycle: 'Quarterly',
      features: tierFeatures.Standard,
      tierPrices,
      tierFeatures,
      tierDurations,
      isDefault,
      type,
      trialDuration: trialDuration > 0 ? trialDuration : undefined,
      usageLimits: (tiers.STANDARD.quotas as Record<string, number>) || {},
      accessRights: ['standard_access'],
    };

    onSave(payload);
  };

  const fieldClass =
    'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';
  const fieldErrorClass = 'border-red-300 focus:ring-red-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 10 }}
        className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden border border-gray-100 my-auto flex flex-col max-h-[92vh]"
      >
        {/* Top Bar Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-blue shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {initialPackage ? 'Edit Local Package' : 'Create Local Package'}
              </h2>
              <p className="text-xs text-gray-400 font-medium">
                Simultaneous 3-Variant Configuration: Standard (90d), Pro (180d), Pro+ (Annual leap-safe)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Package Basic Information */}
          <div className="bg-gray-50/70 p-5 rounded-2xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-blue" />
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                1. Package Basic Information
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Package Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({ ...errors, name: '' });
                  }}
                  placeholder="e.g. Retail Starter, Growth Suite, Enterprise Hub"
                  className={cn(fieldClass, 'bg-white', errors.name && fieldErrorClass)}
                />
                {errors.name && <p className="text-[11px] text-red-500 font-bold mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High-level commercial description of this package template..."
                  className={cn(fieldClass, 'bg-white')}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-blue border-gray-300 focus:ring-brand-blue"
                />
                <span className="text-xs font-bold text-gray-700">Set as Default Package</span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Free Trial Days:</span>
                <input
                  type="number"
                  min="0"
                  value={trialDuration}
                  onChange={(e) => setTrialDuration(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-20 bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-900"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Side-by-Side 3-Tier Variant Configuration Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-blue" />
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  2. Configure All 3 Tier Variants (Simultaneous Side-by-Side View)
                </h3>
              </div>
              <span className="text-xs text-gray-400 font-medium">
                Standard (90d) · Pro (180d) · Pro+ (Annual leap-safe)
              </span>
            </div>

            {/* 3-Column Responsive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* ================= STANDARD VARIANT ================= */}
              <div className="bg-white border-2 border-blue-100 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Standard
                    </span>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/70 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> 90 Days
                  </span>
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Standard Price (£)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-gray-400">£</span>
                    <input
                      type="number"
                      min="0"
                      value={tiers.STANDARD.price}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setTiers((prev) => ({
                          ...prev,
                          STANDARD: { ...prev.STANDARD, price: val },
                        }));
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">One-off fee for 90-day cycle</p>
                </div>

                {/* Feature Bullets */}
                <div className="flex-1 flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Features ({tiers.STANDARD.features.length})
                    </label>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={featureInputs.STANDARD}
                      onChange={(e) =>
                        setFeatureInputs((prev) => ({ ...prev, STANDARD: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature('STANDARD');
                        }
                      }}
                      placeholder="Add standard feature..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-blue"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature('STANDARD')}
                      className="p-2 bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-all text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 flex-1">
                    {tiers.STANDARD.features.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No features configured</p>
                    ) : (
                      tiers.STANDARD.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 group"
                        >
                          <span className="text-gray-800 font-medium flex items-center gap-1.5 leading-tight">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                            {feat}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature('STANDARD', idx)}
                            className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quotas / Limits */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-brand-blue" />
                    Quotas / Limits (Optional)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={quotaKeyInputs.STANDARD}
                      onChange={(e) =>
                        setQuotaKeyInputs((prev) => ({ ...prev, STANDARD: e.target.value }))
                      }
                      placeholder="key (e.g. maxListings)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold"
                    />
                    <input
                      type="text"
                      value={quotaValInputs.STANDARD}
                      onChange={(e) =>
                        setQuotaValInputs((prev) => ({ ...prev, STANDARD: e.target.value }))
                      }
                      placeholder="limit"
                      className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddQuota('STANDARD')}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {Object.keys(tiers.STANDARD.quotas).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(tiers.STANDARD.quotas).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-100 text-brand-blue rounded-md text-[10px] font-bold"
                        >
                          <span className="font-mono">{k}:</span>
                          <span className="text-gray-900">{String(v)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuota('STANDARD', k)}
                            className="hover:text-red-500"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ================= PRO VARIANT ================= */}
              <div className="bg-white border-2 border-orange-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4 relative">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Pro
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyFeatures('STANDARD', 'PRO')}
                      className="px-2 py-0.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-orange-200/60 transition-all"
                      title="Clone all features from Standard"
                    >
                      <Copy className="w-2.5 h-2.5" /> Copy Standard
                    </button>
                    <span className="px-2.5 py-1 bg-orange-50 text-orange-700 border border-orange-200/70 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 180 Days
                    </span>
                  </div>
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Pro Price (£)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-gray-400">£</span>
                    <input
                      type="number"
                      min="0"
                      value={tiers.PRO.price}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setTiers((prev) => ({
                          ...prev,
                          PRO: { ...prev.PRO, price: val },
                        }));
                      }}
                      className="w-full bg-orange-50/30 border border-orange-200 rounded-xl px-3 py-2 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">One-off fee for 180-day cycle</p>
                </div>

                {/* Feature Bullets */}
                <div className="flex-1 flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Features ({tiers.PRO.features.length})
                    </label>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={featureInputs.PRO}
                      onChange={(e) =>
                        setFeatureInputs((prev) => ({ ...prev, PRO: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature('PRO');
                        }
                      }}
                      placeholder="Add pro feature..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature('PRO')}
                      className="p-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 flex-1">
                    {tiers.PRO.features.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No features configured</p>
                    ) : (
                      tiers.PRO.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-orange-50/20 px-2.5 py-1.5 rounded-lg border border-orange-100 group"
                        >
                          <span className="text-gray-800 font-medium flex items-center gap-1.5 leading-tight">
                            <Check className="w-3 h-3 text-orange-500 shrink-0" />
                            {feat}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature('PRO', idx)}
                            className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quotas / Limits */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-orange-500" />
                    Quotas / Limits (Optional)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={quotaKeyInputs.PRO}
                      onChange={(e) =>
                        setQuotaKeyInputs((prev) => ({ ...prev, PRO: e.target.value }))
                      }
                      placeholder="key (e.g. maxListings)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold"
                    />
                    <input
                      type="text"
                      value={quotaValInputs.PRO}
                      onChange={(e) =>
                        setQuotaValInputs((prev) => ({ ...prev, PRO: e.target.value }))
                      }
                      placeholder="limit"
                      className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddQuota('PRO')}
                      className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {Object.keys(tiers.PRO.quotas).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(tiers.PRO.quotas).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-800 rounded-md text-[10px] font-bold"
                        >
                          <span className="font-mono">{k}:</span>
                          <span className="text-gray-900">{String(v)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuota('PRO', k)}
                            className="hover:text-red-500"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ================= PRO+ VARIANT ================= */}
              <div className="bg-white border-2 border-purple-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4 relative">
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-xs font-black text-gray-900 uppercase tracking-wider">
                      Pro+
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyFeatures('PRO', 'PRO_PLUS')}
                      className="px-2 py-0.5 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-purple-200/60 transition-all"
                      title="Clone all features from Pro"
                    >
                      <Copy className="w-2.5 h-2.5" /> Copy Pro
                    </button>
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200/70 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> 1 Year (Leap-safe)
                    </span>
                  </div>
                </div>

                {/* Price Input */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Pro+ Price (£)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-gray-400">£</span>
                    <input
                      type="number"
                      min="0"
                      value={tiers.PRO_PLUS.price}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setTiers((prev) => ({
                          ...prev,
                          PRO_PLUS: { ...prev.PRO_PLUS, price: val },
                        }));
                      }}
                      className="w-full bg-purple-50/30 border border-purple-200 rounded-xl px-3 py-2 text-lg font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium">366d in leap year, 365d standard</p>
                </div>

                {/* Feature Bullets */}
                <div className="flex-1 flex flex-col space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                      Features ({tiers.PRO_PLUS.features.length})
                    </label>
                  </div>

                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={featureInputs.PRO_PLUS}
                      onChange={(e) =>
                        setFeatureInputs((prev) => ({ ...prev, PRO_PLUS: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature('PRO_PLUS');
                        }
                      }}
                      placeholder="Add pro+ feature..."
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature('PRO_PLUS')}
                      className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all text-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 flex-1">
                    {tiers.PRO_PLUS.features.length === 0 ? (
                      <p className="text-xs text-gray-400 italic py-2">No features configured</p>
                    ) : (
                      tiers.PRO_PLUS.features.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-xs bg-purple-50/20 px-2.5 py-1.5 rounded-lg border border-purple-100 group"
                        >
                          <span className="text-gray-800 font-medium flex items-center gap-1.5 leading-tight">
                            <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                            {feat}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFeature('PRO_PLUS', idx)}
                            className="p-0.5 text-gray-300 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Quotas / Limits */}
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-3 h-3 text-purple-500" />
                    Quotas / Limits (Optional)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={quotaKeyInputs.PRO_PLUS}
                      onChange={(e) =>
                        setQuotaKeyInputs((prev) => ({ ...prev, PRO_PLUS: e.target.value }))
                      }
                      placeholder="key (e.g. maxListings)"
                      className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-mono font-bold"
                    />
                    <input
                      type="text"
                      value={quotaValInputs.PRO_PLUS}
                      onChange={(e) =>
                        setQuotaValInputs((prev) => ({ ...prev, PRO_PLUS: e.target.value }))
                      }
                      placeholder="limit"
                      className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddQuota('PRO_PLUS')}
                      className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-bold"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {Object.keys(tiers.PRO_PLUS.quotas).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {Object.entries(tiers.PRO_PLUS.quotas).map(([k, v]) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 border border-purple-200 text-purple-800 rounded-md text-[10px] font-bold"
                        >
                          <span className="font-mono">{k}:</span>
                          <span className="text-gray-900">{String(v)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuota('PRO_PLUS', k)}
                            className="hover:text-red-500"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-gray-50 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving Package...
              </>
            ) : initialPackage ? (
              'Save All 3 Variants'
            ) : (
              'Create 3-Tier Local Package'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
