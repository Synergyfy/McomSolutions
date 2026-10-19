import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Check, Info, Loader2, Save, Shield, Sparkles, Star } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useServicePolicy, useUpdateServicePolicy } from './hooks/useConsoleApps';
import type { SetServicePolicyInput } from '../../../services/admin/types';
import ServiceMeshSkillModal from './ServiceMeshSkillModal';

const WILDCARD = '*';

interface PolicyEntry {
  allowedAudiences: string[];
  allowedCallers: string[];
}
type PolicyMap = Record<string, PolicyEntry>;

const egressAllows = (p: PolicyMap, caller: string, target: string) => {
  const list = p[caller]?.allowedAudiences ?? [];
  return list.includes(WILDCARD) || list.includes(target);
};
const ingressAllows = (p: PolicyMap, target: string, caller: string) => {
  const list = p[target]?.allowedCallers ?? [];
  return list.includes(WILDCARD) || list.includes(caller);
};
const edgeAllowed = (p: PolicyMap, caller: string, target: string) =>
  egressAllows(p, caller, target) && ingressAllows(p, target, caller);
const egressWildcard = (p: PolicyMap, id: string) => (p[id]?.allowedAudiences ?? []).includes(WILDCARD);
const ingressWildcard = (p: PolicyMap, id: string) => (p[id]?.allowedCallers ?? []).includes(WILDCARD);

export default function ServiceMeshPolicyPanel({ onBack }: { onBack: () => void }) {
  const { data, isLoading, isError } = useServicePolicy();
  const update = useUpdateServicePolicy();
  const apps = useMemo(() => data?.apps ?? [], [data]);

  const [policy, setPolicy] = useState<PolicyMap>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkillModal, setShowSkillModal] = useState(false);

  useEffect(() => {
    if (!data || dirty) return;
    const next: PolicyMap = {};
    for (const a of data.apps) {
      next[a.clientId] = {
        allowedAudiences: [...a.allowedAudiences],
        allowedCallers: [...a.allowedCallers],
      };
    }
    setPolicy(next);
  }, [data, dirty]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const toggleEdge = (caller: string, target: string) => {
    if (egressWildcard(policy, caller) || ingressWildcard(policy, target)) return;
    setDirty(true);
    setPolicy((prev) => {
      const allowed = edgeAllowed(prev, caller, target);
      const next: PolicyMap = {
        ...prev,
        [caller]: { ...prev[caller] },
        [target]: { ...prev[target] },
      };
      if (allowed) {
        next[caller].allowedAudiences = next[caller].allowedAudiences.filter((x) => x !== target);
        next[target].allowedCallers = next[target].allowedCallers.filter((x) => x !== caller);
      } else {
        next[caller].allowedAudiences = [...new Set([...next[caller].allowedAudiences, target])];
        next[target].allowedCallers = [...new Set([...next[target].allowedCallers, caller])];
      }
      return next;
    });
  };

  const setEgressWildcard = (id: string, on: boolean) => {
    setDirty(true);
    setPolicy((prev) => ({
      ...prev,
      [id]: { ...prev[id], allowedAudiences: on ? [WILDCARD] : [] },
    }));
  };

  const setIngressWildcard = (id: string, on: boolean) => {
    setDirty(true);
    setPolicy((prev) => ({
      ...prev,
      [id]: { ...prev[id], allowedCallers: on ? [WILDCARD] : [] },
    }));
  };

  const handleSave = async () => {
    setError(null);
    const payload: SetServicePolicyInput = {
      apps: apps.map((a) => ({
        clientId: a.clientId,
        allowedAudiences: policy[a.clientId]?.allowedAudiences ?? [],
        allowedCallers: policy[a.clientId]?.allowedCallers ?? [],
      })),
    };
    try {
      await update.mutateAsync(payload);
      setDirty(false);
      setSaved(true);
    } catch (e: any) {
      const status = e?.response?.status;
      setError(
        status === 400
          ? 'Invalid policy — unknown peer, self-reference, or duplicate entry.'
          : 'Failed to save the service policy. Please try again.',
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Apps
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowSkillModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm border border-gray-800"
          >
            <Bot className="w-3.5 h-3.5 text-brand-blue" />
            <span>🤖 Mesh AI Skill & Tester</span>
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold animate-in fade-in">
              <Check className="w-3.5 h-3.5" /> Policy Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={update.isPending || !dirty}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-brand-dark transition-all shadow-glow disabled:opacity-50"
          >
            {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Policy
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-2xl bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue flex-shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm font-display">Service Mesh Policy</h3>
            <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
              Control which registered app backends may call which. <b>Deny by default</b> — a call works only when
              the caller's egress and the target's ingress both permit it. Use <Star className="w-3 h-3 inline text-amber-500" />{' '}
              for "anyone".
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50/60 border border-blue-100 rounded-2xl text-[11px] text-blue-800">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Rows are <b>callers</b>, columns are <b>targets</b>. Ticking a cell sets both sides at once. Wildcard
            (anyone) rows/columns lock their cells.
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading policy…
          </div>
        ) : isError ? (
          <div className="py-10 text-center text-sm text-red-500 font-semibold">
            Failed to load the service policy.
          </div>
        ) : apps.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 font-medium">
            No registered applications yet.
          </div>
        ) : (
          <>
            {/* Per-app wildcard controls */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Wildcard Rules</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {apps.map((a) => (
                  <div
                    key={a.clientId}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-800 truncate">{a.name}</div>
                      <div className="text-[10px] font-mono text-gray-400 truncate">{a.clientId}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <WildcardToggle
                        label="Calls anyone"
                        active={egressWildcard(policy, a.clientId)}
                        onChange={(on) => setEgressWildcard(a.clientId, on)}
                      />
                      <WildcardToggle
                        label="Accepts anyone"
                        active={ingressWildcard(policy, a.clientId)}
                        onChange={(on) => setIngressWildcard(a.clientId, on)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Matrix */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Call Matrix</div>
              <div className="overflow-x-auto border border-gray-100 rounded-2xl">
                <table className="border-collapse text-[10px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-100 px-3 py-2 text-left font-bold text-gray-500 min-w-[160px]">
                        Caller \ Target
                      </th>
                      {apps.map((t) => (
                        <th
                          key={t.clientId}
                          className={cn(
                            'border-b border-gray-100 px-2 py-2 font-bold text-gray-600 min-w-[92px]',
                            ingressWildcard(policy, t.clientId) && 'bg-amber-50',
                          )}
                          title={t.clientId}
                        >
                          <div className="truncate max-w-[88px] mx-auto">{t.clientId}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((caller) => (
                      <tr key={caller.clientId}>
                        <th
                          className={cn(
                            'sticky left-0 z-10 bg-gray-50 border-b border-r border-gray-100 px-3 py-2 text-left font-bold text-gray-700',
                            egressWildcard(policy, caller.clientId) && 'bg-amber-50',
                          )}
                          title={caller.clientId}
                        >
                          <div className="truncate max-w-[150px]">{caller.clientId}</div>
                        </th>
                        {apps.map((target) => {
                          const isSelf = caller.clientId === target.clientId;
                          const locked =
                            egressWildcard(policy, caller.clientId) ||
                            ingressWildcard(policy, target.clientId);
                          const allowed = edgeAllowed(policy, caller.clientId, target.clientId);
                          return (
                            <td key={target.clientId} className="border-b border-gray-100 p-1 text-center">
                              {isSelf ? (
                                <span className="text-gray-300">—</span>
                              ) : locked ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center justify-center w-6 h-6 rounded-lg',
                                    allowed ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-300',
                                  )}
                                  title="Managed by a wildcard rule"
                                >
                                  <Star className="w-3 h-3" />
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleEdge(caller.clientId, target.clientId)}
                                  className={cn(
                                    'inline-flex items-center justify-center w-6 h-6 rounded-lg border transition-all',
                                    allowed
                                      ? 'bg-emerald-500 border-emerald-500 text-white'
                                      : 'bg-white border-gray-200 text-transparent hover:border-emerald-300',
                                  )}
                                  title={
                                    allowed
                                      ? `Disable ${caller.clientId} → ${target.clientId}`
                                      : `Allow ${caller.clientId} → ${target.clientId}`
                                  }
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs font-bold text-red-600">
            {error}
          </div>
        )}
      </div>

      {showSkillModal && (
        <ServiceMeshSkillModal
          apps={apps}
          policy={policy}
          onClose={() => setShowSkillModal(false)}
        />
      )}
    </div>
  );
}

function WildcardToggle({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold transition-all',
        active
          ? 'bg-amber-100 border-amber-300 text-amber-800'
          : 'bg-white border-gray-200 text-gray-400 hover:border-amber-300 hover:text-amber-600',
      )}
      title={label}
    >
      <Star className="w-3 h-3" />
      {label}
    </button>
  );
}
