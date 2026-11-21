import { useState } from 'react';
import { BookOpen, CreditCard, LayoutDashboard, LineChart, ShieldAlert, Scale, Wallet, Landmark } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { OverviewTab } from './OverviewTab';
import { TransfersTab } from './TransfersTab';
import { PlatformWalletTab } from './PlatformWalletTab';
import { AccountsTab } from './AccountsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { ReconciliationTab } from './ReconciliationTab';
import { ChargeLedgerPanel } from './McomPayPanel';
import { WalletActivityPanel } from './WalletActivityPanel';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'transfers', label: 'Transfers', icon: BookOpen },
  { id: 'platform', label: 'Platform wallet', icon: Landmark },
  { id: 'accounts', label: 'Accounts', icon: Scale },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'charges', label: 'Charges', icon: CreditCard },
  { id: 'wallet', label: 'Wallet activity', icon: Wallet },
  { id: 'reconciliation', label: 'Reconciliation', icon: ShieldAlert },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function McomPayConsole() {
  const { admin } = useAdminAuth();
  const [tab, setTab] = useState<TabId>('overview');

  if (admin?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-3xl border border-gray-100 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg font-display">ADMIN Access Required</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
          The MCOM Pay ledger is restricted to authorized administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center shadow-inner flex-shrink-0">
            <BookOpen className="w-6 h-6 text-brand-blue" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black tracking-tight font-display">MCOM Pay — Central Ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Every movement of money across the ecosystem: wallet-to-wallet sales, platform sales,
              delegations and referral commissions.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors',
                tab === item.id
                  ? 'bg-brand-blue text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'transfers' && <TransfersTab />}
      {tab === 'platform' && <PlatformWalletTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'analytics' && <AnalyticsTab />}
      {tab === 'charges' && <ChargeLedgerPanel />}
      {tab === 'wallet' && <WalletActivityPanel />}
      {tab === 'reconciliation' && <ReconciliationTab />}
    </div>
  );
}
