import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles, TrendingUp, DollarSign, Users, Heart, Zap } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

const benefits = [
  { icon: TrendingUp, text: 'Increase Revenue' },
  { icon: DollarSign, text: 'Reduce Costs' },
  { icon: Users, text: 'Find New Customers' },
  { icon: Heart, text: 'Build Customer Loyalty' },
  { icon: Zap, text: 'Grow Smarter' },
];

export default function GetStartedRoleSelect() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-orange-50 via-white to-orange-50/50 text-gray-900 font-sans">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-orange-200/40 rounded-full blur-[130px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-red-200/40 rounded-full blur-[110px] animate-pulse delay-1000" />
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-20 md:px-8">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-4xl mx-auto flex flex-col items-center"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-10 max-w-4xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-xs font-bold tracking-wide text-orange-600 uppercase bg-orange-100 border border-orange-200 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              Welcome to MCOM
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-orange-900 to-gray-800 drop-shadow-sm">
              Helping Businesses <br className="hidden md:block" />
              <span className="text-orange-600">Grow Smarter</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed font-medium">
              Increase revenue, reduce costs, find new customers, build customer loyalty — all from one platform.
            </p>
          </motion.div>

          {/* Benefits Pills */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mb-10 max-w-2xl">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <span key={i} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-orange-100 rounded-full text-sm font-bold text-gray-700 shadow-sm">
                  <Icon className="w-4 h-4 text-orange-500" />
                  {b.text}
                </span>
              );
            })}
          </motion.div>

          {/* CTA Button */}
          <motion.div variants={itemVariants} className="w-full max-w-md">
            <button
              onClick={() => navigate('/getstarted/business')}
              className="group w-full relative overflow-hidden p-[2px] rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 shadow-2xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-shadow"
            >
              <div className="relative w-full bg-white rounded-2xl p-[2px]">
                <div className="w-full bg-white rounded-xl py-5 px-8 flex items-center justify-between">
                  <span className="text-xl font-black text-gray-900 group-hover:text-orange-600 transition-colors">
                    Get Started as a Business
                  </span>
                  <ArrowRight className="w-6 h-6 text-orange-500 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </button>
          </motion.div>

          {/* Footer Area */}
          <motion.div variants={itemVariants} className="mt-12 text-center">
            <p className="text-gray-500 mb-4 text-sm md:text-base">
              Already have an account?{' '}
              <Link to="/login" className="text-orange-600 hover:text-orange-700 font-bold transition-colors">
                Sign In
              </Link>
            </p>
            <div className="flex items-center justify-center gap-8 text-sm font-medium text-gray-400">
              <Link to="/terms" className="hover:text-orange-600 transition-colors">Terms of Service</Link>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              <Link to="/privacy" className="hover:text-orange-600 transition-colors">Privacy Policy</Link>
            </div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
