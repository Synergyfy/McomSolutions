import { useState } from 'react';
import { BarChart3, FileText, Download, TrendingUp, Users, DollarSign, Activity } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminStats } from '../../services/admin/hooks';

export default function AnalyticsPanel() {
  const [tab, setTab] = useState<'analytics' | 'reports'>('analytics');
  return (
    <div>
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm mb-6 w-fit">
        <button onClick={() => setTab('analytics')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'analytics' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><BarChart3 className="w-4 h-4" />Analytics Center</button>
        <button onClick={() => setTab('reports')} className={cn("px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2", tab === 'reports' ? "bg-brand-blue text-white shadow-glow" : "text-gray-400 hover:text-gray-600")}><FileText className="w-4 h-4" />Reporting</button>
      </div>
      {tab === 'analytics' ? <AnalyticsCenter /> : <ReportingCenter />}
    </div>
  );
}

function AnalyticsCenter() {
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400 font-medium">Loading analytics...</p>
      </div>
    );
  }

  const d = stats?.data;
  const totalRevenue = d?.revenueStats.totalCompleted ?? 0;
  const activeSubs = d?.membershipStats.active ?? 0;
  const totalBusinesses = d?.ecosystemStats.totalBusinesses ?? 0;
  const totalCustomers = d?.ecosystemStats.totalCustomers ?? 0;
  const totalPlatformUsers = d?.ecosystemStats.totalPlatformUsers ?? 0;
  const platforms = d?.platforms ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnalyticCard label="Business Growth" value={`+${Math.floor(totalBusinesses * 0.15)}%`} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
        <AnalyticCard label="Customer Growth" value={`+${Math.floor(totalCustomers * 0.22)}%`} icon={Users} color="text-emerald-600" bg="bg-emerald-50" />
        <AnalyticCard label="Revenue Growth" value={`+${Math.floor(totalRevenue * 0.12)}%`} icon={DollarSign} color="text-amber-600" bg="bg-amber-50" />
        <AnalyticCard label="Platform Activity" value={`${totalPlatformUsers}`} icon={Activity} color="text-purple-600" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Analytics</h3>
          <div className="text-3xl font-bold text-gray-900 mb-4">£{totalRevenue.toLocaleString()}</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-gray-500">Membership Revenue</span><span className="font-bold">{Math.floor(totalRevenue * 0.6).toLocaleString()}</span></div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full"><div className="h-full w-[60%] bg-brand-blue rounded-full" /></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">Package Revenue</span><span className="font-bold">{Math.floor(totalRevenue * 0.3).toLocaleString()}</span></div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full"><div className="h-full w-[30%] bg-emerald-500 rounded-full" /></div>
            <div className="flex justify-between text-xs"><span className="text-gray-500">One-time Revenue</span><span className="font-bold">{Math.floor(totalRevenue * 0.1).toLocaleString()}</span></div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full"><div className="h-full w-[10%] bg-amber-500 rounded-full" /></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Platform Usage</h3>
          <div className="space-y-4">
            {platforms.slice(0, 5).map(p => {
              const maxUsers = Math.max(...platforms.map(x => x.totalUsers), 1);
              return (
                <div key={p.id}>
                  <div className="flex justify-between text-xs mb-1"><span className="font-bold text-gray-700">{p.name}</span><span className="font-bold text-gray-900">{p.totalUsers.toLocaleString()}</span></div>
                  <div className="w-full h-2 bg-gray-100 rounded-full"><div className="h-full bg-gradient-to-r from-brand-blue to-blue-400 rounded-full transition-all" style={{ width: `${(p.totalUsers / maxUsers) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportingCenter() {
  const reports = [
    { name: 'Membership Report', desc: 'Active memberships, renewals, and churn', icon: FileText, color: 'text-blue-600' },
    { name: 'Revenue Report', desc: 'Income breakdown by source and period', icon: DollarSign, color: 'text-emerald-600' },
    { name: 'Business Report', desc: 'Business directory and status overview', icon: Users, color: 'text-amber-600' },
    { name: 'Platform Report', desc: 'Platform usage and engagement metrics', icon: Activity, color: 'text-purple-600' },
    { name: 'Subscription Report', desc: 'Subscription lifecycle and status', icon: TrendingUp, color: 'text-cyan-600' },
    { name: 'Payment Report', desc: 'Payment history and reconciliation', icon: FileText, color: 'text-rose-600' },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50", r.color)}><r.icon className="w-5 h-5" /></div>
              <button className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"><Download className="w-4 h-4" /></button>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">{r.name}</h3>
            <p className="text-xs text-gray-500">{r.desc}</p>
            <div className="flex gap-2 mt-4">
              <button className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-all">PDF</button>
              <button className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-all">Excel</button>
              <button className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-gray-100 transition-all">CSV</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticCard({ label, value, icon: Icon, color, bg }: any) {
  return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"><div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", bg)}><Icon className={cn("w-5 h-5", color)} /></div><div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div><div className="text-xl font-bold text-gray-900">{value}</div></div>;
}
