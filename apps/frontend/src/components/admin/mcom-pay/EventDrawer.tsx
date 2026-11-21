import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useLedgerEvent } from './hooks/useMcomPayAdmin';
import { formatDate, formatMinor, intentLabel, intentStyle } from './format';
import type { LedgerParty } from './api/mcom-pay-admin.api';

function PartyBlock({
  title,
  parties,
  tone,
}: {
  title: string;
  parties: LedgerParty[];
  tone: 'debit' | 'credit';
}) {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <div
        className={cn(
          'px-4 py-2 text-[10px] font-bold uppercase tracking-widest',
          tone === 'debit' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
        )}
      >
        {title}
      </div>
      <div className="divide-y divide-gray-50">
        {parties.length === 0 && <div className="px-4 py-3 text-xs text-gray-400">—</div>}
        {parties.map((party) => (
          <div key={party.account} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-gray-900">{party.label}</span>
              <span className={cn('text-xs font-black', tone === 'debit' ? 'text-rose-600' : 'text-emerald-600')}>
                {formatMinor(party.amountMinor)}
              </span>
            </div>
            <div className="font-mono text-[10px] text-gray-400 break-all mt-0.5">{party.account}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function providerLabel(payer: { method: string; provider: string | null }) {
  if (payer.method === 'wallet') return 'MCOM Wallet';
  const provider = payer.provider ?? payer.method;
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Show the arithmetic, not just the result: rates change and fees must stay explainable. */
function feeExplanation(charge: {
  amountMinor: string;
  feeMinor: string;
  feeConfig: { feePercent: string | null; feeFixedMinor: string | null };
  currentFeeConfig: { feePercent: string; feeFixedMinor: string; source: string };
}) {
  const fee = formatMinor(charge.feeMinor);
  const snapshot = charge.feeConfig.feePercent;
  const usingCurrent = snapshot == null;

  const percentValue = Number(snapshot ?? charge.currentFeeConfig.feePercent);
  const fixedValue = Number(charge.feeConfig.feeFixedMinor ?? charge.currentFeeConfig.feeFixedMinor);

  const percent = (percentValue * 100).toFixed(2).replace(/\.?0+$/, '');
  const percentAmount = formatMinor(Math.round(Number(charge.amountMinor) * percentValue));
  const formula = `${fee} = ${percent}% × ${formatMinor(charge.amountMinor)} (${percentAmount}) + ${formatMinor(fixedValue)} fixed`;

  return usingCurrent
    ? `${formula} — shown with the app's current rate; this charge did not record the rate applied`
    : formula;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-[11px] text-gray-800 break-words">{value}</p>
    </div>
  );
}

export function EventDrawer({ eventKey, onClose }: { eventKey: string; onClose: () => void }) {
  const { data, isLoading, isError } = useLedgerEvent(eventKey);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl h-full bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ledger entry</p>
            <p className="font-mono text-[11px] text-gray-700 truncate">{eventKey}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isError || !data ? (
            <p className="text-sm font-bold text-red-600 py-10 text-center">Could not load this entry.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-bold border', intentStyle(data.primaryIntent))}>
                  {intentLabel(data.primaryIntent)}
                </span>
                <span className="text-[11px] text-gray-500">{formatDate(data.createdAt)}</span>
                {data.platformIds.map((platform) => (
                  <span key={platform} className="text-[11px] font-mono text-gray-500">
                    {platform}
                  </span>
                ))}
              </div>

              {data.descriptions.length > 0 && (
                <p className="text-xs text-gray-600">{data.descriptions.join(' · ')}</p>
              )}

              {data.payer && (
                <div
                  className={cn(
                    'rounded-2xl border p-4',
                    data.payer.identified ? 'border-gray-100' : 'border-gray-100 bg-gray-50',
                  )}
                >
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Paid by</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">
                    {data.payer.identified && data.payer.name
                      ? data.payer.name
                      : data.payer.mcomUserId
                        ? `MCOM user ${data.payer.mcomUserId}`
                        : data.payer.method === 'wallet'
                          ? 'Wallet holder'
                          : 'Unidentified buyer'}
                    <span className="ml-2 text-[11px] font-normal text-gray-500">
                      via {providerLabel(data.payer)}
                    </span>
                  </p>
                  {data.payer.email && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{data.payer.email}</p>
                  )}

                  {!data.payer.identified && data.payer.mcomUserId && (
                    <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                      The charge carried the Central Hub user id {data.payer.mcomUserId}, but no such user exists.
                    </p>
                  )}

                  {!data.payer.identified && !data.payer.mcomUserId && (
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                      This legacy charge was sent without a Central Hub user id, so the buyer cannot be named.
                      Guest payments are no longer accepted — new charges without an MCOM identity are rejected.
                      {data.payer.appCustomerRef ? (
                        <>
                          {' '}The app&apos;s own customer reference was{' '}
                          <span className="font-mono">{data.payer.appCustomerRef}</span> (not a CHS identity).
                        </>
                      ) : null}
                    </p>
                  )}
                </div>
              )}

              {data.noPayee === true && data.charge && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-800">No payee was specified</p>
                  <p className="text-[11px] text-amber-800/90 mt-1 leading-relaxed">
                    The charge sent no <code className="font-mono">splits</code>, so the net{' '}
                    <b>{formatMinor(data.charge.netMinor)}</b> accrued to{' '}
                    <b>
                      {data.credits.find((party) => party.account.startsWith('payable:app:'))?.label ??
                        data.charge.appClientId}
                    </b>{' '}
                    as an app payable — not to a seller&apos;s wallet. It will not reach a seller until the app
                    sends <code className="font-mono">payeeUserId</code> with the charge.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <PartyBlock title="Debited" parties={data.debits} tone="debit" />
                <PartyBlock title="Credited" parties={data.credits} tone="credit" />
              </div>

              {data.charge && (
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Charge
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Field label="Gross" value={formatMinor(data.charge.amountMinor)} />
                      <Field label="Fee" value={formatMinor(data.charge.feeMinor)} />
                      <Field label="Net" value={formatMinor(data.charge.netMinor)} />
                      <Field label="Refunded" value={formatMinor(data.charge.refundedMinor)} />
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fee</p>
                      <p className="text-[11px] text-gray-800">{feeExplanation(data.charge)}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <Field label="Method" value={data.charge.method} />
                      <Field label="Status" value={data.charge.status} />
                      <Field label="Settlement" value={data.charge.settlementState} />
                      <Field label="Payer (MCOM user)" value={data.charge.mcomUserId ?? '—'} />
                      <Field label="Provider ref" value={data.charge.providerRef ?? '—'} />
                      <Field label="Charge id" value={data.charge.id} />
                    </div>

                    {data.charge.splits.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                          Payee splits
                        </p>
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="text-[9px] text-gray-400 uppercase tracking-widest border-b border-gray-100">
                              <th className="py-1.5">Payee</th>
                              <th className="py-1.5 text-right">Gross</th>
                              <th className="py-1.5 text-right">Fee</th>
                              <th className="py-1.5 text-right">Net</th>
                              <th className="py-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.charge.splits.map((split) => (
                              <tr key={split.id} className="border-b border-gray-50 last:border-0">
                                <td className="py-1.5 font-mono text-[10px] text-gray-700">
                                  {split.payeeUserId ?? split.payeeExternalId ?? split.payeeType}
                                </td>
                                <td className="py-1.5 text-right">{formatMinor(split.amountMinor)}</td>
                                <td className="py-1.5 text-right">{formatMinor(split.feeMinor)}</td>
                                <td className="py-1.5 text-right font-bold">{formatMinor(split.netMinor)}</td>
                                <td className="py-1.5">
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 rounded text-[9px] font-bold uppercase',
                                      split.status === 'credited'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : split.status === 'failed'
                                          ? 'bg-rose-50 text-rose-600'
                                          : 'bg-amber-50 text-amber-700',
                                    )}
                                  >
                                    {split.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {data.walletTransactions.length > 0 && (
                <div className="rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Wallet receipts
                  </div>
                  <div className="divide-y divide-gray-50">
                    {data.walletTransactions.map((txn) => (
                      <div key={txn.id} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-xs font-bold text-gray-900">
                            {txn.userName ?? 'Wallet'}
                            <span className="ml-2 text-[10px] font-normal text-gray-400">{txn.userEmail ?? ''}</span>
                          </span>
                          <span
                            className={cn(
                              'text-xs font-black',
                              txn.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600',
                            )}
                          >
                            {txn.type === 'CREDIT' ? '+' : '−'}
                            {Number(txn.amount).toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          balance {Number(txn.balanceBefore).toFixed(2)} → {Number(txn.balanceAfter).toFixed(2)} ·{' '}
                          {txn.category} · {txn.status}
                        </div>
                        <div className="font-mono text-[10px] text-gray-400 break-all">{txn.id}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Journal — {data.transfers.length} transfer{data.transfers.length === 1 ? '' : 's'}
                </p>
                {data.transfers.map((transfer) => (
                  <div key={transfer.id} className="rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                      <span className={cn('px-2 py-0.5 rounded text-[9px] font-bold border', intentStyle(transfer.intent))}>
                        {intentLabel(transfer.intent)}
                      </span>
                      <span className="text-[10px] text-gray-500">{formatDate(transfer.createdAt)}</span>
                    </div>
                    <div className="px-4 py-2 grid grid-cols-1 sm:grid-cols-2 gap-2 border-b border-gray-50">
                      <Field label="Transfer id" value={transfer.id} />
                      <Field label="Idempotency key" value={transfer.idempotencyKey} />
                      <Field
                        label="Initiated by"
                        value={`${transfer.initiatorType}${transfer.initiatorId ? ` · ${transfer.initiatorId}` : ''}`}
                      />
                      <Field label="Platform" value={transfer.platformId ?? '—'} />
                    </div>

                    {transfer.steps.map((step, index) => (
                      <div key={step.id}>
                        <div className="px-4 py-1.5 bg-white text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          Step {index + 1} · {formatMinor(step.amountMinor, step.currency)} · {step.status}
                        </div>
                        <table className="w-full text-left">
                          <tbody>
                            {step.entries.map((entry) => (
                              <tr key={entry.id} className="border-t border-gray-50">
                                <td className="px-4 py-2">
                                  <div className="text-[11px] font-semibold text-gray-800">{entry.accountLabel}</div>
                                  <div className="font-mono text-[10px] text-gray-400 break-all">{entry.account}</div>
                                </td>
                                <td className="px-4 py-2 w-24">
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 rounded text-[9px] font-bold uppercase',
                                      entry.direction === 'debit'
                                        ? 'bg-rose-50 text-rose-600'
                                        : 'bg-emerald-50 text-emerald-700',
                                    )}
                                  >
                                    {entry.direction}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-xs font-bold text-gray-900 w-28">
                                  {formatMinor(entry.amountMinor, entry.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-gray-400">
            Entries are append-only. Corrections are new reversing entries, never edits.
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </div>
    </div>
  );
}
