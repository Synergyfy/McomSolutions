import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  X,
  Loader2,
  AlertCircle,
  Calendar,
  Zap,
  Shield,
  Layers,
  ListChecks,
  CreditCard,
  Eye,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAdminPlans,
  useCreatePlan,
  useUpdatePlan,
  useSupportedPlatforms,
  useExternalPlans,
} from '../services/admin/hooks';
import type {
  CreatePlanInput,
  IncludedAppPlan,
  MembershipPlan,
  PlatformInfo,
  TierEntitlementResource,
} from '../services/admin/types';
import SplitEditor, {
  TIER_DURATIONS,
  TIER_SPLITS,
  draftError,
  type OptionDraft,
  type TierKey,
} from '../components/admin/SplitEditor';

const STEPS = ['Basics', 'Pricing', 'Features', 'Entitlements', 'Bundles', 'Review'] as const;

const COLOR_PRESETS = [
  { label: 'Amber', value: 'border-amber-600/20 text-amber-600 bg-amber-50', dotColor: 'bg-amber-500' },
  { label: 'Slate', value: 'border-slate-400/20 text-slate-500 bg-slate-50', dotColor: 'bg-slate-400' },
  { label: 'Gold', value: 'border-yellow-500/30 text-yellow-600 bg-yellow-50', dotColor: 'bg-yellow-500' },
  { label: 'Blue', value: 'border-blue-600/20 text-blue-700 bg-blue-50', dotColor: 'bg-blue-600' },
  { label: 'Green', value: 'border-emerald-500/20 text-emerald-600 bg-emerald-50', dotColor: 'bg-emerald-500' },
  { label: 'Purple', value: 'border-purple-500/20 text-purple-600 bg-purple-50', dotColor: 'bg-purple-500' },
];

const TIER_META: Record<TierKey, { blurb: string; duration: string; chip: string; card: string }> = {
  Standard: {
    blurb: 'Get started version',
    duration: '90 Days',
    chip: 'bg-gray-700',
    card: 'border-gray-200',
  },
  Pro: {
    blurb: 'Mid-tier scaling version',
    duration: '180 Days',
    chip: 'bg-orange-600',
    card: 'border-orange-500/40',
  },
  'Pro+': {
    blurb: 'Maximum power version',
    duration: 'Annual · leap-year aware',
    chip: 'bg-purple-600',
    card: 'border-purple-300',
  },
};

const inputClass =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[48px]';
const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';
const hintClass = 'text-xs sm:text-sm text-gray-400 mt-1';

function friendlyError(err: unknown): string {
  const msg =
    (err as any)?.response?.data?.message ||
    (err as any)?.message ||
    'Something went wrong. Please check your entries and try again.';
  return Array.isArray(msg) ? msg.join(' ') : String(msg);
}

/** Label suffix showing whether a field must be filled in. */
function Requirement({ required }: { required: boolean }) {
  return required ? (
    <span className="ml-1.5 inline-flex items-center px-1.5 py-px rounded-md bg-red-50 text-red-600 text-[10px] font-extrabold uppercase tracking-wide align-middle">
      Required
    </span>
  ) : (
    <span className="ml-1.5 inline-flex items-center px-1.5 py-px rounded-md bg-gray-100 text-gray-400 text-[10px] font-extrabold uppercase tracking-wide align-middle">
      Optional
    </span>
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs sm:text-sm font-semibold text-red-600 mt-1.5">{message}</p>;
}

export default function AdminMembershipEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const segments = location.pathname.split('/');
  const isNew = segments[3] === 'new';
  const planId = !isNew ? segments[3] : null;

  const { data: plansRes, isLoading: plansLoading } = useAdminPlans();
  const plans: MembershipPlan[] = plansRes?.data ?? [];
  const editingPlan = planId ? plans.find((p) => p.id === planId) : undefined;

  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const saving = createPlan.isPending || updatePlan.isPending;
  const saveError = createPlan.error || updatePlan.error;

  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true }));
  const initialized = useRef(false);

  // ── Form state (mirrors the previous modal editor) ──
  const [name, setName] = useState('Bronze');
  const [description, setDescription] = useState('Essential ecosystem plan');
  const [whoItIsFor, setWhoItIsFor] = useState('Small & Medium Businesses');
  const [badge, setBadge] = useState('');
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[0].value);

  const [tierPrices, setTierPrices] = useState<Record<TierKey, number>>({ Standard: 49, Pro: 123, 'Pro+': 245 });
  const [tierOptions, setTierOptions] = useState<Record<TierKey, OptionDraft[]>>({
    Standard: [],
    Pro: [],
    'Pro+': [],
  });
  const [tierFeatures, setTierFeatures] = useState<Record<TierKey, string[]>>({ Standard: [], Pro: [], 'Pro+': [] });
  const [newFeatureText, setNewFeatureText] = useState<Record<TierKey, string>>({ Standard: '', Pro: '', 'Pro+': '' });
  const [entitlements, setEntitlements] = useState<TierEntitlementResource[]>([]);
  const [includedApps, setIncludedApps] = useState<IncludedAppPlan[]>([]);
  const [selectedBundlePlatform, setSelectedBundlePlatform] = useState('');
  const [selectedBundlePlanId, setSelectedBundlePlanId] = useState('');

  const [newResName, setNewResName] = useState('');
  const [newResValues, setNewResValues] = useState({ standard: '10', pro: '25', proPlus: '50' });

  // ── Bundles data ──
  const { data: platformsRes } = useSupportedPlatforms();
  const platforms: PlatformInfo[] = platformsRes?.data ?? [];
  const { data: externalPlansRes } = useExternalPlans(selectedBundlePlatform);
  const availablePlansForPlatform = useMemo(() => {
    const extPlans = (externalPlansRes as any)?.data ?? [];
    return extPlans.map((ep: any) => ({ id: ep.id, name: ep.name, price: ep.tierPrices?.Standard ?? ep.monthlyPrice ?? 0 }));
  }, [externalPlansRes]);

  // ── Init from existing plan (edit mode) ──
  useEffect(() => {
    if (initialized.current) return;
    if (!isNew && (plansLoading || !planId)) return;
    const src = isNew ? undefined : editingPlan;
    if (!isNew && planId && !plansLoading && !src) return; // unknown id — handled below
    initialized.current = true;
    if (!src) return;

    setName(src.name || 'Bronze');
    setDescription(src.description || '');
    setWhoItIsFor(src.whoItIsFor || '');
    setBadge(src.badge || '');
    setColorPreset(src.color || COLOR_PRESETS[0].value);

    const rawPrices = src.tierPrices as any;
    const base = Number(src.monthlyPrice ?? src.price ?? 49);
    const prices: Record<TierKey, number> = {
      Standard: Number(rawPrices?.Standard ?? rawPrices?.Normal ?? base),
      Pro: Number(rawPrices?.Pro ?? Math.round(base * 2.5)),
      'Pro+': Number(rawPrices?.['Pro+'] ?? Math.round(base * 5)),
    };
    setTierPrices(prices);

    const rawFeatures = src.tierFeatures as any;
    const baseFeatures = src.features || [];
    setTierFeatures({
      Standard: rawFeatures?.Standard || baseFeatures || [],
      Pro: rawFeatures?.Pro || baseFeatures || [],
      'Pro+': rawFeatures?.['Pro+'] || baseFeatures || [],
    });

    const apiTiers = (src as any).tiers;
    const build = (key: TierKey): OptionDraft[] =>
      TIER_SPLITS[key].map((s) => {
        const apiTier = Array.isArray(apiTiers)
          ? apiTiers.find((t: any) => t.tier === key || (key === 'Pro+' && t.tier === 'ProPlus'))
          : null;
        const apiOpt = apiTier?.paymentOptions?.find((o: any) => o.paymentPlan === s.paymentPlan);
        if (apiOpt) {
          return {
            paymentPlan: s.paymentPlan,
            mode: apiOpt.mode === 'manual' ? ('manual' as const) : ('auto' as const),
            manualPrice: Number(apiOpt.manualPrice ?? apiOpt.perChargePrice) || 0,
            surchargePct: Number(apiOpt.surchargePct ?? 0),
          };
        }
        return { paymentPlan: s.paymentPlan, mode: 'auto' as const, manualPrice: 0, surchargePct: 0 };
      });
    setTierOptions({ Standard: build('Standard'), Pro: build('Pro'), 'Pro+': build('Pro+') });

    if (Array.isArray(src.tierEntitlements) && src.tierEntitlements.length > 0) {
      setEntitlements(src.tierEntitlements as TierEntitlementResource[]);
    }
    setIncludedApps(src.includedApps || []);
  }, [isNew, planId, plansLoading, editingPlan]);

  const unknownPlan = !isNew && !plansLoading && planId && !editingPlan;

  // ── Validation (per-field messages; shown after blur or a Continue/Save attempt) ──
  const nameError = !name.trim() ? 'Give the membership a name.' : null;
  const descriptionError = !description.trim() ? 'Add a short description.' : null;
  const basicsError = nameError || descriptionError;
  const priceErrorFor = (tier: TierKey) =>
    !Number.isFinite(tierPrices[tier]) || tierPrices[tier] < 0 ? 'Enter an outright price of £0 or more.' : null;
  const pricingError = (() => {
    for (const k of Object.keys(tierPrices) as TierKey[]) {
      if (priceErrorFor(k)) return 'Tier prices must be £0 or more.';
    }
    const bad = (Object.keys(tierOptions) as TierKey[]).some((k) => tierOptions[k].some((d) => draftError(d) !== null));
    if (bad) return 'Fix the highlighted payment option before continuing.';
    return null;
  })();

  const canContinue = step === 0 ? !basicsError : step === 1 ? !pricingError : true;

  // ── Mutations helpers ──
  const addFeature = (tier: TierKey) => {
    const text = newFeatureText[tier]?.trim();
    if (!text) return;
    setTierFeatures({ ...tierFeatures, [tier]: [...tierFeatures[tier], text] });
    setNewFeatureText({ ...newFeatureText, [tier]: '' });
  };
  const removeFeature = (tier: TierKey, index: number) => {
    setTierFeatures({ ...tierFeatures, [tier]: tierFeatures[tier].filter((_, i) => i !== index) });
  };

  const addResource = () => {
    if (!newResName.trim()) return;
    const key = newResName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    setEntitlements([
      ...entitlements,
      { resourceKey: key, name: newResName.trim(), standard: newResValues.standard, pro: newResValues.pro, proPlus: newResValues.proPlus },
    ]);
    setNewResName('');
    setNewResValues({ standard: '10', pro: '25', proPlus: '50' });
  };
  const updateEntitlement = (index: number, field: 'standard' | 'pro' | 'proPlus', value: string) => {
    const updated = [...entitlements];
    updated[index] = { ...updated[index], [field]: value };
    setEntitlements(updated);
  };

  const addBundledApp = () => {
    if (!selectedBundlePlanId) return;
    const planObj = availablePlansForPlatform.find((p: any) => p.id === selectedBundlePlanId);
    if (!planObj) return;
    if (includedApps.some((a) => a.platform === selectedBundlePlatform && a.planId === planObj.id)) return;
    setIncludedApps([
      ...includedApps,
      { platform: selectedBundlePlatform, planId: planObj.id, planName: planObj.name, standalonePrice: planObj.price },
    ]);
    setSelectedBundlePlanId('');
  };

  const handleSave = () => {
    setFormError(null);
    setShowErrors(true);
    if (basicsError || pricingError) {
      setFormError(basicsError || pricingError);
      setStep(basicsError ? 0 : 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const platformAccess: string[] = Array.from(new Set(includedApps.map((a) => a.platform)));
    const tiers = (Object.keys(TIER_DURATIONS) as TierKey[]).map((tier) => ({
      tier,
      fullPrice: tierPrices[tier],
      durationDays: TIER_DURATIONS[tier],
      features: tierFeatures[tier],
      entitlements: entitlements.map((e) => ({
        resourceKey: e.resourceKey,
        quotaValue: String(tier === 'Standard' ? e.standard : tier === 'Pro' ? e.pro : e.proPlus),
      })),
      paymentOptions: [
        { paymentPlan: 'full' as const, mode: 'manual' as const, manualPrice: tierPrices[tier] },
        ...tierOptions[tier].map((o) => ({
          paymentPlan: o.paymentPlan,
          mode: o.mode,
          ...(o.mode === 'manual' ? { manualPrice: o.manualPrice } : { surchargePct: o.surchargePct }),
        })),
      ],
    }));

    const payload: CreatePlanInput = {
      name: name.trim(),
      description: description.trim(),
      whoItIsFor: whoItIsFor.trim(),
      badge: badge.trim() || undefined,
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
      tierPrices: { ...tierPrices },
      tierFeatures: { ...tierFeatures },
      tierEntitlements: entitlements,
      tierDurations: { ...TIER_DURATIONS },
      tiers,
    };

    const done = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      navigate('/admin/memberships');
    };
    if (isNew) {
      createPlan.mutate(payload, { onSuccess: done });
    } else if (planId) {
      updatePlan.mutate({ id: planId, data: payload }, { onSuccess: done });
    }
  };

  const next = () => {
    if (!canContinue) {
      setShowErrors(true);
      setFormError(step === 0 ? basicsError : pricingError);
      return;
    }
    setFormError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isNew && plansLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm font-semibold">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading membership…
      </div>
    );
  }

  if (unknownPlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Membership not found</h2>
        <p className="text-sm text-gray-500 mb-6">It may have been deleted. Go back and pick another one.</p>
        <button
          onClick={() => navigate('/admin/memberships')}
          className="px-6 py-3 rounded-xl bg-brand-blue text-white text-sm font-bold min-h-[48px]"
        >
          Back to memberships
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pb-32">
      <button
        onClick={() => navigate('/admin/memberships')}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-blue font-bold text-sm mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> All memberships
      </button>

      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
        {isNew ? 'Create membership' : `Edit ${editingPlan?.name || 'membership'}`}
      </h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

      {/* Progress */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1" role="list" aria-label="Setup progress">
        {STEPS.map((label, i) => (
          <button
            key={label}
            role="listitem"
            onClick={() => i < step && setStep(i)}
            disabled={i >= step}
            aria-current={i === step ? 'step' : undefined}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold whitespace-nowrap min-h-[40px]',
              i < step
                ? 'bg-green-100 text-green-700'
                : i === step
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 text-gray-400',
            )}
          >
            {i < step ? <Check className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
            {label}
          </button>
        ))}
      </div>

      {(formError || saveError) && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl p-3.5 text-sm text-red-700 font-semibold flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{formError || friendlyError(saveError)}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6 space-y-5"
        >
          {step === 0 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
              <div>
                <label htmlFor="plan-name" className={labelClass}>Membership name <Requirement required /></label>
                <input
                  id="plan-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => touch('name')}
                  placeholder="e.g. Gold"
                  aria-required="true"
                  aria-invalid={(touched.name || showErrors) && !!nameError}
                  aria-describedby={(touched.name || showErrors) && nameError ? 'plan-name-error' : undefined}
                  className={cn(inputClass, (touched.name || showErrors) && nameError && 'border-red-300 focus:ring-red-500/20 focus:border-red-500')}
                />
                {(touched.name || showErrors) && nameError && <FieldError message={nameError} />}
              </div>
              <div>
                <label htmlFor="plan-who" className={labelClass}>Who it is for <Requirement required={false} /></label>
                <input id="plan-who" value={whoItIsFor} onChange={(e) => setWhoItIsFor(e.target.value)} placeholder="e.g. Scaling businesses" className={inputClass} />
              </div>
              </div>
              <div>
                <label htmlFor="plan-desc" className={labelClass}>Description <Requirement required /></label>
                <textarea
                  id="plan-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => touch('description')}
                  placeholder="Who is this for and what do they get?"
                  rows={3}
                  aria-required="true"
                  aria-invalid={(touched.description || showErrors) && !!descriptionError}
                  className={cn(inputClass, 'min-h-[96px] resize-y', (touched.description || showErrors) && descriptionError && 'border-red-300 focus:ring-red-500/20 focus:border-red-500')}
                />
                {(touched.description || showErrors) && descriptionError && <FieldError message={descriptionError} />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="plan-badge" className={labelClass}>Badge <Requirement required={false} /></label>
                  <input id="plan-badge" value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="e.g. MOST POPULAR" className={inputClass} />
                </div>
                <div>
                  <span className={labelClass}>Colour theme <Requirement required={false} /></span>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => setColorPreset(preset.value)}
                        aria-pressed={colorPreset === preset.value}
                        title={preset.label}
                        className={cn(
                          'w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all',
                          colorPreset === preset.value ? 'border-orange-500 scale-105' : 'border-gray-200',
                        )}
                      >
                        <span className={cn('w-5 h-5 rounded-full', preset.dotColor)} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                Set the outright price per tier, then how buyers may split it. Split buyers pay slightly more overall — that is what makes outright the best value.
              </p>
              {(Object.keys(TIER_DURATIONS) as TierKey[]).map((tier) => (
                <section key={tier} className={cn('rounded-2xl border-2 p-4 sm:p-5 space-y-4', TIER_META[tier].card)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-1 bg-gray-900 text-white rounded-lg text-xs font-extrabold uppercase tracking-wide">
                      {tier}
                    </span>
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      {tier === 'Pro+' ? <Zap className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                      {TIER_META[tier].duration}
                    </span>
                  </div>
                  <div>
                    <label htmlFor={`full-${tier}`} className={labelClass}>
                      Outright price <Requirement required /> <span className="text-gray-400 font-medium">· unlocks the full term today</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-400">£</span>
                      <input
                        id={`full-${tier}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={tierPrices[tier]}
                        onChange={(e) => setTierPrices({ ...tierPrices, [tier]: Number(e.target.value) })}
                        onBlur={() => touch(`price-${tier}`)}
                        aria-required="true"
                        aria-invalid={(touched[`price-${tier}`] || showErrors) && !!priceErrorFor(tier)}
                        className={cn(
                          'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-2xl font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[56px]',
                          (touched[`price-${tier}`] || showErrors) && priceErrorFor(tier) && 'border-red-300 focus:ring-red-500/20 focus:border-red-500',
                        )}
                      />
                    </div>
                    {(touched[`price-${tier}`] || showErrors) && priceErrorFor(tier) && (
                      <FieldError message={priceErrorFor(tier)} />
                    )}
                  </div>
                  <SplitEditor
                    tierKey={tier}
                    fullPrice={tierPrices[tier]}
                    drafts={tierOptions[tier]}
                    onChange={(next) => setTierOptions({ ...tierOptions, [tier]: next })}
                    chipClass={cn(
                      tier === 'Standard' ? 'bg-gray-700' : tier === 'Pro' ? 'bg-orange-600' : 'bg-purple-600',
                    )}
                  />
                </section>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                What each tier includes. Buyers compare these lists before they pay. <span className="font-semibold">Features are optional — leave a tier empty if it has none yet.</span>
              </p>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
              {(Object.keys(TIER_DURATIONS) as TierKey[]).map((tier) => (
                <section key={tier} className="rounded-2xl border border-gray-200 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                    <ListChecks className="w-4 h-4 text-brand-blue" /> {tier} features <Requirement required={false} />
                  </div>
                  {tierFeatures[tier].map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-sm bg-gray-50 px-3 py-2.5 rounded-xl min-h-[48px]">
                      <span className="text-gray-700 font-medium flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFeature(tier, i)}
                        aria-label={`Remove ${f}`}
                        className="p-2 text-gray-300 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      placeholder={`Add a ${tier} feature…`}
                      value={newFeatureText[tier]}
                      onChange={(e) => setNewFeatureText({ ...newFeatureText, [tier]: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addFeature(tier)}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => addFeature(tier)}
                      aria-label={`Add ${tier} feature`}
                      className="shrink-0 w-[52px] min-h-[48px] bg-gray-900 text-white rounded-xl flex items-center justify-center"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </section>
              ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                Numeric limits enforced live per tier — e.g. campaigns, listings, API calls. <span className="font-semibold">Entirely optional — skip this step if the plan has no limits.</span>
              </p>
              {entitlements.map((e, i) => (
                <div key={i} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-600" /> {e.name || e.resourceKey}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEntitlements(entitlements.filter((_, j) => j !== i))}
                      aria-label={`Remove ${e.resourceKey}`}
                      className="p-2 text-gray-300 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['standard', 'pro', 'proPlus'] as const).map((field) => (
                      <div key={field}>
                        <label htmlFor={`ent-${i}-${field}`} className="block text-xs font-bold text-gray-500 mb-1 capitalize">
                          {field === 'proPlus' ? 'Pro+' : field}
                        </label>
                        <input
                          id={`ent-${i}-${field}`}
                          value={String(e[field] ?? '')}
                          onChange={(ev) => updateEntitlement(i, field, ev.target.value)}
                          inputMode="numeric"
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base font-bold text-gray-900 min-h-[48px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 space-y-3">
                <div className="text-sm font-extrabold text-gray-900">Add a resource <Requirement required={false} /></div>
                <div>
                  <label htmlFor="new-res-name" className={labelClass}>Resource name <Requirement required /></label>
                  <input id="new-res-name" value={newResName} onChange={(e) => setNewResName(e.target.value)} placeholder="e.g. Campaigns" className={inputClass} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['standard', 'pro', 'proPlus'] as const).map((field) => (
                    <div key={field}>
                      <label htmlFor={`new-res-${field}`} className="block text-xs font-bold text-gray-500 mb-1 capitalize">
                        {field === 'proPlus' ? 'Pro+' : field} quota
                      </label>
                      <input
                        id={`new-res-${field}`}
                        value={newResValues[field]}
                        onChange={(e) => setNewResValues({ ...newResValues, [field]: e.target.value })}
                        inputMode="numeric"
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-base font-bold text-gray-900 min-h-[48px]"
                      />
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addResource}
                  disabled={!newResName.trim()}
                  className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40 min-h-[48px] flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add resource
                </button>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                Bundle platform plans into this membership. Buyers get them automatically on activation. <span className="font-semibold">Bundles are optional — save without any.</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bundle-platform" className={labelClass}>Platform <Requirement required={false} /></label>
                  <select
                    id="bundle-platform"
                    value={selectedBundlePlatform}
                    onChange={(e) => {
                      setSelectedBundlePlatform(e.target.value);
                      setSelectedBundlePlanId('');
                    }}
                    className={cn(inputClass, 'bg-white')}
                  >
                    <option value="">Choose platform…</option>
                    {platforms.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bundle-plan" className={labelClass}>Plan <Requirement required={false} /></label>
                  <select
                    id="bundle-plan"
                    value={selectedBundlePlanId}
                    onChange={(e) => setSelectedBundlePlanId(e.target.value)}
                    disabled={!selectedBundlePlatform}
                    className={cn(inputClass, 'bg-white disabled:opacity-50')}
                  >
                    <option value="">Choose plan…</option>
                    {availablePlansForPlatform.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={addBundledApp}
                disabled={!selectedBundlePlanId}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40 min-h-[48px] flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add to bundle
              </button>
              {includedApps.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No bundled apps yet.</p>
              ) : (
                <div className="space-y-2">
                  {includedApps.map((app, i) => (
                    <div key={`${app.platform}-${app.planId}-${i}`} className="flex items-center justify-between gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5 min-h-[52px]">
                      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 min-w-0">
                        <Layers className="w-4 h-4 text-brand-blue shrink-0" />
                        <span className="truncate"><span className="text-brand-blue">{app.platform}:</span> {app.planName}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIncludedApps(includedApps.filter((_, j) => j !== i))}
                        aria-label={`Remove ${app.planName}`}
                        className="p-2 text-gray-300 hover:text-red-500 shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <div className="flex items-center gap-2 text-sm font-extrabold text-gray-900">
                <Eye className="w-4 h-4 text-brand-blue" /> Review before saving
              </div>
              <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 text-sm">
                <div className="p-3.5 flex justify-between gap-3">
                  <span className="text-gray-500 font-medium">Name</span>
                  <span className="font-bold text-gray-900 text-right">{name || '—'}</span>
                </div>
                <div className="p-3.5 flex justify-between gap-3">
                  <span className="text-gray-500 font-medium">For</span>
                  <span className="font-bold text-gray-900 text-right">{whoItIsFor || '—'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5">
                {(Object.keys(TIER_DURATIONS) as TierKey[]).map((tier) => (
                  <div key={tier} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div className="flex justify-between gap-3 mb-1">
                      <span className="font-extrabold text-gray-900">{tier}</span>
                      <span className="font-black text-gray-900">£{tierPrices[tier]}</span>
                    </div>
                    <div className="text-xs text-gray-500 space-y-0.5">
                      {tierOptions[tier].map((o) => (
                        <div key={o.paymentPlan}>
                          {o.paymentPlan === 'monthly' ? 'Monthly' : o.paymentPlan === 'quarterly' ? 'Quarterly' : 'Every 6 months'}: automatic split configured
                        </div>
                      ))}
                      <div>{tierFeatures[tier].length} features · {includedApps.length} bundled apps</div>
                    </div>
                  </div>
                ))}
                </div>
                <div className="p-3.5 flex justify-between gap-3">
                  <span className="text-gray-500 font-medium">Entitlements</span>
                  <span className="font-bold text-gray-900">{entitlements.length} resources</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed flex items-start gap-1.5">
                <CreditCard className="w-4 h-4 shrink-0 mt-0.5" />
                Saving writes all tiers, splits, features, limits and bundles in one transaction — buyers see the new prices immediately.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3">
        <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto flex gap-2.5">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              disabled={saving}
              className="px-5 min-h-[52px] rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-700 flex items-center gap-1.5 disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/admin/memberships')}
              className="px-5 min-h-[52px] rounded-2xl border-2 border-gray-200 text-sm font-bold text-gray-700"
            >
              Cancel
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="flex-1 min-h-[52px] rounded-2xl bg-brand-blue text-white text-base font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
            >
              Continue <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !canContinue}
              className="flex-1 min-h-[52px] rounded-2xl bg-green-600 text-white text-base font-extrabold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-600/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" /> {isNew ? 'Create membership' : 'Save changes'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
