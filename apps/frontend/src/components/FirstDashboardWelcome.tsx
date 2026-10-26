import { motion } from 'motion/react';
import {
  Lock, CheckCircle2, ArrowRight, Sparkles, Clock,
  Users, User, HeadphonesIcon, Target
} from 'lucide-react';
import { PROGRAMME_PHASES, getPhaseForDay, getProgrammeDay, getTaskStatus, getTotalMissions } from '../lib/programmeData';
import { useProfile, useMyTasks } from '../services/business/hooks';

export default function FirstDashboardWelcome({ onDismiss }: { onDismiss: () => void }) {
  const { data: profile } = useProfile();
  const { data: myTasksRes } = useMyTasks();
  const configuredProgrammeDays = Number((myTasksRes as any)?.meta?.totalProgrammeDays);
  const programmeDays = Number.isFinite(configuredProgrammeDays) && configuredProgrammeDays > 0
    ? configuredProgrammeDays
    : 90;

  let businessName = profile?.businessName || '';
  let sector = profile?.sector || '';
  let category = profile?.category || '';
  let membership = profile?.membershipLevel || '';
  let membershipSub = profile?.membershipTier || '';
  let membershipStatus = profile?.membershipStatus || 'Active';

  if (!businessName) {
    const userRaw = localStorage.getItem('business_user');
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        businessName = user.businessName || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : '');
        if (!sector) sector = user.sector || '';
        if (!category) category = user.category || '';
        if (!membership) membership = user.membershipLevel || '';
        if (!membershipSub) membershipSub = user.membershipTier || '';
      } catch {}
    }
  }

  const onboardingData = localStorage.getItem('businessOnboarding');
  if (onboardingData) {
    try {
      const data = JSON.parse(onboardingData);
      if (!businessName && data.businessName) businessName = data.businessName;
      if (!sector && data.sector) sector = data.sector;
      if (!category && data.category) category = data.category;
    } catch {}
  }

  if (!businessName) businessName = 'Your Business';
  if (!membership) membership = 'Bronze';
  if (!membershipSub) membershipSub = 'Standard';

  const currentDay = getProgrammeDay();
  const allMissions = PROGRAMME_PHASES.flatMap((phase) => phase.missions);
  const completedMissionCount = allMissions.filter((mission) => getTaskStatus(mission.id) === 'completed').length;
  const progress = Math.round((completedMissionCount / allMissions.length) * 100);
  const currentPhase = getPhaseForDay(currentDay) || PROGRAMME_PHASES[PROGRAMME_PHASES.length - 1];
  const firstMission = currentPhase.missions.find((mission) => getTaskStatus(mission.id) !== 'completed')
    || allMissions.find((mission) => getTaskStatus(mission.id) !== 'completed')
    || allMissions[0];
  const totalMissions = getTotalMissions();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ═══ Programme summary ═══ */}
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
              {(sector || category) && <p className="mt-1 text-sm text-gray-500">{sector}{sector && category ? ' · ' : ''}{category}</p>}
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              {membershipStatus.charAt(0).toUpperCase() + membershipStatus.slice(1).toLowerCase()}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Membership</p>
              <p className="mt-1 truncate text-sm font-bold text-gray-900">{membership} {membershipSub}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Programme day</p>
              <p className="mt-1 text-sm font-bold text-gray-900">Day {currentDay} <span className="font-medium text-gray-500">of {programmeDays}</span></p>
            </div>
            <div className="col-span-2 rounded-xl bg-gray-50 px-3 py-2.5 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Tasks completed</p>
              <p className="mt-1 text-sm font-bold text-gray-900">{completedMissionCount} <span className="font-medium text-gray-500">of {totalMissions}</span></p>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">Programme progress</span>
              <span className="font-bold text-orange-600">{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ delay: 0.3, duration: 0.7 }} className="h-full rounded-full bg-orange-500" />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-3">
        {/* ═══ Your First Mission (per screens.md) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-7 border border-gray-200 shadow-sm"
        >
          <div className="flex items-start gap-3 sm:gap-4 mb-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Your Next Mission</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-tight break-words">{firstMission.title}</p>
            </div>
          </div>

          <p className="mb-4 text-sm leading-6 text-gray-600">{firstMission.description}</p>

          <div className="flex items-center gap-3 sm:gap-4 mb-4 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="font-bold text-gray-900 whitespace-nowrap">{firstMission.estimatedMinutes} min</span>
            </div>
            <div className="h-4 w-px bg-gray-200 shrink-0" />
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="font-bold text-amber-600 whitespace-nowrap">{firstMission.reward}</span>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            Start Mission
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </motion.div>

        {/* ═══ Programme Overview (per screens.md) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 mb-4">Programme Overview</h3>
          <div className="space-y-2">
            {PROGRAMME_PHASES.map((phase) => {
              const Icon = phase.icon;
              const isCompleted = phase.missions.every((mission) => getTaskStatus(mission.id) === 'completed');
              const isActive = !isCompleted && currentDay >= phase.dayStart && currentDay <= phase.dayEnd;
              const isLocked = !isCompleted && !isActive;
              return (
                <div key={phase.id} className={`flex items-center gap-3 p-3 rounded-xl ${
                  isCompleted ? 'bg-green-50 text-green-700' :
                  isActive ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  <Icon className={`w-4 h-4 shrink-0 ${
                    isCompleted ? 'text-green-500' :
                    isActive ? 'text-orange-500' : ''
                  }`} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-semibold block ${
                      isLocked ? 'text-gray-400' : ''
                    }`}>{phase.name}</span>
                    <span className="text-[10px] font-medium text-gray-400">
                      Days {phase.dayStart}–{phase.dayEnd}
                    </span>
                  </div>
                  {isLocked && <Lock className="w-3 h-3 shrink-0" />}
                  {isCompleted && <CheckCircle2 className="w-3 h-3 shrink-0 text-green-500" />}
                  {isActive && <ArrowRight className="w-3 h-3 shrink-0 text-orange-500" />}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-2">
      {/* ═══ Today's Tasks ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-200 shadow-sm"
      >
        <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
          <h3 className="font-bold text-gray-900 text-sm sm:text-base">Today's Tasks</h3>
          <span className="text-[11px] sm:text-xs font-bold text-gray-400 whitespace-nowrap shrink-0">Day {currentDay}</span>
        </div>
        <div className="space-y-3">
          {currentPhase.missions.slice(0, 3).map((mission, i) => {
            const isCompleted = getTaskStatus(mission.id) === 'completed';
            const isCurrent = mission.id === firstMission.id;
            return (
            <div key={mission.id} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-xl sm:rounded-2xl">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isCompleted ? 'bg-green-100 text-green-600' : isCurrent ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm leading-tight break-words">{mission.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-tight">{mission.estimatedMinutes} min · {mission.reward}</p>
              </div>
            </div>
            );
          })}
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
        <div className="grid grid-cols-1 gap-3">
          <button className="flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm leading-tight">Assigned Agent</p>
              <p className="text-xs text-gray-400 leading-tight">Your dedicated agent</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <HeadphonesIcon className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm leading-tight">Account Manager</p>
              <p className="text-xs text-gray-400 leading-tight">Book a session</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-3 sm:p-4 bg-orange-50 rounded-xl sm:rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900 text-sm leading-tight">Invite Accountant</p>
              <p className="text-xs text-gray-400 leading-tight">For financial sections</p>
            </div>
          </button>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
