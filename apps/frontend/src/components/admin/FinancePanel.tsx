import { useAdminPayments, useAdminSubscriptions, useAdminRevenue, useUpdatePaymentStatus } from '../../services/admin/hooks';
import { DollarSign, Receipt, Search, CheckCircle2, X, RotateCcw, Download, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function FinancePanel() {
  const { data: payRes } = useAdminPayments();
  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PaymentsPanel paymentsData={payRes} />
        <BillingPanel paymentsData={payRes} />
      </div>
    </div>
  );
}

function PaymentsPanel({ paymentsData }: { paymentsData: any }) {
  const payments = paymentsData?.data ?? [];
  const updatePay = useUpdatePaymentStatus();

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
              {payments.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50/80 transition-colors group">
                  <td className="px-4 py-3"><div className="font-bold text-xs text-gray-900">{p.businessName}</div><div className="text-[10px] text-gray-400">{p.invoice}</div></td>
                  <td className="px-4 py-3 font-bold text-sm">£{p.amount}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-600">{p.method}</td>
                  <td className="px-4 py-3"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", p.status === 'Completed' ? 'bg-green-50 text-green-700' : p.status === 'Pending' ? 'bg-amber-50 text-amber-700' : p.status === 'Failed' ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-600')}>{p.status}</span></td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-500">{p.date}</td>
                  <td className="px-4 py-3"><div className="flex justify-center gap-1">
                    {p.status === 'Pending' && <button onClick={() => updatePay.mutate({ id: p.id, data: { status: 'Completed' } })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-green-50 hover:text-green-600 transition-all"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                    {p.status === 'Completed' && <button onClick={() => updatePay.mutate({ id: p.id, data: { status: 'Refunded' } })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-amber-50 hover:text-amber-600 transition-all"><RotateCcw className="w-3.5 h-3.5" /></button>}
                    {p.status === 'Failed' && <button onClick={() => updatePay.mutate({ id: p.id, data: { status: 'Pending' } })} className="p-1.5 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-all"><RotateCcw className="w-3.5 h-3.5" /></button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BillingPanel({ paymentsData }: { paymentsData: any }) {
  const { data: subsRes } = useAdminSubscriptions();
  const { data: revRes } = useAdminRevenue();
  const payments = paymentsData?.data ?? [];
  const subscriptions = subsRes?.data ?? [];
  const revenueRecords = revRes?.data ?? [];

  const totalRevenue = payments.filter((p: any) => p.status === 'Completed').reduce((s: number, p: any) => s + p.amount, 0);
  const pendingRevenue = payments.filter((p: any) => p.status === 'Pending').reduce((s: number, p: any) => s + p.amount, 0);
  const activeSubs = subscriptions.filter((s: any) => s.status === 'Active').length;
  const monthlyRecurring = subscriptions.filter((s: any) => s.status === 'Active').reduce((sum: number, s: any) => sum + s.amount, 0);
  const recentRevenue = revenueRecords.slice(-6);

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-4"><Receipt className="w-4 h-4 text-brand-blue" />Billing Summary</h3>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <BillStat label="Total Revenue (Completed)" value={`£${totalRevenue.toLocaleString()}`} />
        <BillStat label="Pending Revenue" value={`£${pendingRevenue.toLocaleString()}`} />
        <BillStat label="Active Subscriptions" value={activeSubs.toString()} />
        <BillStat label="Monthly Recurring" value={`£${monthlyRecurring.toLocaleString()}`} />
        <div className="pt-3 border-t border-gray-50">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Revenue Trend (Last 6)</div>
          <div className="flex items-end gap-2 h-20">
            {recentRevenue.map((r: any, i: number) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-gradient-to-t from-brand-blue to-blue-300 rounded-t-lg transition-all hover:opacity-80" style={{ height: `${revenueRecords.length > 0 ? Math.max((r.amount / Math.max(...revenueRecords.map((x: any) => x.amount))) * 100, 10) : 10}%` }} />
                <span className="text-[8px] font-bold text-gray-400">{r.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BillStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-gray-500">{label}</span>
      <span className="text-sm font-bold text-gray-900">{value}</span>
    </div>
  );
}
