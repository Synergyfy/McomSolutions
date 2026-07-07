import { motion } from 'motion/react';
import {
  Crown, Shield, Lock, CheckCircle2, ArrowRight, Sparkles,
  Building2, Gift, Users, BarChart3, FileSearch, Clock,
  User, ChevronRight, HeadphonesIcon, Calendar, Target
} from 'lucide-react';
import { PROGRAMME_PHASES, getPhaseForDay, getProgressForDay, getTotalMissions } from '../lib/programmeData';

export default function FirstDashboardWelcome({ onDismiss }: { onDismiss: () => void }) {
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
    } catch {}
  }

  const onboardingData = localStorage.getItem('businessOnboarding');
  if (onboardingData) {
    try {
      const data = JSON.parse(onboardingData);
      if (data.businessName) businessName = data.businessName;
      if (data.sector) sector = data.sector;
      if (data.category) category = data.category;
    } catch {}
  }

  const currentDay = 1;
  const progress = getProgressForDay(currentDay);
  const currentPhase = getPhaseForDay(currentDay);
  const firstMission = PROGRAMME_PHASES[0].missions[0];
  const totalMissions = getTotalMissions();

  return (
    <div className="space-y-6">
      {/* ═══ Welcome Card (per screens.md) ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-orange-500/20"
      >
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -right-4 bottom-0 w-32 h-32 bg-white/5 rounded-full" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-2">Welcome to Your</p>
              <h2 className="text-2xl md:text-3xl font-black mb-1">90-Day Business Success Programme</h2>
            </div>
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
              <Crown className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Business Name + Sector */}
          <div className="mb-6">
            <p className="text-xl font-black">{businessName}</p>
            {(sector || category) && (
              <p className="text-orange-200 text-sm font-medium mt-1">
                {sector}{sector && category ? ' / ' : ''}{category}
              </p>
            )}
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Membership</p>
              <p className="font-bold text-sm mt-1">{membership} {membershipSub}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Status</p>
              <p className="font-bold text-sm mt-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full" /> Active
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Readiness</p>
              <p className="font-bold text-sm mt-1">{progress}%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Programme</p>
              <p className="font-bold text-sm mt-1">Day {currentDay} of 90</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-orange-200">Overall Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <p className="text-orange-200 text-[10px] font-bold mt-1">0 of {totalMissions} tasks completed</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ Your First Mission (per screens.md) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Your First Mission</h3>
              <p className="text-sm text-gray-500 mt-1">{firstMission.title}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span className="font-bold text-gray-900">{firstMission.estimatedMinutes} minutes</span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Target className="w-4 h-4" />
              <span className="font-bold text-amber-600">{firstMission.reward}</span>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-base hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2"
          >
            Start Mission
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* ═══ Programme Overview (per screens.md) ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 mb-4">Programme Overview</h3>
          <div className="space-y-2">
            {PROGRAMME_PHASES.map((phase, i) => {
              const Icon = phase.icon;
              const isCompleted = i === 0;
              const isActive = i === 1;
              const isLocked = i > 1;
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

      {/* ═══ Today's Tasks ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">Today's Tasks</h3>
          <span className="text-xs font-bold text-gray-400">Day {currentDay}</span>
        </div>
        <div className="space-y-3">
          {PROGRAMME_PHASES[0].missions.slice(0, 3).map((mission, i) => (
            <div key={mission.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-orange-50 transition-colors cursor-pointer group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i === 0 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{mission.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{mission.estimatedMinutes} min · {mission.reward}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══ Upcoming ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
      >
        <h3 className="font-bold text-gray-900 mb-5">Upcoming</h3>
        <div className="space-y-3">
          {[
            { label: 'Tomorrow', task: 'Upload logo & brand assets', time: '5 min' },
            { label: 'This week', task: 'Confirm sector & opening hours', time: '5 min' },
            { label: 'Next week', task: 'Activate referral profile & generate QR links', time: '7 min' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">{item.label}</p>
                <p className="font-bold text-gray-900 text-sm mt-0.5">{item.task}</p>
              </div>
              <span className="text-xs text-gray-400 font-medium shrink-0">{item.time}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══ Support ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
      >
        <h3 className="font-bold text-gray-900 mb-5">Support</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Assigned Agent</p>
              <p className="text-xs text-gray-400">Your dedicated agent</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <HeadphonesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Account Manager</p>
              <p className="text-xs text-gray-400">Book a session</p>
            </div>
          </button>
          <button className="flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Invite Accountant</p>
              <p className="text-xs text-gray-400">For financial sections</p>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
