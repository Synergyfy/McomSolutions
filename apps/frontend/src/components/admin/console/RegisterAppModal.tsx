import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Link,
  Loader2,
  Lock,
  Plus,
  Radio,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Webhook,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { CONSOLE_ALLOWED_SCOPES } from '../../../services/admin/types';
import { useRegisterApp } from './hooks/useConsoleApps';
import type { RegisterAppResult } from '../../../services/admin/types';

interface RegisterAppModalProps {
  onClose: () => void;
  onRegistered: (result: RegisterAppResult) => void;
}

const inputCls =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';

const labelCls = 'block text-xs font-bold text-gray-700 mb-1';

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

const platformSlugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

const SCOPE_DESCRIPTIONS: Record<string, { label: string; desc: string; icon: any }> = {
  profile: {
    label: 'User Profile',
    desc: 'Access user name, avatar, account ID, and basic metadata',
    icon: UserCheck,
  },
  email: {
    label: 'Verified Email',
    desc: 'Access the verified primary email address of the account',
    icon: ShieldCheck,
  },
  business: {
    label: 'Business Details',
    desc: 'Access registered business name, sector, address, and profile',
    icon: Layers,
  },
  membership: {
    label: 'Membership Tier',
    desc: 'Access active tier (Gold, Platinum), billing status, and renewal dates',
    icon: Sparkles,
  },
  packages: {
    label: 'Package Entitlements',
    desc: 'Access purchased ecosystem platforms and active subscription licenses',
    icon: Zap,
  },
};

export default function RegisterAppModal({ onClose, onRegistered }: RegisterAppModalProps) {
  const registerApp = useRegisterApp();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [platformSlug, setPlatformSlug] = useState('');
  const [description, setDescription] = useState('');
  const [appUrl, setAppUrl] = useState('');
  const [billingApiUrl, setBillingApiUrl] = useState('');
  const [planSchemaEndpoint, setPlanSchemaEndpoint] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>(['']);
  const [corsOrigins, setCorsOrigins] = useState<string[]>(['']);
  const [scopes, setScopes] = useState<string[]>(['profile', 'email', 'business']);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-slugify helpers
  const handleNameChange = (val: string) => {
    setName(val);
    if (!clientId || clientId === slugify(name)) {
      setClientId(slugify(val));
    }
    if (!platformSlug || platformSlug === platformSlugify(name.replace(/^mcom[\s-_]*/i, ''))) {
      setPlatformSlug(platformSlugify(val.replace(/^mcom[\s-_]*/i, '')));
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  const updateRedirectUri = (index: number, value: string) =>
    setRedirectUris((prev) => prev.map((item, i) => (i === index ? value : item)));

  const updateCorsOrigin = (index: number, value: string) =>
    setCorsOrigins((prev) => prev.map((item, i) => (i === index ? value : item)));

  // Validate per-step
  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 1) {
      if (!name.trim() || name.trim().length < 3) return 'Application name is required (min 3 characters).';
      if (!/^[a-z0-9-]+$/.test(clientId) || clientId.length < 3) {
        return 'Client ID must be lowercase letters, numbers, and hyphens only (min 3 characters).';
      }
      if (platformSlug && !/^[a-z0-9_]+$/.test(platformSlug)) {
        return 'Platform slug must be lowercase letters, numbers, and underscores only.';
      }
    }
    if (currentStep === 2) {
      if (appUrl && !isValidUrl(appUrl)) return 'App Frontend URL must be a valid URL (e.g. https://app.example.com).';
      if (billingApiUrl && !isValidUrl(billingApiUrl)) return 'Billing API URL must be a valid URL (e.g. https://api.example.com).';
      if (planSchemaEndpoint && !isValidUrl(planSchemaEndpoint)) return 'Plan Schema Endpoint must be a valid URL (e.g. https://api.example.com/api/v1/system/plans/schema).';
      const cleanedRedirects = redirectUris.map((u) => u.trim()).filter(Boolean);
      if (cleanedRedirects.length === 0) return 'At least one Redirect URI (SSO callback) is required.';
      if (cleanedRedirects.some((u) => !isValidUrl(u))) return 'Every Redirect URI must be a valid URL with http/https scheme.';
      const cleanedOrigins = corsOrigins.map((u) => u.trim()).filter(Boolean);
      if (cleanedOrigins.length === 0) return 'At least one CORS Origin is required.';
      if (cleanedOrigins.some((u) => !isValidUrl(u))) return 'Every CORS Origin must be a valid URL (e.g. https://app.example.com).';
    }
    if (currentStep === 3) {
      if (scopes.length === 0) return 'Please select at least one OAuth scope.';
      if (webhookUrl && !isValidUrl(webhookUrl)) return 'Webhook URL must be a valid URL.';
    }
    return null;
  };

  const handleNext = () => {
    const error = validateStep(step);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    setStep((prev) => (prev + 1) as any);
  };

  const handleBack = () => {
    setSubmitError(null);
    setStep((prev) => (prev - 1) as any);
  };

  const handleSubmit = async () => {
    const error = validateStep(1) || validateStep(2) || validateStep(3);
    if (error) {
      setSubmitError(error);
      return;
    }
    setSubmitError(null);
    try {
      const result = await registerApp.mutateAsync({
        name: name.trim(),
        clientId: clientId.trim(),
        platformSlug: platformSlug.trim() || undefined,
        description: description.trim() || undefined,
        appUrl: appUrl.trim() || undefined,
        billingApiUrl: billingApiUrl.trim() || undefined,
        planSchemaEndpoint: planSchemaEndpoint.trim() || undefined,
        redirectUris: redirectUris.map((u) => u.trim()).filter(Boolean),
        corsOrigins: corsOrigins.map((u) => u.trim()).filter(Boolean),
        scopes,
        webhookUrl: webhookUrl.trim() || undefined,
      });
      onRegistered(result);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) setSubmitError('An app with this Client ID or platform slug already exists.');
      else if (status === 403) setSubmitError('You need ADMIN access to register applications.');
      else setSubmitError('Registration failed. Please verify the fields and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Wizard Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-between border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue">
              <Sparkles className="w-5 h-5 text-brand-blue" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base font-display">Register New Application</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue/30 text-blue-200 border border-brand-blue/40">
                  Step {step} of 4
                </span>
              </div>
              <p className="text-xs text-gray-400">Add a dynamic tenant platform with zero redeployments.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          {[
            { num: 1, title: 'App Identity' },
            { num: 2, title: 'URLs & CORS' },
            { num: 3, title: 'Scopes & Events' },
            { num: 4, title: 'Review & Secrets' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={cn(
                  'w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-all',
                  step === s.num
                    ? 'bg-brand-blue text-white shadow-xs'
                    : step > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-200 text-gray-500',
                )}
              >
                {step > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span
                className={cn(
                  'text-xs font-bold hidden sm:inline',
                  step === s.num ? 'text-gray-900' : 'text-gray-400',
                )}
              >
                {s.title}
              </span>
              {idx < 3 && <div className="w-6 sm:w-12 h-0.5 bg-gray-200 mx-1 hidden sm:block" />}
            </div>
          ))}
        </div>

        {/* Wizard Step Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {submitError && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* STEP 1: IDENTITY */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Info className="w-4 h-4 text-brand-blue flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  Enter your platform's display name. The <b>Client ID</b> and <b>Platform Slug</b> will be auto-generated to enable dynamic permissions without touching core MCOM source code.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Application Name *</label>
                  <input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Mcom vCard"
                    className={inputCls}
                    autoFocus
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Display title shown in admin dashboard & SSO screens.</p>
                </div>

                <div>
                  <label className={labelCls}>Client ID * (Machine Identifier)</label>
                  <input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="e.g. mcom-vcard"
                    className={cn(inputCls, 'font-mono')}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Lowercase alphanumeric + hyphens. Immutable after registration.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls}>Platform Slug (Optional)</label>
                    <span className="text-[10px] font-mono text-brand-blue">
                      canAccess_{platformSlug || '...'}
                    </span>
                  </div>
                  <input
                    value={platformSlug}
                    onChange={(e) => setPlatformSlug(e.target.value)}
                    placeholder="e.g. vcard"
                    className={cn(inputCls, 'font-mono')}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Enables dynamic package access checks (<code>canAccess_{platformSlug || 'slug'}</code>).
                  </p>
                </div>

                <div>
                  <label className={labelCls}>Description (Optional)</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Digital business card platform"
                    className={inputCls}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Short summary for the app registry directory.</p>
                </div>
              </div>

              {/* Live Preview Card */}
              {name && (
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Live Registration Preview</span>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center font-bold text-xs">
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900">{name}</p>
                        <p className="text-[10px] font-mono text-gray-400">{clientId}</p>
                      </div>
                    </div>
                    {platformSlug && (
                      <span className="px-2 py-0.5 bg-blue-50 text-brand-blue border border-blue-100 rounded text-[10px] font-mono font-bold">
                        canAccess_{platformSlug}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: URLS & CORS */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>App Frontend URL (Optional)</label>
                  <input
                    value={appUrl}
                    onChange={(e) => setAppUrl(e.target.value)}
                    placeholder="https://vcard.mcom.com"
                    className={cn(inputCls, 'font-mono')}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">User landing page / web app URL.</p>
                </div>

                <div>
                  <label className={labelCls}>Billing API URL (Optional)</label>
                  <input
                    value={billingApiUrl}
                    onChange={(e) => setBillingApiUrl(e.target.value)}
                    placeholder="https://api.vcard.mcom.com"
                    className={cn(inputCls, 'font-mono')}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Backend URL for plan management (Generic Connector).</p>
                </div>

                <div>
                  <label className={labelCls}>Plan Schema Endpoint (Optional)</label>
                  <input
                    value={planSchemaEndpoint}
                    onChange={(e) => setPlanSchemaEndpoint(e.target.value)}
                    placeholder="https://api.vcard.mcom.com/api/v1/system/plans/schema"
                    className={cn(inputCls, 'font-mono')}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Endpoint returning the plan configuration schema. Defaults to{' '}
                    <code>&lt;billingApiUrl&gt;/api/v1/system/plans/schema</code> if left blank.
                  </p>
                </div>
              </div>

              {/* Redirect URIs */}
              <ArrayField
                label="Redirect URIs * (SSO Callbacks)"
                placeholder="https://vcard.mcom.com/auth/callback"
                values={redirectUris}
                onChange={(next) => setRedirectUris(next)}
                onItemChange={updateRedirectUri}
                hint="MCOM redirects authenticated users to these URLs with an authorization code."
                devPreset="http://localhost:3000/auth/callback"
                onAddPreset={(preset) => setRedirectUris([...redirectUris.filter(Boolean), preset])}
              />

              {/* CORS Origins */}
              <ArrayField
                label="CORS Allowed Origins *"
                placeholder="https://vcard.mcom.com"
                values={corsOrigins}
                onChange={(next) => setCorsOrigins(next)}
                onItemChange={updateCorsOrigin}
                hint="Allowed browser origins for client-side API requests. Merged dynamically within 60s."
                devPreset="http://localhost:3000"
                onAddPreset={(preset) => setCorsOrigins([...corsOrigins.filter(Boolean), preset])}
              />
            </div>
          )}

          {/* STEP 3: SCOPES & WEBHOOKS */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>OAuth Scopes *</label>
                <p className="text-[11px] text-gray-500 mb-3">
                  Select what user data this application is authorized to request:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CONSOLE_ALLOWED_SCOPES.map((scope) => {
                    const info = SCOPE_DESCRIPTIONS[scope] || {
                      label: scope,
                      desc: `Grant ${scope} permission`,
                      icon: Zap,
                    };
                    const Icon = info.icon;
                    const isSelected = scopes.includes(scope);

                    return (
                      <div
                        key={scope}
                        onClick={() => toggleScope(scope)}
                        className={cn(
                          'p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none',
                          isSelected
                            ? 'bg-blue-50/50 border-brand-blue/60 shadow-xs'
                            : 'bg-white border-gray-200 hover:border-gray-300',
                        )}
                      >
                        <div
                          className={cn(
                            'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                            isSelected ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-400',
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900">{info.label}</span>
                            <span className="text-[10px] font-mono font-bold text-gray-400">{scope}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">{info.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <label className={labelCls}>Webhook URL (Optional)</label>
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.vcard.mcom.com/webhooks"
                  className={cn(inputCls, 'font-mono')}
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  MCOM dispatches user registration and lifecycle event payloads to this URL with HMAC signatures.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & GENERATE */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-emerald-900 text-xs">Ready to Generate Credentials</h5>
                  <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                    Clicking "Register Application" will immediately generate your <b>Client Secret</b>, <b>API Key</b>, <b>HMAC Secret</b>, and <b>Webhook Secret</b>. These will be shown <b>once</b>.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50/80 rounded-2xl border border-gray-200 p-4 space-y-3">
                <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuration Summary</h5>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Name</span>
                    <span className="font-bold text-gray-900">{name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Client ID</span>
                    <span className="font-mono font-bold text-gray-900">{clientId}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Platform Slug</span>
                    <span className="font-mono font-bold text-brand-blue">{platformSlug || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 block">Scopes</span>
                    <span className="font-bold text-gray-900">{scopes.length} selected</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200/60 text-xs space-y-1">
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>Redirect URIs:</span>
                    <span className="font-mono text-gray-800">{redirectUris.filter(Boolean).length} configured</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>CORS Origins:</span>
                    <span className="font-mono text-gray-800">{corsOrigins.filter(Boolean).length} configured</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[11px]">
                    <span>Plan Schema Endpoint:</span>
                    <span className="font-mono text-gray-800">
                      {planSchemaEndpoint.trim() ? 'Custom' : 'Auto (billing API)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer / Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-gray-200/80 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow"
            >
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={registerApp.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow disabled:opacity-50"
            >
              {registerApp.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Register Application & Generate Secrets
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ArrayField({
  label,
  placeholder,
  values,
  onChange,
  onItemChange,
  hint,
  devPreset,
  onAddPreset,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
  onItemChange: (index: number, value: string) => void;
  hint?: string;
  devPreset?: string;
  onAddPreset?: (preset: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className={labelCls}>{label}</label>
        {devPreset && onAddPreset && !values.includes(devPreset) && (
          <button
            type="button"
            onClick={() => onAddPreset(devPreset)}
            className="text-[10px] font-bold text-brand-blue hover:underline"
          >
            + Add Dev Localhost
          </button>
        )}
      </div>

      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => onItemChange(index, e.target.value)}
              placeholder={placeholder}
              className={cn(inputCls, 'font-mono text-xs')}
            />
            {values.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(values.filter((_, i) => i !== index))}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...values, ''])}
        className="mt-2 flex items-center gap-1 text-xs font-bold text-brand-blue hover:underline"
      >
        <Plus className="w-3 h-3" /> Add Another URL
      </button>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}