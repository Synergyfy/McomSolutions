import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CreditCard,
  Eye,
  Layers,
  Loader2,
  Plus,
  Shield,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAdminAccessPlans,
  useCreateAccessPlan,
  useExternalPlans,
  useSupportedPlatforms,
  useUpdateAccessPlan,
} from '../services/admin/hooks';
import type {
  AccessIncludedAppPlan,
  AccessPlan,
  CreateAccessPlanInput,
  PlatformInfo,
  TierName,
} from '../services/admin/types';

const STEPS = ['Basics', 'Price & Duration', 'Platform Access', 'Review'] as const;
const VARIANTS: TierName[] = ['Standard', 'Pro', 'Pro+'];
const DURATION_PRESETS = [3, 7, 14, 30, 90, 180, 365, 400];

const COLOR_PRESETS = [
  { label: 'Amber', value: 'border-amber-600/20 text-amber-600 bg-amber-50', dotColor: 'bg-amber-500' },
  { label: 'Slate', value: 'border-slate-400/20 text-slate-500 bg-slate-50', dotColor: 'bg-slate-400' },
  { label: 'Gold', value: 'border-yellow-500/30 text-yellow-600 bg-yellow-50', dotColor: 'bg-yellow-500' },
  { label: 'Blue', value: 'border-blue-600/20 text-blue-700 bg-blue-50', dotColor: 'bg-blue-600' },
  { label: 'Green', value: 'border-emerald-500/20 text-emerald-600 bg-emerald-50', dotColor: 'bg-emerald-500' },
  { label: 'Purple', value: 'border-purple-500/20 text-purple-600 bg-purple-50', dotColor: 'bg-purple-500' },
];

const inputClass =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-h-[48px]';
const labelClass = 'block text-sm font-bold text-gray-700 mb-1.5';

function friendlyError(err: unknown): string {
  const msg =
    (err as any)?.response?.data?.message ||
    (err as any)?.message ||
    'Something went wrong. Please check your entries and try again.';
  return Array.isArray(msg) ? msg.join(' ') : String(msg);
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs sm:text-sm font-semibold text-red-600 mt-1.5">{message}</p>;
}

function normalizeVariantTier(value?: string | null): TierName {
  const normalized = (value || '').toUpperCase().replace(/[^A-Z+]/g, '');
  if (normalized === 'PRO_PLUS' || normalized === 'PROPLUS' || normalized === 'PRO+') return 'Pro+';
  if (normalized === 'PRO') return 'Pro';
  return 'Standard';
}

export default function AdminAccessEditor() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const segments = location.pathname.split('/');
  const isNew = segments[3] === 'new';
  const planId = !isNew ? segments[3] : null;

  const { data: plansRes, isLoading: plansLoading } = useAdminAccessPlans();
  const plans: AccessPlan[] = plansRes?.data ?? [];
  const editingPlan = planId ? plans.find((p) => p.id === planId) : undefined;

  const createPlan = useCreateAccessPlan();
  const updatePlan = useUpdateAccessPlan();
  const saving = createPlan.isPending || updatePlan.isPending;
  const saveError = createPlan.error || updatePlan.error;

  const [step, setStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const initialized = useRef(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [whoItIsFor, setWhoItIsFor] = useState('');
  const [badge, setBadge] = useState('');
  const [colorPreset, setColorPreset] = useState(COLOR_PRESETS[4].value);
  const [price, setPrice] = useState(19.99);
  const [durationDays, setDurationDays] = useState(30);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState('');
  const [includedApps, setIncludedApps] = useState<AccessIncludedAppPlan[]>([]);

  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedVariant, setSelectedVariant] = useState<TierName>('Standard');

  const { data: platformsRes } = useSupportedPlatforms();
  const platforms: PlatformInfo[] = platformsRes?.data ?? [];
  const { data: externalPlansRes, isLoading: externalPlansLoading } = useExternalPlans(selectedPlatform);

  const availablePlans = useMemo(() => {
    const extPlans = (externalPlansRes as any)?.data ?? [];
    return extPlans.map((ep: any) => ({
      id: ep.id,
      name: ep.name,
      variants: Array.isArray(ep.variants) ? ep.variants : [],
    }));
  }, [externalPlansRes]);

  const selectedPlan = availablePlans.find((p: any) => p.id === selectedPlanId);
  const hasVariants = Array.isArray(selectedPlan?.variants) && selectedPlan!.variants.length > 0;

  useEffect(() => {
    if (initialized.current) return;
    if (!isNew && (plansLoading || !planId)) return;
    const src = isNew ? undefined : editingPlan;
    if (!isNew && planId && !plansLoading && !src) return;
    initialized.current = true;
    if (!src) return;

    setName(src.name || '');
    setDescription(src.description || '');
    setWhoItIsFor(src.whoItIsFor || '');
    setBadge(src.badge || '');
    setColorPreset(src.color || COLOR_PRESETS[4].value);
    setPrice(Number(src.price ?? 0));
    setDurationDays(Number(src.durationDays ?? 30));
    setFeatures(Array.isArray(src.features) ? src.features : []);
    setIncludedApps(
      (src.appBundles ?? []).map((bundle) => ({
        platform: bundle.platform,
        planId: bundle.externalPlanId || '',
        externalPlanId: bundle.externalPlanId || undefined,
        planName: bundle.packageName,
        variantTier: normalizeVariantTier(bundle.variantTier),
        limits: (bundle.limits as Record<string, any> | null) ?? undefined,
      })),
    );
  }, [isNew, planId, plansLoading, editingPlan]);

  const unknownPlan = !isNew && !plansLoading && planId && !editingPlan;

  const nameError = !name.trim() ? 'Give the access pass a name.' : null;
  const descriptionError = !description.trim() ? 'Add a short description.' : null;
  const priceError =
    !Number.isFinite(price) || price <= 0 ? 'Enter a price greater than £0.' : null;
  const durationError =
    !Number.isInteger(durationDays) || durationDays < 1 || durationDays > 800
      ? 'Duration must be a whole number between 1 and 800 days.'
      : null;
  const bundlesError = includedApps.length === 0 ? 'Add at least one platform plan.' : null;
  const basicsError = nameError || descriptionError;
  const pricingError = priceError || durationError;

  const canContinue =
    step === 0 ? !basicsError : step === 1 ? !pricingError : step === 2 ? !bundlesError : true;

  const addFeature = () => {
    const text = newFeatureText.trim();
    if (!text) return;
    if (!features.includes(text)) setFeatures([...features, text]);
    setNewFeatureText('');
  };

  const addBundle = () => {
    if (!selectedPlan || !selectedPlatform) return;
    if (includedApps.some((app) => app.platform === selectedPlatform)) {
      setFormError(`Only one plan per platform is allowed. Remove the existing ${selectedPlatform} bundle first.`);
      return;
    }
    const variant = hasVariants
      ? selectedPlan.variants.find(
          (v: any) => normalizeVariantTier(v.tier || v.tierLevel?.name) === selectedVariant,
        )
      : undefined;
    const externalPlanId = String(variant?.id ?? selectedPlan.id);
    const limits = variant?.configuration
      ? {
          ...(variant.configuration.quotas ?? {}),
          ...(variant.configuration.featureFlags ?? {}),
        }
      : undefined;

    setIncludedApps([
      ...includedApps,
      {
        platform: selectedPlatform,
        planId: selectedPlan.id,
        externalPlanId,
        planName: selectedPlan.name,
        variantTier: hasVariants ? selectedVariant : 'Standard',
        limits,
      },
    ]);
    setFormError(null);
    setSelectedPlanId('');
    setSelectedVariant('Standard');
  };

  const handleSave = () => {
    setFormError(null);
    setShowErrors(true);
    if (basicsError || pricingError || bundlesError) {
      setFormError(basicsError || pricingError || bundlesError);
      setStep(basicsError ? 0 : pricingError ? 1 : 2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const payload: CreateAccessPlanInput = {
      name: name.trim(),
      description: description.trim(),
      price,
      durationDays,
      whoItIsFor: whoItIsFor.trim() || undefined,
      badge: badge.trim() || undefined,
      color: colorPreset,
      features: features.map((f) => f.trim()).filter(Boolean),
      includedApps: includedApps.map((app) => ({
        platform: app.platform,
        planId: app.planId,
        externalPlanId: app.externalPlanId || app.planId,
        planName: app.planName,
        variantTier: app.variantTier || 'Standard',
        limits: app.limits,
      })),
    };

    const done = () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accessPlans'] });
      queryClient.invalidateQueries({ queryKey: ['accessPlans'] });
      navigate('/admin/access');
    };

    if (isNew) createPlan.mutate(payload, { onSuccess: done });
    else if (planId) updatePlan.mutate({ id: planId, data: payload }, { onSuccess: done });
  };

  const next = () => {
    if (!canContinue) {
      setShowErrors(true);
      setFormError(step === 0 ? basicsError : step === 1 ? pricingError : bundlesError);
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
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading access pass…
      </div>
    );
  }

  if (unknownPlan) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Access pass not found</h2>
        <p className="text-sm text-gray-500 mb-6">It may have been deleted. Go back and pick another one.</p>
        <button
          onClick={() => navigate('/admin/access')}
          className="px-6 py-3 rounded-xl bg-brand-blue text-white text-sm font-bold min-h-[48px]"
        >
          Back to access passes
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 pb-32">
      <button
        onClick={() => navigate('/admin/access')}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-blue font-bold text-sm mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> All access passes
      </button>

      <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
        {isNew ? 'Create access pass' : `Edit ${editingPlan?.name || 'access pass'}`}
      </h1>
      <p className="text-sm text-gray-500 mt-1 mb-5">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>

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
                  <label htmlFor="access-name" className={labelClass}>Access pass name</label>
                  <input
                    id="access-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 7-Day Mall Pass"
                    aria-invalid={(showErrors) && !!nameError}
                    className={cn(inputClass, showErrors && nameError && 'border-red-300')}
                  />
                  {showErrors && <FieldError message={nameError} />}
                </div>
                <div>
                  <label htmlFor="access-who" className={labelClass}>Who it is for <span className="text-gray-400 font-medium">· optional</span></label>
                  <input
                    id="access-who"
                    value={whoItIsFor}
                    onChange={(e) => setWhoItIsFor(e.target.value)}
                    placeholder="e.g. Businesses testing the ecosystem"
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="access-desc" className={labelClass}>Description</label>
                <textarea
                  id="access-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this access pass unlock?"
                  rows={3}
                  aria-invalid={showErrors && !!descriptionError}
                  className={cn(inputClass, 'min-h-[96px] resize-y', showErrors && descriptionError && 'border-red-300')}
                />
                {showErrors && <FieldError message={descriptionError} />}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="access-badge" className={labelClass}>Badge <span className="text-gray-400 font-medium">· optional</span></label>
                  <input
                    id="access-badge"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    placeholder="e.g. LIMITED TIME"
                    className={inputClass}
                  />
                </div>
                <div>
                  <span className={labelClass}>Colour theme <span className="text-gray-400 font-medium">· optional</span></span>
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

              <div className="rounded-2xl border border-gray-200 p-4 space-y-2.5">
                <div className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" /> What is included <span className="text-gray-400 font-medium">· optional</span>
                </div>
                {features.map((f, i) => (
                  <div key={`${f}-${i}`} className="flex items-center justify-between gap-2 text-sm bg-gray-50 px-3 py-2.5 rounded-xl min-h-[48px]">
                    <span className="text-gray-700 font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-500 shrink-0" /> {f}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                      aria-label={`Remove ${f}`}
                      className="p-2 text-gray-300 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    placeholder="Add an included feature…"
                    value={newFeatureText}
                    onChange={(e) => setNewFeatureText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addFeature()}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    aria-label="Add feature"
                    className="shrink-0 w-[52px] min-h-[48px] bg-gray-900 text-white rounded-xl flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                Access passes are one-time payments. The buyer gets the bundled platform plans for exactly the number of days you set here — no membership tiers or instalment options.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="access-price" className={labelClass}>One-time price (£)</label>
                  <input
                    id="access-price"
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    aria-invalid={showErrors && !!priceError}
                    className={cn(inputClass, 'text-2xl font-black', showErrors && priceError && 'border-red-300')}
                  />
                  {showErrors && <FieldError message={priceError} />}
                </div>
                <div>
                  <label htmlFor="access-days" className={labelClass}>Access duration (days)</label>
                  <input
                    id="access-days"
                    type="number"
                    min={1}
                    max={800}
                    step="1"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    aria-invalid={showErrors && !!durationError}
                    className={cn(inputClass, 'text-2xl font-black', showErrors && durationError && 'border-red-300')}
                  />
                  {showErrors && <FieldError message={durationError} />}
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quick presets</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DURATION_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDurationDays(days)}
                      className={cn(
                        'px-3 py-2 rounded-xl border text-sm font-bold min-h-[44px]',
                        durationDays === days
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
                      )}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50/70 border border-emerald-100 p-4 text-sm text-emerald-800 flex items-start gap-2">
                <Calendar className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  At checkout, the platform plans are granted for <strong>{durationDays || 0} days</strong>. Existing active plans that last longer are never shortened.
                </span>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-gray-500 leading-relaxed">
                Pick the platform plans this access pass unlocks. Choose a variant when the platform exposes Standard / Pro / Pro+ plans — the access duration still overrides the platform plan's own duration.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bundle-platform" className={labelClass}>Platform</label>
                  <select
                    id="bundle-platform"
                    value={selectedPlatform}
                    onChange={(e) => {
                      setSelectedPlatform(e.target.value);
                      setSelectedPlanId('');
                      setSelectedVariant('Standard');
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
                  <label htmlFor="bundle-plan" className={labelClass}>Plan</label>
                  <select
                    id="bundle-plan"
                    value={selectedPlanId}
                    onChange={(e) => {
                      setSelectedPlanId(e.target.value);
                      setSelectedVariant('Standard');
                    }}
                    disabled={!selectedPlatform || externalPlansLoading}
                    className={cn(inputClass, 'bg-white disabled:opacity-50')}
                  >
                    <option value="">{externalPlansLoading ? 'Loading plans…' : 'Choose plan…'}</option>
                    {availablePlans.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {hasVariants && (
                <div>
                  <span className={labelClass}>Variant</span>
                  <div className="grid grid-cols-3 gap-2">
                    {VARIANTS.map((variant) => (
                      <button
                        key={variant}
                        type="button"
                        onClick={() => setSelectedVariant(variant)}
                        className={cn(
                          'py-2.5 rounded-xl border text-sm font-bold min-h-[48px]',
                          selectedVariant === variant
                            ? 'border-brand-blue bg-blue-50 text-brand-blue'
                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100',
                        )}
                      >
                        {variant}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={addBundle}
                disabled={!selectedPlanId}
                className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-bold disabled:opacity-40 min-h-[48px] flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add to access pass
              </button>

              {includedApps.length === 0 ? (
                <p className={cn('text-sm text-center py-4', showErrors && bundlesError ? 'text-red-600 font-semibold' : 'text-gray-400')}>
                  {showErrors && bundlesError ? bundlesError : 'No platform plans added yet.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {includedApps.map((app, i) => (
                    <div key={`${app.platform}-${app.externalPlanId || app.planId}-${i}`} className="flex items-center justify-between gap-2 bg-blue-50/60 border border-blue-100 rounded-xl px-3 py-2.5 min-h-[52px]">
                      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 min-w-0">
                        <Layers className="w-4 h-4 text-brand-blue shrink-0" />
                        <span className="truncate">
                          <span className="text-brand-blue">{app.platform}:</span> {app.planName}
                          {app.variantTier ? ` · ${app.variantTier}` : ''}
                        </span>
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

          {step === 3 && (
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
                <div className="grid grid-cols-2 gap-3 p-3.5">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div className="text-xs text-gray-500 font-medium">One-time price</div>
                    <div className="text-xl font-black text-gray-900">£{price}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div className="text-xs text-gray-500 font-medium">Duration</div>
                    <div className="text-xl font-black text-gray-900">{durationDays} days</div>
                  </div>
                </div>
                <div className="p-3.5">
                  <div className="text-gray-500 font-medium mb-2">Platform plans</div>
                  <div className="flex flex-wrap gap-1.5">
                    {includedApps.map((app, i) => (
                      <span key={`${app.platform}-${i}`} className="px-2 py-1 bg-blue-50 text-brand-blue rounded-lg text-xs font-bold">
                        {app.platform}: {app.planName}{app.variantTier ? ` (${app.variantTier})` : ''}
                      </span>
                    ))}
                    {includedApps.length === 0 && <span className="text-gray-400 text-xs">None</span>}
                  </div>
                </div>
                <div className="p-3.5 flex justify-between gap-3">
                  <span className="text-gray-500 font-medium">Features</span>
                  <span className="font-bold text-gray-900">{features.length}</span>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-400 leading-relaxed flex items-start gap-1.5">
                <CreditCard className="w-4 h-4 shrink-0 mt-0.5" />
                Saving writes the access pass and its platform bundles transactionally. Buyers pay once and receive access for the configured number of days.
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

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
              onClick={() => navigate('/admin/access')}
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
                  <Check className="w-5 h-5" /> {isNew ? 'Create access pass' : 'Save changes'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
