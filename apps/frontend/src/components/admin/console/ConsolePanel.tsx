import { useState } from 'react';
import {
  AppWindow,
  BookOpen,
  HelpCircle,
  Lock,
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import AppList from './AppList';
import AppDetail from './AppDetail';
import RegisterAppModal from './RegisterAppModal';
import CredentialsSuccess from './CredentialsSuccess';
import ConsoleMetrics from './ConsoleMetrics';
import ConsoleArchitectureModal from './ConsoleArchitectureModal';
import { useConsoleApps } from './hooks/useConsoleApps';
import type { RegisterAppResult } from '../../../services/admin/types';

type View = { kind: 'list' } | { kind: 'detail'; clientId: string };

export default function ConsolePanel() {
  const { admin } = useAdminAuth();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [showRegister, setShowRegister] = useState(false);
  const [showArchGuide, setShowArchGuide] = useState(false);
  const [registered, setRegistered] = useState<RegisterAppResult | null>(null);

  const { data: apps = [], refetch, isFetching } = useConsoleApps();

  if (admin?.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-3xl border border-gray-100 text-center shadow-sm">
        <div className="w-16 h-16 rounded-3xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500 mb-4 shadow-sm">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="font-bold text-gray-900 text-lg font-display">ADMIN Access Required</h3>
        <p className="text-xs text-gray-500 mt-1 max-w-sm leading-relaxed">
          The MCOM Ecosystem Application Console is restricted to authorized super-administrators only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hero Header Bar */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white rounded-3xl p-6 shadow-sm border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center text-brand-blue shadow-inner flex-shrink-0">
            <AppWindow className="w-6 h-6 text-brand-blue" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-black tracking-tight text-white font-display">MCOM Console</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-blue text-white shadow-xs">
                Zero-Downtime Mesh
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Dynamically register, configure, and issue credentials for ecosystem platform integrations.
            </p>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowArchGuide(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-800/90 hover:bg-gray-700 text-gray-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-gray-700"
          >
            <Workflow className="w-3.5 h-3.5 text-brand-blue" />
            <span>Architecture Guide</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh application states"
            className="p-2 bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl text-xs transition-colors border border-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-brand-blue' : ''}`} />
          </button>

          {view.kind === 'list' && (
            <button
              onClick={() => setShowRegister(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow"
            >
              <Plus className="w-4 h-4" /> Register New Application
            </button>
          )}
        </div>
      </div>

      {/* Metrics Counter Bar (List view only) */}
      {view.kind === 'list' && <ConsoleMetrics apps={apps} />}

      {/* Main View Router */}
      {view.kind === 'list' ? (
        <AppList
          onManage={(clientId) => setView({ kind: 'detail', clientId })}
          onRegisterClick={() => setShowRegister(true)}
        />
      ) : (
        <AppDetail
          clientId={view.clientId}
          onBack={() => setView({ kind: 'list' })}
        />
      )}

      {/* Registration Wizard Modal */}
      {showRegister && (
        <RegisterAppModal
          onClose={() => setShowRegister(false)}
          onRegistered={(result) => {
            setShowRegister(false);
            setRegistered(result);
          }}
        />
      )}

      {/* Vault Reveal Modal (One-Time Display) */}
      {registered && (
        <CredentialsSuccess
          result={registered}
          onClose={() => setRegistered(null)}
        />
      )}

      {/* Interactive Architecture Guide Modal */}
      {showArchGuide && (
        <ConsoleArchitectureModal onClose={() => setShowArchGuide(false)} />
      )}

      {/* Footer Assurance Banner */}
      <div className="pt-2 flex items-center justify-between text-xs text-gray-400 px-2">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>AES-256-GCM encrypted HMAC & Webhook storage · One-way Bcrypt client secrets</span>
        </div>
        <button
          onClick={() => setShowArchGuide(true)}
          className="text-[11px] font-bold text-brand-blue hover:underline hidden sm:inline"
        >
          View Integration Specifications →
        </button>
      </div>
    </div>
  );
}