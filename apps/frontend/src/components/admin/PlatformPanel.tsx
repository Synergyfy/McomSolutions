import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToggleLeft, Grid, Rocket, X, Edit3, Wrench, Eye, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminPlatforms, useUpdatePlatform, useCreateLaunchRule, useDeleteLaunchRule } from '../../services/admin/hooks';
import type { Platform, LaunchRule } from '../../services/admin/types';
import type { CreateLaunchRuleInput } from '../../services/admin/types';

export default function PlatformPanel() {
  const [tab, setTab] = useState<'access' | 'directory' | 'launch'>('access');
  const { data: platformsRes, isLoading } = useAdminPlatforms();
  const platforms = platformsRes?.data?.platforms ?? [];
  const launchRules = platformsRes?.data?.launchRules ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        {[
          { id: 'access', label: 'Access Control', icon: ToggleLeft },
          { id: 'directory', label: 'Directory', icon: Grid },
          { id: 'launch', label: 'Launch Control', icon: Rocket },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === t.id ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'access' && <PlatformAccessPanel platforms={platforms} />}
      {tab === 'directory' && <PlatformDirectoryPanel platforms={platforms} />}
      {tab === 'launch' && <PlatformLaunchPanel platforms={platforms} launchRules={launchRules} />}
    </div>
  );
}

function PlatformAccessPanel({ platforms }: { platforms: Platform[] }) {
  const updatePlat = useUpdatePlatform();
  const statusColor: Record<string, string> = { Enabled: 'bg-green-500', Disabled: 'bg-red-500', Maintenance: 'bg-amber-500', Restricted: 'bg-purple-500' };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {platforms.map((p: any) => (
        <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">{p.name}</h3>
            <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold", p.status === 'Enabled' ? 'bg-green-50 text-green-700' : p.status === 'Disabled' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700')}>
              <span className={cn("w-1.5 h-1.5 rounded-full", statusColor[p.status])} />{p.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-4">{p.description}</p>
          <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
            <span className="font-bold">{p.totalUsers?.toLocaleString() ?? 0} users</span>
            <span>Launched {p.launchDate ?? '—'}</span>
          </div>
          <div className="flex gap-2">
            {(['Enabled', 'Disabled', 'Maintenance'] as const).map(status => (
              <button key={status} onClick={() => updatePlat.mutate({ id: p.id, data: { status } })} className={cn("flex-1 py-2 rounded-xl text-[10px] font-bold transition-all", p.status === status ? "bg-brand-blue text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100")}>{status}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlatformDirectoryPanel({ platforms }: { platforms: Platform[] }) {
  const updatePlat = useUpdatePlatform();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Users</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Launched</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Visible</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {platforms.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="font-bold text-sm text-gray-900">{p.name}</div><div className="text-[10px] text-gray-400">{p.description}</div></td>
                <td className="px-6 py-4"><span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", p.status === 'Enabled' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>{p.status}</span></td>
                <td className="px-6 py-4 font-bold text-sm">{p.totalUsers.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{p.launchDate}</td>
                <td className="px-6 py-4"><button onClick={() => updatePlat.mutate({ id: p.id, data: { visible: !p.visible } })} className={cn("px-3 py-1 rounded-lg text-[10px] font-bold transition-all", p.visible ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400")}>{p.visible ? 'Yes' : 'No'}</button></td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2">
                  <button className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                  <button className="p-2 bg-gray-50 rounded-lg hover:bg-amber-50 hover:text-amber-500 transition-all"><Wrench className="w-3.5 h-3.5 text-gray-400" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlatformLaunchPanel({ platforms, launchRules }: { platforms: Platform[]; launchRules: LaunchRule[] }) {
  const createRule = useCreateLaunchRule();
  const deleteRule = useDeleteLaunchRule();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-gray-500 font-medium">{launchRules.length} launch rules configured</p>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Rocket className="w-4 h-4" /> Add Rule</button>
      </div>
      <div className="grid grid-cols-1 gap-4">
        {launchRules.map((rule: LaunchRule) => (
          <div key={rule.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div><h3 className="font-bold text-gray-900">{platforms.find((p: Platform) => p.id === rule.platformId)?.name || rule.platformId}</h3><p className="text-xs text-gray-500">Conditions: {rule.launchConditions}</p></div>
              <div className="flex gap-1.5">
                <button onClick={() => deleteRule.mutate(rule.id)} className="p-1.5 bg-gray-50 rounded-lg hover:bg-red-50 transition-all"><X className="w-3.5 h-3.5 text-gray-400" /></button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div><span className="font-bold text-gray-400 block mb-1">Membership Req.</span><span className="font-bold">{rule.requiredMembership}</span></div>
              <div><span className="font-bold text-gray-400 block mb-1">Package Req.</span><span className="font-bold">{rule.requiredPackage}</span></div>
              <div><span className="font-bold text-gray-400 block mb-1">Redirect</span><span className="font-bold text-brand-blue">{rule.redirectRule}</span></div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"><h4 className="text-lg font-bold">Add Launch Rule</h4><button onClick={() => setShowAdd(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
              <LaunchRuleForm onSave={(data: CreateLaunchRuleInput) => { createRule.mutate(data); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LaunchRuleForm({ onSave, onCancel }: any) {
  const [form, setForm] = useState({ platformId: 'rewards', requiredMembership: 'Bronze', requiredPackage: 'None', requiredPermissions: [], launchConditions: '', redirectRule: '/platform/', accessRule: '' });
  return (
    <div className="p-6 space-y-4">
      {[{ key: 'platformId', label: 'Platform', options: ['rewards', 'spin', 'mall', 'audit', 'expo'] },
        { key: 'requiredMembership', label: 'Required Membership', options: ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'] },
        { key: 'requiredPackage', label: 'Required Package', options: ['None', 'Loyalty Starter', 'Loyalty Pro', 'Mall Basic', 'Mall Enterprise', 'Spin Basic', 'Audit Basic', 'Expo Basic'] },
      ].map((f: any) => (
        <div key={f.key} className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">{f.label}</label>
          <select value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
            {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">Launch Conditions</label>
        <input value={form.launchConditions} onChange={e => setForm({ ...form, launchConditions: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      </div>
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
        <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">Create Rule</button>
      </div>
    </div>
  );
}
