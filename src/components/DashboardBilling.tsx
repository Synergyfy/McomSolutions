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
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-1">Billing & Payments</h2>
          <p className="text-gray-500">Your central payment control hub.</p>
        </div>
        <button
          onClick={() => setModal('pay-now')}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-7 py-4 rounded-full font-bold transition-colors shadow-lg shadow-orange-500/20"
        >
          <CreditCard className="w-5 h-5" /> Pay Now
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
          <Wallet className="w-8 h-8 text-orange-200 mb-4" />
          <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Total Spend</p>
          <p className="text-4xl font-black">£{totalSpend.toFixed(0)}</p>
          <p className="text-orange-300 text-xs font-semibold mt-1">Lifetime</p>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-green-500 mb-4" />
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Active Subscriptions</p>
          <p className="text-4xl font-black text-gray-900">{SUBSCRIPTIONS.filter(s => s.status === 'active').length}</p>
          <p className="text-gray-400 text-xs font-semibold mt-1">Auto-renewing</p>
        </div>
        <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
          <Clock className="w-8 h-8 text-amber-500 mb-4" />
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Next Due Date</p>
          <p className="text-4xl font-black text-gray-900">23 Jul</p>
          <p className="text-gray-400 text-xs font-semibold mt-1">2026 · £296/mo total</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-full w-full max-w-lg">
        {[
          { id: 'transactions', label: 'Transactions', icon: Receipt },
          { id: 'subscriptions', label: 'Subscriptions', icon: RefreshCw },
          { id: 'methods', label: 'Payment Methods', icon: CreditCard },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id as any;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full font-bold text-sm transition-all ${
                isActive ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Transactions Tab */}
      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div key="tx" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Transaction History</h3>
                <button className="flex items-center gap-2 text-orange-500 font-bold text-sm hover:underline">
                  <Download className="w-4 h-4" /> Export All
                </button>
              </div>
              <div className="divide-y divide-gray-50">
                {TRANSACTIONS.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-8 py-5 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{tx.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tx.id} · {tx.date}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <StatusBadge status={tx.status} />
                      <span className="font-black text-gray-900">{tx.amount}</span>
                      <button className="p-2 text-gray-300 hover:text-orange-500 transition-colors">
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
            <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Active Subscriptions</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {SUBSCRIPTIONS.map((sub, i) => (
                  <motion.div
                    key={sub.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-4 px-8 py-5 hover:bg-gray-50/70 transition-colors"
                  >
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${sub.status === 'active' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{sub.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">Next charge: {sub.next}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <StatusBadge status={sub.status} />
                      <span className="font-black text-gray-900 min-w-[60px] text-right">{sub.price}</span>
                      <button className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors">
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
            <div className="space-y-4">
              {PAYMENT_METHODS.map((card, i) => (
                <motion.div
                  key={card.last4}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`bg-white rounded-3xl border p-8 flex items-center gap-6 ${card.primary ? 'border-orange-300 shadow-md' : 'border-gray-200'}`}
                >
                  <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg">
                    <CreditCard className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <p className="font-black text-gray-900 text-lg">{card.type} •••• {card.last4}</p>
                      {card.primary && <span className="bg-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">Primary</span>}
                    </div>
                    <p className="text-gray-400 text-sm font-semibold mt-1">Expires {card.expiry}</p>
                  </div>
                  <div className="flex gap-3">
                    {!card.primary && <button className="px-5 py-2.5 rounded-full border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-600 transition-colors">Set Primary</button>}
                    <button className="px-5 py-2.5 rounded-full border border-red-200 hover:bg-red-50 text-sm font-bold text-red-400 transition-colors">Remove</button>
                  </div>
                </motion.div>
              ))}

              {/* Add Card */}
              <button
                onClick={() => setModal('add-card')}
                className="w-full bg-white rounded-3xl border-2 border-dashed border-gray-300 hover:border-orange-400 p-8 flex items-center justify-center gap-3 text-gray-400 hover:text-orange-500 font-bold transition-all"
              >
                <Plus className="w-5 h-5" /> Add New Payment Method
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-10 max-w-md w-full shadow-2xl"
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
