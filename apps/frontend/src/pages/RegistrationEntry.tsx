import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, User, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { persistReferralCodeFromSearchParams } from '../lib/referral';

export default function RegistrationEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Persist ?ref= so attribution survives the multi-step signup flows.
  useEffect(() => {
    persistReferralCodeFromSearchParams(searchParams);
  }, [searchParams]);

  const roles = [
    { id: 'business', title: 'Business', description: 'Register your company and set up your storefront', icon: Building2 },
    { id: 'customer', title: 'Customer', description: 'Create a personal account for the MCOM ecosystem', icon: User },
    { id: 'affiliate', title: 'Affiliate', description: 'Register as an affiliate or sales agent', icon: Briefcase },
  ];

  const handleContinue = () => {
    const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
    if (selectedRole === 'business') {
      navigate(`/getstarted/business${searchStr}`);
    } else if (selectedRole === 'customer') {
      navigate(`/register/customer${searchStr}`);
    } else if (selectedRole === 'affiliate') {
      navigate(`/register/affiliate${searchStr}`);
    } else {
      alert('This registration flow is coming soon!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-200/50 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-100/50 blur-[120px] pointer-events-none" />

      <motion.button 
        onClick={() => navigate('/')}
        className="self-start mb-4 sm:absolute sm:top-6 sm:left-8 text-gray-500 hover:text-gray-900 flex items-center text-sm font-medium transition-colors z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" />
        Back to Home
      </motion.button>

      <motion.div 
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 shadow-xl relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-2 sm:mb-3 tracking-tight">Join the Ecosystem</h1>
          <p className="text-gray-500 text-sm sm:text-base font-normal">Who are you registering as today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <motion.button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={`flex flex-col items-start p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border text-left transition-all ${
                  isSelected 
                    ? 'bg-orange-50 border-orange-500 shadow-[0_0_15px_rgba(255,105,0,0.15)] ring-1 ring-orange-500' 
                    : 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-md'
                }`}
              >
                <div className={`p-3 sm:p-3.5 rounded-xl mb-3 transition-colors ${isSelected ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className={`text-base sm:text-lg md:text-xl font-semibold mb-1 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                  {role.title}
                </h3>
                <p className={`text-xs sm:text-sm leading-relaxed ${isSelected ? 'text-orange-900' : 'text-gray-500'}`}>
                  {role.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        <div className="flex justify-center mt-4 sm:mt-6">
          <motion.button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`flex items-center justify-center w-full sm:w-auto px-8 sm:px-12 py-3.5 sm:py-4 rounded-full font-semibold text-base sm:text-lg transition-all ${
              selectedRole 
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            whileHover={selectedRole ? { scale: 1.02 } : {}}
            whileTap={selectedRole ? { scale: 0.98 } : {}}
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-1.5" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
