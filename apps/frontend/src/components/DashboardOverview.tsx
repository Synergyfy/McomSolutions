import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, ArrowRight, X,
  Users, FileSearch,
  User, HeadphonesIcon, Calendar, ChevronRight, AlertCircle,
  BarChart3, Heart, Lock, Sparkles, Play, RotateCcw, ExternalLink, Briefcase
} from 'lucide-react';
import {
  PROGRAMME_PHASES, getPhaseForDay, getProgrammeDay,
  getTaskStatus, setTaskStatus, TaskStatus
} from '../lib/programmeData';
import type { ProgrammeMission } from '../lib/programmeData';
import { useMyTasks, useStartMyTask, useCompleteMyTask, useMyProgramme, useCompleteMission, useProgrammePhases, useUploadBusinessFile } from '../services/business/hooks';
import ProgrammeCountdown from './ProgrammeCountdown';
import ProgrammeTaskRow from './ProgrammeTaskRow';
import ProgrammeTaskGroup from './ProgrammeTaskGroup';
import { resolveProgrammeTimeline } from '../lib/programmeTimeline';
import { groupProgrammeTasks } from '../lib/programmeTaskGroups';

function TaskStartModal({
  mission,
  open,
  onClose,
  onStart,
  onCancel,
  onSubmit,
  onUploadImage,
  onOpenLink,
}: {
  mission: any;
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  onCancel: () => void;
  onSubmit?: (submissionData: Record<string, unknown>) => Promise<void> | void;
  onUploadImage?: (file: File) => Promise<string>;
  onOpenLink?: () => void;
}) {
  const [value, setValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkOpened, setLinkOpened] = useState(false);

  const submissionType = String(mission?.submissionType || '').toLowerCase();
  const actionUrl = mission?.actionUrl || '';
  const requiresSubmission = ['external_link', 'text_input', 'digit_input', 'image_upload'].includes(submissionType);
  const linkTask = submissionType === 'external_link' && !!actionUrl;

  useEffect(() => {
    setValue('');
    setFile(null);
    setError(null);
    setSubmitting(false);
    setLinkOpened(false);
  }, [mission?.id, open]);

  if (!open || !mission) return null;

  const openActionLink = () => {
    if (!actionUrl) return;
    window.open(actionUrl, '_blank', 'noopener,noreferrer');
    setLinkOpened(true);
    onOpenLink?.();
  };

  const handleSubmit = async () => {
    setError(null);
    if (!onSubmit) return;
    setSubmitting(true);
    try {
      if (submissionType === 'image_upload') {
        if (!file) {
          setError('Choose an image to upload.');
          return;
        }
        if (!onUploadImage) {
          setError('Image upload is unavailable right now.');
          return;
        }
        const imageUrl = await onUploadImage(file);
        await onSubmit({ imageUrl });
        return;
      }

      if (linkTask) {
        if (!linkOpened) {
          setError('Open the link first, then mark this task complete.');
          return;
        }
        await onSubmit({ actionUrl, openedAt: new Date().toISOString() });
        return;
      }

      const trimmed = value.trim();
      if (!trimmed) {
        setError(
          submissionType === 'external_link'
            ? 'Paste the link before submitting.'
            : submissionType === 'digit_input'
              ? 'Enter the requested digits.'
              : 'Enter the requested text.',
        );
        return;
      }
      if (submissionType === 'external_link') {
        try {
          const url = new URL(trimmed);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid');
        } catch {
          setError('Enter a valid http(s) link.');
          return;
        }
      }
      if (submissionType === 'digit_input' && !/^\d+$/.test(trimmed)) {
        setError('Only digits are allowed.');
        return;
      }
      await onSubmit({ value: trimmed });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Could not submit this task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] max-h-[90dvh] overflow-hidden flex flex-col"
      >
        <div className="flex items-start gap-3 sm:gap-4 px-4 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
            <Play className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight break-words">{mission.title}</h3>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {mission.estimatedMinutes ? `${mission.estimatedMinutes} · ` : ''}{mission.reward}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto">
          {mission.instructions || mission.description ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Instructions</label>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{mission.instructions || mission.description}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No instructions provided for this task.</p>
          )}

          {mission.featureKey && (
            <div className="bg-amber-50 border border-amber-200/70 rounded-xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800">Automated Reward Verification</p>
                <p className="text-xs text-amber-700 mt-1">
                  Once started, you will be directed to the corresponding section. When you complete the action, our background workers will automatically mark it done and deposit your points!
                </p>
              </div>
            </div>
          )}

          {submissionType === 'external_link' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-700">{linkTask ? 'Open the link to complete this task' : 'External Task'}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {linkTask
                    ? 'Open the link below, complete the step on that page, then come back here and click Submit & Complete.'
                    : 'This task is completed on an external platform. After you finish, come back here and click "Mark Complete" to confirm completion and claim your reward.'}
                </p>
              </div>
            </div>
          )}

          {submissionType === 'image_upload' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Upload the required image to complete this task.</p>
            </div>
          )}

          {(submissionType === 'text_input' || submissionType === 'digit_input') && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700">
                {submissionType === 'text_input' ? 'Enter the required text information to complete this task.' : 'Enter the required digits to complete this task.'}
              </p>
            </div>
          )}

          {requiresSubmission && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                {submissionType === 'external_link' && (linkTask ? 'Task Link' : 'Your Link')}
                {submissionType === 'text_input' && 'Your Answer'}
                {submissionType === 'digit_input' && 'Your Digits'}
                {submissionType === 'image_upload' && 'Your Image'}
              </label>

              {submissionType === 'external_link' && linkTask && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={openActionLink}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {mission.actionLabel || 'Open link'}
                  </button>
                  {linkOpened ? (
                    <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-2">
                      Link opened. Complete the step there, then submit below.
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      You must open the link before you can mark this task complete.
                    </p>
                  )}
                </div>
              )}

              {submissionType === 'external_link' && !linkTask && (
                <input
                  type="url"
                  placeholder="https://..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              )}

              {submissionType === 'text_input' && (
                <textarea
                  rows={4}
                  placeholder="Type your answer here..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              )}

              {submissionType === 'digit_input' && (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Enter digits only"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              )}

              {submissionType === 'image_upload' && (
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-orange-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-orange-700"
                />
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">{error}</p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onCancel} className="px-6 py-3 sm:py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-white rounded-xl transition-all text-center">
            Cancel
          </button>
          {requiresSubmission ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 sm:py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? <RotateCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit & Complete'}
            </button>
          ) : (
            <button
              onClick={onStart}
              className="px-8 py-3 sm:py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {mission.featureKey ? 'Start & Open Feature' : 'Confirm & Start'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function DashboardOverview({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const userRaw = localStorage.getItem('business_user');
  let businessName = 'Your Business';
  let sector = '';
  let category = '';
  let membership = 'Bronze';
  let membershipSub = 'Standard';

  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      businessName = user.businessName || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Your Business');
      sector = user.sector || '';
      category = user.category || '';
      if (user.membership) membership = user.membership;
      if (user.membershipSub) membershipSub = user.membershipSub;
    } catch {}
  }

  const { data: myTasksRes, isLoading: loadingMyTasks } = useMyTasks();
  const startTaskMutation = useStartMyTask();
  const completeTaskMutation = useCompleteMyTask();
  const uploadFileMutation = useUploadBusinessFile();

  const { data: myProgrammeRes } = useMyProgramme();
  const completeMissionMutation = useCompleteMission();
  const { data: phasesRes } = useProgrammePhases();

  const programmeData = (myProgrammeRes as any)?.data;
  const completedMissionIds: string[] = Array.isArray(programmeData?.completedMissions)
    ? programmeData.completedMissions
    : [];
  const taskMeta = (myTasksRes as any)?.meta;
  const apiTasks = myTasksRes?.data;

  // Programme clock derived from the task engine config in /admin/programme:
  // each task expires `deadlineDays` after assignment; the whole programme is
  // the sum of those windows, counted from the first assignment.
  const programmeTimeline = resolveProgrammeTimeline({
    tasks: apiTasks,
    configuredTotalDays: taskMeta?.totalProgrammeDays,
    startedAt: programmeData?.startedAt,
    extendedDays: programmeData?.extendedBy,
  });
  const programmeDays = programmeTimeline.totalDays;
  const programmeEndsAt = programmeTimeline.endsAt;

  // DB phases are the source of truth; static PROGRAMME_PHASES is the fallback.
  // Merge DB day-ranges/missions over static icons so the UI never breaks.
  const activePhases = useMemo(() => {
    const dbPhases = (phasesRes as any)?.data;
    if (Array.isArray(dbPhases) && dbPhases.length > 0) {
      return dbPhases.map((p: any, i: number) => {
        const fallback = PROGRAMME_PHASES[i] || PROGRAMME_PHASES[0];
        return {
          ...fallback,
          ...p,
          id: p.id ?? fallback.id,
          name: p.name ?? fallback.name,
          dayStart: p.dayStart ?? fallback.dayStart,
          dayEnd: p.dayEnd ?? fallback.dayEnd,
          icon: fallback.icon,
          missions: Array.isArray(p.missions) && p.missions.length > 0 ? p.missions : fallback.missions,
        };
      });
    }
    return PROGRAMME_PHASES;
  }, [phasesRes]);

  const currentDay = programmeData?.currentDay ?? getProgrammeDay();
  const currentPhase = activePhases.find((p: any) => currentDay >= p.dayStart && currentDay <= p.dayEnd)
    ?? getPhaseForDay(currentDay);
  const currentPhaseIndex = activePhases.findIndex((p: any) => p.id === (currentPhase as any)?.id);

  // Real backend tasks

  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>(() => {
    const saved = localStorage.getItem('businessTaskStatuses');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeMission, setActiveMission] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('businessTaskStatuses', JSON.stringify(taskStatuses));
  }, [taskStatuses]);

  const hasApiTasks =
    (Array.isArray(apiTasks) && apiTasks.length > 0) ||
    Number((myTasksRes as any)?.meta?.configuredTaskCount ?? 0) > 0;

  const allMissions = useMemo(() => {
    if (hasApiTasks) {
      return apiTasks.map((t: any) => {
        const isCompleted = t.status === 'COMPLETED';
        const isInProgress = t.status === 'IN_PROGRESS';
        const isExpired = t.status === 'EXPIRED';
        const st = isCompleted ? 'completed' : isInProgress ? 'in_progress' : isExpired ? 'expired' : (taskStatuses[t.id] || 'not_started');

        return {
          id: t.id,
          taskId: t.taskId,
          title: t.title,
          description: t.description,
          instructions: t.description,
          featureKey: t.featureKey,
          taskSource: t.taskSource || 'INTERNAL',
          platform: t.platform || 'mcom_central',
          externalAppName: t.externalAppName || null,
          externalAppUrl: t.externalAppUrl || null,
          externalClientId: t.externalClientId || null,
          reward: `+${t.rewardPoints} points`,
          rewardPoints: t.rewardPoints,
          rewardCouponEnabled: !!t.rewardCouponEnabled,
          rewardCoupon: t.rewardCoupon || null,
          submissionType: t.submissionType || 'AUTO',
          actionUrl: t.actionUrl || null,
          actionLabel: t.actionLabel || null,
          estimatedMinutes: t.daysRemaining !== undefined ? `${t.daysRemaining}d left` : '7d',
          deadlineAt: t.deadlineAt ?? null,
          deadlineDays: t.daysRemaining,
          status: st,
          system: t.externalAppName || (t.platform && t.platform !== 'mcom_central' ? t.platform : 'MCOM Central'),
        };
      });
    }
    return currentPhase?.missions || [];
  }, [hasApiTasks, apiTasks, currentPhase, taskStatuses]);

  // Split the programme into what still needs attention vs. what is already
  // closed out. Outstanding tasks are ordered by the soonest deadline so the
  // most urgent work always sits at the top of the dashboard.
  const taskGroups = useMemo(() => {
    return groupProgrammeTasks({
      tasks: allMissions,
      useApiStatus: hasApiTasks,
      completedMissionIds,
      localStatuses: taskStatuses,
    });
  }, [allMissions, hasApiTasks, completedMissionIds, taskStatuses]);

  const totalTasksCount = allMissions.length;
  const completedTasksCount = taskGroups.completed.length;
  const computedProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : Math.min(100, Math.round((currentDay / programmeDays) * 100));

  const isMissionCompleted = (missionId: string) => {
    if (completedMissionIds.includes(missionId)) return true;
    return (taskStatuses[missionId] || 'not_started') === 'completed';
  };

  const status = (id: string): TaskStatus => {
    const found = allMissions.find((m: any) => m.id === id);
    if (found && hasApiTasks) {
      return found.status;
    }
    if (completedMissionIds.includes(id)) return 'completed';
    return taskStatuses[id] || 'not_started';
  };

  const handleGoToAction = (mission: any) => {
    // Proof-submission tasks are completed from the modal, not by navigating.
    if (['external_link', 'text_input', 'digit_input', 'image_upload'].includes(String(mission.submissionType || '').toLowerCase())) {
      setActiveMission(mission);
      setModalOpen(true);
      return;
    }
    // External platform tasks: open the console-registered app URL (frontend URL
    // from /admin/console). Completion stays manual — no worker touches these.
    if (mission.externalAppUrl) {
      window.open(mission.externalAppUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const key = mission.featureKey || '';
    if (key.includes('membership')) {
      onNavigate?.('memberships');
    } else {
      // e.g. business.logo_uploaded, business.profile_completed, business.google_verified, business.social_linked, business.opening_hours_set
      onNavigate?.('business-profile');
    }
  };

  // Admin-configured link tasks (MCOM Central + External Link): opening the link
  // marks the task in progress, which is the proof recorded on completion.
  const openTaskLink = (mission: any) => {
    const url = mission.actionUrl || mission.externalAppUrl;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (hasApiTasks && mission.id) {
      startTaskMutation.mutate(mission.id);
    }
    setTaskStatuses(prev => ({ ...prev, [mission.id]: 'in_progress' }));
  };

  const handleStart = (mission: any) => {
    setActiveMission(mission);
    setModalOpen(true);
  };

  const confirmStart = () => {
    if (!activeMission) return;
    if (hasApiTasks && activeMission.id) {
      startTaskMutation.mutate(activeMission.id);
    }
    setTaskStatuses(prev => ({ ...prev, [activeMission.id]: 'in_progress' }));
    const toNav = activeMission;
    setModalOpen(false);
    setActiveMission(null);
    if (toNav.externalAppUrl || toNav.featureKey) {
      handleGoToAction(toNav);
    }
  };

  const cancelStart = () => {
    if (activeMission && !hasApiTasks) {
      setTaskStatuses(prev => ({ ...prev, [activeMission.id]: 'not_started' }));
    }
    setModalOpen(false);
    setActiveMission(null);
  };

  const markComplete = async (mission: any, isApiTask: boolean) => {
    const id = typeof mission === 'string' ? mission : mission.id;
    const isLinkTask = String(mission?.submissionType || '').toUpperCase() === 'EXTERNAL_LINK';
    const submissionData = isLinkTask
      ? { actionUrl: mission?.actionUrl || undefined, openedAt: new Date().toISOString() }
      : undefined;
    try {
      if (isApiTask) {
        await completeTaskMutation.mutateAsync({ assignmentId: id, submissionData });
      } else {
        await completeMissionMutation.mutateAsync(id);
      }
    } catch (err: any) {
      // Backend rejected the completion (e.g. link not opened, expired task).
      if (isApiTask) {
        alert(err?.response?.data?.message || err?.message || 'Could not complete this task.');
        return;
      }
    }
    // Optimistic fallback for instant UI response
    setTaskStatuses(prev => ({ ...prev, [id]: 'completed' }));
  };

  const submitMission = async (mission: any, submissionData: Record<string, unknown>) => {
    if (hasApiTasks) {
      await completeTaskMutation.mutateAsync({ assignmentId: mission.id, submissionData });
    } else {
      await completeMissionMutation.mutateAsync(mission.id);
    }
    setTaskStatuses(prev => ({ ...prev, [mission.id]: 'completed' }));
    setModalOpen(false);
    setActiveMission(null);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveMission(null);
  };

  const nextPhase = currentPhaseIndex < activePhases.length - 1 ? activePhases[currentPhaseIndex + 1] : null;

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500 overflow-x-hidden">
      {/* ═══ Task Start Modal ═══ */}
      <AnimatePresence>
        {modalOpen && (
          <TaskStartModal
            mission={activeMission}
            open={modalOpen}
            onClose={handleCloseModal}
            onStart={confirmStart}
            onCancel={cancelStart}
            onSubmit={(submissionData) => activeMission ? submitMission(activeMission, submissionData) : Promise.resolve()}
            onOpenLink={() => { if (activeMission) openTaskLink(activeMission); }}
            onUploadImage={async (file: File) => {
              const res: any = await uploadFileMutation.mutateAsync(file);
              return res?.secure_url || res?.url;
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ Programme Summary ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:rounded-3xl"
      >
        <div className="h-1.5 bg-orange-500" />
        <div className="p-4 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-600">Business success programme</p>
              <h2 className="mt-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">Welcome, {businessName}</h2>
              <p className="mt-1 text-sm text-gray-500">Your guided plan to strengthen and grow your business.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              {membership} {membershipSub}
            </span>
          </div>

          {programmeEndsAt && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-600">
                  Programme time remaining
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Complete every task before the programme clock runs out.
                </p>
              </div>
              <ProgrammeCountdown endsAt={programmeEndsAt} />
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Tasks completed</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{completedTasksCount} <span className="font-medium text-gray-500">of {totalTasksCount}</span></p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Current phase</p>
              <p className="mt-1 truncate text-sm font-bold text-gray-900">{currentPhase?.name || 'Foundation'}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-gray-50 px-3 py-2.5 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Programme day</p>
              <p className="mt-1 text-sm font-bold text-gray-900">Day {currentDay} <span className="font-medium text-gray-500">of {programmeDays}</span></p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Programme progress</span>
              <span className="font-bold text-orange-600">{computedProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <motion.div initial={{ width: 0 }} animate={{ width: `${computedProgress}%` }} transition={{ delay: 0.3, duration: 0.7 }} className="h-full rounded-full bg-orange-500" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-3 min-w-0">
        {/* ═══ Today's Mission ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-gray-200 shadow-sm min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">Your Programme Tasks</h3>
                <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                  {hasApiTasks
                    ? `${completedTasksCount} of ${totalTasksCount} done${taskGroups.expired.length > 0 ? ` · ${taskGroups.expired.length} expired` : ''}`
                    : currentPhase?.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 bg-orange-50 text-orange-600 rounded-full border border-orange-100">
                {taskGroups.active.length} active
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-gray-400 whitespace-nowrap">Day {currentDay}</span>
            </div>
          </div>

          {loadingMyTasks && !hasApiTasks ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-400">
              <RotateCcw className="w-6 h-6 animate-spin text-orange-500" />
              <span className="text-xs font-medium">Loading your programme missions...</span>
            </div>
          ) : allMissions.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-xs bg-gray-50 rounded-2xl">
              No active tasks available right now. Check back soon!
            </div>
          ) : (
            <div>
              {taskGroups.active.length === 0 ? (
                <div className="py-8 text-center bg-green-50/60 border border-green-100 rounded-2xl">
                  <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-green-700">You are all caught up — no outstanding tasks.</p>
                </div>
              ) : (
                <div className="space-y-2.5 sm:space-y-3">
                  {taskGroups.active.map((mission: any, i: number) => (
                    <ProgrammeTaskRow
                      key={mission.id}
                      mission={mission}
                      status={mission.status}
                      index={i}
                      hasApiTasks={hasApiTasks}
                      onStart={handleStart}
                      onOpenLink={openTaskLink}
                      onContinue={handleGoToAction}
                      onComplete={(m) => markComplete(m, hasApiTasks)}
                    />
                  ))}
                </div>
              )}

              {taskGroups.expired.length > 0 && (
                <ProgrammeTaskGroup
                  title="Expired tasks"
                  hint="Deadline passed before completion"
                  count={taskGroups.expired.length}
                  tone="expired"
                  icon={AlertCircle}
                >
                  {taskGroups.expired.map((mission: any) => (
                    <ProgrammeTaskRow
                      key={mission.id}
                      mission={mission}
                      status={mission.status}
                      hasApiTasks={hasApiTasks}
                      onStart={handleStart}
                      onOpenLink={openTaskLink}
                      onContinue={handleGoToAction}
                      onComplete={(m) => markComplete(m, hasApiTasks)}
                    />
                  ))}
                </ProgrammeTaskGroup>
              )}

              {taskGroups.completed.length > 0 && (
                <ProgrammeTaskGroup
                  title="Completed tasks"
                  hint="Rewards already claimed"
                  count={taskGroups.completed.length}
                  tone="completed"
                  icon={CheckCircle2}
                >
                  {taskGroups.completed.map((mission: any) => (
                    <ProgrammeTaskRow
                      key={mission.id}
                      mission={mission}
                      status={mission.status}
                      hasApiTasks={hasApiTasks}
                      onStart={handleStart}
                      onOpenLink={openTaskLink}
                      onContinue={handleGoToAction}
                      onComplete={(m) => markComplete(m, hasApiTasks)}
                    />
                  ))}
                </ProgrammeTaskGroup>
              )}
            </div>
          )}
        </motion.div>

        {/* ═══ Phase Status ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 mb-4">Phase Status</h3>
          <div className="space-y-2">
            {activePhases.map((phase, i) => {
              const Icon = phase.icon;
              const phaseMissions = Array.isArray(phase.missions) ? phase.missions : [];
              const completedInPhase = phaseMissions.filter((mission: any) =>
                completedMissionIds.includes(mission.id) || status(mission.id) === 'completed'
              ).length;
              const isCompleted = phaseMissions.length > 0 && completedInPhase === phaseMissions.length;
              const isCurrent = i === currentPhaseIndex && !isCompleted;
              const isLocked = i > currentPhaseIndex;
              const phaseProgress = isCompleted ? 100 : phaseMissions.length > 0 ? Math.round((completedInPhase / phaseMissions.length) * 100) : 0;
              return (
                <div key={phase.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                  isCompleted ? 'bg-green-50 text-green-700' :
                  isCurrent ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  <Icon className={`w-4 h-4 shrink-0 ${
                    isCompleted ? 'text-green-500' :
                    isCurrent ? 'text-orange-500' : ''
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold block ${
                      isLocked ? 'text-gray-400' : ''
                    }`}>{phase.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                          isCompleted ? 'bg-green-500' : isCurrent ? 'bg-orange-500' : 'bg-gray-300'
                        }`} style={{ width: `${isCompleted ? 100 : phaseProgress}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">
                        {isCompleted ? 'Done' : isCurrent ? `${phaseProgress}%` : `Days ${phase.dayStart}–${phase.dayEnd}`}
                      </span>
                    </div>
                  </div>
                  {isLocked && <Lock className="w-3 h-3 shrink-0" />}
                  {isCompleted && <CheckCircle2 className="w-3 h-3 shrink-0 text-green-500" />}
                  {isCurrent && <ArrowRight className="w-3 h-3 shrink-0 text-orange-500" />}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {/* ═══ Business Health ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-4">Business Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 sm:p-4 bg-green-50 rounded-xl sm:rounded-2xl gap-2">
              <span className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-2 min-w-0">
                <BarChart3 className="w-4 h-4 text-green-500 shrink-0" /> <span className="truncate">Readiness Score</span>
              </span>
              <span className="font-black text-green-600 text-sm sm:text-base shrink-0">{computedProgress}%</span>
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-amber-50 rounded-xl sm:rounded-2xl gap-2">
              <span className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-2 min-w-0">
                <Heart className="w-4 h-4 text-amber-500 shrink-0" /> <span className="truncate">Health Score</span>
              </span>
              <span className="font-black text-amber-600 text-sm shrink-0">Pending</span>
            </div>
            <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl gap-2">
              <span className="text-xs sm:text-sm font-bold text-gray-700 flex items-center gap-2 min-w-0">
                <FileSearch className="w-4 h-4 text-gray-400 shrink-0" /> <span className="truncate">Audit Status</span>
              </span>
              <span className="font-black text-gray-500 text-sm shrink-0">Not Ready</span>
            </div>
          </div>
        </motion.div>

        {/* ═══ Upcoming ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-4 sm:mb-5">Upcoming</h3>
          <div className="space-y-3">
            {[
              { label: 'Tomorrow', task: nextPhase?.missions[0]?.title || 'Continue current tasks', time: '10 min' },
              { label: 'This week', task: 'Complete all Foundation phase tasks', time: '' },
              { label: 'Next phase', task: nextPhase ? `${nextPhase.name} — ${nextPhase.description.split('.')[0]}` : 'Coming soon', time: `Day ${nextPhase?.dayStart || 8}` },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 sm:gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider leading-none">{item.label}</p>
                  <p className="font-semibold text-gray-800 text-xs mt-1 leading-tight break-words line-clamp-2">{item.task}</p>
                </div>
                {item.time && <span className="text-[10px] text-gray-400 font-medium shrink-0 whitespace-nowrap">{item.time}</span>}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ═══ Support ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-4 sm:mb-5">Support</h3>
          <div className="space-y-3">
            <button onClick={() => onNavigate?.('support')} className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Assigned Agent</p>
                <p className="text-xs text-gray-400 leading-tight">Your dedicated growth agent</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
            <button onClick={() => onNavigate?.('support')} className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <HeadphonesIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Account Manager</p>
                <p className="text-xs text-gray-400 leading-tight">Book a strategy session</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
            <button onClick={() => onNavigate?.('support')} className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Consultant</p>
                <p className="text-xs text-gray-400 leading-tight">Specialist advice for your business</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
            <button onClick={() => onNavigate?.('support')} className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Invite Accountant</p>
                <p className="text-xs text-gray-400 leading-tight">For financial audit sections</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
