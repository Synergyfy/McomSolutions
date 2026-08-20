import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Download, RefreshCw, CheckCircle2,
  Clock, AlertCircle, Receipt, FileText, Wallet,
  Plus, ChevronRight, ArrowUpRight, X, Shield
} from 'lucide-react';

const TRANSACTIONS = [
  { id: 'INV-0023', date: '23 Jun 2026', description: 'Silver Membership Renewal', amount: '£99.00', status: 'paid' },
  { id: 'INV-0022', date: '23 Jun 2026', description: 'MCOM Mall – Standard Package', amount: '£99.00', status: 'paid' },
  { id: 'INV-0021', date: '23 May 2026', description: 'MCOM Rewards – Standard Package', amount: '£79.00', status: 'paid' },
  { id: 'INV-0020', date: '23 May 2026', description: 'MCOM Spin – Starter Package', amount: '£19.00', status: 'paid' },
  { id: 'INV-0019', date: '1 Jun 2026', description: '247GBS Audit – Starter (Expired)', amount: '£99.00', status: 'refunded' },
  { id: 'INV-0018', date: '23 Apr 2026', description: 'Silver Membership Charge', amount: '£99.00', status: 'paid' },
  { id: 'INV-0017', date: '15 Apr 2026', description: 'MCOM Mall – Starter Package', amount: '£39.00', status: 'paid' },
];

const SUBSCRIPTIONS = [
  { name: 'Silver Membership', price: '£99/mo', status: 'active', next: '23 Jul 2026' },
  { name: 'MCOM Rewards – Standard', price: '£79/mo', status: 'active', next: '23 Jul 2026' },
  { name: 'MCOM Spin – Starter', price: '£19/mo', status: 'active', next: '23 Jul 2026' },
  { name: 'MCOM Mall – Standard', price: '£99/mo', status: 'active', next: '23 Jul 2026' },
  { name: '247GBS Expo – Standard', price: '£149/mo', status: 'pending', next: '1 Jul 2026' },
];

const PAYMENT_METHODS = [
  { type: 'Visa', last4: '4242', expiry: '08/28', primary: true },
  { type: 'Mastercard', last4: '5510', expiry: '11/26', primary: false },
];

type ModalType = 'add-card' | 'pay-now' | null;

const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    refunded: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    overdue: 'bg-red-100 text-red-600',
    active: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${config[status] || 'bg-gray-100 text-gray-500'}`}>
      {status}
    </span>
  );
};

export default function DashboardBilling() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'subscriptions' | 'methods'>('transactions');
  const [modal, setModal] = useState<ModalType>(null);

  const totalSpend = TRANSACTIONS.filter(t => t.status === 'paid')
    .reduce((sum, t) => sum + parseFloat(t.amount.replace('£', '')), 0);

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 leading-tight">Billing & Payments</h2>
          <p className="text-sm sm:text-base text-gray-500 leading-tight">Your central payment control hub.</p>
        </div>
        <button
          onClick={() => setModal('pay-now')}
          className="w-full sm:w-auto justify-center flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 sm:px-7 sm:py-3.5 rounded-full font-bold text-sm sm:text-base transition-colors shadow-lg shadow-orange-500/20 shrink-0"
        >
          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" /> Pay Now
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200 mb-3 sm:mb-4" />
          <p className="text-orange-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Total Spend</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black">£{totalSpend.toFixed(0)}</p>
          <p className="text-orange-300 text-[11px] sm:text-xs font-semibold mt-1">Lifetime</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Active Subscriptions</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">{SUBSCRIPTIONS.filter(s => s.status === 'active').length}</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">Auto-renewing</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Next Due Date</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">23 Jul</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">2026 · £296/mo total</p>
        </div>
      </div>

      {/* Tab Navigation - native pill control */}
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

      {/* Transactions Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div key="tx" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Transaction History</h3>
                <button className="flex items-center gap-1.5 text-orange-500 font-bold text-xs sm:text-sm hover:underline shrink-0 whitespace-nowrap">
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export All</span><span className="sm:hidden">Export</span>
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {TRANSACTIONS.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-2.5 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] sm:text-sm leading-tight line-clamp-2">{tx.description}</p>
                      <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">{tx.id} · {tx.date}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
                      <span className="hidden sm:inline-flex"><StatusBadge status={tx.status} /></span>
                      <span className="font-black text-gray-900 text-sm sm:text-base whitespace-nowrap">{tx.amount}</span>
                      <button className="hidden sm:flex p-2 text-gray-300 hover:text-orange-500 transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Subscriptions Tab */}
        {activeTab === 'subscriptions' && (
          <motion.div key="subs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Active Subscriptions</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {SUBSCRIPTIONS.map((sub, i) => (
                  <motion.div
                    key={sub.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-2.5 sm:gap-3 md:gap-4 px-3 sm:px-4 md:px-8 py-3 sm:py-4 md:py-5 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${sub.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] sm:text-sm leading-tight line-clamp-2">{sub.name}</p>
                      <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">Next: {sub.next}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-shrink-0">
                      <span className="hidden sm:inline-flex"><StatusBadge status={sub.status} /></span>
                      <span className="font-black text-gray-900 text-sm sm:text-base min-w-[56px] sm:min-w-[60px] text-right whitespace-nowrap">{sub.price}</span>
                      <button className="hidden sm:flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors whitespace-nowrap">
                        Manage <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Payment Methods Tab */}
        {activeTab === 'methods' && (
          <motion.div key="methods" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="space-y-3 sm:space-y-4">
              {PAYMENT_METHODS.map((card, i) => (
                <motion.div
                  key={card.last4}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`bg-white rounded-2xl sm:rounded-3xl border p-4 sm:p-5 md:p-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 ${card.primary ? 'border-orange-300 shadow-md' : 'border-gray-200'}`}
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-900 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <CreditCard className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-gray-900 text-base sm:text-lg leading-tight">{card.type} •••• {card.last4}</p>
                      {card.primary && <span className="bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full leading-none">Primary</span>}
                    </div>
                    <p className="text-gray-400 text-xs sm:text-sm font-semibold mt-1">Expires {card.expiry}</p>
                  </div>
                  <div className="flex gap-2 sm:gap-3 shrink-0">
                    {!card.primary && <button className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-full border border-gray-200 hover:bg-gray-50 text-xs sm:text-sm font-bold text-gray-600 transition-colors whitespace-nowrap">Set Primary</button>}
                    <button className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-full border border-red-200 hover:bg-red-50 text-xs sm:text-sm font-bold text-red-400 transition-colors whitespace-nowrap">Remove</button>
                  </div>
                </motion.div>
              ))}

              {/* Add Card */}
              <button
                onClick={() => setModal('add-card')}
                className="w-full bg-white rounded-2xl sm:rounded-3xl border-2 border-dashed border-gray-300 hover:border-orange-400 p-5 sm:p-8 flex items-center justify-center gap-2 sm:gap-3 text-gray-400 hover:text-orange-500 font-bold text-sm sm:text-base transition-all"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add New Payment Method
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-10 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {modal === 'pay-now' && (
                <>
                  <CreditCard className="w-12 h-12 text-orange-500 mb-5" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Pay Outstanding Balance</h3>
                  <p className="text-gray-500 mb-6">Review and pay any outstanding invoices on your account.</p>
                  <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-200 space-y-3">
                    <div className="flex justify-between text-sm font-bold"><span className="text-gray-500">No outstanding balance</span><span className="text-green-600">£0.00</span></div>
                  </div>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors">All Clear ✓</button>
                </>
              )}
              {modal === 'add-card' && (
                <>
                  <Shield className="w-12 h-12 text-orange-500 mb-5" />
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Add Payment Method</h3>
                  <p className="text-gray-500 mb-6">Your payment details are secured with 256-bit encryption.</p>
                  <div className="space-y-4 mb-8">
                    <input className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm" placeholder="Card Number" />
                    <div className="grid grid-cols-2 gap-4">
                      <input className="bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm" placeholder="MM / YY" />
                      <input className="bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm" placeholder="CVC" />
                    </div>
                    <input className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm" placeholder="Cardholder Name" />
                  </div>
                  <button onClick={() => setModal(null)} className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors">Save Card Securely</button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
