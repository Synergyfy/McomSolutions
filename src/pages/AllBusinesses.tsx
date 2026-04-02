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
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useBusinesses, Business } from '../context/BusinessContext';

const ITEMS_PER_PAGE = 8;

export default function AllBusinesses() {
  const { businesses, addBusiness, updateBusiness, deleteBusiness } = useBusinesses();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewingBusiness, setViewingBusiness] = useState<Business | null>(null);

  // Filter and search logic
  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || b.membership.includes(activeFilter);
    return matchesSearch && matchesFilter;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredBusinesses.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentBusinesses = filteredBusinesses.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          <Link to="/admin" className="w-full">
            <NavItem icon={LayoutDashboard} label="Admin Overview" />
          </Link>
          <Link to="/admin/pricing" className="w-full">
            <NavItem icon={CreditCard} label="Pricing Manager" />
          </Link>
          <NavItem icon={Building2} label="All Businesses" active />
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
              placeholder="Search merchants, brands..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all text-sm"
              value={searchQuery}
              onChange={(e) => {setSearchQuery(e.target.value); setCurrentPage(1);}}
            />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-gray-900">Adam Smith</div>
                <div className="text-[10px] text-brand-blue font-bold uppercase">Super Admin</div>
              </div>
              <div className="w-10 h-10 bg-brand-dark rounded-xl flex items-center justify-center text-white font-bold shadow-glow">AS</div>
            </div>
          </div>
        </header>

        <div className="p-12">
          <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 tracking-tight">Merchant Directory</h1>
              <p className="text-gray-500 font-medium">Browse and manage all {businesses.length} businesses in the MCOM ecosystem.</p>
            </div>
            <div className="flex gap-4">
              <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                {['All', 'Bronze', 'Silver', 'Gold', 'Platinum'].map(filter => (
                  <button 
                    key={filter} 
                    onClick={() => {setActiveFilter(filter); setCurrentPage(1);}}
                    className={cn(
                      "px-6 py-2 rounded-xl text-xs font-bold transition-all",
                      activeFilter === filter 
                        ? "bg-brand-blue text-white shadow-glow" 
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Business Table */}
          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden mb-12">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                    <tr className="bg-gray-50/50">
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Business Name</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Membership</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ecosystem Status</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                    {currentBusinesses.map((b) => (
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
                        <td className="px-8 py-6 text-sm font-semibold text-gray-600">
                             <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-sm font-bold text-gray-900">Active & Ready</span>
                            </div>
                        </td>
                        <td className="px-8 py-6">
                            <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewingBusiness(b)} className="p-2.5 bg-gray-50 rounded-xl hover:bg-blue-50 hover:text-brand-blue transition-all shadow-sm">
                                <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2.5 bg-gray-50 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm" onClick={() => deleteBusiness(b.id)}>
                                <Trash2 className="w-4 h-4" />
                            </button>
                            </div>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination UI */}
            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Showing {startIndex + 1} to {Math.min(startIndex + ITEMS_PER_PAGE, filteredBusinesses.length)} of {filteredBusinesses.length} merchants
                </div>
                <div className="flex items-center gap-2">
                    <button 
                         disabled={currentPage === 1}
                         onClick={() => handlePageChange(currentPage - 1)}
                         className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-brand-blue hover:border-brand-blue/20 disabled:opacity-50 transition-all shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                        <button 
                            key={i} 
                            onClick={() => handlePageChange(i + 1)}
                            className={cn(
                                "w-8 h-8 rounded-lg text-xs font-black transition-all",
                                currentPage === i + 1 ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-900 hover:bg-gray-100"
                            )}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button 
                        disabled={currentPage === totalPages}
                        onClick={() => handlePageChange(currentPage + 1)}
                        className="p-2 rounded-lg bg-white border border-gray-200 text-gray-400 hover:text-brand-blue hover:border-brand-blue/20 disabled:opacity-50 transition-all shadow-sm"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
          </div>
        </div>
      </main>

      {/* Insights Modal */}
      <AnimatePresence>
        {viewingBusiness && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-dark/40 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl overflow-y-auto max-h-[90vh]"
            >
                <div className="p-12 relative">
                    <button onClick={() => setViewingBusiness(null)} className="absolute top-8 right-8 p-3 text-gray-400 hover:text-gray-900"><X /></button>
                    <div className="flex items-center gap-6 mb-12">
                        <div className="w-20 h-20 bg-brand-blue rounded-3xl flex items-center justify-center text-white text-3xl font-bold">{viewingBusiness.name.charAt(0)}</div>
                        <div>
                            <h3 className="text-3xl font-extrabold tracking-tight">{viewingBusiness.name}</h3>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{viewingBusiness.source}</span>
                                <div className="h-4 w-px bg-gray-200" />
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
                                    viewingBusiness.membership.includes('Gold') ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                                    viewingBusiness.membership.includes('Silver') ? "bg-slate-50 text-slate-500 border-slate-200" :
                                    "bg-blue-50 text-blue-700 border-blue-200"
                                )}>
                                    {viewingBusiness.membership} Member
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <InsightStat label="Campaign Access" value="Unlimited" icon={Target} color="text-brand-blue" />
                        <InsightStat label="Monthly Growth" value="+24.2%" icon={Zap} color="text-amber-500" />
                        <InsightStat label="Support Tier" value="Priority 24/7" icon={Clock} color="text-emerald-500" />
                        <InsightStat label="Active Modules" value="Loyalty, Audit" icon={LayoutDashboard} color="text-purple-500" />
                    </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InsightStat({ label, value, icon: Icon, color }: any) {
    return (
        <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
            <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 ${color}`}>
                <Icon size={20} />
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-lg font-bold text-gray-900">{value}</div>
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
