import { useState } from 'react';
import { BarChart3, FileText, Download, TrendingUp, Users, DollarSign, Activity, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  useAdminStats,
  useAdminAnalytics,
  useAdminBusinesses,
  useAdminCustomers,
  useAdminSubscriptions,
  useAdminPayments,
  useAdminRevenue,
  useAdminPlatforms,
} from '../../services/admin/hooks';

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
  const { data: analyticsRes } = useAdminAnalytics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-gray-400 font-medium">Loading analytics...</p>
      </div>
    );
  }

  const d = stats?.data;
  const totalRevenue = d?.revenueStats.totalCompleted ?? analyticsRes?.data?.totalRevenue ?? 0;
  const totalPlatformUsers = d?.ecosystemStats.totalPlatformUsers ?? 0;
  const platforms = d?.platforms ?? [];

  const growth = analyticsRes?.data?.growth ?? { businessGrowth: 0, customerGrowth: 0, revenueGrowth: 0 };
  const revenueBreakdown = analyticsRes?.data?.revenueBreakdown ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AnalyticCard label="Business Growth" value={`${growth.businessGrowth >= 0 ? '+' : ''}${growth.businessGrowth}%`} icon={TrendingUp} color="text-blue-600" bg="bg-blue-50" />
        <AnalyticCard label="Customer Growth" value={`${growth.customerGrowth >= 0 ? '+' : ''}${growth.customerGrowth}%`} icon={Users} color="text-emerald-600" bg="bg-emerald-50" />
        <AnalyticCard label="Revenue Growth" value={`${growth.revenueGrowth >= 0 ? '+' : ''}${growth.revenueGrowth}%`} icon={DollarSign} color="text-amber-600" bg="bg-amber-50" />
        <AnalyticCard label="Platform Activity" value={`${totalPlatformUsers}`} icon={Activity} color="text-purple-600" bg="bg-purple-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Analytics</h3>
          <div className="text-3xl font-bold text-gray-900 mb-4">£{totalRevenue.toLocaleString()}</div>
          {revenueBreakdown.length > 0 ? (
            <div className="space-y-3">
              {revenueBreakdown.map((item: any) => (
                <div key={item.type}>
                  <div className="flex justify-between text-xs"><span className="text-gray-500">{item.type}</span><span className="font-bold">£{item.amount.toLocaleString()} · {item.percentage}%</span></div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-full bg-brand-blue rounded-full" style={{ width: `${Math.min(item.percentage, 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">No revenue breakdown available.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Platform Usage</h3>
          <p className="text-sm text-gray-500 mb-4">
            <span className="font-bold text-gray-900">{totalPlatformUsers.toLocaleString()}</span> total users across {platforms.length} {platforms.length === 1 ? 'platform' : 'platforms'}
          </p>
          <div className="space-y-2">
            {platforms.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                <span className="text-xs font-bold text-gray-700">{p.name}</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Live</span>
              </div>
            ))}
            {platforms.length === 0 && (
              <p className="text-xs text-gray-400">No platforms registered yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportingCenter() {
  const { data: businessesRes, isLoading: loadingBusinesses } = useAdminBusinesses({ page: 1, limit: 100 });
  const { data: customersRes, isLoading: loadingCustomers } = useAdminCustomers({ page: 1, limit: 100 });
  const { data: subscriptionsRes, isLoading: loadingSubs } = useAdminSubscriptions({ page: 1, limit: 100 });
  const { data: paymentsRes, isLoading: loadingPayments } = useAdminPayments({ page: 1, limit: 100 });
  const { data: revenueRes, isLoading: loadingRevenue } = useAdminRevenue({ page: 1, limit: 100 });
  const { data: platformsRes, isLoading: loadingPlatforms } = useAdminPlatforms();

  const businesses = businessesRes?.data ?? [];
  const customers = customersRes?.data ?? [];
  const subscriptions = subscriptionsRes?.data ?? [];
  const payments = paymentsRes?.data ?? [];
  const revenue = revenueRes?.data ?? [];
  const platforms = platformsRes?.data?.platforms ?? [];

  const loading = loadingBusinesses || loadingCustomers || loadingSubs || loadingPayments || loadingRevenue || loadingPlatforms;

  const reports = [
    {
      name: 'Business Report',
      desc: 'Business directory and status overview',
      icon: Users,
      color: 'text-amber-600',
      count: businessesRes?.total ?? businesses.length,
      onDownload: () => downloadCsv('business-report',
        ['Name', 'Email', 'Phone', 'Membership', 'Status', 'Revenue', 'Joined'],
        businesses.map((b: any) => [b.name, b.email, b.phone, b.membership, b.status, b.revenue, b.joined])),
    },
    {
      name: 'Customer Report',
      desc: 'Customer directory, loyalty and membership',
      icon: Users,
      color: 'text-blue-600',
      count: customersRes?.total ?? customers.length,
      onDownload: () => downloadCsv('customer-report',
        ['Name', 'Email', 'Loyalty Points', 'Membership Status', 'Status'],
        customers.map((c: any) => [c.name, c.email, c.loyaltyPoints, c.membershipStatus, c.status])),
    },
    {
      name: 'Subscription Report',
      desc: 'Subscription lifecycle and status',
      icon: TrendingUp,
      color: 'text-cyan-600',
      count: subscriptionsRes?.total ?? subscriptions.length,
      onDownload: () => downloadCsv('subscription-report',
        ['Business', 'Type', 'Item', 'Status', 'Start', 'End', 'Amount', 'Billing Cycle'],
        subscriptions.map((s: any) => [s.businessName, s.type, s.itemName, s.status, s.startDate, s.endDate, s.amount, s.billingCycle])),
    },
    {
      name: 'Payment Report',
      desc: 'Payment history and reconciliation',
      icon: FileText,
      color: 'text-rose-600',
      count: paymentsRes?.total ?? payments.length,
      onDownload: () => downloadCsv('payment-report',
        ['Business', 'Amount', 'Currency', 'Method', 'Status', 'Invoice', 'Type'],
        payments.map((p: any) => [p.businessName, p.amount, p.currency, p.method, p.status, p.invoice, p.type])),
    },
    {
      name: 'Revenue Report',
      desc: 'Income breakdown by source and period',
      icon: DollarSign,
      color: 'text-emerald-600',
      count: revenueRes?.total ?? revenue.length,
      onDownload: () => downloadCsv('revenue-report',
        ['Date', 'Amount', 'Type', 'Source'],
        revenue.map((r: any) => [r.date, r.amount, r.type, r.source])),
    },
    {
      name: 'Platform Report',
      desc: 'Registered platforms and availability',
      icon: Activity,
      color: 'text-purple-600',
      count: platforms.length,
      onDownload: () => downloadCsv('platform-report',
        ['Name', 'Description', 'Status'],
        platforms.map((p: any) => [p.name, p.description, p.status])),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((r) => (
          <div key={r.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50", r.color)}><r.icon className="w-5 h-5" /></div>
              <button
                onClick={r.onDownload}
                title={`Download ${r.name} (CSV)`}
                className="p-2 bg-gray-50 rounded-lg text-gray-400 hover:text-brand-blue hover:bg-blue-50 transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">{r.name}</h3>
            <p className="text-xs text-gray-500">{r.desc}</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-bold text-gray-400">{r.count.toLocaleString()} records</span>
              <button
                onClick={r.onDownload}
                className="px-3 py-1.5 bg-gray-50 rounded-lg text-[10px] font-bold text-gray-500 hover:bg-blue-50 hover:text-brand-blue transition-all"
              >
                CSV
              </button>
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
