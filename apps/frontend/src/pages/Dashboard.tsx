import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Bell, Settings, Grid, LogOut, Menu, X,
  LayoutDashboard, HelpCircle, CreditCard,
  PackageOpen, Wallet, Building2, ShieldCheck,
  User, ChevronDown, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import { businessApi } from '../lib/api';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if token exists, redirect if not
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    
    // Fetch profile
    businessApi.getProfile().then(data => {
      setProfile(data);
    }).catch(err => {
      console.error('Failed to load profile in Dashboard dashboard mount:', err);
      // If unauthorized, redirect
      if (err.response?.status === 401) {
        localStorage.removeItem('auth_token');
        navigate('/login');
      }
    });
  }, [navigate]);

  const handleNav = (tab: string) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    businessApi.logout();
    navigate('/login');
  };

  const displayName = profile?.businessName || 'Business Owner';
  const displayEmail = profile?.email || 'owner@mcomsolutions.co.uk';
  const displayInitials = displayName ? displayName.slice(0, 2).toUpperCase() : 'BO';

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex text-gray-900">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-gray-200 flex flex-col",
        "transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-glow">M</div>
            <div>
              <div className="font-black text-xl tracking-tighter text-gray-900">MCOM Central</div>
              <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Ecosystem Hub</div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
          <NavItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => handleNav('overview')} />
          <NavItem icon={Grid} label="All Products" active={activeTab === 'all-products'} onClick={() => handleNav('all-products')} />
          <NavItem icon={ShieldCheck} label="Access & Limits" active={activeTab === 'access'} onClick={() => handleNav('access')} />
          <NavItem icon={Bell} label="Notifications" active={activeTab === 'notifications'} onClick={() => handleNav('notifications')} />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Billing & Plans</span>
          </div>
          <NavItem icon={CreditCard} label="Memberships" active={activeTab === 'memberships'} onClick={() => handleNav('memberships')} />
          <NavItem icon={PackageOpen} label="Packages" active={activeTab === 'packages'} onClick={() => handleNav('packages')} />
          <div className="pt-8 pb-4 px-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Account</span>
          </div>
          <NavItem icon={Wallet} label="Billing" active={activeTab === 'billing'} onClick={() => handleNav('billing')} />
          <NavItem icon={Building2} label="Business Profile" active={activeTab === 'business-profile'} onClick={() => handleNav('business-profile')} />
          <NavItem icon={HelpCircle} label="Support Center" active={activeTab === 'support'} onClick={() => handleNav('support')} />
          <NavItem icon={Settings} label="Settings" active={activeTab === 'settings'} onClick={() => handleNav('settings')} />
        </nav>

        <div className="p-6 space-y-4">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-2xl transition-all group">
            <LogOut className="w-5 h-5 group-hover:rotate-180 transition-transform" />
            <span className="font-bold text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 bg-mesh min-h-screen">
        <header className="sticky top-0 z-10 px-4 sm:px-6 lg:px-12 py-3 md:py-6 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-full max-w-xs hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search ecosystem..."
                className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white transition-all text-sm"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* User Menu Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-gray-200 group"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-gray-900 group-hover:text-orange-500 transition-colors">{displayName}</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase">Business</div>
                </div>
                <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-black shadow-glow">
                  {displayInitials}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform hidden sm:block", userMenuOpen && "rotate-180")} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 z-50">
                    <div className="px-3 py-3 border-b border-gray-100 mb-2">
                      <div className="font-bold text-gray-900 text-sm">{displayName}</div>
                      <div className="text-xs text-gray-500">{displayEmail}</div>
                    </div>

                    <button onClick={() => { setUserMenuOpen(false); handleNav('business-profile'); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Building2 className="w-4 h-4" /></div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 text-sm group-hover:text-orange-500 transition-colors">Business Profile</div>
                        <div className="text-xs text-gray-500">Manage your company info</div>
                      </div>
                    </button>

                    <button onClick={() => { setUserMenuOpen(false); handleNav('settings'); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600"><Settings className="w-4 h-4" /></div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 text-sm group-hover:text-orange-500 transition-colors">Settings</div>
                        <div className="text-xs text-gray-500">Account & preferences</div>
                      </div>
                    </button>

                    <button onClick={() => { setUserMenuOpen(false); handleNav('billing'); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                      <div className="p-1.5 rounded-lg bg-green-50 text-green-600"><Wallet className="w-4 h-4" /></div>
                      <div className="text-left">
                        <div className="font-semibold text-gray-900 text-sm group-hover:text-orange-500 transition-colors">Billing</div>
                        <div className="text-xs text-gray-500">Invoices & payments</div>
                      </div>
                    </button>

                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 transition-colors group">
                        <div className="p-1.5 rounded-lg bg-red-50 text-red-500"><LogOut className="w-4 h-4" /></div>
                        <div className="text-left">
                          <div className="font-semibold text-red-600 text-sm">Sign Out</div>
                          <div className="text-xs text-gray-500">Return to login page</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-12">
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
      <span className="font-bold text-sm">{label}</span>
    </button>
  );
}
