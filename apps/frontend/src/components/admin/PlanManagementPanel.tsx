import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, X, Trash2, Edit3, Package, Gem, Copy, Archive, Eye } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData, MembershipPlan, Package as PackageType } from '../../context/AdminDataContext';

export default function PlanManagementPanel() {
  const { membershipPlans, packages, addMembershipPlan, updateMembershipPlan, deleteMembershipPlan, addPackage, updatePackage, deletePackage } = useAdminData();
  const [tab, setTab] = useState<'memberships' | 'packages'>('memberships');
  const [showAddMembership, setShowAddMembership] = useState(false);
  const [editMembership, setEditMembership] = useState<string | null>(null);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [editPackage, setEditPackage] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button onClick={() => setTab('memberships')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all", tab === 'memberships' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Gem className="w-4 h-4 inline mr-1.5" />Memberships</button>
        <button onClick={() => setTab('packages')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all", tab === 'packages' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><Package className="w-4 h-4 inline mr-1.5" />Packages</button>
      </div>

      {tab === 'memberships' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500 font-medium">{membershipPlans.length} membership plans configured</p>
            <button onClick={() => setShowAddMembership(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Plus className="w-4 h-4" /> Create Membership</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {membershipPlans.map(plan => (
              <div key={plan.id} className={cn("bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all", plan.archived ? "opacity-50" : "")}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditMembership(plan.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => deleteMembershipPlan(plan.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => updateMembershipPlan(plan.id, { archived: !plan.archived })} className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all"><Archive className={cn("w-3.5 h-3.5", plan.archived ? "text-amber-500" : "text-gray-400")} /></button>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold text-gray-900">£{plan.price}</span>
                  <span className="text-xs text-gray-400">/{plan.billingCycle.toLowerCase()}</span>
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform Access</div>
                  <div className="flex flex-wrap gap-1.5">{plan.platformAccess.map(p => <span key={p} className="px-2 py-1 bg-blue-50 text-brand-blue rounded-lg text-[10px] font-bold">{p}</span>)}</div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Permissions</div>
                  <div className="flex flex-wrap gap-1.5">{plan.permissions.map(p => <span key={p} className="px-2 py-1 bg-gray-50 text-gray-600 rounded-lg text-[10px] font-bold">{p}</span>)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'packages' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-sm text-gray-500 font-medium">{packages.length} packages across platforms</p>
            <button onClick={() => setShowAddPackage(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Plus className="w-4 h-4" /> Create Package</button>
          </div>
          {['MCOM Rewards', 'MCOM Spin', 'MCOM Mall', 'GBS Audit', 'GBS Expo'].map(platform => {
            const platformPkgs = packages.filter(p => p.platform === platform && !p.archived);
            if (platformPkgs.length === 0) return null;
            return (
              <div key={platform} className="mb-8">
                <h3 className="font-bold text-sm text-gray-900 mb-4 flex items-center gap-2"><Package className="w-4 h-4 text-brand-blue" />{platform}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {platformPkgs.map(pkg => (
                    <div key={pkg.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-bold text-gray-900">{pkg.name}</h4>
                          <p className="text-xs text-gray-500">{pkg.description}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditPackage(pkg.id)} className="p-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 transition-all"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                          <button onClick={() => deletePackage(pkg.id)} className="p-1.5 bg-gray-50 rounded-lg hover:bg-red-50 transition-all"><Trash2 className="w-3.5 h-3.5 text-gray-400" /></button>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1 mb-3"><span className="text-xl font-bold">£{pkg.price}</span><span className="text-xs text-gray-400">/{pkg.billingCycle.toLowerCase()}</span></div>
                      <div className="space-y-1.5">
                        {pkg.features.map(f => <div key={f} className="flex items-center gap-2 text-xs text-gray-600"><div className="w-1.5 h-1.5 rounded-full bg-green-400" />{f}</div>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showAddMembership && (
          <PlanFormModal title="Create Membership" onClose={() => setShowAddMembership(false)} onSave={(data) => { addMembershipPlan(data); setShowAddMembership(false); }} />
        )}
        {editMembership && (
          <PlanFormModal title="Edit Membership" initial={membershipPlans.find(p => p.id === editMembership)} onClose={() => setEditMembership(null)} onSave={(data) => { updateMembershipPlan(editMembership!, data); setEditMembership(null); }} />
        )}
        {showAddPackage && (
          <PackageFormModal title="Create Package" onClose={() => setShowAddPackage(false)} onSave={(data) => { addPackage(data); setShowAddPackage(false); }} />
        )}
        {editPackage !== null && (
          <PackageFormModal title="Edit Package" initial={packages.find(p => p.id === editPackage)} onClose={() => setEditPackage(null)} onSave={(data) => { updatePackage(editPackage!, data); setEditPackage(null); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanFormModal({ title, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(initial || { name: '', description: '', price: 0, billingCycle: 'Monthly', platformAccess: [], usageLimits: { rewards: 0, campaigns: 0, stores: 0, spins: 0, audits: 0, expos: 0 }, permissions: [], archived: false });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white"><h4 className="text-lg font-bold">{title}</h4><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-6 space-y-4">
          <Field label="Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-20 resize-none" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (£)"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
            <Field label="Billing Cycle"><select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['Monthly', 'Quarterly', 'Yearly'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          </div>
          <Field label="Platform Access"><MultiSelect options={['Loyalty', 'Mall', 'Rewards', 'Spin', 'Audit', 'Expo']} selected={form.platformAccess} onChange={v => setForm({ ...form, platformAccess: v })} /></Field>
          <Field label="Permissions"><MultiSelect options={['Basic Dashboard', 'Standard Dashboard', 'Full Dashboard', 'API Access', 'Priority Support', 'Dedicated AM', 'Executive Reports', 'Campaign Access']} selected={form.permissions} onChange={v => setForm({ ...form, permissions: v })} /></Field>
          <Field label="Usage Limits">
            <div className="grid grid-cols-3 gap-2">
              {['rewards', 'campaigns', 'stores', 'spins', 'audits', 'expos'].map(key => (
                <div key={key} className="bg-gray-50 rounded-xl p-2"><div className="text-[9px] font-bold text-gray-400 uppercase mb-1">{key}</div><input type="number" value={(form.usageLimits as any)[key] || 0} onChange={e => setForm({ ...form, usageLimits: { ...form.usageLimits, [key]: parseInt(e.target.value) || 0 } })} className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold" /></div>
              ))}
            </div>
          </Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">{initial ? 'Save' : 'Create'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function PackageFormModal({ title, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(initial || { name: '', platform: 'MCOM Rewards', description: '', price: 0, billingCycle: 'Monthly', features: [], usageLimits: { members: 0, products: 0, orders: 0, spins: 0, prizes: 0, audits: 0, templates: 0, booth: 1, media: 0 }, accessRights: [], archived: false });
  const [newFeature, setNewFeature] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white"><h4 className="text-lg font-bold">{title}</h4><button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className="p-6 space-y-4">
          <Field label="Package Name"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Platform"><select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['MCOM Rewards', 'MCOM Spin', 'MCOM Mall', 'GBS Audit', 'GBS Expo'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
            <Field label="Billing Cycle"><select value={form.billingCycle} onChange={e => setForm({ ...form, billingCycle: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">{['Monthly', 'Quarterly', 'Yearly'].map(o => <option key={o} value={o}>{o}</option>)}</select></Field>
          </div>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20 h-16 resize-none" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price (£)"><input type="number" value={form.price} onChange={e => setForm({ ...form, price: parseInt(e.target.value) || 0 })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></Field>
          </div>
          <Field label="Features">
            <div className="space-y-2">
              {form.features.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={f} onChange={e => { const arr = [...form.features]; arr[i] = e.target.value; setForm({ ...form, features: arr }); }} className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                  <button onClick={() => setForm({ ...form, features: form.features.filter((_: any, j: number) => j !== i) })} className="p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex gap-2">
                <input value={newFeature} onChange={e => setNewFeature(e.target.value)} placeholder="Add feature..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                <button onClick={() => { if (newFeature.trim()) { setForm({ ...form, features: [...form.features, newFeature.trim()] }); setNewFeature(''); } }} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
          </Field>
          <Field label="Access Rights"><MultiSelect options={['Store Admin', 'Marketing Admin', 'Analytics', 'View Analytics', 'Export Data', 'Spin Admin', 'Audit Access', 'Expo Admin']} selected={form.accessRights} onChange={v => setForm({ ...form, accessRights: v })} /></Field>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">{initial ? 'Save' : 'Create'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function Field({ label, children }: any) {
  return <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2 block">{label}</label>{children}</div>;
}

function MultiSelect({ options, selected, onChange }: any) {
  return <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">{
    options.map((o: string) => (
      <button key={o} type="button" onClick={() => onChange(selected.includes(o) ? selected.filter((x: string) => x !== o) : [...selected, o])}
        className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", selected.includes(o) ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-100")}>{o}</button>
    ))
  }</div>;
}
