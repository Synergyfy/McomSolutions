import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Bell, 
  Settings, 
  Grid, 
  LogOut, 
  User,
  ArrowUpRight,
  Zap,
  Clock,
  LayoutDashboard,
  Plus,
  HelpCircle,
  Building2,
  BadgeCheck,
  CreditCard,
  Target,
  X,
  Trash2,
  CheckCircle2,
  Eye,
  Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useBusinesses, Business } from '../context/BusinessContext';

export default function AdminDashboard() {
  const { businesses, addBusiness, updateBusiness, deleteBusiness } = useBusinesses();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [viewingBusiness, setViewingBusiness] = useState<Business | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || b.membership.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900 overflow-x-hidden">
      {/* Admin Sidebar */}
      <aside className="w-20 lg:w-72 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-glow">24</div>
          <div className="hidden lg:block">
            <div className="font-bold text-xl tracking-tighter text-gray-900 uppercase">Admin Hub</div>
            <div className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">Global Ecosystem</div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          <NavItem icon={LayoutDashboard} label="Admin Overview" active />
          <Link to="/admin/pricing" className="w-full">
            <NavItem icon={CreditCard} label="Pricing Manager" />
          </Link>
          <NavItem icon={Building2} label="All Businesses" />
          <NavItem icon={Target} label="Campaigns" />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest hidden lg:block">System Control</span>
          </div>
          <NavItem icon={Settings} label="Global Settings" />
        </nav>

        <div className="p-6">
          <button className="w-full flex items-center gap-3 p-4 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all group">
            <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform" />
            <span className="font-semibold text-sm hidden lg:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-72 bg-mesh min-h-screen">
        <header className="sticky top-0 z-10 px-12 py-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search businesses, products..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-6">
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-blue rounded-full" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-gray-900">Adam Smith</div>
                <div className="text-[10px] text-brand-blue font-bold uppercase">Super Admin</div>
              </div>
              <div className="w-10 h-10 bg-brand-dark rounded-xl flex items-center justify-center text-white font-bold shadow-glow">
                AS
              </div>
            </div>
          </div>
        </header>

        <div className="p-12">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-bold mb-2 tracking-tight">Global Business Overview</h2>
              <p className="text-gray-500 font-medium">Monitoring {businesses.length} businesses across the 24/7 GBS umbrella.</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Business
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard label="Total Merchants" value={businesses.length.toLocaleString()} change="+4" />
            <StatCard label="Total Subscriptions" value={businesses.filter(b => b.membership !== 'None').length.toString()} change="+12%" />
            <StatCard label="Live Campaigns" value="12" change="+2" />
            <StatCard label="Pending Audits" value="8" change="Stable" />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-xl font-bold">Business Directory</h3>
              <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
                {['All', 'Bronze', 'Silver', 'Gold', 'Platinum'].map(filter => (
                  <button 
                    key={filter} 
                    onClick={() => setActiveFilter(filter)}
                    className={cn(
                      "px-5 py-2 rounded-xl text-xs font-bold transition-all",
                      activeFilter === filter ? "bg-white text-brand-blue shadow-lg border border-gray-100" : "text-gray-400 hover:text-gray-600"
                    )}>{filter}</button>
                ))}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Business Name</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Membership</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Ecosystem Status</th>
                    <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredBusinesses.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm",
                              b.membership.includes('Gold') ? "bg-yellow-50 text-yellow-600" : 
                              b.membership.includes('Silver') ? "bg-slate-50 text-slate-500" : 
                              "bg-blue-50 text-brand-blue"
                          )}>
                            {b.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 group-hover:text-brand-blue transition-colors text-sm">{b.name}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase">{b.source}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                          b.membership.includes('Gold') ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                          b.membership.includes('Silver') ? "bg-slate-50 text-slate-500 border-slate-200" :
                          b.membership.includes('Platinum') ? "bg-blue-50 text-blue-700 border-blue-200" :
                          "bg-amber-50 text-amber-600 border-amber-200"
                        )}>
                          {b.membership}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <span className="text-sm font-bold text-gray-900">Active & Ready</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Direct Billing: Enabled</div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-3">
                          <button 
                            onClick={() => setViewingBusiness(b)}
                            className="p-2.5 bg-gray-50 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-xl transition-all border border-gray-100"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setEditingBusiness(b)}
                            className="p-2.5 bg-gray-50 text-gray-400 hover:text-brand-blue hover:bg-blue-50 rounded-xl transition-all border border-gray-100"
                            title="Quick Edit"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteBusiness(b.id)}
                            className="p-2.5 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all border border-gray-100"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        <AnimatePresence>
            {editingBusiness && (
                <Modal 
                    title={`Edit ${editingBusiness.name}`} 
                    onClose={() => setEditingBusiness(null)}
                >
                    <div className="p-8 space-y-6">
                        <InputGroup 
                            label="Business Name" 
                            value={editingBusiness.name} 
                            onChange={(v: string) => setEditingBusiness({ ...editingBusiness, name: v })} 
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <SelectGroup 
                                label="Membership" 
                                value={editingBusiness.membership} 
                                options={['Bronze Normal', 'Silver Normal', 'Gold Pro', 'Gold Pro+', 'Platinum Normal']}
                                onChange={(v: string) => setEditingBusiness({ ...editingBusiness, membership: v })} 
                            />
                            <SelectGroup 
                                label="Product Source" 
                                value={editingBusiness.source} 
                                options={['GBS Loyalty', 'Mcom Mall', 'Mcom Rewards', 'GBS Audit', 'McomQ Link']}
                                onChange={(v: string) => setEditingBusiness({ ...editingBusiness, source: v })} 
                            />
                        </div>
                        <InputGroup 
                            label="Monthly Revenue" 
                            value={editingBusiness.revenue} 
                            onChange={(v: string) => setEditingBusiness({ ...editingBusiness, revenue: v })} 
                        />
                        <div className="pt-4 flex gap-4">
                            <button 
                                onClick={() => {
                                    updateBusiness(editingBusiness.id, editingBusiness);
                                    setEditingBusiness(null);
                                }}
                                className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-glow"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* View Modal */}
            {viewingBusiness && (
                <Modal 
                    title="Merchant Insights" 
                    onClose={() => setViewingBusiness(null)}
                >
                    <div className="p-10 text-center">
                        <div className="w-20 h-20 bg-blue-50 text-brand-blue rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100">
                            <Briefcase className="w-10 h-10" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">{viewingBusiness.name}</h3>
                        <p className="text-gray-400 font-medium mb-8">Joined our ecosystem on {viewingBusiness.joined}</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-6 bg-gray-50 rounded-[2rem] text-left">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Member Since</div>
                                <div className="font-bold">{viewingBusiness.joined}</div>
                            </div>
                            <div className="p-6 bg-gray-50 rounded-[2rem] text-left">
                                <div className="text-[10px] font-bold text-gray-400 uppercase mb-2">Active Tools</div>
                                <div className="font-bold">4 Modules</div>
                            </div>
                        </div>

                        <button className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold hover:bg-brand-blue transition-all flex items-center justify-center gap-2">
                             Full Analytics <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>
                </Modal>
            )}

            {/* Add Modal */}
            {showAddModal && (
                <Modal 
                    title="Onboard New Business" 
                    onClose={() => setShowAddModal(false)}
                >
                    <form className="p-8 space-y-6" onSubmit={(e) => {
                        e.preventDefault();
                        const data = new FormData(e.currentTarget);
                        addBusiness({
                            name: data.get('name') as string,
                            membership: data.get('membership') as string,
                            source: data.get('source') as string,
                            revenue: data.get('revenue') as string,
                            joined: new Date().toISOString().split('T')[0]
                        });
                        setShowAddModal(false);
                    }}>
                        <InputGroup label="Business Name" name="name" required />
                        <div className="grid grid-cols-2 gap-4">
                            <SelectGroup 
                                label="Membership Tier" 
                                name="membership"
                                options={['Bronze Normal', 'Silver Normal', 'Gold Pro', 'Gold Pro+', 'Platinum Normal']}
                            />
                            <SelectGroup 
                                label="Platform Access" 
                                name="source"
                                options={['GBS Loyalty', 'Mcom Mall', 'Mcom Rewards', 'GBS Audit', 'McomQ Link']}
                            />
                        </div>
                        <InputGroup label="Estimated Revenue" name="revenue" placeholder="£..." required />
                        <button 
                            type="submit"
                            className="w-full py-5 bg-brand-blue text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-glow mt-4"
                        >
                            Complete Onboarding
                        </button>
                    </form>
                </Modal>
            )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-brand-dark/20 backdrop-blur-sm shadow-xl"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg relative z-10 overflow-hidden border border-gray-100"
            >
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h4 className="text-xl font-bold tracking-tight">{title}</h4>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-gray-900 border border-transparent hover:border-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </motion.div>
        </div>
    );
}

function InputGroup({ label, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 block">{label}</label>
            <input 
                className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 focus:bg-white focus:ring-4 focus:ring-brand-blue/5 transition-all font-bold text-lg border border-transparent focus:border-brand-blue/20"
                {...props}
            />
        </div>
    );
}

function SelectGroup({ label, options, value, onChange, ...props }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2 block">{label}</label>
            <select 
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                className="w-full bg-gray-50 border-transparent rounded-2xl px-6 py-4 focus:bg-white focus:ring-4 focus:ring-brand-blue/5 transition-all font-bold text-lg border border-transparent focus:border-brand-blue/20 appearance-none"
                {...props}
            >
                {options.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <div className={cn(
      "w-full flex items-center gap-4 p-4 rounded-xl transition-all group cursor-pointer",
      active ? "bg-brand-blue text-white shadow-glow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    )}>
      <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active ? "text-white" : "text-gray-400 group-hover:text-gray-900")} />
      <span className="font-semibold text-sm hidden lg:block tracking-tight">{label}</span>
    </div>
  );
}

function StatCard({ label, value, change }: { label: string, value: string, change: string }) {
  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm transition-all hover:shadow-xl group overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Target className="w-12 h-12" />
      </div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 group-hover:text-brand-blue transition-colors">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
        <div className={cn(
          "text-xs font-bold px-2 py-1 rounded-lg",
          change.startsWith('+') ? "bg-green-500 text-white" : "bg-blue-500 text-white shadow-glow"
        )}>
          {change}
        </div>
      </div>
    </div>
  );
}
