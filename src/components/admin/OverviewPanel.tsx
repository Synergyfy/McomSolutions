import { useAdminData } from '../../context/AdminDataContext';
import { cn } from '../../lib/utils';
import { Building2, Users, Briefcase, UserCircle, Target, Zap, ShoppingBag, ClipboardCheck, Presentation, Heart, Wallet, CreditCard, ArrowUpRight, CheckCircle2, Clock, AlertTriangle, Activity, Package } from 'lucide-react';

const QUICK_ACTIONS = [
  { label: 'Create Membership', tab: 'memberships', icon: CreditCard, color: 'bg-blue-500' },
  { label: 'Create Package', tab: 'packages', icon: Package, color: 'bg-emerald-500' },
  { label: 'Manage Pricing', tab: 'pricing', icon: Target, color: 'bg-amber-500' },
  { label: 'Manage Users', tab: 'users', icon: Users, color: 'bg-purple-500' },
  { label: 'Manage Platforms', tab: 'platform-access', icon: Activity, color: 'bg-rose-500' },
  { label: 'View Payments', tab: 'payments', icon: Wallet, color: 'bg-cyan-500' },
];

export default function OverviewPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { businesses, customers, agents, consultants, accountManagers, payments, revenueRecords, subscriptions, platforms } = useAdminData();

  const totalPlatformUsers = platforms.reduce((sum, p) => sum + p.totalUsers, 0);
  const activeSubs = subscriptions.filter(s => s.status === 'Active').length;
  const expiredSubs = subscriptions.filter(s => s.status === 'Expired').length;
  const pendingSubs = subscriptions.filter(s => s.status === 'Pending').length;
  const cancelledSubs = subscriptions.filter(s => s.status === 'Cancelled').length;
  const todayRevenue = revenueRecords.filter(r => r.date === new Date().toISOString().split('T')[0]).reduce((s, r) => s + r.amount, 0);
  const monthlyRevenue = revenueRecords.reduce((s, r) => s + r.amount, 0);
  const completedPayments = payments.filter(p => p.status === 'Completed').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Businesses" value={businesses.length} icon={Building2} color="text-blue-600" bg="bg-blue-50" />
        <StatCard label="Total Customers" value={customers.length} icon={UserCircle} color="text-emerald-600" bg="bg-emerald-50" />
        <StatCard label="Total Agents" value={agents.length} icon={Briefcase} color="text-purple-600" bg="bg-purple-50" />
        <StatCard label="Consultants" value={consultants.length} icon={Users} color="text-amber-600" bg="bg-amber-50" />
        <StatCard label="Account Managers" value={accountManagers.length} icon={UserCircle} color="text-cyan-600" bg="bg-cyan-50" />
        <StatCard label="Platform Users" value={totalPlatformUsers.toLocaleString()} icon={Activity} color="text-rose-600" bg="bg-rose-50" />
      </div>

      {/* Memberships & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Membership Stats</h3>
          <div className="space-y-3">
            <MiniStat label="Active" value={activeSubs} color="text-green-600" bg="bg-green-50" />
            <MiniStat label="Expired" value={expiredSubs} color="text-red-600" bg="bg-red-50" />
            <MiniStat label="Pending" value={pendingSubs} color="text-amber-600" bg="bg-amber-50" />
            <MiniStat label="Cancelled" value={cancelledSubs} color="text-gray-600" bg="bg-gray-50" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Stats</h3>
          <div className="space-y-3">
            <MiniStat label="Today's Revenue" value={`£${todayRevenue.toLocaleString()}`} color="text-green-600" bg="bg-green-50" />
            <MiniStat label="Monthly Revenue" value={`£${monthlyRevenue.toLocaleString()}`} color="text-blue-600" bg="bg-blue-50" />
            <MiniStat label="Total Completed" value={`£${completedPayments.toLocaleString()}`} color="text-purple-600" bg="bg-purple-50" />
            <MiniStat label="Recurring Revenue" value={`£${(monthlyRevenue * 0.7).toLocaleString()}`} color="text-cyan-600" bg="bg-cyan-50" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Platform Users</h3>
          <div className="space-y-3">
            {platforms.slice(0, 6).map(p => (
              <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                <span className="text-sm font-bold text-gray-700">{p.name}</span>
                <span className="text-sm font-bold text-brand-blue">{p.totalUsers.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.tab}
              onClick={() => onNavigate(action.tab)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-lg transition-all group text-left"
            >
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", action.color)}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <div className="font-bold text-sm text-gray-900 group-hover:text-brand-blue transition-colors">{action.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", bg)}>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, color, bg }: any) {
  return (
    <div className={cn("flex items-center justify-between p-3 rounded-xl", bg || 'bg-gray-50')}>
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <span className={cn("text-sm font-bold", color)}>{value}</span>
    </div>
  );
}
