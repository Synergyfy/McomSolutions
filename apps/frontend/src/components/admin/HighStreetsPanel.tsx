import { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  MapPin, 
  Users, 
  Building2, 
  Activity,
  Globe,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Rocket,
  Store,
  Map as MapIcon,
  Rss,
  ShoppingCart
} from 'lucide-react';
import HighStreetActivationWizard from './HighStreetActivationWizard';
import { cn } from '../../lib/utils';

// Mock data for High Streets (Inventory Table)
const initialHighStreets = [
  {
    id: '1',
    name: 'Oxford Street',
    borough: 'Westminster',
    status: 'Active',
    physicalHub: 'Yes',
    virtualHub: 'Yes',
    communityGroup: 'Active',
    totalBusinesses: 145,
    engagementScore: 92,
    location: { lat: 51.5145, lng: -0.1448 },
    hasPhysical: true,
    hasVirtual: true
  },
  {
    id: '2',
    name: 'Kings Road',
    borough: 'Kensington & Chelsea',
    status: 'Active',
    physicalHub: 'No',
    virtualHub: 'Yes',
    communityGroup: 'Active',
    totalBusinesses: 88,
    engagementScore: 78,
    location: { lat: 51.4875, lng: -0.1685 },
    hasPhysical: false,
    hasVirtual: true
  },
  {
    id: '3',
    name: 'Brick Lane',
    borough: 'Tower Hamlets',
    status: 'Pending',
    physicalHub: 'No',
    virtualHub: 'No',
    communityGroup: 'Inactive',
    totalBusinesses: 122,
    engagementScore: 45,
    location: { lat: 51.5218, lng: -0.0718 },
    hasPhysical: false,
    hasVirtual: false
  },
];

export default function HighStreetsPanel() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Inactive'>('All');
  const [boroughFilter, setBoroughFilter] = useState('All Boroughs');
  const [districtLayer, setDistrictLayer] = useState<'physical' | 'virtual'>('physical');
  const [activeActionsMenu, setActiveActionsMenu] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Filter high street data based on active filters
  const filteredHighStreets = initialHighStreets.filter(hs => {
    const matchesSearch = hs.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         hs.borough.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || hs.status === statusFilter;
    const matchesBorough = boroughFilter === 'All Boroughs' || hs.borough === boroughFilter;
    return matchesSearch && matchesStatus && matchesBorough;
  });

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Active High Streets" value="24" trend="+2" icon={MapIcon} />
        <StatCard title="Pending Activations" value="7" trend="-1" icon={Clock} />
        <StatCard title="Community Part." value="85%" trend="+5%" icon={Users} />
        <StatCard title="Borough Coverage" value="12" trend="0" icon={MapPin} />
        <StatCard title="Traffic Activity" value="1.2k" trend="+12%" icon={Activity} />
        <StatCard title="QR Engagement" value="4.8k" trend="+18%" icon={QrCode} />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Map Mockup Section */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-950 text-base">High Street Activity Map</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-bold text-orange-600 ring-1 ring-inset ring-orange-200">Live View</span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider italic">District Overlay Active</span>
              </div>
            </div>
            <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200 shadow-inner">
              <button
                onClick={() => setDistrictLayer('physical')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                  districtLayer === 'physical' 
                    ? "bg-white text-orange-600 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                Physical
              </button>
              <button
                onClick={() => setDistrictLayer('virtual')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                  districtLayer === 'virtual' 
                    ? "bg-white text-brand-blue shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Globe className="h-3.5 w-3.5" />
                Virtual
              </button>
            </div>
          </div>
          <div className="p-6">
            {/* Custom SVG Map Visualization */}
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-150 bg-[#F3F4F6] flex items-center justify-center group shadow-inner">
              <svg viewBox="0 0 800 450" className="w-full h-full text-gray-300">
                {/* Background Grid Pattern */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E5E7EB" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Stylized London Thames River */}
                <path 
                  d="M -50 300 Q 150 330 250 250 T 550 230 T 850 280" 
                  fill="none" 
                  stroke="#DBEAFE" 
                  strokeWidth="32" 
                  strokeLinecap="round" 
                  className="opacity-75"
                />
                <path 
                  d="M -50 300 Q 150 330 250 250 T 550 230 T 850 280" 
                  fill="none" 
                  stroke="#93C5FD" 
                  strokeWidth="8" 
                  strokeLinecap="round"
                  className="opacity-50"
                />

                {/* District Zones Polygons (Interactive) */}
                <polygon 
                  points="180,80 320,60 350,160 190,180" 
                  fill={districtLayer === 'physical' ? "rgba(249, 115, 22, 0.08)" : "rgba(59, 130, 246, 0.05)"}
                  stroke={districtLayer === 'physical' ? "#F97316" : "#3B82F6"}
                  strokeWidth="2" 
                  strokeDasharray="4,4"
                  className="cursor-pointer transition-all hover:fill-orange-500/20"
                  onMouseEnter={() => setHoveredZone('Oxford Street Core - Active Hub')}
                  onMouseLeave={() => setHoveredZone(null)}
                />
                <polygon 
                  points="450,150 620,130 650,220 480,240" 
                  fill={districtLayer === 'physical' ? "rgba(249, 115, 22, 0.05)" : "rgba(59, 130, 246, 0.08)"}
                  stroke={districtLayer === 'physical' ? "#F97316" : "#3B82F6"}
                  strokeWidth="2" 
                  strokeDasharray="4,4"
                  className="cursor-pointer transition-all hover:fill-blue-500/20"
                  onMouseEnter={() => setHoveredZone('East London Virtual Hub')}
                  onMouseLeave={() => setHoveredZone(null)}
                />

                {/* Live Hotspot Rings (Pulse effect mocked in SVG via CSS classes) */}
                <circle cx="260" cy="120" r="15" className="fill-orange-400/30 animate-pulse" />
                <circle cx="260" cy="120" r="5" className="fill-orange-600" />

                <circle cx="530" cy="180" r="22" className="fill-brand-blue/20 animate-pulse" />
                <circle cx="530" cy="180" r="6" className="fill-brand-blue" />

                <circle cx="380" cy="270" r="12" className="fill-emerald-400/30 animate-pulse" />
                <circle cx="380" cy="270" r="4" className="fill-emerald-500" />
                
                {/* Labels */}
                <text x="210" y="50" className="text-[10px] font-bold fill-gray-500 uppercase tracking-widest">Oxford District</text>
                <text x="510" y="110" className="text-[10px] font-bold fill-gray-500 uppercase tracking-widest">East Hub Zone</text>
              </svg>

              {/* Map Legend Overlay */}
              <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
                <div className="bg-white/95 backdrop-blur-sm p-3.5 rounded-2xl border border-gray-100 shadow-xl space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-gray-700">High Traffic Hub</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-blue shadow-sm" />
                    <span className="text-[10px] font-bold text-gray-700">Activation Zone</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-gray-700">Participating Biz</span>
                  </div>
                </div>
              </div>

              {/* Hovered Zone Details Box */}
              {hoveredZone && (
                <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-gray-800 shadow-xl text-white text-xs font-semibold">
                  {hoveredZone}
                </div>
              )}
            </div>
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
                {['All Boroughs', 'Westminster', 'Camden', 'Tower Hamlets'].map((borough) => (
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
              <FeedItem 
                icon={ShoppingCart} 
                iconColor="text-brand-blue" 
                bgColor="bg-blue-50"
                title="Marylebone Zone spike detected"
                details="(+22% foot traffic)."
                time="2m ago"
                location="Borough: Westminster"
                indicatorColor="bg-brand-blue"
              />
              <FeedItem 
                icon={Rocket} 
                iconColor="text-orange-600" 
                bgColor="bg-orange-50"
                title="Hackney Virtual Hub successfully deployed."
                time="14m ago"
                location="District: East"
                indicatorColor="bg-orange-700"
              />
              <FeedItem 
                icon={QrCode} 
                iconColor="text-emerald-600" 
                bgColor="bg-emerald-50"
                title="QR Engagement Milestone reached in Islington."
                time="32m ago"
                location="Users: 5,000+"
                indicatorColor="bg-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* High Street List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
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
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Physical Hub</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Virtual Hub</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Community Group</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Businesses</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Eng. Score</th>
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
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {hs.physicalHub === 'Yes' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {hs.virtualHub === 'Yes' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border",
                        hs.communityGroup === 'Active' ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-gray-400 bg-gray-50 border-gray-150"
                      )}>
                        <Users className="h-3 w-3" />
                        {hs.communityGroup}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-800">{hs.totalBusinesses}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50">
                          <div 
                            className={cn(
                              "h-full rounded-full",
                              hs.engagementScore > 80 ? "bg-emerald-500" : "bg-amber-500"
                            )}
                            style={{ width: `${hs.engagementScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700">{hs.engagementScore}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={() => setActiveActionsMenu(activeActionsMenu === hs.id ? null : hs.id)}
                        className="p-1.5 hover:bg-gray-50 rounded-xl transition-all text-gray-400 hover:text-gray-700"
                      >
                        <MoreVertical className="h-4.5 w-4.5" />
                      </button>
                      
                      {activeActionsMenu === hs.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveActionsMenu(null)} />
                          <div className="absolute right-6 top-10 mt-1 w-48 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 z-40 text-left">
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <Activity className="h-4 w-4 text-gray-400" /> Manage Ecosystem
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <Users className="h-4 w-4 text-gray-400" /> Assign Manager
                            </button>
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs font-semibold text-gray-700">
                              <BarChart3 className="h-4 w-4 text-gray-400" /> View Analytics
                            </button>
                            <div className="h-px bg-gray-100 my-1" />
                            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-xs font-bold text-orange-600">
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
                  <td colSpan={9} className="h-24 text-center text-xs font-bold text-gray-400">
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
      />
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
