import { useState } from 'react';
import { Wallet as WalletIcon, BarChart3, ArrowLeft, RefreshCw, BookOpen } from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { WalletList } from './WalletList';
import { WalletDetail } from './WalletDetail';
import { WalletReports } from './WalletReports';
import { WalletIntegrationModal } from './WalletIntegrationModal';
import { useAdminWallets } from './hooks/useWalletAdmin';

type View =
  | { kind: 'list' }
  | { kind: 'detail'; walletId: string }
  | { kind: 'reports' };

export function WalletPanel() {
  const { admin } = useAdminAuth();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [showGuide, setShowGuide] = useState(false);
  const { refetch, isFetching } = useAdminWallets({});

  if (admin?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-3xl border border-gray-100 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4 shadow-sm">
          <WalletIcon className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg font-display">ADMIN Access Required</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
          Wallet Management is restricted to authorized administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner flex-shrink-0">
            <WalletIcon className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight text-white font-display">Wallet Management</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {view.kind === 'reports'
                ? 'Cross-platform credit/debit volume and reconciliation'
                : view.kind === 'detail'
                  ? 'Wallet balance, holds, transactions, and controls'
                  : 'Every user wallet across the MCOM ecosystem'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {view.kind !== 'list' && (
            <button
              onClick={() => setView({ kind: 'list' })}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-700"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>All Wallets</span>
            </button>
          )}

          <button
            onClick={() => (view.kind === 'reports' ? undefined : setView({ kind: 'reports' }))}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
              view.kind === 'reports'
                ? 'bg-brand-blue text-white border-brand-blue shadow-glow'
                : 'bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white border-gray-700'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Reports</span>
          </button>

          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-700"
            title="Wallet partner integration guide"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Integration Guide</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            className="p-2 bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs transition-colors border border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-brand-blue' : ''}`} />
          </button>
        </div>
      </div>

      {view.kind === 'reports' ? (
        <WalletReports />
      ) : view.kind === 'detail' ? (
        <WalletDetail walletId={view.walletId} onBack={() => setView({ kind: 'list' })} />
      ) : (
        <WalletList onManage={(walletId) => setView({ kind: 'detail', walletId })} />
      )}

      {showGuide && <WalletIntegrationModal onClose={() => setShowGuide(false)} />}
    </div>
  );
}