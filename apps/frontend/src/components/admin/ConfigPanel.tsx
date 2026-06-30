import { useState } from 'react';
import { KeyRound, UserPlus, Store, Eye, EyeOff, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData } from '../../context/AdminDataContext';

export default function ConfigPanel() {
  const [tab, setTab] = useState<'auth' | 'registration' | 'profile'>('auth');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        {[
          { id: 'auth', label: 'Authentication', icon: KeyRound },
          { id: 'registration', label: 'Registration Flow', icon: UserPlus },
          { id: 'profile', label: 'Business Profile', icon: Store },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === t.id ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><t.icon className="w-4 h-4" />{t.label}</button>
        ))}
      </div>

      {tab === 'auth' && <AuthConfigPanel />}
      {tab === 'registration' && <RegistrationFlowPanel />}
      {tab === 'profile' && <BusinessProfileConfigPanel />}
    </div>
  );
}

function AuthConfigPanel() {
  const { authConfig, updateAuthConfig } = useAdminData();
  const ac = authConfig;

  return (
    <div className="max-w-2xl space-y-6">
      <ConfigSection title="Login & Registration">
        <ToggleRow label="Login Enabled" value={ac.loginEnabled} onChange={v => updateAuthConfig({ loginEnabled: v })} />
        <ToggleRow label="Registration Enabled" value={ac.registrationEnabled} onChange={v => updateAuthConfig({ registrationEnabled: v })} />
        <ToggleRow label="Single Sign-On (SSO)" value={ac.ssoEnabled} onChange={v => updateAuthConfig({ ssoEnabled: v })} />
      </ConfigSection>
      <ConfigSection title="Password Policy">
        <SliderRow label="Minimum Password Length" value={ac.passwordMinLength} min={4} max={32} onChange={v => updateAuthConfig({ passwordMinLength: v })} />
        <ToggleRow label="Require Special Characters" value={ac.passwordRequireSpecial} onChange={v => updateAuthConfig({ passwordRequireSpecial: v })} />
        <ToggleRow label="Require Numbers" value={ac.passwordRequireNumber} onChange={v => updateAuthConfig({ passwordRequireNumber: v })} />
      </ConfigSection>
      <ConfigSection title="Session Policy">
        <SliderRow label="Session Duration (hours)" value={ac.sessionDuration} min={1} max={168} onChange={v => updateAuthConfig({ sessionDuration: v })} />
        <SliderRow label="Max Sessions Per User" value={ac.maxSessionsPerUser} min={1} max={20} onChange={v => updateAuthConfig({ maxSessionsPerUser: v })} />
      </ConfigSection>
    </div>
  );
}

function RegistrationFlowPanel() {
  const { registrationFlow, updateRegistrationFlow } = useAdminData();
  const rf = registrationFlow;

  return (
    <div className="max-w-2xl space-y-6">
      <ConfigSection title="Business Registration Fields">
        <div className="flex flex-wrap gap-1.5">{rf.businessFields.map(f => <span key={f} className="px-3 py-1.5 bg-blue-50 text-brand-blue rounded-lg text-xs font-bold">{f}</span>)}</div>
      </ConfigSection>
      <ConfigSection title="Customer Registration Fields">
        <div className="flex flex-wrap gap-1.5">{rf.customerFields.map(f => <span key={f} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">{f}</span>)}</div>
      </ConfigSection>
      <ConfigSection title="Verification Rules">
        <ToggleRow label="Require Business Verification" value={rf.requireBusinessVerification} onChange={v => updateRegistrationFlow({ requireBusinessVerification: v })} />
        <ToggleRow label="Require Email Verification" value={rf.requireEmailVerification} onChange={v => updateRegistrationFlow({ requireEmailVerification: v })} />
        <ToggleRow label="Auto-Approve Businesses" value={rf.autoApproveBusinesses} onChange={v => updateRegistrationFlow({ autoApproveBusinesses: v })} />
        <ToggleRow label="Auto-Approve Customers" value={rf.autoApproveCustomers} onChange={v => updateRegistrationFlow({ autoApproveCustomers: v })} />
      </ConfigSection>
    </div>
  );
}

function BusinessProfileConfigPanel() {
  const { businessProfileConfig, updateBusinessProfileConfig } = useAdminData();
  const bp = businessProfileConfig;

  return (
    <div className="max-w-2xl space-y-6">
      <ConfigSection title="Business Information Fields">
        <div className="flex flex-wrap gap-1.5">{bp.fields.map(f => <span key={f} className="px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold">{f}</span>)}</div>
      </ConfigSection>
      <ConfigSection title="Storefront & Google">
        <ToggleRow label="Storefront Enabled" value={bp.storefrontEnabled} onChange={v => updateBusinessProfileConfig({ storefrontEnabled: v })} />
        <ToggleRow label="Google Fields Enabled" value={bp.googleFieldsEnabled} onChange={v => updateBusinessProfileConfig({ googleFieldsEnabled: v })} />
      </ConfigSection>
      <ConfigSection title="Location Fields">
        <div className="flex flex-wrap gap-1.5">{bp.locationFields.map(f => <span key={f} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold">{f}</span>)}</div>
      </ConfigSection>
      <ConfigSection title="Media Fields">
        <div className="flex flex-wrap gap-1.5">{bp.mediaFields.map(f => <span key={f} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-xs font-bold">{f}</span>)}</div>
      </ConfigSection>
    </div>
  );
}

function ConfigSection({ title, children }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{title}</h3><div className="space-y-3">{children}</div></div>;
}

function ToggleRow({ label, value, onChange }: any) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <button onClick={() => onChange(!value)} className={cn("w-12 h-7 rounded-full transition-all relative", value ? "bg-brand-blue" : "bg-gray-200")}>
        <div className={cn("w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all", value ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: any) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} className="w-24 accent-brand-blue" />
        <span className="text-sm font-bold text-brand-blue w-8 text-right">{value}</span>
      </div>
    </div>
  );
}
