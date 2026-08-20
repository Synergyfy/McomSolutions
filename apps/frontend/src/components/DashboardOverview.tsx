import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Crown, CheckCircle2, ArrowRight, Clock, Target, X,
  Building2, Gift, Users, FileSearch, Shield, Dices,
  User, HeadphonesIcon, Calendar, ChevronRight, AlertCircle,
  BarChart3, Heart, Lock, Sparkles, Play, RotateCcw, ExternalLink
} from 'lucide-react';
import {
  PROGRAMME_PHASES, getPhaseForDay, getProgressForDay, getTotalMissions,
  getTaskStatus, setTaskStatus, TaskStatus
} from '../lib/programmeData';
import type { ProgrammeMission } from '../lib/programmeData';
import { cn } from '../lib/utils';

const CURRENT_DAY = 17;

function TaskStartModal({
  mission,
  open,
  onClose,
  onStart,
  onCancel,
}: {
  mission: ProgrammeMission | null;
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (!open || !mission) return null;

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
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{mission.estimatedMinutes} min · {mission.reward}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-5 overflow-y-auto">
          {mission.instructions ? (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Instructions</label>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{mission.instructions}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No instructions provided for this task.</p>
          )}

          {mission.submissionType === 'external_link' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-blue-700">External Task</p>
                <p className="text-xs text-blue-600 mt-1">
                  This task is completed on an external platform. After you finish, come back here and click <strong>"Mark Complete"</strong> to confirm completion and claim your reward.
                </p>
              </div>
            </div>
          )}

          {mission.submissionType === 'image_upload' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">Upload the required image to complete this task.</p>
            </div>
          )}

          {(mission.submissionType === 'text_input' || mission.submissionType === 'digit_input') && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <p className="text-sm text-purple-700">
                {mission.submissionType === 'text_input' ? 'Enter the required text information to complete this task.' : 'Enter the required digits to complete this task.'}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onCancel} className="px-6 py-3 sm:py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-white rounded-xl transition-all text-center">
            Cancel
          </button>
          <button
            onClick={onStart}
            className="px-8 py-3 sm:py-2.5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 to-red-500 rounded-xl hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Confirm & Start
          </button>
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

  const progress = getProgressForDay(CURRENT_DAY);
  const currentPhase = getPhaseForDay(CURRENT_DAY);
  const currentPhaseIndex = PROGRAMME_PHASES.findIndex(p => p.id === currentPhase?.id);
  const totalMissions = getTotalMissions();

  const [taskStatuses, setTaskStatuses] = useState<Record<string, TaskStatus>>(() => {
    const saved = localStorage.getItem('businessTaskStatuses');
    return saved ? JSON.parse(saved) : {};
  });
  const [activeMission, setActiveMission] = useState<ProgrammeMission | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('businessTaskStatuses', JSON.stringify(taskStatuses));
  }, [taskStatuses]);

  const status = (id: string): TaskStatus => taskStatuses[id] || 'not_started';
  const completedCount = Object.values(taskStatuses).filter(s => s === 'completed').length;

  const handleStart = (mission: ProgrammeMission) => {
    setActiveMission(mission);
    setModalOpen(true);
  };

  const confirmStart = () => {
    if (!activeMission) return;
    setTaskStatuses(prev => ({ ...prev, [activeMission.id]: 'in_progress' }));
    setModalOpen(false);
    setActiveMission(null);
  };

  const cancelStart = () => {
    if (activeMission) {
      setTaskStatuses(prev => ({ ...prev, [activeMission.id]: 'not_started' }));
    }
    setModalOpen(false);
    setActiveMission(null);
  };

  const markComplete = (missionId: string) => {
    setTaskStatuses(prev => ({ ...prev, [missionId]: 'completed' }));
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setActiveMission(null);
  };

  const StatusBadge = ({ missionId }: { missionId: string }) => {
    const st = status(missionId);
    const mission = currentPhase?.missions.find(m => m.id === missionId);
    switch (st) {
      case 'not_started':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold whitespace-nowrap">
            <Play className="w-3 h-3" /> Start Now
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold whitespace-nowrap">
            <RotateCcw className="w-3 h-3 animate-spin" /> In Progress
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      default:
        return null;
    }
  };

  const todayMissions = currentPhase?.missions.slice(0, 3) || [];
  const nextPhase = currentPhaseIndex < PROGRAMME_PHASES.length - 1 ? PROGRAMME_PHASES[currentPhaseIndex + 1] : null;

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
          />
        )}
      </AnimatePresence>

      {/* ═══ Programme Header ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white relative shadow-xl shadow-orange-500/20 overflow-hidden sm:overflow-hidden"
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="min-w-0 flex-1">
              <p className="text-orange-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1.5 sm:mb-2 leading-tight">90-Day Business Success Programme</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black mb-1 leading-tight">Day {CURRENT_DAY} of 90</h2>
              <p className="text-orange-100 sm:text-orange-200 text-xs sm:text-sm font-medium truncate">{currentPhase?.name || 'Foundation'}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="bg-white/20 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-sm inline-block">
                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <p className="text-orange-200 text-[10px] sm:text-xs font-bold mt-1.5 sm:mt-2 leading-tight">{membership}<br className="sm:hidden" /> <span className="hidden sm:inline"> </span>{membershipSub}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold mb-1.5">
              <span className="text-orange-200">Overall Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <div className="h-2.5 sm:h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <p className="text-orange-200 text-[10px] font-bold mt-1">{completedCount} of {totalMissions} tasks completed</p>
          </div>

          {/* Phase Progress Dots - labels hidden on mobile to prevent cramming */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {PROGRAMME_PHASES.map((phase, i) => {
              const isCompleted = i < currentPhaseIndex;
              const isCurrent = i === currentPhaseIndex;
              return (
                <div key={phase.id} className="flex-1 min-w-0">
                  <div className={`h-1.5 rounded-full ${
                    isCompleted ? 'bg-white' : isCurrent ? 'bg-white/60' : 'bg-white/20'
                  }`} />
                  <p className={`hidden sm:block text-[9px] font-bold mt-1 text-center truncate leading-tight ${
                    isCurrent ? 'text-white' : 'text-orange-200'
                  }`}>{phase.name.split(' ')[0]}</p>
                  {/* Mobile: only show dot, no label - keep header compact */}
                </div>
              );
            })}
          </div>
          {/* Mobile phase labels - wrap to 2 rows to avoid any clipping */}
          <div className="sm:hidden mt-3 flex flex-wrap gap-1.5">
            {PROGRAMME_PHASES.map((phase, i) => {
              const isCurrent = i === currentPhaseIndex;
              const isCompleted = i < currentPhaseIndex;
              return (
                <span key={`m-${phase.id}`} className={`text-[10px] font-bold whitespace-nowrap px-2.5 py-1 rounded-full shrink-0 leading-none ${isCurrent ? 'bg-white text-orange-600 shadow-sm' : isCompleted ? 'bg-white/30 text-white' : 'bg-white/15 text-orange-100 border border-white/10'}`}>
                  {phase.name}
                </span>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
        {/* ═══ Today's Mission ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 md:p-8 border border-gray-200 shadow-sm min-w-0 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">Today's Mission</h3>
                <p className="text-[11px] sm:text-xs text-gray-400 truncate">{currentPhase?.name}</p>
              </div>
            </div>
            <span className="text-[11px] sm:text-xs font-bold text-gray-400 whitespace-nowrap shrink-0">Day {CURRENT_DAY}</span>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            {todayMissions.map((mission, i) => {
              const st = status(mission.id);
              const isExternalLink = mission.submissionType === 'external_link';
              const isInProgress = st === 'in_progress';
              return (
                <div
                  key={mission.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl transition-colors group",
                    st === 'completed' ? 'bg-green-50/50' : isInProgress ? 'bg-blue-50/50' : 'hover:bg-orange-50'
                  )}
                >
                  <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0 w-full">
                    <div className={cn(
                      "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0",
                      st === 'completed' ? 'bg-green-500 text-white' :
                      isInProgress ? 'bg-blue-500 text-white' :
                      i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                    )}>
                      {st === 'completed' ? <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" /> :
                       isInProgress ? <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" /> :
                       <span className="text-xs sm:text-sm font-bold">{i + 1}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-[13px] sm:text-sm leading-tight break-words line-clamp-2">{mission.title}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3 mt-1">
                        <span className="text-[11px] sm:text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" /> {mission.estimatedMinutes} min
                        </span>
                        <span className="text-[11px] sm:text-xs text-amber-600 font-bold flex items-center gap-1">
                          <Target className="w-3 h-3 shrink-0" /> {mission.reward}
                        </span>
                        {mission.system && (
                          <span className="text-[10px] sm:text-xs text-sky-600 font-bold truncate max-w-[90px] sm:max-w-none">{mission.system}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto mt-1 sm:mt-0 min-w-0">
                    {st === 'not_started' && (
                      <button onClick={() => handleStart(mission)} className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-orange-600 transition-colors shadow-sm max-w-full">
                        <Play className="w-3 h-3 shrink-0" /> <span className="truncate">Start Now</span>
                      </button>
                    )}
                    {st === 'in_progress' && (
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2 bg-blue-100 text-blue-700 rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold flex-1 sm:flex-none">
                          <RotateCcw className="w-3 h-3 animate-spin" /> In Progress
                        </span>
                        {isExternalLink && (
                          <button onClick={() => markComplete(mission.id)} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-4 py-2 sm:py-2 bg-blue-500 text-white rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold hover:bg-blue-600 transition-colors shadow-sm">
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </button>
                        )}
                      </div>
                    )}
                    {st === 'completed' && (
                      <span className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 px-4 py-2 sm:py-2 bg-green-100 text-green-700 rounded-full sm:rounded-xl text-[11px] sm:text-xs font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            {PROGRAMME_PHASES.map((phase, i) => {
              const Icon = phase.icon;
              const isCompleted = i < currentPhaseIndex;
              const isCurrent = i === currentPhaseIndex;
              const isLocked = i > currentPhaseIndex;
              const phaseProgress = isCompleted ? 100 : isCurrent ? Math.round(((CURRENT_DAY - phase.dayStart + 1) / (phase.dayEnd - phase.dayStart + 1)) * 100) : 0;
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
              <span className="font-black text-green-600 text-sm sm:text-base shrink-0">{progress}%</span>
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
            <button className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Assigned Agent</p>
                <p className="text-xs text-gray-400 leading-tight">Your dedicated growth agent</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
            <button className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <HeadphonesIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight">Account Manager</p>
                <p className="text-xs text-gray-400 leading-tight">Book a strategy session</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 shrink-0" />
            </button>
            <button className="w-full flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
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
