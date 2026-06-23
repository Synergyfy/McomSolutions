import React, { useState } from 'react';
import { 
  Search, 
  Bell, 
  Settings, 
  Grid, 
  LogOut, 
  User,
  Zap,
  Clock,
  LayoutDashboard,
  Plus,
  HelpCircle,
  CreditCard,
  PackageOpen,
  Wallet,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import DashboardMemberships from '../components/DashboardMemberships';
import DashboardPackages from '../components/DashboardPackages';
import DashboardOverview from '../components/DashboardOverview';
import DashboardAllProducts from '../components/DashboardAllProducts';
import DashboardBilling from '../components/DashboardBilling';
import DashboardBusinessProfile from '../components/DashboardBusinessProfile';
import DashboardAccess from '../components/DashboardAccess';
import DashboardNotifications from '../components/DashboardNotifications';
import DashboardSupport from '../components/DashboardSupport';
import DashboardSettings from '../components/DashboardSettings';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

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
        
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto scrollbar-hide">
          <NavItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <NavItem icon={Grid} label="All Products" active={activeTab === 'all-products'} onClick={() => setActiveTab('all-products')} />
          <NavItem icon={ShieldCheck} label="Access & Limits" active={activeTab === 'access'} onClick={() => setActiveTab('access')} />
          <NavItem icon={Bell} label="Notifications" active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden lg:block">Billing & Plans</span>
          </div>
          <NavItem icon={CreditCard} label="Memberships" active={activeTab === 'memberships'} onClick={() => setActiveTab('memberships')} />
          <NavItem icon={PackageOpen} label="Packages" active={activeTab === 'packages'} onClick={() => setActiveTab('packages')} />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden lg:block">Account</span>
          </div>
          <NavItem icon={Wallet} label="Billing" active={activeTab === 'billing'} onClick={() => setActiveTab('billing')} />
          <NavItem icon={Building2} label="Business Profile" active={activeTab === 'business-profile'} onClick={() => setActiveTab('business-profile')} />
          <NavItem icon={HelpCircle} label="Support Center" active={activeTab === 'support'} onClick={() => setActiveTab('support')} />
          <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
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
              className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all text-sm"
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
                <div className="text-[10px] text-gray-500 font-bold uppercase">Business</div>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-brand-blue to-brand-accent rounded-xl flex items-center justify-center text-white font-black shadow-glow">
                FE
              </div>
            </div>
          </div>
        </header>

        <div className="p-12">
          {activeTab === 'overview' && <DashboardOverview onNavigate={setActiveTab} />}
          {activeTab === 'all-products' && <DashboardAllProducts />}
          {activeTab === 'access' && <DashboardAccess />}
          {activeTab === 'notifications' && <DashboardNotifications />}
          {activeTab === 'memberships' && <DashboardMemberships />}
          {activeTab === 'packages' && <DashboardPackages />}
          {activeTab === 'billing' && <DashboardBilling />}
          {activeTab === 'business-profile' && <DashboardBusinessProfile />}
          {activeTab === 'support' && <DashboardSupport />}
          {activeTab === 'settings' && <DashboardSettings />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full flex items-center gap-4 p-4 rounded-2xl transition-all group",
      active ? "bg-orange-500 text-white shadow-glow" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
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
