import { useState } from 'react';
import { 
  Building2, 
  Users, 
  Rocket, 
  Gift, 
  Calendar, 
  Activity,
  Search,
  Filter,
  MoreVertical,
  ExternalLink,
  MapPin,
  ArrowUpRight,
  ArrowDownRight,
  Store,
  Heart,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  Clock,
  Plus,
  ChevronLeft,
  X,
  TrendingUp,
  Zap,
  Edit3,
  Download
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminBoroughs } from '../../services/admin/hooks';
import { Loader2 } from 'lucide-react';
import type { Borough } from '../../services/admin/types';

export default function BoroughsPanel() {
  const { data: boroughsRes, isLoading } = useAdminBoroughs();
  const boroughs: Borough[] = boroughsRes?.data ?? [];

  const [selectedBoroughId, setSelectedBoroughId] = useState<string | null>(null);
  const [isOnboardOpen, setIsOnboardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('overview');

  // Modals for detail view
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);

  // New Borough Form State
  const [newBorough, setNewBorough] = useState({
    name: '',
    adminName: '',
    activity: 'High',
    bizCount: '0'
  });

  const selectedBorough = boroughs.find(b => b.id === selectedBoroughId);

  const filteredBoroughs = boroughs.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const boroughStats = [
    { title: 'Active Businesses', value: boroughs.reduce((s, b) => s + b.businessCount, 0).toLocaleString(), trend: `+${boroughs.length}`, icon: Store, trendType: 'up' as const },
    { title: 'Total Boroughs', value: String(boroughs.length), trend: '0', icon: Users, trendType: 'up' as const },
    { title: 'Borough Campaigns', value: String(boroughs.reduce((s, b) => s + b.activeCampaigns, 0)), trend: '+2', icon: Rocket, trendType: 'up' as const },
    { title: 'Avg Health Score', value: boroughs.length > 0 ? `${Math.round(boroughs.reduce((s, b) => s + b.healthScore, 0) / boroughs.length)}%` : '0%', trend: '+5%', icon: Gift, trendType: 'up' as const },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  // Render Onboard Dialog Modal
  const renderOnboardModal = () => {
    if (!isOnboardOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 relative">
          <button 
            onClick={() => setIsOnboardOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-650 hover:bg-gray-50 rounded-xl transition-all"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="mb-4">
            <h3 className="text-lg font-bold text-gray-900">Onboard New Borough</h3>
            <p className="text-xs text-gray-500 font-medium">Add a new geographic borough to the McomMall ecosystem.</p>
          </div>

          <div className="space-y-4 py-2 text-left">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Borough Name</label>
              <input 
                type="text" 
                placeholder="e.g. Southwark" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={newBorough.name}
                onChange={e => setNewBorough({ ...newBorough, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Assigned Admin</label>
              <input 
                type="text" 
                placeholder="e.g. John Doe" 
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={newBorough.adminName}
                onChange={e => setNewBorough({ ...newBorough, adminName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Activity Level</label>
                <select 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                  value={newBorough.activity}
                  onChange={e => setNewBorough({ ...newBorough, activity: e.target.value })}
                >
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Very High">Very High</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Initial Biz Count</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                  value={newBorough.bizCount}
                  onChange={e => setNewBorough({ ...newBorough, bizCount: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2.5">
            <button 
              onClick={() => setIsOnboardOpen(false)}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all shadow-sm"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                console.log("Confirming Onboarding:", newBorough);
                setIsOnboardOpen(false);
              }}
              className="py-2.5 px-5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-105 transition-all"
            >
              Confirm Onboarding
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Detailed Borough Profile
  const renderDetailView = () => {
    if (!selectedBorough) return null;
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Top Navigation & Breadcrumb */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              setSelectedBoroughId(null);
              setActiveDetailTab('overview');
            }}
            className="flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-950 bg-white border border-gray-150 hover:bg-gray-50 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Inventory
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Borough Profile / {selectedBorough.name}</p>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-6">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center border border-gray-200 overflow-hidden shadow-inner group-hover:border-orange-200 transition-colors">
                <Building2 className="h-9 w-9 text-gray-300 group-hover:text-orange-400 transition-colors" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-orange-600 border-2 border-white flex items-center justify-center shadow-lg">
                <ShieldCheck className="h-3.5 w-3.5 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-gray-955 tracking-tight">{selectedBorough.name} Borough</h1>
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-inset ring-blue-100">
                  {selectedBorough.activity}
                </span>
              </div>
              <p className="text-[10px] font-bold text-gray-450 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-gray-300" /> {selectedBorough.area} • Region {selectedBorough.region}
              </p>
              <div className="flex items-center gap-6 pt-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-orange-50 rounded-lg text-orange-600"><TrendingUp className="h-3.5 w-3.5" /></div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Engagement Score</p>
                    <p className="text-xs font-bold text-gray-800 leading-none">{selectedBorough.engagement}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-blue-50 rounded-lg text-blue-600"><Heart className="h-3.5 w-3.5" /></div>
                  <div>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Community Health</p>
                    <p className="text-xs font-bold text-gray-800 leading-none">{selectedBorough.health}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsEditProfileOpen(true)}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-800 bg-white border border-gray-250 hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2"
            >
              <Edit3 className="h-4 w-4" /> Edit Profile
            </button>
            <button 
              onClick={() => setIsNewCampaignOpen(true)}
              className="py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-100 hover:shadow-xl hover:scale-[1.01] transition-all flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New Campaign
            </button>
          </div>
        </div>

        {/* Detail Tabs */}
        <div className="w-full space-y-6">
          <div className="border-b border-gray-200 flex gap-6 overflow-x-auto no-scrollbar pb-1">
            {['Overview', 'Businesses', 'Campaigns', 'Community'].map((tab) => (
              <button 
                key={tab} 
                onClick={() => setActiveDetailTab(tab.toLowerCase())}
                className={cn(
                  "pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap",
                  activeDetailTab === tab.toLowerCase()
                    ? "border-orange-500 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content - Overview */}
          {activeDetailTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard2 title="Total Businesses" value="1,284" trend="+12.4%" icon={Store} color="orange" />
                <StatCard2 title="Active Customers" value="42.5k" trend="+8.1%" icon={Users} color="blue" />
                <StatCard2 title="Footfall Density" value="8.2k/day" trend="-2.3%" icon={Activity} color="indigo" trendDown />
                <StatCard2 title="MCOM Impact" value="£1.42M" trend="+18.8%" icon={Zap} color="emerald" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Growth Chart */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-gray-950 text-base">Growth & Engagement Trends</h3>
                      <p className="text-xs text-gray-400 font-semibold">Comparative analysis of business growth vs user engagement.</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                      <button className="px-2.5 py-1 text-[10px] font-bold text-gray-500 rounded hover:bg-white hover:shadow-sm transition-all">6M</button>
                      <button className="px-2.5 py-1 text-[10px] font-bold text-gray-950 bg-white shadow-sm rounded transition-all">30D</button>
                    </div>
                  </div>
                  <div className="h-60 flex items-end gap-2.5 pt-4">
                    {[45, 60, 40, 75, 85, 55, 95, 110, 65, 100, 125, 140].map((h, i) => (
                      <div key={i} className="flex-1 group relative flex flex-col items-center">
                        <div 
                          className={cn(
                            "w-full rounded-t-lg transition-all duration-300 group-hover:brightness-95",
                            i === 11 ? "bg-orange-600" : "bg-orange-100"
                          )} 
                          style={{ height: `${h}px` }} 
                        />
                        <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] py-1 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                          {h}%
                        </div>
                        <div className="mt-2 text-[9px] font-bold text-gray-400 uppercase">
                          {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Radar Mockup */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-950 text-base">Regional Activity</h3>
                    <p className="text-xs text-gray-400 font-semibold mb-4">Density heatmap of active businesses.</p>
                  </div>
                  
                  <div className="h-48 relative rounded-2xl overflow-hidden bg-gray-950 flex items-center justify-center">
                    <div className="absolute inset-0 border border-gray-900 rounded-full animate-ping scale-75 opacity-20" />
                    <div className="absolute inset-0 border border-gray-900 rounded-full animate-ping scale-50 opacity-40" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <div className="w-0.5 h-full bg-white" />
                      <div className="h-0.5 w-full bg-white" />
                    </div>
                    <div className="absolute top-1/4 left-1/3 w-6 h-6 bg-orange-500 rounded-full blur-md opacity-70 animate-pulse" />
                    <div className="absolute bottom-1/3 right-1/4 w-8 h-8 bg-blue-500 rounded-full blur-lg opacity-60" />
                    
                    <div className="absolute bottom-3 left-3 right-3 p-3 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-150 shadow-lg text-left">
                      <p className="text-xs font-bold text-gray-900 leading-none">Angel High Street</p>
                      <p className="text-[9px] font-semibold text-gray-500 mt-1">342 Active Merchants • High Density</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeDetailTab === 'businesses' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center animate-in fade-in duration-300">
              <Store className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-gray-800">Business Registry</h4>
              <p className="text-xs text-gray-400 font-semibold max-w-xs mx-auto mt-1">Total {selectedBorough.businessCount} active local businesses registered in this borough.</p>
            </div>
          )}

          {activeDetailTab === 'campaigns' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center animate-in fade-in duration-300">
              <Rocket className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-gray-800">Campaigns Control</h4>
              <p className="text-xs text-gray-400 font-semibold max-w-xs mx-auto mt-1">{selectedBorough.activeCampaigns} active marketing and incentive campaigns currently live.</p>
            </div>
          )}

          {activeDetailTab === 'community' && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 text-center animate-in fade-in duration-300">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <h4 className="font-bold text-sm text-gray-800">Community Control</h4>
              <p className="text-xs text-gray-400 font-semibold max-w-xs mx-auto mt-1">Manage moderators, business owners, and resident dialogue groups.</p>
            </div>
          )}
        </div>

        {/* Modal: Edit Profile */}
        {isEditProfileOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 relative">
              <button onClick={() => setIsEditProfileOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-650 hover:bg-gray-50 rounded-xl transition-all">
                <X className="h-5 w-5" />
              </button>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Edit Borough Profile</h3>
                <p className="text-xs text-gray-500 font-medium">Update geographic or administrative parameters.</p>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Borough Name</label>
                  <input type="text" defaultValue={selectedBorough.name} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Area Designation</label>
                  <input type="text" defaultValue={selectedBorough.area} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Region</label>
                  <input type="text" defaultValue={selectedBorough.region} className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button onClick={() => setIsEditProfileOpen(false)} className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-all">Cancel</button>
                <button onClick={() => setIsEditProfileOpen(false)} className="py-2.5 px-5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition-all">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: New Campaign */}
        {isNewCampaignOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl p-6 relative">
              <button onClick={() => setIsNewCampaignOpen(false)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-650 hover:bg-gray-50 rounded-xl transition-all">
                <X className="h-5 w-5" />
              </button>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Launch New Campaign</h3>
                <p className="text-xs text-gray-500 font-medium">Create a promotional campaign for merchants on {selectedBorough.name}.</p>
              </div>
              <div className="space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Campaign Name</label>
                  <input type="text" placeholder="e.g. Summer High Street Boost" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Budget</label>
                    <input type="number" placeholder="£" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Target Audience</label>
                    <input type="text" placeholder="e.g. All Residents" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1.5">Description</label>
                  <input type="text" placeholder="Campaign details..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900" />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button onClick={() => setIsNewCampaignOpen(false)} className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-755 bg-white border border-gray-200 hover:bg-gray-50 shadow-sm transition-all">Cancel</button>
                <button onClick={() => setIsNewCampaignOpen(false)} className="py-2.5 px-5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg transition-all">Launch Campaign</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render main inventory page
  const renderInventoryView = () => {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Borough Management</h2>
            <p className="text-xs text-gray-500 font-medium italic">Command center for local borough ecosystems and engagement systems.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:shadow transition-all">
              <Filter className="h-4 w-4" />
              District Filter
            </button>
            <button 
              onClick={() => setIsOnboardOpen(true)}
              className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-100 hover:shadow-xl hover:scale-[1.01] transition-all"
            >
              <Plus className="h-4 w-4" />
              Onboard Borough
            </button>
          </div>
        </div>

        {/* Overview KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {boroughStats.map((stat, idx) => (
            <StatCard key={idx} {...stat} />
          ))}
        </div>

        {/* Borough List Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-950 text-base">Borough Inventory</h3>
              <p className="text-xs text-gray-400 font-semibold">Live monitoring of community health, business density, and ecosystem participation.</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                placeholder="Search boroughs..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-8">Borough Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Population Activity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Active Businesses</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Live Campaigns</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Rewards Participation</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Community Health</th>
                  <th className="px-6 py-4 text-right pr-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBoroughs.map((b) => (
                  <tr 
                    key={b.id}
                    className="hover:bg-gray-50/50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedBoroughId(b.id)}
                  >
                    <td className="px-6 py-4 pl-8">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-150 text-gray-650 group-hover:bg-white transition-colors">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{b.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-gray-300" /> Admin: {b.manager}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset",
                        b.populationActivity === 'Very High' ? "bg-orange-50 text-orange-650 ring-orange-200" :
                        b.populationActivity === 'High' ? "bg-blue-50 text-blue-650 ring-blue-200" :
                        "bg-gray-50 text-gray-600 ring-gray-250"
                      )}>
                        {b.populationActivity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-sm text-gray-700">{b.businessCount}</td>
                    <td className="px-6 py-4 text-center font-bold text-sm text-gray-700">{b.activeCampaigns}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-100">
                        {b.rewardsParticipation}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              b.healthScore > 90 ? "bg-emerald-500" : "bg-orange-505"
                            )}
                            style={{ width: `${b.healthScore}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{b.healthScore}% Health</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right pr-8 relative" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setActiveActionsMenu(activeActionsMenu === b.id ? null : b.id)}
                        className="p-1.5 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-705"
                      >
                        <MoreVertical className="h-4.5 w-4.5" />
                      </button>

                      {activeActionsMenu === b.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveActionsMenu(null)} />
                          <div className="absolute right-8 top-10 mt-1 w-56 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-40 text-left">
                            <button 
                              onClick={() => {
                                setSelectedBoroughId(b.id);
                                setActiveActionsMenu(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700"
                            >
                              <ExternalLink className="h-4 w-4 text-gray-400" /> View Detailed Borough Profile
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <Rocket className="h-4 w-4 text-orange-500" /> Launch Activation Campaign
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <ShieldCheck className="h-4 w-4 text-blue-500" /> Reassign Borough Manager
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <BarChart3 className="h-4 w-4 text-emerald-500" /> Advanced Ecosystem Analytics
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-xs font-bold text-brand-blue">
                              <MessageSquare className="h-4 w-4 text-brand-blue" /> Open Community Feedback
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for new onboarding */}
        {renderOnboardModal()}
      </div>
    );
  };

  return selectedBoroughId ? renderDetailView() : renderInventoryView();
}

function StatCard({ title, value, trend, icon: Icon, trendType }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2.5 group hover:border-orange-200 transition-colors">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-gray-50 rounded-xl text-gray-500 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <div className={cn(
          "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter border",
          trendType === 'up' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-red-50 text-red-650 border-red-100"
        )}>
          {trendType === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-xl font-black text-gray-900 mt-1 leading-none">{value}</p>
      </div>
    </div>
  );
}

function StatCard2({ title, value, trend, icon: Icon, color, trendDown }: any) {
  const colorMap: any = {
    orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-650' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600' }
  };
  const theme = colorMap[color] || colorMap.orange;

  return (
    <div className="bg-white rounded-2xl border border-gray-150 p-5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className={cn("p-2 rounded-xl", theme.bg, theme.text)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
          trendDown ? "bg-red-50 text-red-600 border-red-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
        )}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-xl font-black text-gray-950 mt-1 leading-none">{value}</p>
      </div>
    </div>
  );
}
