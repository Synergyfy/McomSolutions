import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  Flag,
  Loader2,
  MapPin,
  MessageSquare,
  Search,
  Send,
  Star,
  Trophy,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  useAccountManager,
  useNearbyAffiliates,
  usePlatformAccess,
  useRateAffiliate,
  useReassignAccountManager,
  useReportAffiliate,
  useCreateAffiliateTask,
} from '../services/business/hooks';
import type { NearbyAffiliate } from '../services/business';
import { chatApi } from '../services/chat';

const ROLE_LABELS: Record<string, string> = {
  AGENT: 'Affiliate Agent',
  ACCOUNT_MANAGER: 'Account Manager',
  CONSULTANT: 'Consultant',
};

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'ACCOUNT_MANAGER', label: 'Account Managers' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'CONSULTANT', label: 'Consultants' },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <p className="text-sm font-black text-gray-900">{value}</p>
    </div>
  );
}

export default function DashboardAccountManager() {
  const navigate = useNavigate();
  const { data: managerRes, isLoading: managerLoading } = useAccountManager();
  const [roleFilter, setRoleFilter] = useState('');  const { data: nearbyRes, isLoading: nearbyLoading } = useNearbyAffiliates({
    role: roleFilter || undefined,
    limit: 12,
  });
  const { data: accessRes } = usePlatformAccess();
  const rateAffiliate = useRateAffiliate();
  const reportAffiliate = useReportAffiliate();
  const createTask = useCreateAffiliateTask();

  const manager = managerRes?.data ?? null;
  const managerMeta = managerRes?.meta ?? null;
  const reassignAccountManager = useReassignAccountManager();
  const affiliates: NearbyAffiliate[] = nearbyRes?.items ?? [];
  const platforms = accessRes?.data?.platforms ?? [];

  const [ratingFor, setRatingFor] = useState<NearbyAffiliate | null>(null);
  const [reportFor, setReportFor] = useState<NearbyAffiliate | null>(null);
  const [delegateFor, setDelegateFor] = useState<NearbyAffiliate | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reportReason, setReportReason] = useState('');
  const [reportText, setReportText] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPlatforms, setTaskPlatforms] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const managerAffiliate = useMemo<NearbyAffiliate | null>(() => {
    if (!manager) return null;
    return {
      userId: manager.userId,
      profileId: manager.profileId,
      name: manager.name,
      email: manager.email,
      role: 'ACCOUNT_MANAGER',
      specialisation: null,
      postcode: manager.postcode,
      reputationScore: manager.reputationScore,
      experienceScore: manager.experienceScore,
      completedTasksCount: manager.completedTasksCount,
      assignedBusinesses: 0,
      proximity: {
        matchedLevel: manager.matchedLevel ?? 'national',
        score: manager.proximityScore ?? 0,
        breakdown: {},
      },
    };
  }, [manager]);

  const openChat = async (userId: string) => {
    try {
      const conversation = await chatApi.getOrCreateDirect(userId);
      navigate(`/dashboard/messages?conversationId=${conversation.id}`);
    } catch {
      navigate('/dashboard/messages');
    }
  };

  const submitRating = async () => {
    if (!ratingFor) return;
    await rateAffiliate.mutateAsync({ userId: ratingFor.userId, data: { rating, comment } });
    setFeedback(`Thanks — your ${rating}/5 rating was saved.`);
    setRatingFor(null);
    setComment('');
    setRating(5);
  };

  const submitReport = async () => {
    if (!reportFor) return;
    await reportAffiliate.mutateAsync({
      userId: reportFor.userId,
      data: { reason: reportReason, description: reportText },
    });
    setFeedback('Report submitted. Our team will review it before any reputation change.');
    setReportFor(null);
    setReportReason('');
    setReportText('');
  };

  const submitDelegation = async () => {
    if (!delegateFor || !taskTitle.trim() || !taskDescription.trim()) return;
    await createTask.mutateAsync({
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      platforms: taskPlatforms,
      assigneeUserId: delegateFor.userId,
    });
    setFeedback('Task delegated. Track its progress in Task Delegation.');
    setDelegateFor(null);
    setTaskTitle('');
    setTaskDescription('');
    setTaskPlatforms([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Account Manager</h1>
          <p className="text-sm text-gray-500 font-medium">
            Your dedicated manager is matched by postcode proximity and reputation.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/tasks')}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-dark transition-colors"
        >
          <Send className="w-4 h-4" /> Task delegation
        </button>
      </div>

      {feedback && (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 flex items-start justify-between gap-3">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {feedback}</span>
          <button onClick={() => setFeedback(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {managerLoading ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-10 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
        </div>
      ) : manager ? (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <UserCog className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-gray-900">{manager.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-blue/10 text-brand-blue text-[10px] font-black uppercase tracking-widest">
                    Account Manager
                  </span>
                </div>
                <p className="text-sm text-gray-500 font-medium">{manager.email}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5" />
                  {manager.postcode || 'Covering your area'}
                  {manager.matchedLevel && (
                    <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                      {manager.matchedLevel.replace('_', ' ')}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => openChat(manager.userId)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-dark transition-colors"
              >
                <MessageSquare className="w-4 h-4" /> Message
              </button>
              <button
                onClick={() => managerAffiliate && setRatingFor(managerAffiliate)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Star className="w-4 h-4" /> Rate
              </button>
              <button
                onClick={() => managerAffiliate && setReportFor(managerAffiliate)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
              >
                <Flag className="w-4 h-4" /> Report
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Reputation" value={manager.reputationScore} />
            <Stat label="Experience" value={manager.experienceScore} />
            <Stat label="Tasks done" value={manager.completedTasksCount} />
            <Stat
              label="Rating"
              value={manager.ratingAverage != null ? `${manager.ratingAverage.toFixed(1)} / 5` : '—'}
            />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <UserCog className="w-10 h-10 text-gray-300 mx-auto" />
          <h2 className="mt-3 text-lg font-black text-gray-900">No account manager yet</h2>
          <p className="mt-1 text-sm text-gray-500 font-medium max-w-xl mx-auto">
            {managerMeta?.assignable
              ? 'Your paid membership includes a dedicated account manager. Assign one now using proximity matching.'
              : "Trial and access-pass plans don't include a dedicated account manager, but you can still delegate a task to a nearby agent or consultant."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {managerMeta?.assignable ? (
              <button
                onClick={async () => {
                  try {
                    await reassignAccountManager.mutateAsync();
                  } catch (err: any) {
                    setFeedback(
                      err?.response?.data?.message ||
                        'Could not assign an account manager right now.',
                    );
                  }
                }}
                disabled={reassignAccountManager.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {reassignAccountManager.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCog className="w-4 h-4" />
                )}
                Assign my account manager now
              </button>
            ) : null}
            <button
              onClick={() => navigate('/dashboard/tasks')}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <Send className="w-4 h-4" /> Delegate a task instead
            </button>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-blue" /> Affiliates near you
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Ranked by postcode proximity, reputation score and completed-task experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setRoleFilter(filter.value)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors',
                  roleFilter === filter.value
                    ? 'bg-brand-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {nearbyLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-blue" />
          </div>
        ) : affiliates.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No affiliates found for this filter yet.
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {affiliates.map((affiliate) => (
              <div key={affiliate.userId} className="rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-gray-900">{affiliate.name}</p>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-brand-blue">
                      {ROLE_LABELS[affiliate.role] ?? affiliate.role}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-500">
                    {affiliate.proximity.matchedLevel.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {affiliate.postcode || 'Area not set'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2 py-1">
                    <Trophy className="w-3 h-3" /> {affiliate.reputationScore} rep
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2 py-1">
                    <Award className="w-3 h-3" /> {affiliate.completedTasksCount} done
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 px-2 py-1">
                    Score {Math.round(affiliate.proximity.score)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => openChat(affiliate.userId)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-2 py-2 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </button>
                  <button
                    onClick={() => setDelegateFor(affiliate)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-blue px-2 py-2 text-[11px] font-bold text-white hover:bg-brand-dark"
                  >
                    <Send className="w-3.5 h-3.5" /> Delegate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate modal */}
      {ratingFor && (
        <Modal title={`Rate ${ratingFor.name}`} onClose={() => setRatingFor(null)}>
          <div className="flex items-center justify-center gap-1 py-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} onClick={() => setRating(value)} type="button">
                <Star
                  className={cn(
                    'w-8 h-8 transition-colors',
                    value <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300',
                  )}
                />
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What went well?"
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <ModalActions
            onCancel={() => setRatingFor(null)}
            onSubmit={submitRating}
            submitLabel="Save rating"
            busy={rateAffiliate.isPending}
          />
        </Modal>
      )}

      {/* Report modal */}
      {reportFor && (
        <Modal title={`Report ${reportFor.name}`} onClose={() => setReportFor(null)}>
          <p className="text-xs text-gray-500 mb-2">
            Reports are reviewed by an admin. Reputation only changes once a report is marked valid.
          </p>
          <input
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Reason (e.g. unprofessional communication)"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <textarea
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
            placeholder="What happened?"
            rows={4}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <ModalActions
            onCancel={() => setReportFor(null)}
            onSubmit={submitReport}
            submitLabel="Submit report"
            busy={reportAffiliate.isPending}
            danger
            disabled={!reportReason.trim() || reportText.trim().length < 5}
          />
        </Modal>
      )}

      {/* Delegate modal */}
      {delegateFor && (
        <Modal title={`Delegate a task to ${delegateFor.name}`} onClose={() => setDelegateFor(null)}>
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <textarea
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Describe exactly what needs doing"
            rows={4}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
          <div>
            <p className="text-[11px] font-bold text-gray-700 mb-1.5">Platforms</p>
            <div className="flex flex-wrap gap-1.5">
              {platforms.length === 0 && (
                <span className="text-xs text-gray-400">No platform access detected.</span>
              )}
              {platforms.map((platform) => {
                const active = taskPlatforms.includes(platform.key);
                return (
                  <button
                    key={platform.key}
                    type="button"
                    onClick={() =>
                      setTaskPlatforms((prev) =>
                        active ? prev.filter((p) => p !== platform.key) : [...prev, platform.key],
                      )
                    }
                    className={cn(
                      'rounded-full px-3 py-1.5 text-[11px] font-bold border transition-colors',
                      active
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                    )}
                  >
                    {platform.name}
                  </button>
                );
              })}
            </div>
          </div>
          <ModalActions
            onCancel={() => setDelegateFor(null)}
            onSubmit={submitDelegation}
            submitLabel="Delegate task"
            busy={createTask.isPending}
            disabled={!taskTitle.trim() || !taskDescription.trim()}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onSubmit,
  submitLabel,
  busy,
  danger,
  disabled,
}: {
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  busy?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={busy || disabled}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50',
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-blue hover:bg-brand-dark',
        )}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
