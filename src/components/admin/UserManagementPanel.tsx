import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, X, Eye, Trash2, Edit3, Building2, UserCircle, Briefcase, Users, Mail, Phone, Shield, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData, BusinessUser, CustomerUser, AgentUser, ConsultantUser, AccountManager } from '../../context/AdminDataContext';

type UserTab = 'businesses' | 'customers' | 'agents' | 'consultants' | 'account-managers';

export default function UserManagementPanel() {
  const {
    businesses, customers, agents, consultants, accountManagers,
    addBusiness, updateBusiness, deleteBusiness,
    addCustomer, updateCustomer, deleteCustomer,
    addAgent, updateAgent, deleteAgent,
    addConsultant, updateConsultant, deleteConsultant,
    addAccountManager, updateAccountManager, deleteAccountManager,
  } = useAdminData();

  const [userTab, setUserTab] = useState<UserTab>('businesses');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const filterBySearch = <T extends { name: string; email: string }>(items: T[]) =>
    items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.email.toLowerCase().includes(search.toLowerCase()));

  const renderTable = () => {
    switch (userTab) {
      case 'businesses': return <BusinessTable data={filterBySearch(businesses)} onEdit={setEditing} onDelete={deleteBusiness} onAdd={() => setShowAdd(true)} />;
      case 'customers': return <CustomerTable data={filterBySearch(customers)} onEdit={setEditing} onDelete={deleteCustomer} onAdd={() => setShowAdd(true)} />;
      case 'agents': return <AgentTable data={filterBySearch(agents)} onEdit={setEditing} onDelete={deleteAgent} onAdd={() => setShowAdd(true)} />;
      case 'consultants': return <ConsultantTable data={filterBySearch(consultants)} onEdit={setEditing} onDelete={deleteConsultant} onAdd={() => setShowAdd(true)} />;
      case 'account-managers': return <AccountManagerTable data={filterBySearch(accountManagers)} onEdit={setEditing} onDelete={deleteAccountManager} onAdd={() => setShowAdd(true)} />;
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
          {(['businesses', 'customers', 'agents', 'consultants', 'account-managers'] as UserTab[]).map(t => (
            <button key={t} onClick={() => setUserTab(t)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", userTab === t ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}>
              {t === 'businesses' ? 'Businesses' : t === 'customers' ? 'Customers' : t === 'agents' ? 'Agents' : t === 'consultants' ? 'Consultants' : 'Account Mgrs'}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-48" />
          </div>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"><Plus className="w-4 h-4" /> Add New</button>
        </div>
      </div>

      {renderTable()}

      <AnimatePresence>
        {showAdd && (
          <UserFormModal
            type={userTab}
            onClose={() => setShowAdd(false)}
            onSave={(data) => {
              if (userTab === 'businesses') addBusiness(data as any);
              else if (userTab === 'customers') addCustomer(data as any);
              else if (userTab === 'agents') addAgent(data as any);
              else if (userTab === 'consultants') addConsultant(data as any);
              else if (userTab === 'account-managers') addAccountManager(data as any);
              setShowAdd(false);
            }}
          />
        )}
        {editing && (
          <UserFormModal
            type={userTab}
            initial={editing}
            onClose={() => setEditing(null)}
            onSave={(data) => {
              if (userTab === 'businesses') updateBusiness(editing.id, data);
              else if (userTab === 'customers') updateCustomer(editing.id, data);
              else if (userTab === 'agents') updateAgent(editing.id, data);
              else if (userTab === 'consultants') updateConsultant(editing.id, data);
              else if (userTab === 'account-managers') updateAccountManager(editing.id, data);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BusinessTable({ data, onEdit, onDelete, onAdd }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Business</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Membership</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Revenue</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((b: BusinessUser) => (
              <tr key={b.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 text-brand-blue rounded-lg flex items-center justify-center font-bold text-xs">{b.name.charAt(0)}</div>
                  <div><div className="font-bold text-sm text-gray-900">{b.name}</div><div className="text-[10px] text-gray-400 font-bold">{b.email}</div></div>
                </div></td>
                <td className="px-6 py-4"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-200">{b.membership}</span></td>
                <td className="px-6 py-4"><div className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", b.status === 'Active' ? 'bg-green-500' : b.status === 'Pending' ? 'bg-amber-500' : 'bg-red-500')} /><span className="text-xs font-bold">{b.status}</span></div></td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{b.revenue}</td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(b)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(b.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No businesses found</div>}
    </div>
  );
}

function CustomerTable({ data, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Customer</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Loyalty Points</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((c: CustomerUser) => (
              <tr key={c.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-bold text-xs">{c.name.charAt(0)}</div>
                  <div><div className="font-bold text-sm text-gray-900">{c.name}</div><div className="text-[10px] text-gray-400 font-bold">{c.email}</div></div>
                </div></td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{c.loyaltyPoints.toLocaleString()}</td>
                <td className="px-6 py-4"><div className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", c.status === 'Active' ? 'bg-green-500' : 'bg-red-500')} /><span className="text-xs font-bold">{c.status}</span></div></td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(c)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(c.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No customers found</div>}
    </div>
  );
}

function AgentTable({ data, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Agent</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Permissions</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((a: AgentUser) => (
              <tr key={a.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center font-bold text-xs">{a.name.charAt(0)}</div>
                  <div><div className="font-bold text-sm text-gray-900">{a.name}</div><div className="text-[10px] text-gray-400 font-bold">{a.email}</div></div>
                </div></td>
                <td className="px-6 py-4"><div className="flex gap-1 flex-wrap">{a.permissions.map(p => <span key={p} className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-bold text-gray-600">{p}</span>)}</div></td>
                <td className="px-6 py-4"><div className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", a.status === 'Active' ? 'bg-green-500' : 'bg-gray-400')} /><span className="text-xs font-bold">{a.status}</span></div></td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(a)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(a.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No agents found</div>}
    </div>
  );
}

function ConsultantTable({ data, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Consultant</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Specialisation</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((c: ConsultantUser) => (
              <tr key={c.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold text-xs">{c.name.charAt(0)}</div>
                  <div><div className="font-bold text-sm text-gray-900">{c.name}</div><div className="text-[10px] text-gray-400 font-bold">{c.email}</div></div>
                </div></td>
                <td className="px-6 py-4 text-sm font-bold text-gray-700">{c.specialisation}</td>
                <td className="px-6 py-4"><div className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", c.status === 'Active' ? 'bg-green-500' : 'bg-gray-400')} /><span className="text-xs font-bold">{c.status}</span></div></td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(c)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(c.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No consultants found</div>}
    </div>
  );
}

function AccountManagerTable({ data, onEdit, onDelete }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead><tr className="bg-gray-50/50">
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manager</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Businesses</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {data.map((a: AccountManager) => (
              <tr key={a.id} className="hover:bg-gray-50/80 transition-colors group">
                <td className="px-6 py-4"><div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-cyan-50 text-cyan-600 rounded-lg flex items-center justify-center font-bold text-xs">{a.name.charAt(0)}</div>
                  <div><div className="font-bold text-sm text-gray-900">{a.name}</div><div className="text-[10px] text-gray-400 font-bold">{a.email}</div></div>
                </div></td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">{a.assignedBusinesses}</td>
                <td className="px-6 py-4"><div className="flex items-center gap-2"><span className={cn("w-2 h-2 rounded-full", a.status === 'Active' ? 'bg-green-500' : 'bg-gray-400')} /><span className="text-xs font-bold">{a.status}</span></div></td>
                <td className="px-6 py-4"><div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(a)} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all"><Edit3 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => onDelete(a.id)} className="p-2 bg-gray-50 rounded-lg hover:bg-red-50 hover:text-red-500 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No account managers found</div>}
    </div>
  );
}

function UserFormModal({ type, initial, onClose, onSave }: any) {
  const [form, setForm] = useState<any>(initial || getDefaults(type));

  const fields = getFormFields(type, form, setForm);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-lg font-bold">{initial ? 'Edit' : 'Add'} {type === 'businesses' ? 'Business' : type === 'customers' ? 'Customer' : type === 'agents' ? 'Agent' : type === 'consultants' ? 'Consultant' : 'Account Manager'}</h4>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map((f: any) => (
            <div key={f.name} className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">{f.label}</label>
              {f.type === 'select' ? (
                <select value={form[f.name]} onChange={e => setForm({ ...form, [f.name]: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20">
                  {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'multi-select' ? (
                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
                  {f.options.map((o: string) => (
                    <button key={o} type="button" onClick={() => {
                      const arr = form[f.name] || [];
                      setForm({ ...form, [f.name]: arr.includes(o) ? arr.filter((x: string) => x !== o) : [...arr, o] });
                    }} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", (form[f.name] || []).includes(o) ? "bg-brand-blue text-white" : "bg-white text-gray-500 hover:bg-gray-100")}>{o}</button>
                  ))}
                </div>
              ) : (
                <input type={f.type || 'text'} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-50 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all">Cancel</button>
          <button onClick={() => onSave(form)} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">{initial ? 'Save Changes' : 'Create'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function getDefaults(type: string) {
  switch (type) {
    case 'businesses': return { name: '', email: '', phone: '', membership: 'Bronze Normal', platformAccess: ['Loyalty'], status: 'Pending', revenue: '£0', source: 'GBS Loyalty', joined: new Date().toISOString().split('T')[0], googleVerified: false };
    case 'customers': return { name: '', email: '', phone: '', loyaltyPoints: 0, platformUsage: [], membershipStatus: 'None', status: 'Active' };
    case 'agents': return { name: '', email: '', phone: '', permissions: ['View Businesses'], status: 'Active' };
    case 'consultants': return { name: '', email: '', phone: '', specialisation: '', status: 'Active' };
    case 'account-managers': return { name: '', email: '', phone: '', assignedBusinesses: 0, status: 'Active' };
    default: return {};
  }
}

function getFormFields(type: string, form: any, setForm: any) {
  const base = [
    { name: 'name', label: 'Full Name', type: 'text' },
    { name: 'email', label: 'Email Address', type: 'email' },
    { name: 'phone', label: 'Phone Number', type: 'text' },
  ];
  switch (type) {
    case 'businesses': return [
      ...base,
      { name: 'membership', label: 'Membership Tier', type: 'select', options: ['Bronze Normal', 'Silver Normal', 'Gold Pro', 'Gold Pro+', 'Platinum Normal'] },
      { name: 'platformAccess', label: 'Platform Access', type: 'multi-select', options: ['Loyalty', 'Mall', 'Rewards', 'Spin', 'Audit', 'Expo'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Pending', 'Suspended', 'Verified'] },
      { name: 'revenue', label: 'Monthly Revenue', type: 'text' },
      { name: 'source', label: 'Source', type: 'select', options: ['GBS Loyalty', 'Mcom Mall', 'Mcom Rewards', 'Mcom Spin', 'GBS Audit', 'GBS Expo', 'McomQ Link'] },
    ];
    case 'customers': return [
      ...base,
      { name: 'loyaltyPoints', label: 'Loyalty Points', type: 'number' },
      { name: 'platformUsage', label: 'Platform Usage', type: 'multi-select', options: ['Rewards', 'Spin', 'Mall', 'Audit', 'Expo'] },
      { name: 'membershipStatus', label: 'Membership Status', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Suspended'] },
    ];
    case 'agents': return [
      ...base,
      { name: 'permissions', label: 'Permissions', type: 'multi-select', options: ['View Businesses', 'Edit Businesses', 'View Customers', 'Edit Customers', 'Support Access', 'Manage Platforms'] },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Deactivated'] },
    ];
    case 'consultants': return [
      ...base,
      { name: 'specialisation', label: 'Specialisation', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    ];
    case 'account-managers': return [
      ...base,
      { name: 'assignedBusinesses', label: 'Assigned Businesses', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
    ];
    default: return base;
  }
}
