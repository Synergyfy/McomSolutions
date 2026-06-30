import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingBag, Store, ArrowRight, Sparkles } from 'lucide-react';

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
          className="w-full max-w-7xl mx-auto flex flex-col items-center"
        >
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-12 max-w-4xl">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-xs font-bold tracking-wide text-orange-600 uppercase bg-orange-100 border border-orange-200 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              Welcome to the Future of Commerce
            </span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-orange-900 to-gray-800 drop-shadow-sm">
              How do you want to <br className="hidden md:block" />
              use <span className="text-orange-600 inline-block transform hover:scale-105 transition-transform duration-300 cursor-default filter drop-shadow-lg">McomMall</span>?
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed font-medium">
              Join thousands of users building the next generation marketplace.
              Select your role to get started with a tailored experience.
            </p>
          </motion.div>

          {/* Cards Container */}
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl"
          >
            {/* Shopper Card */}
            <div
              onClick={() => navigate('/signup?role=customer')}
              className="group w-full block h-full cursor-pointer"
            >
              <motion.div
                variants={itemVariants}
                whileHover={{
                  y: -12,
                  scale: 1.03,
                  boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25)',
                  borderColor: 'rgba(251, 146, 60, 0.8)',
                  transition: { type: 'spring', stiffness: 300, damping: 20 }
                }}
                className="h-full relative overflow-hidden p-10 rounded-[2.5rem] bg-white border border-orange-100/50 shadow-xl shadow-orange-500/5 transition-all flex flex-col justify-between min-h-[380px]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div>
                  <div className="w-16 h-16 mb-8 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform duration-300 ring-1 ring-orange-100">
                    <ShoppingBag className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 tracking-tight group-hover:text-orange-600 transition-colors">I am a Customer</h3>
                  <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-6 font-medium group-hover:text-gray-600">
                    Shop for unique products, enjoy secure transactions, and get the best deals from top-rated sellers.
                  </p>
                </div>

                <div className="flex items-center text-orange-600 text-sm md:text-base font-bold group-hover:translate-x-2 transition-transform">
                  Continue as Customer <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </motion.div>
            </div>

            {/* Merchant Card */}
            <div
              onClick={() => navigate('/getstarted/business')}
              className="group w-full block h-full cursor-pointer"
            >
              <motion.div
                variants={itemVariants}
                whileHover={{
                  y: -12,
                  scale: 1.03,
                  boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
                  borderColor: 'rgba(248, 113, 113, 0.8)',
                  transition: { type: 'spring', stiffness: 300, damping: 20 }
                }}
                className="h-full relative overflow-hidden p-10 rounded-[2.5rem] bg-white border border-red-100/50 shadow-xl shadow-red-500/5 transition-all flex flex-col justify-between min-h-[380px]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-red-50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                <div>
                  <div className="w-16 h-16 mb-8 rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-110 transition-transform duration-300 ring-1 ring-red-100">
                    <Store className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2 tracking-tight group-hover:text-red-600 transition-colors">I am a Business</h3>
                  <p className="text-gray-500 text-sm md:text-base leading-relaxed mb-6 font-medium group-hover:text-gray-600">
                    Launch your store in minutes. Access powerful tools to scale your business.
                  </p>
                </div>

                <div className="flex items-center text-red-600 text-sm md:text-base font-bold group-hover:translate-x-2 transition-transform">
                  Create Business Profile <ArrowRight className="ml-2 w-4 h-4" />
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Footer Area */}
          <motion.div variants={itemVariants} className="mt-16 text-center">
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
