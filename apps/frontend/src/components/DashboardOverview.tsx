import React from 'react';
import { motion } from 'motion/react';
import {
  Crown, CheckCircle2, ArrowRight, Clock, Target,
  Building2, Gift, Users, FileSearch, Shield, Dices,
  User, HeadphonesIcon, Calendar, ChevronRight, AlertCircle,
  BarChart3, Heart, Lock, Sparkles
} from 'lucide-react';
import { PROGRAMME_PHASES, getPhaseForDay, getProgressForDay, getTotalMissions } from '../lib/programmeData';

const CURRENT_DAY = 17;

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
  const completedMissions = Math.round(totalMissions * (progress / 100));

  const todayMissions = currentPhase?.missions.slice(0, 3) || [];
  const nextPhase = currentPhaseIndex < PROGRAMME_PHASES.length - 1 ? PROGRAMME_PHASES[currentPhaseIndex + 1] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ═══ Programme Header ═══ */}
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
              <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-2">90-Day Business Success Programme</p>
              <h2 className="text-2xl md:text-3xl font-black mb-1">Day {CURRENT_DAY} of 90</h2>
              <p className="text-orange-200 text-sm font-medium">{currentPhase?.name || 'Foundation'}</p>
            </div>
            <div className="text-right">
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm inline-block">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <p className="text-orange-200 text-xs font-bold mt-2">{membership} {membershipSub}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs font-bold mb-1.5">
              <span className="text-orange-200">Overall Progress</span>
              <span className="text-white">{progress}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <p className="text-orange-200 text-[10px] font-bold mt-1">{completedMissions} of {totalMissions} tasks completed</p>
          </div>

          {/* Phase Progress Dots */}
          <div className="flex items-center gap-2">
            {PROGRAMME_PHASES.map((phase, i) => {
              const isCompleted = i < currentPhaseIndex;
              const isCurrent = i === currentPhaseIndex;
              return (
                <div key={phase.id} className="flex-1">
                  <div className={`h-1.5 rounded-full ${
                    isCompleted ? 'bg-white' : isCurrent ? 'bg-white/60' : 'bg-white/20'
                  }`} />
                  <p className={`text-[9px] font-bold mt-1 text-center truncate ${
                    isCurrent ? 'text-white' : 'text-orange-200'
                  }`}>{phase.name.split(' ')[0]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ Today's Mission ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Today's Mission</h3>
                <p className="text-xs text-gray-400">{currentPhase?.name}</p>
              </div>
            </div>
            <span className="text-xs font-bold text-gray-400">Day {CURRENT_DAY}</span>
          </div>

          <div className="space-y-3">
            {todayMissions.map((mission, i) => (
              <div key={mission.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl hover:bg-orange-50 transition-colors cursor-pointer group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i === 0 ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{mission.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {mission.estimatedMinutes} min
                    </span>
                    <span className="text-xs text-amber-600 font-bold flex items-center gap-1">
                      <Target className="w-3 h-3" /> {mission.reward}
                    </span>
                    {mission.system && (
                      <span className="text-xs text-sky-600 font-bold">{mission.system}</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </motion.div>

        {/* ═══ Phase Status ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ═══ Business Health ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 mb-4">Business Health</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-green-500" /> Readiness Score
              </span>
              <span className="font-black text-green-600">{progress}%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Heart className="w-4 h-4 text-amber-500" /> Health Score
              </span>
              <span className="font-black text-amber-600">Pending</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-gray-400" /> Audit Status
              </span>
              <span className="font-black text-gray-500">Not Ready</span>
            </div>
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
              { label: 'Tomorrow', task: nextPhase?.missions[0]?.title || 'Continue current tasks', time: '10 min' },
              { label: 'This week', task: 'Complete all Foundation phase tasks', time: '' },
              { label: 'Next phase', task: nextPhase ? `${nextPhase.name} — ${nextPhase.description.split('.')[0]}` : 'Coming soon', time: `Day ${nextPhase?.dayStart || 8}` },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">{item.label}</p>
                  <p className="font-semibold text-gray-800 text-xs mt-0.5 truncate">{item.task}</p>
                </div>
                {item.time && <span className="text-[10px] text-gray-400 font-medium shrink-0">{item.time}</span>}
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
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">Assigned Agent</p>
                <p className="text-xs text-gray-400">Your dedicated growth agent</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <HeadphonesIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">Account Manager</p>
                <p className="text-xs text-gray-400">Book a strategy session</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
            </button>
            <button className="w-full flex items-center gap-3 p-4 bg-orange-50 rounded-2xl hover:bg-orange-100 transition-colors text-left group">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">Invite Accountant</p>
                <p className="text-xs text-gray-400">For financial audit sections</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
