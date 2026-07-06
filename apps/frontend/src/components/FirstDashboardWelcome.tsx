import { motion } from 'motion/react';
import {
  Crown, Shield, Lock, CheckCircle2, ArrowRight, Sparkles,
  Building2, Zap, Gift, Users, BarChart3, FileSearch
} from 'lucide-react';

const phases = [
  { name: 'Business Registration', status: 'completed' as const, icon: CheckCircle2 },
  { name: 'Business Foundation', status: 'active' as const, icon: Shield },
  { name: 'Digital Presence', status: 'locked' as const, icon: Building2 },
  { name: 'Customer Engagement', status: 'locked' as const, icon: Gift },
  { name: 'Business Growth', status: 'locked' as const, icon: Users },
  { name: 'Business Intelligence', status: 'locked' as const, icon: BarChart3 },
  { name: 'Business Audit', status: 'locked' as const, icon: FileSearch },
];

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
      businessName = user.businessName || user.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Your Business';
    } catch {}
  }

  const onboardingData = localStorage.getItem('businessOnboarding');
  if (onboardingData) {
    try {
      const data = JSON.parse(onboardingData);
      if (data.businessName) businessName = data.businessName;
    } catch {}
  }

  const planInfo = localStorage.getItem('gbs_pricing_plans');

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Business</p>
              <p className="font-bold text-sm mt-1 truncate">{businessName}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Programme</p>
              <p className="font-bold text-sm mt-1">Day 1 of 90</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Readiness</p>
              <p className="font-bold text-sm mt-1">0%</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm">
              <p className="text-orange-200 text-[10px] font-bold uppercase tracking-widest">Status</p>
              <p className="font-bold text-sm mt-1 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full" /> Active
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* First Mission Card */}
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
              <p className="text-sm text-gray-500 mt-1">Business Verification & Profile Foundation</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-2xl">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-bold text-gray-900">10-15 minutes</span>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-bold text-amber-600">+Business Readiness</span>
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

        {/* Programme Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm"
        >
          <h3 className="font-bold text-gray-900 mb-4">Programme Overview</h3>
          <div className="space-y-2">
            {phases.map((phase, i) => {
              const Icon = phase.icon;
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${
                  phase.status === 'completed' ? 'bg-green-50 text-green-700' :
                  phase.status === 'active' ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  <Icon className={`w-4 h-4 shrink-0 ${
                    phase.status === 'completed' ? 'text-green-500' :
                    phase.status === 'active' ? 'text-orange-500' : ''
                  }`} />
                  <span className={`text-sm font-semibold ${
                    phase.status === 'locked' ? 'text-gray-400' : ''
                  }`}>{phase.name}</span>
                  {phase.status === 'locked' && <Lock className="w-3 h-3 ml-auto" />}
                  {phase.status === 'completed' && <CheckCircle2 className="w-3 h-3 ml-auto text-green-500" />}
                  {phase.status === 'active' && <ArrowRight className="w-3 h-3 ml-auto text-orange-500" />}
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
