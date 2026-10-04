import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Download, RefreshCw, CheckCircle2,
  Clock, Receipt, FileText, Wallet, ArrowUpRight,
  Loader2, Sparkles, Check, AlertCircle, PackageOpen
} from 'lucide-react';
import { useTransactions, useSubscriptions } from '../services/pricing/hooks';
import { useProfile } from '../services/business/hooks';
import { cn } from '../lib/utils';

export default function DashboardBilling() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'subscriptions' | 'methods'>('transactions');
  const { data: rawTransactions = [], isLoading: txLoading } = useTransactions();
  const { data: subData, isLoading: subLoading } = useSubscriptions();
  const { data: profile } = useProfile();

  const transactions = Array.isArray(rawTransactions) ? rawTransactions : [];
  const subscriptions = subData?.subscriptions ?? [];
  const packages = subData?.packages ?? profile?.packages ?? [];

  // 1. Calculate Total Spend (Lifetime)
  const totalSpend = useMemo(() => {
    return transactions
      .filter((t: any) => t.status === 'paid' || t.status === 'Completed' || t.status === 'success')
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
  }, [transactions]);

  // 2. Active Subscriptions Count
  const activeSubsCount = useMemo(() => {
    const activeEcosystem = subscriptions.filter((s: any) => s.status?.toLowerCase() === 'active').length;
    const activePkgs = packages.filter((p: any) => p.status?.toLowerCase() === 'active').length;
    const hasActiveMembership = profile?.membershipStatus === 'active' || profile?.membershipStatus === 'trial';
    return Math.max(activeEcosystem + activePkgs, hasActiveMembership ? 1 : 0);
  }, [subscriptions, packages, profile]);

  // 3. Next Due Date
  const nextDueDate = useMemo(() => {
    const dates: Date[] = [];
    if (profile?.membershipExpiresAt) {
      const d = new Date(profile.membershipExpiresAt);
      if (!isNaN(d.getTime()) && d.getTime() > Date.now()) dates.push(d);
    }
    subscriptions.forEach((s: any) => {
      if (s.endDate) {
        const d = new Date(s.endDate);
        if (!isNaN(d.getTime()) && d.getTime() > Date.now()) dates.push(d);
      }
    });
    packages.forEach((p: any) => {
      if (p.expiresAt) {
        const d = new Date(p.expiresAt);
        if (!isNaN(d.getTime()) && d.getTime() > Date.now()) dates.push(d);
      }
    });

    if (dates.length === 0) return '—';
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0].toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }, [profile, subscriptions, packages]);

  const handleExportCsv = () => {
    if (transactions.length === 0) return;
    const headers = ['Date', 'Description', 'Amount (£)', 'Status'];
    const rows = transactions.map((t: any) => [
      new Date(t.createdAt || Date.now()).toISOString().split('T')[0],
      `"${(t.description || 'Transaction').replace(/"/g, '""')}"`,
      Number(t.amount || 0).toFixed(2),
      t.status || 'paid',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `billing_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 leading-tight">Billing & Payments</h2>
          <p className="text-sm sm:text-base text-gray-500 leading-tight">Your central payment and subscription control hub.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200 mb-3 sm:mb-4" />
          <p className="text-orange-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Total Spend</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black">£{totalSpend.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
          <p className="text-orange-300 text-[11px] sm:text-xs font-semibold mt-1">Lifetime</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Active Subscriptions</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">{activeSubsCount}</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">Auto-renewing</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Next Due Date</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">{nextDueDate}</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">{nextDueDate === '—' ? 'No pending dues' : 'Upcoming renewal'}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 sm:gap-2 bg-gray-100 p-1 sm:p-1.5 rounded-full w-full sm:max-w-lg overflow-x-auto scrollbar-hide">
        {[
          { id: 'transactions', label: 'Transactions', shortLabel: 'Txns', icon: Receipt },
          { id: 'subscriptions', label: 'Subscriptions', shortLabel: 'Subs', icon: RefreshCw },
          { id: 'methods', label: 'Payment Methods', shortLabel: 'Methods', icon: CreditCard },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id as any;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3 px-2.5 sm:px-4 rounded-full font-bold text-[11px] sm:text-sm leading-none whitespace-nowrap transition-all min-w-0 ${
                isActive ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div key="tx" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Transaction History</h3>
                <button
                  onClick={handleExportCsv}
                  disabled={transactions.length === 0}
                  className="flex items-center gap-1.5 text-orange-500 font-bold text-xs sm:text-sm hover:underline shrink-0 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export All</span><span className="sm:hidden">Export</span>
                </button>
              </div>

              {txLoading ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                  <p className="text-xs text-gray-400 font-bold">Loading transactions...</p>
                </div>
              ) : transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/50 border-b border-gray-100">
                        <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-3.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transactions.map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-sm text-gray-900">{tx.description || 'Ecosystem Transaction'}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{tx.id}</p>
                          </td>
                          <td className="px-6 py-4 font-black text-sm text-gray-900">
                            £{Number(tx.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                              tx.status === 'paid' || tx.status === 'Completed' ? "bg-green-100 text-green-700" :
                              tx.status === 'trial' ? "bg-blue-100 text-blue-700" :
                              tx.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                            )}>
                              {tx.status || 'Paid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-gray-500 whitespace-nowrap">
                            {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <FileText className="w-10 h-10 text-gray-300 mb-4" />
                  <p className="font-bold text-gray-900">No transactions yet</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">Your invoices and payment receipts will appear here automatically.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'subscriptions' && (
          <motion.div key="subs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Active Subscriptions & Packages</h3>
              </div>

              {subLoading ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                  <p className="text-xs text-gray-400 font-bold">Loading active subscriptions...</p>
                </div>
              ) : (subscriptions.length > 0 || packages.length > 0 || profile?.membershipLevel) ? (
                <div className="p-4 sm:p-6 md:p-8 space-y-4">
                  {/* Current Membership */}
                  {profile?.membershipLevel && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black">
                          <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Core Ecosystem</span>
                          <h4 className="font-black text-lg text-gray-900 mt-1">{profile.membershipLevel} Membership ({profile.membershipTier || 'Standard'})</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Status: <span className="font-bold text-green-600 capitalize">{profile.membershipStatus || 'Active'}</span> · 
                            Expires: <span className="font-bold text-gray-700">{profile.membershipExpiresAt ? new Date(profile.membershipExpiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Ongoing'}</span>
                          </p>
                        </div>
                      </div>
                      <span className="px-4 py-2 bg-white border border-orange-200 rounded-xl font-bold text-xs text-orange-600 shadow-xs">
                        Active Plan
                      </span>
                    </div>
                  )}

                  {/* Ecosystem Subscriptions */}
                  {subscriptions.map((sub: any) => (
                    <div key={sub.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-2xl gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center font-black">
                          <PackageOpen className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{sub.type || 'Subscription'}</span>
                          <h4 className="font-black text-lg text-gray-900 mt-1">{sub.itemName}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Billing: <span className="font-bold text-gray-700">{sub.billingCycle || 'Monthly'}</span> · 
                            Rate: <span className="font-bold text-gray-700">£{Number(sub.amount || 0).toFixed(2)}</span> · 
                            Expires: <span className="font-bold text-gray-700">{sub.endDate ? new Date(sub.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Ongoing'}</span>
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold text-xs">
                        {sub.status || 'Active'}
                      </span>
                    </div>
                  ))}

                  {/* Platform Packages */}
                  {packages.map((pkg: any) => (
                    <div key={pkg.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-2xl gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500 text-white flex items-center justify-center font-black">
                          <RefreshCw className="w-6 h-6" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{pkg.platform || pkg.platformName || 'Platform'}</span>
                          <h4 className="font-black text-lg text-gray-900 mt-1">{pkg.packageName}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Status: <span className="font-bold text-green-600 capitalize">{pkg.status || 'Active'}</span> · 
                            Renewal: <span className="font-bold text-gray-700">{pkg.expiresAt ? new Date(pkg.expiresAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '30 Days'}</span>
                          </p>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-bold text-xs">
                        {pkg.status || 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <RefreshCw className="w-10 h-10 text-gray-300 mb-4" />
                  <p className="font-bold text-gray-900">No active subscriptions</p>
                  <p className="text-sm text-gray-400 mt-1 max-w-sm">Your membership and platform subscriptions will appear here automatically.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'methods' && (
          <motion.div key="methods" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Payment Methods</h3>
              </div>
              <div className="p-6 md:p-8">
                <div className="flex items-center gap-4 p-5 bg-gray-50 border border-gray-200 rounded-2xl">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">Secure Payment Gateway</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Payments are processed securely via Stripe and PayPal with bank-grade encryption.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}