import React from 'react';
import {
  AlertCircle, ArrowRight, CheckCircle2, Clock, ExternalLink, Gift,
  Play, RotateCcw, Target,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { TaskStatus } from '../lib/programmeData';
import TaskCountdown from './TaskCountdown';

export type ProgrammeTaskStatus = TaskStatus | 'expired';

export interface ProgrammeTaskRowProps {
  /** React list key (React 19 types require it to be declared explicitly). */
  key?: React.Key;
  /** Task shape produced by DashboardOverview (API assignment or static mission). */
  mission: any;
  /** Resolved status for this task. */
  status: ProgrammeTaskStatus;
  /** Position in the outstanding list — used for the numbered badge. */
  index?: number;
  /** True when tasks come from the backend task engine. */
  hasApiTasks: boolean;
  onStart: (mission: any) => void;
  onOpenLink: (mission: any) => void;
  onContinue: (mission: any) => void;
  onComplete: (mission: any) => void;
  className?: string;
}

/**
 * A single programme task card.
 *
 * Rendered for outstanding tasks (numbered) and inside the collapsed
 * "Expired" / "Completed" groups (icon only).
 */
export default function ProgrammeTaskRow({
  mission,
  status,
  index,
  hasApiTasks,
  onStart,
  onOpenLink,
  onContinue,
  onComplete,
  className,
}: ProgrammeTaskRowProps) {
  const submissionType = String(mission.submissionType || '').toUpperCase();
  const isExternalLink = submissionType === 'EXTERNAL_LINK';
  // Link tasks created in /admin/programme: the admin supplies the destination
  // and the user opens it, then confirms completion.
  const linkTarget = isExternalLink ? (mission.actionUrl || mission.externalAppUrl || null) : null;
  const isLinkTask = Boolean(linkTarget);
  // API external tasks (console-registered platforms): manual completion only.
  const isApiExternal = hasApiTasks && mission.taskSource === 'EXTERNAL';
  const isInProgress = status === 'in_progress';
  const isCompleted = status === 'completed';
  const isExpired = status === 'expired';
  const showNumber = typeof index === 'number' && !isCompleted && !isInProgress && !isExpired;
  const isNextUp = showNumber && index === 0;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl transition-colors group',
        isCompleted ? 'bg-green-50/50' : isInProgress ? 'bg-blue-50/50' : isExpired ? 'bg-red-50/30' : 'hover:bg-orange-50',
        className,
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
        <div className={cn(
          'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0',
          isCompleted ? 'bg-green-500 text-white' :
          isInProgress ? 'bg-blue-500 text-white' :
          isExpired ? 'bg-red-400 text-white' :
          isNextUp ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500',
        )}>
          {isCompleted ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> :
           isInProgress ? <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" /> :
           isExpired ? <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" /> :
           showNumber ? <span className="text-xs sm:text-sm font-bold">{(index as number) + 1}</span> :
           <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-[13px] sm:text-sm leading-tight break-words line-clamp-2">{mission.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3 mt-1">
            {mission.deadlineAt && !isCompleted && !isExpired ? (
              <TaskCountdown deadlineAt={mission.deadlineAt} active />
            ) : (
              <span className="text-[11px] sm:text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" /> {mission.estimatedMinutes}
              </span>
            )}
            <span className="text-[11px] sm:text-xs text-amber-600 font-bold flex items-center gap-1">
              <Target className="w-3 h-3 shrink-0" /> {mission.reward}
            </span>
            {mission.rewardCouponEnabled && !mission.rewardCoupon && (
              <span className="text-[10px] sm:text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Gift className="w-3 h-3 shrink-0" /> Coupon reward
              </span>
            )}
            {mission.rewardCoupon && (
              <span className="text-[10px] sm:text-xs text-emerald-700 font-black flex items-center gap-1 font-mono">
                <Gift className="w-3 h-3 shrink-0" /> {mission.rewardCoupon.code}
              </span>
            )}
            {mission.system && (
              <span className="text-[10px] sm:text-xs text-sky-600 font-bold truncate max-w-[90px] sm:max-w-none">{mission.system}</span>
            )}
            {isLinkTask && !isCompleted && !isExpired && (
              <span className="text-[10px] sm:text-xs text-blue-600 font-bold flex items-center gap-1">
                <ExternalLink className="w-3 h-3 shrink-0" /> Open the link, then mark complete
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-1 sm:mt-0 min-w-0">
        {status === 'not_started' && (
          isLinkTask ? (
            <button onClick={() => onOpenLink(mission)} className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm max-w-full">
              <ExternalLink className="w-3 h-3 shrink-0" /> <span className="truncate">{mission.actionLabel || 'Open link'}</span>
            </button>
          ) : (
            <button onClick={() => onStart(mission)} className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm max-w-full">
              <Play className="w-3 h-3 shrink-0" /> <span className="truncate">Start Now</span>
            </button>
          )
        )}
        {isInProgress && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2 bg-blue-100 text-blue-700 rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold flex-1 sm:flex-none">
              <RotateCcw className="w-3 h-3 animate-spin" /> In Progress
            </span>
            {isLinkTask ? (
              <>
                <button
                  onClick={() => onOpenLink(mission)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3.5 py-2 sm:py-2 bg-blue-600 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <span>{mission.actionLabel || 'Open link'}</span> <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onComplete(mission)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-4 py-2 sm:py-2 bg-emerald-600 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-3 h-3" /> Mark Complete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onContinue(mission)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3.5 py-2 sm:py-2 bg-blue-600 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  {isApiExternal ? (
                    <><span>Open {mission.externalAppName || 'App'}</span> <ExternalLink className="w-3 h-3" /></>
                  ) : (
                    <><span>Continue</span> <ArrowRight className="w-3 h-3" /></>
                  )}
                </button>
                {isApiExternal && (
                  <button onClick={() => onComplete(mission)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-4 py-2 sm:py-2 bg-emerald-600 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                    <CheckCircle2 className="w-3 h-3" /> Complete
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {isCompleted && (
          <span className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-4 py-2 sm:py-2 bg-green-100 text-green-700 rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
          </span>
        )}
        {isExpired && (
          <span className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-4 py-2 sm:py-2 bg-red-100 text-red-700 rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold">
            <AlertCircle className="w-3.5 h-3.5" /> Expired
          </span>
        )}
      </div>
    </div>
  );
}
