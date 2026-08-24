import { useState, type ReactNode } from 'react';
import { KeyRound, UserPlus, Store, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminSettings, useUpdateSettings } from '../../services/admin/hooks';
import type { SystemSettings } from '../../services/admin/types';

export default function ConfigPanel() {
  const [tab, setTab] = useState<'auth' | 'registration' | 'profile'>('auth');
  const { data: settingsRes, isLoading } = useAdminSettings();
  const updateSettings = useUpdateSettings();
  const settings: SystemSettings | undefined = settingsRes?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        {[
          { id: 'auth', label: 'Authentication', icon: KeyRound },
          { id: 'registration', label: 'Registration Flow', icon: UserPlus },
          { id: 'profile', label: 'Business Profile', icon: Store },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === t.id ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><t.icon className="w-4 h-4" />{t.label}</button>
        ))}
      </div>
      {tab === 'auth' && <AuthConfigTab settings={settings} onSave={updateSettings} />}
      {tab === 'registration' && <RegistrationConfigTab settings={settings} onSave={updateSettings} />}
      {tab === 'profile' && <BusinessProfileConfigTab settings={settings} onSave={updateSettings} />}
    </div>
  );
}

function ConfigSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, description }: { label: string; value: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button onClick={() => onChange(!value)} className={cn("w-12 h-7 rounded-full transition-all relative shrink-0", value ? "bg-brand-blue" : "bg-gray-200")}>
        <div className={cn("w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all", value ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange, description }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-24 accent-brand-blue" />
        <span className="text-sm font-bold text-brand-blue w-8 text-right">{value}</span>
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange, description }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className="text-sm font-bold text-gray-700">{label}</span>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <select value={value} onChange={e => onChange(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function SaveBar({ onSave, isSaving }: { onSave: () => void; isSaving: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
      <button onClick={onSave} disabled={isSaving} className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl hover:bg-brand-dark transition-colors text-xs font-bold shadow-sm disabled:opacity-50">
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function AuthConfigTab({ settings, onSave }: { settings: SystemSettings | undefined; onSave: any }) {
  const authCfg = (settings?.authConfig ?? {}) as Record<string, any>;
  const [local, setLocal] = useState({
    allowRegistration: settings?.allowRegistration ?? true,
    maintenanceMode: settings?.maintenanceMode ?? false,
    sessionTimeout: settings?.sessionTimeout ?? 30,
    maxLoginAttempts: settings?.maxLoginAttempts ?? 5,
    twoFactorEnabled: authCfg.twoFactorEnabled ?? false,
    passwordMinLength: authCfg.passwordMinLength ?? 8,
    passwordRequireUppercase: authCfg.passwordRequireUppercase ?? true,
    passwordRequireNumbers: authCfg.passwordRequireNumbers ?? true,
    passwordRequireSpecial: authCfg.passwordRequireSpecial ?? true,
    lockoutDuration: authCfg.lockoutDuration ?? 15,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave.mutate({
      allowRegistration: local.allowRegistration,
      maintenanceMode: local.maintenanceMode,
      sessionTimeout: local.sessionTimeout,
      maxLoginAttempts: local.maxLoginAttempts,
      authConfig: {
        twoFactorEnabled: local.twoFactorEnabled,
        passwordMinLength: local.passwordMinLength,
        passwordRequireUppercase: local.passwordRequireUppercase,
        passwordRequireNumbers: local.passwordRequireNumbers,
        passwordRequireSpecial: local.passwordRequireSpecial,
        lockoutDuration: local.lockoutDuration,
      },
    }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); } });
  };

  const update = <K extends keyof typeof local>(key: K, value: typeof local[K]) => setLocal(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <ConfigSection title="General">
        <ToggleRow label="Allow Registration" value={local.allowRegistration} onChange={v => update('allowRegistration', v)} description="Allow new users to register accounts" />
        <ToggleRow label="Maintenance Mode" value={local.maintenanceMode} onChange={v => update('maintenanceMode', v)} description="Block public access to the platform" />
        <SliderRow label="Session Timeout (min)" value={local.sessionTimeout} min={5} max={120} onChange={v => update('sessionTimeout', v)} description="Idle time before session expires" />
        <SliderRow label="Max Login Attempts" value={local.maxLoginAttempts} min={3} max={20} onChange={v => update('maxLoginAttempts', v)} description="Failed attempts before lockout" />
        <SliderRow label="Lockout Duration (min)" value={local.lockoutDuration} min={5} max={60} onChange={v => update('lockoutDuration', v)} description="Account lockout duration" />
      </ConfigSection>
      <ConfigSection title="Password Policy">
        <SliderRow label="Minimum Length" value={local.passwordMinLength} min={6} max={32} onChange={v => update('passwordMinLength', v)} description="Minimum password characters" />
        <ToggleRow label="Require Uppercase" value={local.passwordRequireUppercase} onChange={v => update('passwordRequireUppercase', v)} description="At least one uppercase letter" />
        <ToggleRow label="Require Numbers" value={local.passwordRequireNumbers} onChange={v => update('passwordRequireNumbers', v)} description="At least one number" />
        <ToggleRow label="Require Special Characters" value={local.passwordRequireSpecial} onChange={v => update('passwordRequireSpecial', v)} description="At least one special character" />
      </ConfigSection>
      <ConfigSection title="Two-Factor Authentication">
        <ToggleRow label="Enable 2FA" value={local.twoFactorEnabled} onChange={v => update('twoFactorEnabled', v)} description="Require two-factor authentication for all users" />
      </ConfigSection>
      {saved && <Toast message="Settings saved successfully" type="success" />}
      <SaveBar onSave={handleSave} isSaving={onSave.isPending} />
    </div>
  );
}

function RegistrationConfigTab({ settings, onSave }: { settings: SystemSettings | undefined; onSave: any }) {
  const regCfg = (settings?.registrationFlow ?? {}) as Record<string, any>;
  const [local, setLocal] = useState({
    emailVerification: regCfg.emailVerification ?? true,
    phoneVerification: regCfg.phoneVerification ?? false,
    approvalRequired: regCfg.approvalRequired ?? false,
    defaultRole: regCfg.defaultRole ?? 'CUSTOMER',
    requireBusinessName: regCfg.requireBusinessName ?? false,
    requireAddress: regCfg.requireAddress ?? true,
    requirePhone: regCfg.requirePhone ?? false,
    welcomeEmailEnabled: regCfg.welcomeEmailEnabled ?? true,
    autoAssignManager: regCfg.autoAssignManager ?? false,
    maxRegistrationPerDay: regCfg.maxRegistrationPerDay ?? 100,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave.mutate({
      registrationFlow: { ...local },
    }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); } });
  };

  const update = <K extends keyof typeof local>(key: K, value: typeof local[K]) => setLocal(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <ConfigSection title="Verification">
        <ToggleRow label="Email Verification Required" value={local.emailVerification} onChange={v => update('emailVerification', v)} description="Users must verify email before accessing the platform" />
        <ToggleRow label="Phone Verification Required" value={local.phoneVerification} onChange={v => update('phoneVerification', v)} description="Users must verify phone number during signup" />
        <ToggleRow label="Admin Approval Required" value={local.approvalRequired} onChange={v => update('approvalRequired', v)} description="New registrations require admin approval" />
      </ConfigSection>
      <ConfigSection title="Required Fields">
        <ToggleRow label="Business Name" value={local.requireBusinessName} onChange={v => update('requireBusinessName', v)} description="Require business name during registration" />
        <ToggleRow label="Address" value={local.requireAddress} onChange={v => update('requireAddress', v)} description="Require physical address" />
        <ToggleRow label="Phone Number" value={local.requirePhone} onChange={v => update('requirePhone', v)} description="Require phone number" />
      </ConfigSection>
      <ConfigSection title="Defaults & Automation">
        <SelectRow label="Default Role" value={local.defaultRole} onChange={v => update('defaultRole', v)} options={[{ value: 'CUSTOMER', label: 'Customer' }, { value: 'BUSINESS_OWNER', label: 'Business Owner' }, { value: 'AGENT', label: 'Agent' }]} description="Default role assigned on registration" />
        <ToggleRow label="Send Welcome Email" value={local.welcomeEmailEnabled} onChange={v => update('welcomeEmailEnabled', v)} description="Send a welcome email after registration" />
        <ToggleRow label="Auto-Assign Account Manager" value={local.autoAssignManager} onChange={v => update('autoAssignManager', v)} description="Automatically assign an account manager to new businesses" />
        <SliderRow label="Max Registrations Per Day" value={local.maxRegistrationPerDay} min={10} max={500} onChange={v => update('maxRegistrationPerDay', v)} description="Daily registration cap" />
      </ConfigSection>
      {saved && <Toast message="Settings saved successfully" type="success" />}
      <SaveBar onSave={handleSave} isSaving={onSave.isPending} />
    </div>
  );
}

function BusinessProfileConfigTab({ settings, onSave }: { settings: SystemSettings | undefined; onSave: any }) {
  const profileCfg = (settings?.businessProfileConfig ?? {}) as Record<string, any>;
  const [local, setLocal] = useState({
    requireLogo: profileCfg.requireLogo ?? false,
    requireDescription: profileCfg.requireDescription ?? true,
    requireCategory: profileCfg.requireCategory ?? true,
    requireOpeningHours: profileCfg.requireOpeningHours ?? false,
    requireSocialLinks: profileCfg.requireSocialLinks ?? false,
    requireGoogleBusiness: profileCfg.requireGoogleBusiness ?? false,
    allowMultipleLocations: profileCfg.allowMultipleLocations ?? false,
    autoVerifyGoogle: profileCfg.autoVerifyGoogle ?? false,
    profileCompletionTarget: profileCfg.profileCompletionTarget ?? 80,
    showCompletionScore: profileCfg.showCompletionScore ?? true,
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave.mutate({
      businessProfileConfig: { ...local },
    }, { onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); } });
  };

  const update = <K extends keyof typeof local>(key: K, value: typeof local[K]) => setLocal(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      <ConfigSection title="Required Profile Fields">
        <ToggleRow label="Logo" value={local.requireLogo} onChange={v => update('requireLogo', v)} description="Business logo is required" />
        <ToggleRow label="Description" value={local.requireDescription} onChange={v => update('requireDescription', v)} description="Business description is required" />
        <ToggleRow label="Category" value={local.requireCategory} onChange={v => update('requireCategory', v)} description="Business category is required" />
        <ToggleRow label="Opening Hours" value={local.requireOpeningHours} onChange={v => update('requireOpeningHours', v)} description="Operating hours are required" />
        <ToggleRow label="Social Links" value={local.requireSocialLinks} onChange={v => update('requireSocialLinks', v)} description="Social media links are required" />
      </ConfigSection>
      <ConfigSection title="Verification & Integration">
        <ToggleRow label="Require Google Business Match" value={local.requireGoogleBusiness} onChange={v => update('requireGoogleBusiness', v)} description="Match against Google Business Profile" />
        <ToggleRow label="Auto-Verify Google Listings" value={local.autoVerifyGoogle} onChange={v => update('autoVerifyGoogle', v)} description="Automatically verify businesses with a Google listing" />
        <ToggleRow label="Allow Multiple Locations" value={local.allowMultipleLocations} onChange={v => update('allowMultipleLocations', v)} description="Allow businesses to register multiple locations" />
      </ConfigSection>
      <ConfigSection title="Completion & Scoring">
        <ToggleRow label="Show Completion Score" value={local.showCompletionScore} onChange={v => update('showCompletionScore', v)} description="Display profile completeness to business owners" />
        <SliderRow label="Completion Target (%)" value={local.profileCompletionTarget} min={50} max={100} onChange={v => update('profileCompletionTarget', v)} description="Minimum profile completion for activation" />
      </ConfigSection>
      {saved && <Toast message="Settings saved successfully" type="success" />}
      <SaveBar onSave={handleSave} isSaving={onSave.isPending} />
    </div>
  );
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold shadow-lg", type === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200")}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {message}
    </div>
  );
}
