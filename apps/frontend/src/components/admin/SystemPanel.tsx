import { useState } from 'react';
import { ClipboardList, Settings as SettingsIcon, Terminal, Crown, Search, Trash2, Download, RefreshCw, Eye, EyeOff, Shield, Save, Loader2, Activity, Plus, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminAuditLogs, useAdminSettings, useAdminPlans, useAdminPlatforms, useAdminPackages, useAdminPermissions, useClearAuditLogs, useUpdateSettings, useSystemHealth, useSystemJobs, useCreateSystemJob, useUpdateSystemJob, useDeleteSystemJob, useSystemErrorLogs } from '../../services/admin/hooks';

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
  const { data: logsRes, isLoading } = useAdminAuditLogs();
  const auditLogs = logsRes?.data ?? [];
  const clearLogs = useClearAuditLogs();
  const [search, setSearch] = useState('');

  const filtered = auditLogs.filter((l: any) =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.adminName.toLowerCase().includes(search.toLowerCase()) ||
    l.targetName.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const rows = filtered.map((l: any) => [
      l.action, l.adminName, `${l.targetType}: ${l.targetName}`, l.details, l.category, new Date(l.timestamp).toISOString(),
    ]);
    const csv = [['Action', 'Admin', 'Target', 'Details', 'Category', 'Timestamp'], ...rows]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-64" /></div>
        <div className="flex gap-2">
          <button onClick={() => clearLogs.mutate()} className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" />Clear All</button>
          <button onClick={handleExport} className="px-3 py-2 bg-gray-50 rounded-xl text-xs font-bold text-gray-500 hover:bg-blue-50 hover:text-brand-blue transition-all flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
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
              {filtered.map((log: any) => (
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
  const { data: settingsRes, isLoading } = useAdminSettings();
  const settings = settingsRes?.data ?? ({} as any);
  const updateSetting = useUpdateSettings();
  const [saved, setSaved] = useState(false);
  const [localSettings, setLocalSettings] = useState<Record<string, any>>({});

  const get = (key: string) => localSettings[key] ?? settings[key] ?? '';

  const set = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (Object.keys(localSettings).length === 0) return;
    updateSetting.mutate(localSettings, {
      onSuccess: () => {
        setLocalSettings({});
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Brand & Support</h3>
        <div className="space-y-4">
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Brand Name</label><input value={get('brandName')} onChange={e => set('brandName', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Support Email</label><input value={get('supportEmail')} onChange={e => set('supportEmail', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Currency</label><select value={get('currency')} onChange={e => set('currency', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20"><option>GBP</option><option>USD</option><option>EUR</option></select></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Security</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Session Timeout (min)</label><input type="number" value={get('sessionTimeout')} onChange={e => set('sessionTimeout', parseInt(e.target.value) || 30)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Max Login Attempts</label><input type="number" value={get('maxLoginAttempts')} onChange={e => set('maxLoginAttempts', parseInt(e.target.value) || 5)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">System Toggles</h3>
        <div className="space-y-4">
          <Toggle label="Email Notifications Enabled" value={get('emailEnabled') ?? settings.emailEnabled} onChange={v => set('emailEnabled', v)} />
          <Toggle label="SMS Notifications Enabled" value={get('smsEnabled') ?? settings.smsEnabled} onChange={v => set('smsEnabled', v)} />
          <Toggle label="Payment Gateway Active" value={(get('paymentGateway') ?? settings.paymentGateway) === 'Stripe'} onChange={v => set('paymentGateway', v ? 'Stripe' : 'None')} />
          <Toggle label="Maintenance Mode" value={get('maintenanceMode') ?? settings.maintenanceMode} onChange={v => set('maintenanceMode', v)} />
          <Toggle label="Allow Registration" value={get('allowRegistration') ?? settings.allowRegistration} onChange={v => set('allowRegistration', v)} />
        </div>
      </div>

      <button onClick={handleSave} className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2">
        <Save className="w-4 h-4" />{saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}

function DeveloperCenterPanel() {
  const [devTab, setDevTab] = useState<'health' | 'jobs' | 'errors'>('health');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        {[
          { id: 'health', label: 'System Health', icon: Shield },
          { id: 'jobs', label: 'Background Jobs', icon: SettingsIcon },
          { id: 'errors', label: 'Error Logs', icon: ClipboardList },
        ].map(t => (
          <button key={t.id} onClick={() => setDevTab(t.id as any)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2", devTab === t.id ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><t.icon className="w-3.5 h-3.5" />{t.label}</button>
        ))}
      </div>
      {devTab === 'health' && <SystemHealthTab />}
      {devTab === 'jobs' && <BackgroundJobsTab />}
      {devTab === 'errors' && <ErrorLogsTab />}
    </div>
  );
}

function SystemHealthTab() {
  const { data: res, isLoading } = useSystemHealth();
  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-blue" /></div>;
  const d = res?.data ?? ({} as any);
  const healthy = d.status === 'healthy';
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <HealthCard icon={healthy ? CheckCircle2 : XCircle} label="Status" value={d.status || 'unknown'} tone={healthy ? 'green' : 'red'} />
      <HealthCard icon={Activity} label="Uptime" value={`${Math.floor(d.uptime || 0)}s`} tone="blue" />
      <HealthCard icon={SettingsIcon} label="Database" value={d.services?.database ?? 'unknown'} tone={d.services?.database === 'ok' ? 'green' : 'red'} />
      <HealthCard icon={Loader2} label="DB Latency" value={`${Math.round(d.services?.databaseLatencyMs ?? 0)}ms`} tone="blue" />
      {d.error && <div className="md:col-span-4 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">{d.error}</div>}
    </div>
  );
}

function BackgroundJobsTab() {
  const { data: res, isLoading } = useSystemJobs();
  const createJob = useCreateSystemJob();
  const updateJob = useUpdateSystemJob();
  const deleteJob = useDeleteSystemJob();
  const jobs = (res?.data ?? []) as any[];
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('pending');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="font-bold text-gray-900">Background Jobs</h3><p className="text-xs text-gray-400">Scheduled and queued background jobs.</p></div>
        <button onClick={() => setShowCreate(v => !v)} className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-colors"><Plus className="w-3.5 h-3.5" /> Create Job</button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Job Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Expire subscriptions" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
              <option value="pending">Pending</option><option value="running">Running</option><option value="completed">Completed</option><option value="failed">Failed</option>
            </select>
          </div>
          <button onClick={async () => { if (!name) return; await createJob.mutateAsync({ name, status }); setName(''); setShowCreate(false); }} className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors">Create</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-blue" /></div>
      ) : jobs.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-white border border-gray-100"><p className="text-sm text-gray-400 font-medium">No background jobs.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {jobs.map((j: any) => (
            <div key={j.id} className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-900 text-sm truncate">{j.name}</p>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", j.status === 'completed' ? 'bg-green-50 text-green-700' : j.status === 'failed' ? 'bg-red-50 text-red-600' : j.status === 'running' ? 'bg-blue-50 text-brand-blue' : 'bg-gray-100 text-gray-500')}>{j.status}</span>
                  {typeof j.progress === 'number' && <span className="text-[10px] font-bold text-gray-400">{j.progress}%</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                  {j.startedAt && <span>Started: {new Date(j.startedAt).toLocaleString()}</span>}
                  {j.completedAt && <span>Completed: {new Date(j.completedAt).toLocaleString()}</span>}
                  {j.error && <span className="text-red-500 font-bold">{j.error}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {j.status !== 'completed' && j.status !== 'failed' && (
                  <button onClick={() => updateJob.mutate({ id: j.id, data: { status: 'completed' } })} className="p-2 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600" title="Mark complete"><CheckCircle2 className="w-4 h-4" /></button>
                )}
                <button onClick={() => deleteJob.mutate(j.id)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ErrorLogsTab() {
  const { data: res, isLoading } = useSystemErrorLogs({ page: 1, limit: 100 });
  const logs = (res?.data ?? []) as any[];
  return (
    <div className="space-y-4">
      <div><h3 className="font-bold text-gray-900">Error Logs</h3><p className="text-xs text-gray-400">Recent application errors and stack traces.</p></div>
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-brand-blue" /></div>
      ) : logs.length === 0 ? (
        <div className="flex items-center justify-center py-16 rounded-2xl bg-white border border-gray-100"><p className="text-sm text-gray-400 font-medium">No error logs.</p></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
          {logs.map((l: any) => (
            <div key={l.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", l.level === 'error' ? 'bg-red-50 text-red-600' : l.level === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-brand-blue')}>{l.level}</span>
                <span className="text-xs font-bold text-gray-700 truncate">{l.message}</span>
                <span className="ml-auto text-[11px] text-gray-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
              {(l.source || l.path) && (
                <div className="mt-1 text-[11px] text-gray-400">{l.source && <span className="font-bold text-gray-500">{l.source}</span>} {l.path && <code className="font-mono">{l.path}</code>}</div>
              )}
              {l.stack && <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-[11px] text-gray-500 overflow-x-auto whitespace-pre-wrap">{l.stack}</pre>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperAdminPanel() {
  const { data: permRes } = useAdminPermissions();
  const { data: plansRes } = useAdminPlans();
  const { data: platformsRes } = useAdminPlatforms();
  const { data: packagesRes } = useAdminPackages();
  const permData = permRes?.data as any;
  const permissionRoles = Array.isArray(permData) ? permData : permData?.data ?? [];
  const planData = plansRes?.data as any;
  const membershipPlans = Array.isArray(planData) ? planData : planData?.data ?? [];
  const platData = platformsRes?.data as any;
  const platforms = Array.isArray(platData) ? platData : platData?.data?.platforms ?? [];
  const pkgData = packagesRes?.data as any;
  const packages = Array.isArray(pkgData) ? pkgData : pkgData?.data ?? [];

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
            {permissionRoles.map((r: any) => <div key={r.role} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><span className="font-bold text-gray-700">{r.role}</span><span className="text-xs text-gray-400">Supervisory</span></div>)}
          </div>
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900">Platforms</h4>
            {platforms.map((p: any) => <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><span className="font-bold text-gray-700">{p.name}</span><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", p.status === 'Enabled' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{p.status}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, tone }: any) {
  const toneMap: Record<string, string> = {
    green: 'text-emerald-600 bg-emerald-50',
    red: 'text-red-600 bg-red-50',
    blue: 'text-brand-blue bg-blue-50',
  };
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", toneMap[tone] || toneMap.blue)}><Icon className="w-5 h-5" /></div><div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div><div className="text-2xl font-bold text-gray-900 capitalize">{value}</div></div>;
}

function SuperStat({ label, value }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div><div className="text-2xl font-bold text-gray-900">{value}</div></div>;
}

function Toggle({ label, value, onChange }: any) {
  return <div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-700">{label}</span><button onClick={() => onChange(!value)} className={cn("w-12 h-7 rounded-full transition-all relative", value ? "bg-brand-blue" : "bg-gray-200")}><div className={cn("w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-all", value ? "left-6" : "left-1")} /></button></div>;
}
