import { useAdminData, Payment } from '../../context/AdminDataContext';
import { DollarSign, Receipt, Search, CheckCircle2, X, RotateCcw, Download } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FinancePanel() {
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentsPanel />
        <BillingPanel />
      </div>
    </div>
  );
}

function PaymentsPanel() {
  const { payments, updatePayment } = useAdminData();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2"><DollarSign className="w-4 h-4 text-brand-blue" />Payments</h3>
        <button className="px-3 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-50/50">
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Business</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Method</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
              <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-4 py-3"><div className="font-bold text-xs text-gray-900">{p.businessName}</div><div className="text-[10px] text-gray-400">{p.invoice}</div></td>
                  <td className="px-4 py-3 font-bold text-sm">£{p.amount}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{p.method}</td>
                  <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", p.status === 'Completed' ? 'bg-green-50 text-green-700' : p.status === 'Pending' ? 'bg-amber-50 text-amber-700' : p.status === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700')}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{p.date}</td>
                  <td className="px-4 py-3"><div className="flex justify-center gap-1">
                    {p.status === 'Pending' && <button onClick={() => updatePayment(p.id, { status: 'Completed' })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-green-50 hover:text-green-600 transition-all" title="Approve"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                    {p.status === 'Completed' && <button onClick={() => updatePayment(p.id, { status: 'Refunded' })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all" title="Refund"><RotateCcw className="w-3.5 h-3.5" /></button>}
                    {p.status === 'Failed' && <button onClick={() => updatePayment(p.id, { status: 'Pending' })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all" title="Retry"><RotateCcw className="w-3.5 h-3.5" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {payments.length === 0 && <div className="p-8 text-center text-sm font-bold text-gray-400">No payments found</div>}
      </div>
    </div>
  );
}

function BillingPanel() {
  const { subscriptions, payments, revenueRecords } = useAdminData();
  const totalRevenue = payments.filter(p => p.status === 'Completed').reduce((s, p) => s + p.amount, 0);
  const pendingRevenue = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + p.amount, 0);
  const activeSubs = subscriptions.filter(s => s.status === 'Active').length;
  const monthlyRecurring = subscriptions.filter(s => s.status === 'Active').reduce((s, sub) => s + sub.amount, 0);

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2"><Receipt className="w-4 h-4 text-brand-blue" />Billing Overview</h3>
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Summary</div>
          <div className="grid grid-cols-2 gap-4">
            <BillStat label="Total Collected" value={`£${totalRevenue.toLocaleString()}`} />
            <BillStat label="Pending" value={`£${pendingRevenue.toLocaleString()}`} />
            <BillStat label="Active Subscriptions" value={activeSubs.toString()} />
            <BillStat label="Monthly Recurring" value={`£${monthlyRecurring.toLocaleString()}`} />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Revenue Trend (Last 6 Days)</div>
          <div className="space-y-2">
            {revenueRecords.slice(-6).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <span className="text-xs text-gray-500 font-medium">{r.date}</span>
                <div className="flex items-center gap-3 flex-1 ml-3">
                  <div className="h-2 rounded-full bg-brand-blue/20" style={{ width: `${(r.amount / Math.max(...revenueRecords.map(x => x.amount))) * 100}%` }} />
                </div>
                <span className="text-xs font-bold text-gray-900">£{r.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BillStat({ label, value }: any) {
  return <div><div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">{label}</div><div className="text-lg font-bold text-gray-900">{value}</div></div>;
}
