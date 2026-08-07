import { useState } from 'react';
import { KeyRound, UserPlus, Store, Eye, EyeOff, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

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

      {tab === 'auth' && <PlaceholderPanel />}
      {tab === 'registration' && <PlaceholderPanel />}
      {tab === 'profile' && <PlaceholderPanel />}
    </div>
  );
}

function PlaceholderPanel() {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-gray-400 font-medium">Configuration will be available once connected to the backend.</p>
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
