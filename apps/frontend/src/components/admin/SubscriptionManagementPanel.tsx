import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, RefreshCw, ArrowUp, ArrowDown, Ban, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAdminData, Subscription } from '../../context/AdminDataContext';

export default function SubscriptionManagementPanel() {
  const { subscriptions, updateSubscription } = useAdminData();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = subscriptions.filter(s => {
    const matchSearch = s.businessName.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || s.status === filter;
    return matchSearch && matchFilter;
  });

  const handleAction = (sub: Subscription, action: string) => {
    const statusMap: Record<string, Subscription['status']> = {
      renew: 'Active', upgrade: 'Active', downgrade: 'Active',
      cancel: 'Cancelled', suspend: 'Suspended', reactivate: 'Active',
    };
    updateSubscription(sub.id, { status: statusMap[action] || sub.status });
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <p className="text-sm text-gray-500 font-medium">{subscriptions.length} subscriptions in ecosystem</p>
        <div className="flex gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search business..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-48" /></div>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        {['All', 'Active', 'Expired', 'Cancelled', 'Pending', 'Suspended'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", filter === f ? "bg-brand-blue text-white shadow-glow" : "bg-white text-gray-400 hover:text-gray-600 border border-gray-100")}>{f}</button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Business</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Period</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-6 py-4 font-bold text-sm text-gray-900">{sub.businessName}</td>
                  <td className="px-6 py-4"><span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold border", sub.type === 'Membership' ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200")}>{sub.type}</span></td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-700">{sub.itemName}</td>
                  <td className="px-6 py-4"><span className="flex items-center gap-1.5"><span className={cn("w-2 h-2 rounded-full", sub.status === 'Active' ? 'bg-green-500' : sub.status === 'Expired' ? 'bg-red-500' : sub.status === 'Pending' ? 'bg-amber-500' : sub.status === 'Cancelled' ? 'bg-gray-400' : 'bg-orange-500')} /><span className="text-xs font-bold">{sub.status}</span></span></td>
                  <td className="px-6 py-4 font-bold text-sm">£{sub.amount}<span className="text-[10px] text-gray-400 font-normal">/{sub.billingCycle.toLowerCase()}</span></td>
                  <td className="px-6 py-4 text-xs text-gray-500">{sub.startDate} → {sub.endDate}</td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {sub.status === 'Active' && <><ActionBtn icon={Ban} label="Suspend" onClick={() => handleAction(sub, 'suspend')} /><ActionBtn icon={X} label="Cancel" onClick={() => handleAction(sub, 'cancel')} /></>}
                      {sub.status === 'Expired' && <ActionBtn icon={RefreshCw} label="Renew" onClick={() => handleAction(sub, 'renew')} />}
                      {sub.status === 'Cancelled' && <ActionBtn icon={CheckCircle2} label="Reactivate" onClick={() => handleAction(sub, 'reactivate')} />}
                      {sub.status === 'Suspended' && <ActionBtn icon={CheckCircle2} label="Reactivate" onClick={() => handleAction(sub, 'reactivate')} />}
                      {sub.status === 'Pending' && <ActionBtn icon={CheckCircle2} label="Approve" onClick={() => handleAction(sub, 'renew')} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-sm font-bold text-gray-400">No subscriptions found</div>}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }: any) {
  return <button onClick={onClick} className="p-2 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-brand-blue transition-all text-gray-400" title={label}><Icon className="w-3.5 h-3.5" /></button>;
}
