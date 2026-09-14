import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard, Download, RefreshCw, CheckCircle2,
  Clock, Receipt, FileText, Wallet,
  ArrowUpRight
} from 'lucide-react';

export default function DashboardBilling() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'subscriptions' | 'methods'>('transactions');

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 leading-tight">Billing & Payments</h2>
          <p className="text-sm sm:text-base text-gray-500 leading-tight">Your central payment control hub.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 text-white shadow-xl shadow-orange-500/20 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <Wallet className="w-6 h-6 sm:w-8 sm:h-8 text-orange-200 mb-3 sm:mb-4" />
          <p className="text-orange-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Total Spend</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black">£0</p>
          <p className="text-orange-300 text-[11px] sm:text-xs font-semibold mt-1">Lifetime</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Active Subscriptions</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">0</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">Auto-renewing</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 md:p-8 border border-gray-200 shadow-sm">
          <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-amber-500 mb-3 sm:mb-4" />
          <p className="text-gray-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">Next Due Date</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">—</p>
          <p className="text-gray-400 text-[11px] sm:text-xs font-semibold mt-1">No pending dues</p>
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

      {/* Empty states — billing data will be wired to the payments API */}
      <AnimatePresence mode="wait">
        {activeTab === 'transactions' && (
          <motion.div key="tx" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100 flex items-center justify-between gap-3">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">Transaction History</h3>
                <button className="flex items-center gap-1.5 text-orange-500 font-bold text-xs sm:text-sm hover:underline shrink-0 whitespace-nowrap" disabled>
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Export All</span><span className="sm:hidden">Export</span>
                </button>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <FileText className="w-10 h-10 text-gray-300 mb-4" />
                <p className="font-bold text-gray-900">No transactions yet</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm">Your invoices and payment history will appear here.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'subscriptions' && (
          <motion.div key="subs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Active Subscriptions</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <RefreshCw className="w-10 h-10 text-gray-300 mb-4" />
                <p className="font-bold text-gray-900">No active subscriptions</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm">Your membership and platform subscriptions will appear here.</p>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'methods' && (
          <motion.div key="methods" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="bg-white rounded-2xl sm:rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 sm:p-5 md:p-8 border-b border-gray-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Payment Methods</h3>
              </div>
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <CreditCard className="w-10 h-10 text-gray-300 mb-4" />
                <p className="font-bold text-gray-900">No saved payment methods</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm flex items-center gap-1.5">
                  Add a card at checkout. Card management is coming soon. <ArrowUpRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}