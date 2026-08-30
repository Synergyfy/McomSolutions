import { useEffect, useState, useMemo, type Dispatch, type SetStateAction } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Bot,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Layers,
  Lock,
  Plus,
  Puzzle,
  RefreshCw,
  Save,
  Search,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  UserCheck,
  Webhook,
  X,
  Zap,
  Loader2,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { generateAiIntegrationPrompt } from './utils/aiPromptGenerator';
import {
  useConsoleApp,
  useDeactivateApp,
  useRotateApiKey,
  useRotateClientSecret,
  useRotateHmacSecret,
  useRotateWebhookSecret,
  useUpdateApp,
} from './hooks/useConsoleApps';
import { useAppHealth, useConsoleAuditLogs } from './hooks/useAppHealth';
import AppHealthBadge from './AppHealthBadge';
import { CONSOLE_ALLOWED_SCOPES, type SsoClientDetail, type UpdateAppInput } from '../../../services/admin/types';

interface AppDetailProps {
  clientId: string;
  onBack: () => void;
}

type DetailTab = 'credentials' | 'config' | 'integration' | 'health' | 'audit';
type SecretKey = 'clientSecret' | 'apiKey' | 'hmacSecret' | 'webhookSecret';

const inputCls =
  'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all';

const labelCls = 'block text-xs font-bold text-gray-700 mb-1';

const copy = (value: string) => navigator.clipboard?.writeText(value);

const mcomBaseUrl =
  import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com';

export default function AppDetail({ clientId, onBack }: AppDetailProps) {
  const { data: detail, isLoading, isError, refetch } = useConsoleApp(clientId);
  const [activeTab, setActiveTab] = useState<DetailTab>('credentials');
  const deactivateApp = useDeactivateApp();
  const rotateClientSecret = useRotateClientSecret();
  const rotateApiKey = useRotateApiKey();
  const rotateHmacSecret = useRotateHmacSecret();
  const rotateWebhookSecret = useRotateWebhookSecret();

  const rotationMutations: Record<
    SecretKey,
    { mutateAsync: (args: { clientId: string; reason?: string }) => Promise<Partial<Record<SecretKey, string>>> }
  > = {
    clientSecret: rotateClientSecret,
    apiKey: rotateApiKey,
    hmacSecret: rotateHmacSecret,
    webhookSecret: rotateWebhookSecret,
  };

  const [confirmDisable, setConfirmDisable] = useState(false);
  const [rotation, setRotation] = useState<{ label: string; key: SecretKey; desc: string } | null>(null);
  const [rotationError, setRotationError] = useState<string | null>(null);
  const [rotationResult, setRotationResult] = useState<{ label: string; value: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (label: string, value: string) => {
    copy(value);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleRotateConfirm = async (target: { label: string; key: SecretKey }) => {
    setRotationError(null);
    try {
      const result = await rotationMutations[target.key].mutateAsync({ clientId });
      setRotationResult({ label: target.label, value: result[target.key]! });
      setRotation(null);
      return true;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 429) setRotationError('Rate limit exceeded (5 rotations per minute). Please wait a moment.');
      else if (status === 403) setRotationError('You need ADMIN role access to rotate secrets.');
      else setRotationError('Secret rotation failed. Please try again.');
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue mb-3" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Application Specs...</p>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 rounded-3xl bg-white border border-gray-100 text-center">
        <ShieldAlert className="w-10 h-10 text-red-500 mb-3" />
        <h4 className="font-bold text-gray-900 text-sm">Application Not Found</h4>
        <p className="text-xs text-gray-400 mt-1 max-w-sm">
          Could not find an application with Client ID <b>{clientId}</b>.
        </p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
        >
          Return to App List
        </button>
      </div>
    );
  }

  const tabs: { id: DetailTab; label: string; icon: any }[] = [
    { id: 'credentials', label: 'Keys & Vault', icon: KeyRound },
    { id: 'config', label: 'Configuration & URLs', icon: Settings2 },
    { id: 'integration', label: 'Code & Quickstart', icon: Code2 },
    { id: 'health', label: 'Health & Diagnostics', icon: Activity },
    { id: 'audit', label: 'Audit Trail', icon: Clock },
  ];

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-4">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-brand-blue transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" /> Back to App Registry
          </button>
          
          <div className="flex items-center gap-2">
            <AppHealthBadge clientId={detail.clientId} enabled={!!detail.billingApiUrl} />
            {!detail.isSystemApp && detail.isActive && (
              <button
                onClick={() => setConfirmDisable(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors border border-red-100"
              >
                <Ban className="w-3.5 h-3.5" /> Disable App
              </button>
            )}
          </div>
        </div>

        {/* App Hero Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-3.5">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-brand-blue/10 to-indigo-500/10 border border-brand-blue/20 flex items-center justify-center font-black text-lg text-brand-blue font-display flex-shrink-0">
              {detail.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-lg font-display">{detail.name}</h3>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border',
                    detail.isActive
                      ? 'bg-green-50 text-green-700 border-green-200/60'
                      : 'bg-gray-100 text-gray-500 border-gray-200',
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      detail.isActive ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-400',
                    )}
                  />
                  {detail.isActive ? 'Active' : 'Inactive'}
                </span>
                {detail.isSystemApp && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> System Core
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 font-medium">Client ID:</span>
                  <code className="font-mono font-bold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                    {detail.clientId}
                  </code>
                </div>
                {detail.platformSlug && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-medium">Permission:</span>
                    <code className="font-mono font-bold text-brand-blue bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                      canAccess_{detail.platformSlug}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick External Links */}
          {detail.appUrl && (
            <a
              href={detail.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors border border-gray-200/60 w-fit"
            >
              <span>Visit App</span> <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
            </a>
          )}
        </div>

        {/* Tab Selection Navigation */}
        <div className="pt-2 border-t border-gray-100 flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-brand-blue text-white shadow-glow'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/70',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'credentials' && (
        <CredentialsTab
          detail={detail}
          onCopy={handleCopy}
          copied={copied}
          onRotate={(target) => setRotation(target)}
        />
      )}

      {activeTab === 'config' && <ConfigTab detail={detail} />}

      {activeTab === 'integration' && <IntegrationTab detail={detail} onCopy={handleCopy} copied={copied} />}

      {activeTab === 'health' && <HealthTab detail={detail} />}

      {activeTab === 'audit' && <AuditTab clientId={clientId} />}

      {/* Deactivate App Modal */}
      {confirmDisable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDisable(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg mb-1 font-display">Deactivate "{detail.name}"?</h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-5">
              This will disable SSO authentication for <b>{detail.clientId}</b> and immediately invalidate all active user sessions for this application.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDisable(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deactivateApp.mutateAsync(clientId);
                  setConfirmDisable(false);
                  onBack();
                }}
                disabled={deactivateApp.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {deactivateApp.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Deactivation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Rotation Confirmation Modal */}
      {rotation && (
        <RotateConfirmModal
          rotation={rotation}
          error={rotationError}
          onClose={() => {
            setRotation(null);
            setRotationError(null);
          }}
          onConfirm={async () => handleRotateConfirm(rotation)}
        />
      )}

      {/* Secret Rotation Result Modal (One-Time Display) */}
      {rotationResult && (
        <RotationResultModal
          label={rotationResult.label}
          value={rotationResult.value}
          onClose={() => setRotationResult(null)}
        />
      )}
    </div>
  );
}

/* ========================================================================= */
/* TAB 1: CREDENTIALS VAULT                                                   */
/* ========================================================================= */
function CredentialsTab({
  detail,
  onCopy,
  copied,
  onRotate,
}: {
  detail: SsoClientDetail;
  onCopy: (label: string, value: string) => void;
  copied: string | null;
  onRotate: (target: { label: string; key: SecretKey; desc: string }) => void;
}) {
  const secretCards: {
    label: string;
    key: SecretKey;
    desc: string;
    storage: string;
    storageDesc: string;
    maskedPreview: string;
  }[] = [
    {
      label: 'Client Secret',
      key: 'clientSecret',
      desc: 'Used to exchange OAuth authorization codes for JWT tokens via /api/v1/auth/sso/token.',
      storage: 'Bcrypt Hash ($2b$12...)',
      storageDesc: 'One-way cryptographic hash. Plain secret is never stored in the database.',
      maskedPreview: 'cs_••••••••••••••••••••••••••••••••',
    },
    {
      label: 'API Key',
      key: 'apiKey',
      desc: 'Sent in the x-mcom-solution-api-key header for billing API plan synchronization.',
      storage: 'Plain Key (Protected)',
      storageDesc: 'Restricted admin token compared directly for API connector authorization.',
      maskedPreview: 'ak_••••••••••••••••••••••••••••••••',
    },
    {
      label: 'HMAC Secret',
      key: 'hmacSecret',
      desc: 'Used to compute SHA-256 HMAC signatures for inter-service /data-sharing calls.',
      storage: 'AES-256-GCM Encrypted',
      storageDesc: 'Encrypted with server master key. Decrypted strictly at verification runtime.',
      maskedPreview: 'hm_••••••••••••••••••••••••••••••••',
    },
    {
      label: 'Webhook Secret',
      key: 'webhookSecret',
      desc: 'Used to sign webhook payloads dispatched to your registered webhook URL.',
      storage: 'AES-256-GCM Encrypted',
      storageDesc: 'Used to generate sha256 signature on outgoing lifecycle events.',
      maskedPreview: 'wh_••••••••••••••••••••••••••••••••',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Security Storage Explanation Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-5 rounded-3xl border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-white text-sm font-display">Cryptographic Credential Vault</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Secrets are masked for security. Rotating a secret generates a new token and reveals it once.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-gray-800 rounded-xl border border-gray-700 text-emerald-400 text-xs font-mono font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> AES-256-GCM + Bcrypt
          </div>
        </div>
      </div>

      {/* Client ID Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Public Client ID</span>
            <p className="text-xs text-gray-500">Public machine identifier passed in login links & API headers</p>
          </div>
          <button
            onClick={() => onCopy('client-id', detail.clientId)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors"
          >
            {copied === 'client-id' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'client-id' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <div className="px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200/70 font-mono text-sm font-bold text-gray-900 select-all">
          {detail.clientId}
        </div>
      </div>

      {/* Secrets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {secretCards.map((card) => (
          <div
            key={card.key}
            className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-brand-blue" />
                  {card.label}
                </span>
                <span className="px-2 py-0.5 bg-blue-50 text-brand-blue border border-blue-100 rounded text-[9px] font-mono font-bold">
                  {card.storage}
                </span>
              </div>

              <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl border border-gray-200/70 font-mono text-xs font-bold text-gray-400 tracking-wider">
                {card.maskedPreview}
              </div>

              <p className="text-[11px] text-gray-500 leading-tight">{card.desc}</p>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-medium">{card.storageDesc}</span>
              <button
                onClick={() => onRotate(card)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-brand-blue hover:text-white text-brand-blue rounded-xl text-xs font-bold transition-all border border-blue-100"
              >
                <RefreshCw className="w-3 h-3" /> Rotate
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 2: CONFIGURATION & URLS                                                */
/* ========================================================================= */
function ConfigTab({ detail }: { detail: SsoClientDetail }) {
  const updateApp = useUpdateApp();
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState(detail.description ?? '');
  const [appUrl, setAppUrl] = useState(detail.appUrl ?? '');
  const [billingApiUrl, setBillingApiUrl] = useState(detail.billingApiUrl ?? '');
  const [planSchemaEndpoint, setPlanSchemaEndpoint] = useState(detail.planSchemaEndpoint ?? '');
  const [platformSlug, setPlatformSlug] = useState(detail.platformSlug ?? '');
  const [webhookUrl, setWebhookUrl] = useState(detail.webhookUrl ?? '');
  const [scopes, setScopes] = useState<string[]>(detail.scopes);
  const [redirectUris, setRedirectUris] = useState<string[]>(detail.redirectUris);
  const [corsOrigins, setCorsOrigins] = useState<string[]>(detail.corsOrigins);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const toggleScope = (scope: string) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  const setItem = (setter: Dispatch<SetStateAction<string[]>>, index: number, value: string) => {
    setter((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const handleSave = async () => {
    setError(null);
    const payload: UpdateAppInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      appUrl: appUrl.trim() || undefined,
      billingApiUrl: billingApiUrl.trim() || undefined,
      planSchemaEndpoint: planSchemaEndpoint.trim() || undefined,
      platformSlug: platformSlug.trim() || undefined,
      webhookUrl: webhookUrl.trim() || undefined,
      scopes,
      redirectUris: redirectUris.map((u) => u.trim()).filter(Boolean),
      corsOrigins: corsOrigins.map((u) => u.trim()).filter(Boolean),
    };
    try {
      await updateApp.mutateAsync({ clientId: detail.clientId, data: payload });
      setSaved(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) setError('Platform slug is already in use by another application.');
      else if (status === 403) setError('You need ADMIN access to update application specifications.');
      else setError('Failed to save configuration changes. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h4 className="font-bold text-gray-900 text-sm font-display">Application Settings</h4>
          <p className="text-xs text-gray-400">Update endpoints, CORS origins, and OAuth scopes dynamically.</p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" /> Configuration Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Application Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          <p className="text-[10px] text-gray-400 mt-1">Display title shown on login & authorization pages.</p>
        </div>
        <div>
          <label className={labelCls}>Platform Slug</label>
          <input
            value={platformSlug}
            onChange={(e) => setPlatformSlug(e.target.value)}
            className={cn(inputCls, 'font-mono')}
            placeholder="e.g. vcard"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Generates dynamic permission flag: <code>canAccess_{platformSlug || '...'}</code>
          </p>
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
          placeholder="e.g. Digital business cards platform for MCOM ecosystem members"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>App Frontend URL</label>
          <input
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            className={cn(inputCls, 'font-mono text-xs')}
            placeholder="https://vcard.mcom.com"
          />
        </div>
        <div>
          <label className={labelCls}>Billing API URL</label>
          <input
            value={billingApiUrl}
            onChange={(e) => setBillingApiUrl(e.target.value)}
            className={cn(inputCls, 'font-mono text-xs')}
            placeholder="https://api.vcard.mcom.com"
          />
        </div>
      </div>

      {/* Plan Schema Endpoint */}
      <div>
        <label className={labelCls}>Plan Schema Endpoint</label>
        <input
          value={planSchemaEndpoint}
          onChange={(e) => setPlanSchemaEndpoint(e.target.value)}
          className={cn(inputCls, 'font-mono text-xs')}
          placeholder="https://api.vcard.mcom.com/api/v1/system/plans/schema"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          Plan configuration schema used by the plan form. Leave blank to auto-derive from the Billing API URL.
        </p>
      </div>

      {/* Scopes Selector */}
      <div>
        <label className={labelCls}>Authorized OAuth Scopes</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CONSOLE_ALLOWED_SCOPES.map((scope) => {
            const isSelected = scopes.includes(scope);
            return (
              <button
                key={scope}
                type="button"
                onClick={() => toggleScope(scope)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all',
                  isSelected
                    ? 'bg-brand-blue text-white border-brand-blue shadow-glow'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                )}
              >
                {isSelected && <Check className="w-3 h-3" />}
                {scope}
              </button>
            );
          })}
        </div>
      </div>

      {/* Redirect URIs & CORS Origins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-gray-100">
        <EditableList
          label="Redirect URIs (SSO Callbacks)"
          values={redirectUris}
          onChange={setRedirectUris}
          setItem={setItem}
          placeholder="https://vcard.mcom.com/auth/callback"
        />
        <EditableList
          label="CORS Allowed Origins"
          values={corsOrigins}
          onChange={setCorsOrigins}
          setItem={setItem}
          placeholder="https://vcard.mcom.com"
        />
      </div>

      {/* Webhook URL */}
      <div className="pt-2 border-t border-gray-100">
        <label className={labelCls}>Webhook URL</label>
        <input
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          className={cn(inputCls, 'font-mono text-xs')}
          placeholder="https://api.vcard.mcom.com/webhooks"
        />
        <p className="text-[10px] text-gray-400 mt-1">Lifecycle events are dispatched to this endpoint.</p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600">
          {error}
        </div>
      )}

      {/* Save Button Bar */}
      <div className="flex items-center justify-end pt-4 border-t border-gray-100">
        <button
          onClick={handleSave}
          disabled={updateApp.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow disabled:opacity-50"
        >
          {updateApp.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}

function EditableList({
  label,
  values,
  onChange,
  setItem,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  setItem: (setter: Dispatch<SetStateAction<string[]>>, index: number, value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <label className={labelCls}>{label}</label>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setItem(onChange, index, e.target.value)}
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
        className="flex items-center gap-1 text-xs font-bold text-brand-blue hover:underline mt-1"
      >
        <Plus className="w-3 h-3" /> Add Another URL
      </button>
    </div>
  );
}

/* ========================================================================= */
/* TAB 3: CODE & INTEGRATION QUICKSTART                                       */
/* ========================================================================= */
function IntegrationTab({
  detail,
  onCopy,
  copied,
}: {
  detail: SsoClientDetail;
  onCopy: (label: string, value: string) => void;
  copied: string | null;
}) {
  const [activeCodeTab, setActiveCodeTab] = useState<'ai-prompt' | '.env' | 'nodejs' | 'nextjs' | 'python' | 'curl'>('ai-prompt');

  const aiPrompt = useMemo(() => generateAiIntegrationPrompt(detail), [detail]);

  const handleDownloadSkill = () => {
    const blob = new Blob([aiPrompt], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MCOM_INTEGRATION_${detail.clientId.toUpperCase()}_SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const envSnippet = [
    `# =========================================================================`,
    `# MCOM Solutions Integration Credentials — ${detail.name}`,
    `# =========================================================================`,
    `MCOM_SOLUTIONS_URL="${mcomBaseUrl}"`,
    `MCOM_CLIENT_ID="${detail.clientId}"`,
    `MCOM_CLIENT_SECRET="<rotate to reveal>"`,
    `MCOM_API_KEY="<rotate to reveal>"`,
    `MCOM_HMAC_SECRET="<rotate to reveal>"`,
  ].join('\n');

  const nodejsSnippet = `// 1. Redirect user to MCOM SSO Login
app.get('/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl = new URL('${mcomBaseUrl}/api/v1/auth/sso/authorize');
  authUrl.searchParams.set('client_id', process.env.MCOM_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', '${detail.redirectUris[0] || 'https://your-app.com/auth/callback'}');
  authUrl.searchParams.set('scope', '${detail.scopes.join(' ')}');
  authUrl.searchParams.set('state', state);

  res.redirect(authUrl.toString());
});

// 2. Exchange authorization code for tokens
app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (state !== req.session.oauthState) return res.status(400).send('State mismatch');

  const response = await axios.post('${mcomBaseUrl}/api/v1/auth/sso/token', {
    code,
    client_id: process.env.MCOM_CLIENT_ID,
    client_secret: process.env.MCOM_CLIENT_SECRET,
    redirect_uri: '${detail.redirectUris[0] || 'https://your-app.com/auth/callback'}',
  });

  const { accessToken, refreshToken, user } = response.data;
  // Store session or issue local session JWT...
  res.redirect('/dashboard');
});`;

  const nextjsSnippet = `// app/api/auth/callback/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  const res = await fetch('${mcomBaseUrl}/api/v1/auth/sso/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      client_id: process.env.MCOM_CLIENT_ID,
      client_secret: process.env.MCOM_CLIENT_SECRET,
      redirect_uri: '${detail.redirectUris[0] || 'https://your-app.com/auth/callback'}',
    }),
  });

  const data = await res.json();
  // Check user dynamic permissions: data.user.permissions?.canAccess_${detail.platformSlug || 'slug'}
  return NextResponse.redirect(new URL('/dashboard', request.url));
}`;

  const pythonSnippet = `# FastAPI / Flask HMAC Signature Verification
import hmac, hashlib

def verify_mcom_signature(raw_body: bytes, received_sig: str, hmac_secret: str) -> bool:
    expected = hmac.new(
        hmac_secret.encode('utf-8'),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", received_sig)`;

  const curlSnippet = `# 1. Exchange Code for JWT Access Token:
curl -X POST ${mcomBaseUrl}/api/v1/auth/sso/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${detail.clientId}",
    "client_secret": "$MCOM_CLIENT_SECRET",
    "code": "AUTH_CODE_HERE",
    "redirect_uri": "${detail.redirectUris[0] || 'https://your-app.com/auth/callback'}"
  }'

# 2. Fetch User Profile & Dynamic Permissions:
curl -X GET ${mcomBaseUrl}/api/v1/auth/sso/userinfo \\
  -H "Authorization: Bearer $ACCESS_TOKEN"`;

  const codeSnippets: Record<string, string> = {
    'ai-prompt': aiPrompt,
    '.env': envSnippet,
    nodejs: nodejsSnippet,
    nextjs: nextjsSnippet,
    python: pythonSnippet,
    curl: curlSnippet,
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5">
      {/* Tab Header Banner */}
      <div className="p-5 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-2xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue shadow-inner flex-shrink-0">
            <Bot className="w-5 h-5 text-brand-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-white text-sm font-display">Target Platform Integration Hub</h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue text-white">
                AI Ready
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Copy the full AI prompt to pass directly to Cursor, Copilot, ChatGPT, or Claude on the target app.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDownloadSkill}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white border border-gray-700 rounded-xl text-xs font-bold transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Download SKILL.md
          </button>
          <button
            onClick={() => onCopy('ai-prompt', aiPrompt)}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl text-xs font-bold hover:bg-brand-dark transition-all shadow-glow"
          >
            {copied === 'ai-prompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied === 'ai-prompt' ? 'Copied AI Prompt' : 'Copy Full AI Prompt'}
          </button>
        </div>
      </div>

      {/* AI Usage Instructions Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            1
          </span>
          <div>
            <p className="text-xs font-bold text-gray-900">Copy AI Prompt</p>
            <p className="text-[11px] text-gray-500">Click the button above to copy the prompt with all variables embedded.</p>
          </div>
        </div>

        <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            2
          </span>
          <div>
            <p className="text-xs font-bold text-gray-900">Open Target Repository</p>
            <p className="text-[11px] text-gray-500">Open Cursor, Copilot, or Claude in the codebase of <b>{detail.name}</b>.</p>
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            3
          </span>
          <div>
            <p className="text-xs font-bold text-gray-900">Automated Integration</p>
            <p className="text-[11px] text-gray-500">The AI writes the SSO redirect, callback routes, and permission guards.</p>
          </div>
        </div>
      </div>

      {/* Code Language Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl overflow-x-auto scrollbar-hide">
          {[
            { id: 'ai-prompt', label: '🤖 AI Agent Prompt / Skill' },
            { id: '.env', label: '.env Snippet' },
            { id: 'nodejs', label: 'Node.js / Express' },
            { id: 'nextjs', label: 'Next.js App Router' },
            { id: 'python', label: 'Python / FastAPI' },
            { id: 'curl', label: 'cURL Terminal' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveCodeTab(tab.id as any)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap',
                activeCodeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => onCopy(activeCodeTab, codeSnippets[activeCodeTab])}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors w-fit"
        >
          {copied === activeCodeTab ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied === activeCodeTab ? 'Copied' : 'Copy View'}
        </button>
      </div>

      {/* Code Output Window */}
      <pre className="p-4 bg-gray-900 rounded-2xl font-mono text-xs text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre border border-gray-800 shadow-inner max-h-[420px] overflow-y-auto">
        {codeSnippets[activeCodeTab]}
      </pre>

      {/* Integration Checklist */}
      <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2">
        <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Integration Checklist</h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Redirect user to <code>/api/v1/auth/sso/authorize</code></span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Handle callback at <code>{detail.redirectUris[0] || '/auth/callback'}</code></span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Exchange code for JWT at <code>/api/v1/auth/sso/token</code></span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Verify <code>canAccess_{detail.platformSlug || 'slug'}</code> entitlement</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* TAB 4: HEALTH & DIAGNOSTICS                                                */
/* ========================================================================= */
function HealthTab({ detail }: { detail: SsoClientDetail }) {
  const { data, isLoading, isError, refetch, isFetching } = useAppHealth(detail.clientId, !!detail.billingApiUrl);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h4 className="font-bold text-gray-900 text-sm font-display">Service Health & Diagnostics</h4>
          <p className="text-xs text-gray-400">Live connectivity checks for the Billing API Generic Connector.</p>
        </div>
        {detail.billingApiUrl && (
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin text-brand-blue')} />
            {isFetching ? 'Pinging...' : 'Ping Endpoint Now'}
          </button>
        )}
      </div>

      {!detail.billingApiUrl ? (
        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-200 text-center space-y-2">
          <Server className="w-8 h-8 text-gray-400 mx-auto" />
          <h5 className="font-bold text-gray-900 text-xs">No Billing API URL Configured</h5>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            This application has not configured a <code>billingApiUrl</code>. Health pings and automated plan management are disabled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Operational Status</span>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    data?.reachable ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500',
                  )}
                />
                <span className="font-bold text-sm text-gray-900">
                  {isLoading ? 'Checking...' : data?.reachable ? 'Online & Reachable' : 'Unreachable / Timeout'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Round-Trip Latency</span>
              <p className="font-mono text-sm font-bold text-gray-900">
                {data?.latencyMs ? `${data.latencyMs} ms` : '—'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
              <span className="text-[10px] font-bold text-gray-400 uppercase">Tested Endpoint</span>
              <p className="font-mono text-xs font-bold text-gray-700 truncate">
                {detail.billingApiUrl}/api/v1/system/plans
              </p>
            </div>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-blue-900 space-y-1">
            <p className="font-bold">Generic Connector Diagnostic Information:</p>
            <p className="text-blue-700 text-[11px]">
              MCOM Solutions checks the endpoint using a lightweight HTTP HEAD/GET request. Requests include the <code>x-mcom-solution-api-key</code> header with this app's API key.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* TAB 5: AUDIT TRAIL                                                         */
/* ========================================================================= */
function AuditTab({ clientId }: { clientId: string }) {
  const { data, isLoading } = useConsoleAuditLogs({ clientId, limit: 15 });
  const events = data?.data ?? [];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
      <div className="pb-3 border-b border-gray-100">
        <h4 className="font-bold text-gray-900 text-sm font-display">Console Audit Log</h4>
        <p className="text-xs text-gray-400">Chronological history of secret rotations, updates, and admin actions.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
        </div>
      ) : events.length === 0 ? (
        <div className="py-12 text-center">
          <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Audit Events Logged Yet</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {events.map((event) => (
            <div key={event.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-mono text-[10px] font-bold">
                  LOG
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-gray-900 px-1.5 py-0.5 bg-gray-100 rounded text-[11px]">
                      {event.action}
                    </span>
                    <span className="text-[11px] text-gray-400">by admin ({event.adminId.slice(0, 8)})</span>
                  </div>
                  {event.changes && (
                    <p className="text-[11px] text-gray-500 font-mono mt-0.5 line-clamp-1">
                      {JSON.stringify(event.changes)}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">
                {new Date(event.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* MODALS: ROTATE CONFIRM & RESULT                                            */
/* ========================================================================= */
function RotateConfirmModal({
  rotation,
  error,
  onClose,
  onConfirm,
}: {
  rotation: { label: string; key: SecretKey; desc: string };
  error: string | null;
  onClose: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base font-display">Rotate {rotation.label}?</h3>
            <p className="text-xs text-gray-400">This will instantly invalidate the existing {rotation.label}.</p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-900 mb-4 leading-relaxed">
          <p className="font-bold mb-1">Impact Warning:</p>
          Any deployed service using the old secret will experience authentication failures until updated with the new value. The new secret will be displayed <b>once</b>.
        </div>

        {error && (
          <div className="mb-4 px-3.5 py-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-600">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
            disabled={busy}
            className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-glow"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirm Rotation
          </button>
        </div>
      </div>
    </div>
  );
}

function RotationResultModal({ label, value, onClose }: { label: string; value: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 border border-gray-100 animate-in fade-in zoom-in-95 duration-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base font-display">New {label} Generated</h3>
            <p className="text-xs text-gray-400">Shown once — copy and store in your app's .env now.</p>
          </div>
        </div>

        <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl font-mono text-xs font-bold text-brand-blue break-all select-all">
          {value}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              copy(value);
              setCopied(true);
            }}
            className="flex-1 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all flex items-center justify-center gap-1.5 shadow-glow"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied to Clipboard' : 'Copy Secret'}
          </button>
        </div>
      </div>
    </div>
  );
}