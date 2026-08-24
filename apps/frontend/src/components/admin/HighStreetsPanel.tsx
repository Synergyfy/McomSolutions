import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Users, 
  Activity,
  CheckCircle2,
  Clock,
  BarChart3,
  Rocket,
  Store,
  Map as MapIcon,
  Rss,
  Loader2,
  X,
  Save,
  Target,
  User,
  Info
} from 'lucide-react';
import HighStreetActivationWizard from './HighStreetActivationWizard';
import AdminHighStreetMap from './AdminHighStreetMap';
import { cn } from '../../lib/utils';
import { useAdminHighStreets, useAdminAuditLogs, useAdminBoroughs, useUpdateHighStreet, useAdminAccountManagers } from '../../services/admin/hooks';
import type { HighStreet } from '../../services/admin/types';

export default function HighStreetsPanel() {
  const { data: hsRes, isLoading } = useAdminHighStreets();
  const allHighStreets: HighStreet[] = hsRes?.data ?? [];
  const { data: logsRes } = useAdminAuditLogs({ page: 1, limit: 10 });
  const activities = (logsRes?.data ?? []) as any[];
  const { data: boroughsRes } = useAdminBoroughs();
  const allBoroughs = (boroughsRes?.data ?? []) as { id: string; name: string }[];
  const boroughNames = ['All Boroughs', ...allBoroughs.map(b => b.name)];
  const updateHighStreet = useUpdateHighStreet();
  const { data: managersRes } = useAdminAccountManagers();
  const managers = (managersRes?.data ?? []) as { id: string; firstName: string; lastName: string; email: string }[];

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Inactive'>('All');
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);

  const [ecosystemModal, setEcosystemModal] = useState<HighStreet | null>(null);
  const [assignModal, setAssignModal] = useState<HighStreet | null>(null);
  const [assignManagerId, setAssignManagerId] = useState('');
  const [analyticsModal, setAnalyticsModal] = useState<HighStreet | null>(null);
  const [campaignModal, setCampaignModal] = useState<HighStreet | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');

  const filteredHighStreets = allHighStreets.filter(hs => {
    const matchesSearch = hs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         hs.borough.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || hs.status === statusFilter;
    const matchesBorough = boroughFilter === 'All Boroughs' || hs.borough === boroughFilter;
    return matchesSearch && matchesStatus && matchesBorough;
  });

  const handleAssignManager = async () => {
    if (!assignModal || !assignManagerId) return;
    await updateHighStreet.mutateAsync({ id: assignModal.id, data: { assignedTo: assignManagerId } as any });
    setAssignModal(null);
    setAssignManagerId('');
  };

  const handleLaunchCampaign = async () => {
    if (!campaignModal || !campaignName) return;
    setCampaignModal(null);
    setCampaignName('');
    setCampaignDescription('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">High Street Management</h2>
          <p className="text-xs text-gray-500 font-medium">Manage physical and virtual high street ecosystems across boroughs.</p>
        </div>
        <button 
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-100 hover:shadow-xl hover:scale-[1.01] transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Activate High Street
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard title="Total High Streets" value={String(allHighStreets.length)} trend="0" icon={MapIcon} />
        <StatCard title="Active" value={String(allHighStreets.filter(h => h.status === 'Active').length)} trend="+2" icon={CheckCircle2} />
        <StatCard title="Pending" value={String(allHighStreets.filter(h => h.status === 'Pending').length)} trend="-1" icon={Clock} />
        <StatCard title="Total Businesses" value={allHighStreets.reduce((s, h) => s + h.businessCount, 0).toLocaleString()} trend="+12%" icon={Store} />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Google Map Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-950 text-base">High Street Activity Map</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-600 ring-1 ring-inset ring-orange-200">Live View</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider italic">OpenStreetMap</span>
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-[400px]">
            <AdminHighStreetMap highStreets={filteredHighStreets} />
          </div>
        </div>

        {/* Filters & Operational Feed Sidebar */}
        <div className="flex flex-col gap-6 h-full">
          {/* Quick Filters */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <h3 className="font-bold text-gray-950 text-sm uppercase tracking-wider">Quick Filters</h3>
            
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                placeholder="Search high streets..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm text-gray-900"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</label>
              <div className="flex flex-wrap gap-2">
                {['All', 'Active', 'Pending', 'Inactive'].map((status) => (
                  <button 
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={cn(
                      "rounded-full py-1.5 px-4 text-xs font-bold transition-all border",
                      statusFilter === status 
                        ? "bg-orange-50 text-orange-600 border-orange-200 shadow-sm" 
                        : "hover:bg-gray-50 text-gray-500 border-gray-200"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Borough</label>
              <div className="flex flex-wrap gap-2">
                {boroughNames.map((borough) => (
                  <button 
                    key={borough}
                    onClick={() => setBoroughFilter(borough)}
                    className={cn(
                      "rounded-full py-1.5 px-4 text-xs font-bold transition-all border",
                      boroughFilter === borough 
                        ? "bg-orange-50 text-orange-600 border-orange-200 shadow-sm" 
                        : "hover:bg-gray-50 text-gray-500 border-gray-200"
                    )}
                  >
                    {borough}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Operational Feed */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-xl border border-orange-100 text-orange-600">
                  <Rss className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-gray-950 text-sm tracking-tight">Operational Feed</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">Live</span>
              </div>
            </div>

            <div className="space-y-4">
              {activities.length > 0 ? activities.slice(0, 5).map((item: any) => {
                const colorMap: Record<string, { icon: string; bg: string; indicator: string }> = {
                  info: { icon: 'text-brand-blue', bg: 'bg-blue-50', indicator: 'bg-brand-blue' },
                  success: { icon: 'text-emerald-600', bg: 'bg-emerald-50', indicator: 'bg-emerald-600' },
                  warning: { icon: 'text-orange-600', bg: 'bg-orange-50', indicator: 'bg-orange-700' },
                };
                const colors = colorMap[item.severity || 'info'] || colorMap.info;
                return (
                  <FeedItem
                    key={item.id}
                    icon={Activity}
                    iconColor={colors.icon}
                    bgColor={colors.bg}
                    title={item.action || item.title}
                    details={item.details}
                    time={item.timestamp ? new Date(item.timestamp).toLocaleString() : ''}
                    location={item.adminName ? `By: ${item.adminName}` : ''}
                    indicatorColor={colors.indicator}
                  />
                );
              }) : (
                <p className="text-xs text-gray-400 text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* High Street List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-visible">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-950 text-base">High Street Inventory</h3>
          <button className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 hover:shadow transition-all">
            <Filter className="h-4 w-4" />
            Advanced Filters
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">High Street Name</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Borough</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Businesses</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredHighStreets.length > 0 ? (
                filteredHighStreets.map((hs) => (
                  <tr key={hs.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 font-bold text-sm text-gray-900">{hs.name}</td>
                    <td className="px-6 py-4 text-xs font-semibold text-gray-500">{hs.borough}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset",
                        hs.status === 'Active' 
                          ? "bg-green-50 text-green-700 ring-green-650/10" 
                          : "bg-amber-50 text-amber-700 ring-amber-650/10"
                      )}>
                        {hs.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-sm text-gray-800">{hs.businessCount}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionsMenu(activeActionsMenu === hs.id ? null : hs.id);
                        }}
                        className="p-1.5 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-700 relative z-50"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      
                      {activeActionsMenu === hs.id && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setActiveActionsMenu(null)} />
                          <div className="fixed right-8 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-[70] text-left" style={{ top: '50%', transform: 'translateY(-50%)' }}>
                            <button onClick={() => { setEcosystemModal(hs); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <Activity className="h-4 w-4 text-gray-400" /> Manage Ecosystem
                            </button>
                            <button onClick={() => { setAssignModal(hs); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <Users className="h-4 w-4 text-gray-400" /> Assign Manager
                            </button>
                            <button onClick={() => { setAnalyticsModal(hs); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <BarChart3 className="h-4 w-4 text-gray-400" /> View Analytics
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button onClick={() => { setCampaignModal(hs); setActiveActionsMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-xs font-bold text-orange-600">
                              <Rocket className="h-4 w-4 text-orange-500" /> Launch Campaign
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="h-24 text-center text-xs font-bold text-gray-400">
                    No high streets match your current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activation Wizard */}
      <HighStreetActivationWizard 
        open={isWizardOpen} 
        onOpenChange={setIsWizardOpen}
        onCreated={() => {}} 
      />

      {/* Manage Ecosystem Modal */}
      {ecosystemModal && (
        <Modal onClose={() => setEcosystemModal(null)} title="Manage Ecosystem" icon={Activity}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">High Street</span>
                <span className="font-bold text-gray-900">{ecosystemModal.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Borough</span>
                <span className="font-bold text-gray-900">{ecosystemModal.borough}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Status</span>
                <span className={cn("font-bold", ecosystemModal.status === 'Active' ? 'text-emerald-600' : 'text-amber-600')}>{ecosystemModal.status}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Businesses</span>
                <span className="font-bold text-gray-900">{ecosystemModal.businessCount}</span>
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
              <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 font-semibold">Ecosystem management allows you to configure platform access, view business registrations, and manage local integrations for this high street.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Assign Manager Modal */}
      {assignModal && (
        <Modal onClose={() => { setAssignModal(null); setAssignManagerId(''); }} title="Assign Manager" icon={User}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 font-medium">Assign an account manager to oversee this high street.</p>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Select Manager</label>
              <select
                value={assignManagerId}
                onChange={e => setAssignManagerId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue outline-none transition-all font-semibold text-sm"
              >
                <option value="">Choose a manager</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.email}</option>
                ))}
              </select>
              {managers.length === 0 && (
                <p className="text-[11px] text-amber-600 font-medium mt-1.5">No account managers found. Create one in User Management first.</p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setAssignModal(null); setAssignManagerId(''); }} className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button 
                onClick={handleAssignManager} 
                disabled={!assignManagerId || updateHighStreet.isPending}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all disabled:opacity-50"
              >
                {updateHighStreet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Assign
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Analytics Modal */}
      {analyticsModal && (
        <Modal onClose={() => setAnalyticsModal(null)} title="View Analytics" icon={BarChart3}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">High Street</span>
                <span className="font-bold text-gray-900">{analyticsModal.name}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Total Businesses</span>
                <span className="font-bold text-gray-900">{analyticsModal.businessCount}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500 font-semibold">Status</span>
                <span className={cn("font-bold", analyticsModal.status === 'Active' ? 'text-emerald-600' : 'text-amber-600')}>{analyticsModal.status}</span>
              </div>
            </div>
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl flex gap-3">
              <Target className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
              <p className="text-xs text-purple-700 font-semibold">Detailed analytics for this high street will be available once the analytics dashboard is fully integrated with the backend.</p>
            </div>
          </div>
        </Modal>
      )}

      {/* Launch Campaign Modal */}
      {campaignModal && (
        <Modal onClose={() => { setCampaignModal(null); setCampaignName(''); setCampaignDescription(''); }} title="Launch Campaign" icon={Rocket}>
          <div className="space-y-4">
            <p className="text-xs text-gray-500 font-medium">Create a campaign for <span className="font-bold text-gray-900">{campaignModal.name}</span>.</p>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Campaign Name</label>
              <input
                type="text"
                placeholder="e.g. Summer Rewards Push"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all font-semibold text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                placeholder="Brief description of the campaign..."
                value={campaignDescription}
                onChange={e => setCampaignDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none transition-all font-semibold text-sm resize-none"
              />
            </div>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-semibold">Campaign creation will be fully functional once the backend campaign endpoint is implemented.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => { setCampaignModal(null); setCampaignName(''); setCampaignDescription(''); }} className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button 
                onClick={handleLaunchCampaign} 
                disabled={!campaignName}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-orange-100 transition-all disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" /> Launch
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ onClose, title, icon: Icon, children }: { onClose: () => void; title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md border border-gray-100 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 text-orange-600 mb-1">
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">High Street</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function FeedItem({ icon: Icon, iconColor, bgColor, title, details, time, location, indicatorColor }: any) {
  return (
    <div className="flex gap-3 relative group">
      <div className={cn("p-2 rounded-xl h-fit shadow-sm relative z-10", bgColor)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
        <div className={cn("absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white", indicatorColor)} />
      </div>
      <div className="flex-1 space-y-1">
        <p className="text-xs text-gray-800 leading-snug font-semibold">
          <span>{title.split(' ')[0]} {title.split(' ')[1]}</span> {title.split(' ').slice(2).join(' ')}
          {details && <span className="text-gray-400 font-medium ml-1">{details}</span>}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-gray-450 font-bold uppercase tracking-wider">
          <span>{time}</span>
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          <span className="text-gray-500">{location}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon }: { title: string, value: string, trend: string, icon: any }) {
  const isPositive = trend.startsWith('+');
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-gray-50 rounded-xl text-gray-500">
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn(
          "text-[9px] font-bold px-2 py-0.5 rounded-full border",
          isPositive ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
        )}>
          {trend}
        </span>
      </div>
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-xl font-black text-gray-900 leading-none mt-1">{value}</p>
      </div>
    </div>
  );
}
