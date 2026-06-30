import { useState } from 'react';
import { ClipboardList, Settings as SettingsIcon, Terminal, Crown, Search, Trash2, Download, RefreshCw, Eye, EyeOff, Shield, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData } from '../../context/AdminDataContext';

export default function SystemPanel() {
  const [tab, setTab] = useState<'audit' | 'settings' | 'developer' | 'super'>('audit');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit overflow-x-auto">
        {[
          { id: 'audit', label: 'Audit Logs', icon: ClipboardList },
          { id: 'settings', label: 'System Settings', icon: SettingsIcon },
          { id: 'developer', label: 'Developer Center', icon: Terminal },
          { id: 'super', label: 'Super Admin', icon: Crown },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap", tab === t.id ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><t.icon className="w-4 h-4" />{t.label}</button>
        ))}
      </div>
      {tab === 'audit' && <AuditLogsPanel />}
      {tab === 'settings' && <SystemSettingsPanel />}
      {tab === 'developer' && <DeveloperCenterPanel />}
      {tab === 'super' && <SuperAdminPanel />}
    </div>
  );
}

function AuditLogsPanel() {
  const { auditLogs, clearAuditLogs } = useAdminData();
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase()) ||
    l.targetName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-64" /></div>
        <div className="flex gap-2">
          <button onClick={clearAuditLogs} className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Clear All</button>
          <button className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 hover:bg-blue-50 hover:text-brand-blue transition-all flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Admin</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Target</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Details</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timestamp</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50/80 transition-colors text-xs">
                  <td className="px-6 py-4 font-bold text-gray-900">{log.action}</td>
                  <td className="px-6 py-4 text-gray-700">{log.adminName}</td>
                  <td className="px-6 py-4"><span className="text-gray-500">{log.targetType}: </span><span className="font-bold text-gray-700">{log.targetName}</span></td>
                  <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{log.details}</td>
                  <td className="px-6 py-4"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-600">{log.category}</span></td>
                  <td className="px-6 py-4 text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No audit logs found</div>}
      </div>
    </div>
  );
}

function SystemSettingsPanel() {
  const { settings, updateSettings } = useAdminData();
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Brand & Support</h3>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Brand Name</label><input value={settings.brandName} onChange={e => updateSettings({ brandName: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Support Email</label><input value={settings.supportEmail} onChange={e => updateSettings({ supportEmail: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Currency</label><select value={settings.currency} onChange={e => updateSettings({ currency: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"><option>GBP</option><option>USD</option><option>EUR</option></select></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Security</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Session Timeout (min)</label><input type="number" value={settings.sessionTimeout} onChange={e => updateSettings({ sessionTimeout: parseInt(e.target.value) || 30 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Max Login Attempts</label><input type="number" value={settings.maxLoginAttempts} onChange={e => updateSettings({ maxLoginAttempts: parseInt(e.target.value) || 5 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">System Toggles</h3>
        <div className="space-y-4">
          <Toggle label="Email Notifications Enabled" value={settings.emailEnabled} onChange={v => updateSettings({ emailEnabled: v })} />
          <Toggle label="SMS Notifications Enabled" value={settings.smsEnabled} onChange={v => updateSettings({ smsEnabled: v })} />
          <Toggle label="Payment Gateway Active" value={settings.paymentGateway === 'Stripe'} onChange={v => updateSettings({ paymentGateway: v ? 'Stripe' : 'None' })} />
          <Toggle label="Maintenance Mode" value={settings.maintenanceMode} onChange={v => updateSettings({ maintenanceMode: v })} />
          <Toggle label="Allow Registration" value={settings.allowRegistration} onChange={v => updateSettings({ allowRegistration: v })} />
        </div>
      </div>

      <button onClick={handleSave} className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2">
        <Save className="w-4 h-4" />{saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

function DeveloperCenterPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <DevCard title="API Documentation" desc="Complete API reference for the MCOM ecosystem." icon={Terminal} />
      <DevCard title="Webhooks" desc="Configure webhook endpoints for real-time events." icon={RefreshCw} />
      <DevCard title="System Health" desc="Monitor system performance and uptime." icon={Shield} />
      <DevCard title="Background Jobs" desc="View and manage background job queues." icon={SettingsIcon} />
      <DevCard title="Error Logs" desc="Review application errors and stack traces." icon={ClipboardList} />
      <DevCard title="Integration Logs" desc="Track third-party integration activity." icon={Search} />
    </div>
  );
}

function SuperAdminPanel() {
  const { permissionRoles, membershipPlans, platforms, packages } = useAdminData();

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center"><Crown className="w-6 h-6 text-white" /></div>
          <div><h3 className="font-bold text-lg text-gray-900">Super Admin Control Center</h3><p className="text-xs text-gray-500">Highest-level administrative control for the entire ecosystem</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SuperStat label="All Admins" value={permissionRoles.length.toString()} />
        <SuperStat label="All Memberships" value={membershipPlans.length.toString()} />
        <SuperStat label="All Packages" value={packages.length.toString()} />
        <SuperStat label="All Platforms" value={platforms.length.toString()} />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Ecosystem Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900">Admin Roles</h4>
            {permissionRoles.map(r => <div key={r.role} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><span className="font-bold text-gray-700">{r.role}</span><span className="text-xs text-gray-400">Supervisory</span></div>)}
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900">Platforms</h4>
            {platforms.map(p => <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><span className="font-bold text-gray-700">{p.name}</span><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", p.status === 'Enabled' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{p.status}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function DevCard({ title, desc, icon: Icon }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all cursor-pointer"><div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center mb-3 text-brand-blue"><Icon className="w-5 h-5" /></div><h3 className="font-bold text-sm text-gray-900 mb-1">{title}</h3><p className="text-xs text-gray-500">{desc}</p></div>;
}

function SuperStat({ label, value }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div><div className="text-2xl font-bold text-gray-900">{value}</div></div>;
}

function Toggle({ label, value, onChange }: any) {
  return <div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-700">{label}</span><button onClick={() => onChange(!value)} className={cn("w-12 h-7 rounded-full transition-all relative", value ? "bg-brand-blue" : "bg-gray-200")}><div className={cn("w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all", value ? "left-6" : "left-1")} /></button></div>;
}
