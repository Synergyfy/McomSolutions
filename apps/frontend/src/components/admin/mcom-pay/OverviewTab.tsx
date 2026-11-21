import { Loader2, RefreshCw, Wallet, Users, HandCoins, TrendingUp } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLedgerOverview, usePlatformWallet } from './hooks/useMcomPayAdmin';
import { formatMinor } from './format';

function Card({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  iconBg,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: any;
  accent: string;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
          <p className={cn('text-2xl font-black mt-1 truncate', accent)}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center border border-gray-100', iconBg)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export function OverviewTab() {
  const { data, isLoading, isFetching, isError, refetch } = useLedgerOverview();
  const { data: platform } = usePlatformWallet();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
        <p className="text-sm font-bold text-red-600">Could not load the ledger overview.</p>
        <button onClick={() => refetch()} className="mt-2 text-xs font-bold text-brand-blue hover:underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Live from the journal · generated {new Date(data.generatedAt).toLocaleTimeString('en-GB')}
        </p>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin text-brand-blue')} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card
          label="Platform wallet"
          value={formatMinor(platform?.balanceMinor ?? data.platformWalletMinor)}
          sub={`lifetime in ${formatMinor(platform?.lifetimeInflowMinor ?? '0')}`}
          icon={Wallet}
          accent="text-emerald-600"
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <Card
          label="User float"
          value={formatMinor(data.userFloatMinor)}
          sub="what we owe wallets"
          icon={Users}
          accent="text-brand-blue"
          iconBg="bg-blue-50 text-brand-blue"
        />
        <Card
          label="Owed to partners"
          value={formatMinor(data.owedToPartnersMinor)}
          sub="app payables not yet paid out"
          icon={HandCoins}
          accent="text-amber-600"
          iconBg="bg-amber-50 text-amber-600"
        />
        <Card
          label="GMV (30d)"
          value={formatMinor(data.gmv30dMinor)}
          sub={`${data.transfersToday.toLocaleString()} transfers today`}
          icon={TrendingUp}
          accent="text-indigo-600"
          iconBg="bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Balance sheet</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Assets</dt>
              <dd className="font-bold text-gray-900">{formatMinor(data.assetsMinor)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Liabilities</dt>
              <dd className="font-bold text-gray-900">{formatMinor(data.liabilitiesMinor)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <dt className="text-gray-500">Equity</dt>
              <dd className="font-bold text-gray-900">{formatMinor(data.equityMinor)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-gray-400">
            Assets must equal liabilities + equity. Any difference is surfaced under Reconciliation.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Platform flow (30d)</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Money in</dt>
              <dd className="font-bold text-emerald-600">{formatMinor(data.inflow30dMinor)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-gray-500">Money out</dt>
              <dd className="font-bold text-rose-600">−{formatMinor(data.outflow30dMinor)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <dt className="text-gray-500">Net</dt>
              <dd className="font-bold text-gray-900">{formatMinor(data.net30dMinor)}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Needs attention</p>
          <div className="mt-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Charges awaiting settlement</span>
              <span
                className={cn(
                  'font-bold',
                  data.chargesAwaitingSettlement > 0 ? 'text-amber-600' : 'text-emerald-600',
                )}
              >
                {data.chargesAwaitingSettlement}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Referral payouts waiting</span>
              <span
                className={cn(
                  'font-bold',
                  (platform?.pendingReferralPayouts ?? 0) > 0 ? 'text-amber-600' : 'text-emerald-600',
                )}
              >
                {platform?.pendingReferralPayouts ?? 0}
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-gray-400">
            Both are retried automatically every 10 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
