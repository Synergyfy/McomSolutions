import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Building2, UserCircle, Gem, Package, CreditCard, RefreshCw,
  ToggleLeft, Shield, KeyRound, UserPlus, Store, Grid, Rocket, DollarSign, Receipt,
  Code, Puzzle, BarChart3, FileText, Bell, LifeBuoy, ClipboardList, Settings,
  Terminal, Crown, LogOut, Menu, X, ChevronDown, Search, HelpCircle,
  ChevronRight, Briefcase
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAdminAuth } from '../context/AdminAuthContext';

export type AdminTab =
  'dashboard' | 'users' | 'businesses' | 'customers' | 'agents' | 'consultants' | 'account-managers'
  | 'memberships' | 'packages' | 'pricing' | 'subscriptions'
  | 'platform-access' | 'platform-directory' | 'platform-launch'
  | 'permissions' | 'auth' | 'registration-flow' | 'business-profile'
  | 'payments' | 'billing'
  | 'api-keys' | 'integrations'
  | 'analytics' | 'reports'
  | 'notifications' | 'support'
  | 'audit-logs'
  | 'programme'
  | 'system-settings' | 'developer-center' | 'super-admin';

interface NavGroup {
  label: string;
  items: { tab: AdminTab; icon: any; label: string }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ tab: 'dashboard', icon: LayoutDashboard, label: 'Ecosystem Dashboard' }],
  },
  {
    label: 'User Management',
    items: [
      { tab: 'users', icon: Users, label: 'All Users' },
      { tab: 'businesses', icon: Building2, label: 'Businesses' },
      { tab: 'customers', icon: UserCircle, label: 'Customers' },
      { tab: 'agents', icon: Briefcase, label: 'Agents' },
      { tab: 'consultants', icon: Users, label: 'Consultants' },
      { tab: 'account-managers', icon: UserCircle, label: 'Account Managers' },
    ],
  },
  {
    label: 'Plans & Billing',
    items: [
      { tab: 'memberships', icon: Gem, label: 'Memberships' },
      { tab: 'packages', icon: Package, label: 'Packages' },
      { tab: 'pricing', icon: CreditCard, label: 'Pricing' },
      { tab: 'subscriptions', icon: RefreshCw, label: 'Subscriptions' },
    ],
  },
  {
    label: 'Platforms',
    items: [
      { tab: 'platform-access', icon: ToggleLeft, label: 'Access Control' },
      { tab: 'platform-directory', icon: Grid, label: 'Directory' },
      { tab: 'platform-launch', icon: Rocket, label: 'Launch Control' },
    ],
  },
  {
    label: 'Auth & Registration',
    items: [
      { tab: 'permissions', icon: Shield, label: 'Permissions' },
      { tab: 'auth', icon: KeyRound, label: 'Authentication' },
      { tab: 'registration-flow', icon: UserPlus, label: 'Registration Flow' },
      { tab: 'business-profile', icon: Store, label: 'Business Profile' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { tab: 'payments', icon: DollarSign, label: 'Payments' },
      { tab: 'billing', icon: Receipt, label: 'Billing' },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { tab: 'api-keys', icon: Code, label: 'API Keys' },
      { tab: 'integrations', icon: Puzzle, label: 'Integrations' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { tab: 'analytics', icon: BarChart3, label: 'Analytics Center' },
      { tab: 'reports', icon: FileText, label: 'Reporting' },
    ],
  },
  {
    label: 'Programme',
    items: [
      { tab: 'programme', icon: Rocket, label: '90-Day Programme' },
    ],
  },
  {
    label: 'Communication',
    items: [
      { tab: 'notifications', icon: Bell, label: 'Notifications' },
      { tab: 'support', icon: LifeBuoy, label: 'Support' },
    ],
  },
  {
    label: 'System',
    items: [
      { tab: 'audit-logs', icon: ClipboardList, label: 'Audit Logs' },
      { tab: 'system-settings', icon: Settings, label: 'System Settings' },
      { tab: 'developer-center', icon: Terminal, label: 'Developer Center' },
      { tab: 'super-admin', icon: Crown, label: 'Super Admin' },
    ],
  },
];

interface AdminLayoutProps {
  activeTab: AdminTab;
  onTabChange: (tab: AdminTab) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
}

export default function AdminLayout({ activeTab, onTabChange, title, subtitle, children, headerActions }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-glow">AS</div>
            <div>
              <div className="font-black text-lg tracking-tighter text-gray-900">Admin Hub</div>
              <div className="text-[9px] font-bold text-brand-blue uppercase tracking-widest">Global Ecosystem</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-3 py-2 mt-4 mb-1">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{group.label}</span>
              </div>
              {group.items.map((item) => (
                <button
                  key={item.tab}
                  onClick={() => { onTabChange(item.tab); setSidebarOpen(false); }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all group text-left",
                    activeTab === item.tab
                      ? "bg-brand-blue text-white shadow-glow"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 flex-shrink-0", activeTab === item.tab ? "text-white" : "text-gray-400 group-hover:text-gray-900")} />
                  <span className="font-semibold text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all group">
            <LogOut className="w-4 h-4 group-hover:rotate-180 transition-transform" />
            <span className="font-semibold text-xs">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 bg-mesh min-h-screen flex flex-col">
        <header className="sticky top-0 z-10 px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-gray-900">{title}</h1>
              {subtitle && <p className="text-xs text-gray-500 font-medium hidden sm:block">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4">
            {headerActions}
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-blue rounded-full" />
            </button>
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 pl-3 border-l border-gray-200 group">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-gray-900 group-hover:text-brand-blue transition-colors">{admin?.name || 'Admin'}</div>
                  <div className="text-[9px] text-gray-500 font-bold uppercase">{admin?.role || 'Admin'}</div>
                </div>
                <div className="w-8 h-8 bg-brand-dark rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-glow">{admin?.avatar || 'AS'}</div>
                <ChevronDown className={cn("w-3 h-3 text-gray-400 transition-transform hidden sm:block", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 z-50">
                    <div className="px-3 py-3 border-b border-gray-100 mb-1">
                      <div className="font-bold text-gray-900 text-sm">{admin?.name}</div>
                      <div className="text-xs text-gray-500">{admin?.email}</div>
                    </div>
                    <div className="border-t border-gray-100 pt-1 mt-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors group">
                        <div className="p-1.5 rounded-lg bg-red-50 text-red-500"><LogOut className="w-4 h-4" /></div>
                        <div className="text-left">
                          <div className="font-semibold text-red-600 text-sm">Sign Out</div>
                          <div className="text-xs text-gray-500">Return to login</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
