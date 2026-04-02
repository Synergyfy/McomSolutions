import React, { useState } from 'react';
import { motion } from 'motion/react';
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
  HelpCircle
} from 'lucide-react';
import { PRODUCTS } from '../constants';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredProducts = PRODUCTS.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900">
      {/* Sidebar - Light & Premium */}
      <aside className="w-20 lg:w-72 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        <div className="p-8 flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-glow">24</div>
          <div className="hidden lg:block">
            <div className="font-black text-xl tracking-tighter text-gray-900">GBS HUB</div>
            <div className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">Enterprise</div>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          <NavItem icon={LayoutDashboard} label="Overview" active />
          <NavItem icon={Grid} label="All Products" />
          <NavItem icon={Zap} label="Automations" />
          <NavItem icon={Clock} label="Activity Log" />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden lg:block">Account</span>
          </div>
          <NavItem icon={User} label="Team Members" />
          <NavItem icon={Settings} label="Settings" />
        </nav>

        <div className="p-6 space-y-4">
          <div className="hidden lg:block p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="text-xs font-bold text-gray-400 mb-2">Storage Usage</div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-brand-blue" />
            </div>
            <div className="mt-2 text-[10px] text-gray-500">64.2 GB of 100 GB used</div>
          </div>
          <button className="w-full flex items-center gap-3 p-4 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all group">
            <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform" />
            <span className="font-bold text-sm hidden lg:block">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-20 lg:ml-72 bg-mesh min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-10 px-12 py-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search ecosystem..."
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:bg-white transition-all text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-6">
            <button className="flex items-center gap-2 px-4 py-2 bg-brand-blue rounded-xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow">
              <Plus className="w-4 h-4" />
              New Project
            </button>
            <div className="h-6 w-px bg-gray-200" />
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-brand-blue rounded-full" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-bold text-gray-900">Frank Emesinwa</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase">Admin</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-accent rounded-xl flex items-center justify-center text-white font-black shadow-glow">
                FE
              </div>
            </div>
          </div>
        </header>

        <div className="p-12">
          <div className="mb-12">
            <h2 className="text-4xl font-bold mb-2">Good morning, Frank</h2>
            <p className="text-gray-500">Here's what's happening across your 24/7 GBS tools today.</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <StatCard label="Active Users" value="12,402" change="+12%" />
            <StatCard label="Total Revenue" value="$482.5k" change="+8%" />
            <StatCard label="Audit Score" value="98/100" change="Stable" />
            <StatCard label="API Requests" value="1.2M" change="+24%" />
          </div>

          {/* App Grid */}
          <div className="mb-8 flex items-center justify-between">
            <h3 className="text-xl font-bold">Your Ecosystem</h3>
            <button className="text-sm font-bold text-brand-blue hover:underline">View All</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-8 rounded-[2rem] border border-gray-100 hover:border-brand-blue/30 hover:shadow-xl transition-all group relative overflow-hidden"
              >
                <div className="absolute -right-8 -top-8 w-32 h-32 bg-brand-blue/5 blur-[60px] group-hover:bg-brand-blue/10 transition-all" />
                
                <div className="flex items-start justify-between mb-8">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-2xl", product.color)}>
                    <product.icon className="w-8 h-8" />
                  </div>
                  <Link to={`/product/${product.id}`} className="p-2 text-gray-400 hover:text-brand-blue transition-colors">
                    <ArrowUpRight className="w-6 h-6" />
                  </Link>
                </div>
                
                <h3 className="text-2xl font-bold mb-2 text-gray-900">{product.name}</h3>
                <p className="text-gray-500 text-sm mb-8 line-clamp-2 leading-relaxed">{product.tagline}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600">
                        U{i}
                      </div>
                    ))}
                    <div className="w-8 h-8 rounded-full border-2 border-white bg-brand-blue flex items-center justify-center text-[10px] font-bold text-white">
                      +8
                    </div>
                  </div>
                  <button className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-blue transition-all active:scale-95">
                    Launch
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false }: { icon: any, label: string, active?: boolean }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group",
      active ? "bg-brand-blue text-white shadow-glow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-white" : "text-gray-400 group-hover:text-gray-900")} />
      <span className="font-bold text-sm hidden lg:block">{label}</span>
    </button>
  );
}

function StatCard({ label, value, change }: { label: string, value: string, change: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">{label}</div>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className={cn(
          "text-xs font-bold px-2 py-1 rounded-lg",
          change.startsWith('+') ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
        )}>
          {change}
        </div>
      </div>
    </div>
  );
}
