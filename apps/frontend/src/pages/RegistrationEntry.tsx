import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, User, Briefcase, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { persistReferralCodeFromSearchParams } from '../lib/referral';
import ChsLogoPattern from '../components/ChsLogoPattern';

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
      const businessParams = new URLSearchParams(searchParams);
      businessParams.set('entry', 'signup');
      navigate(`/getstarted/business?${businessParams.toString()}`);
    } else if (selectedRole === 'customer') {
      navigate(`/register/customer${searchStr}`);
    } else if (selectedRole === 'affiliate') {
      navigate(`/register/affiliate${searchStr}`);
    } else {
      alert('This registration flow is coming soon!');
    }
  };

  return (
      <div className="registration-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gray-50 p-4 sm:p-6 md:p-8">
      <ChsLogoPattern />

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
        className="w-full max-w-5xl rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_28px_90px_rgba(20,30,48,0.16)] backdrop-blur sm:rounded-[2rem] sm:p-8 md:p-11 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto mb-8 max-w-xl text-center sm:mb-10">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Create your account</p>
          <h1 className="text-3xl font-semibold tracking-[-0.045em] text-slate-950 sm:text-4xl">Join the Ecosystem</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500 sm:text-base">Choose the account type that best describes you.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <motion.button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                aria-pressed={isSelected}
                className={`group relative flex min-h-[190px] cursor-pointer flex-col items-start rounded-2xl border p-5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/20 sm:min-h-[205px] sm:p-6 ${
                  isSelected 
                    ? 'border-orange-500 bg-orange-50/80 shadow-[0_12px_32px_rgba(255,105,0,0.12)] ring-1 ring-orange-500'
                    : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-[0_12px_32px_rgba(20,30,48,0.08)]'
                }`}
              >
                <div className="mb-7 flex w-full items-center justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${isSelected ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors ${isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200 bg-white text-transparent group-hover:border-orange-300'}`}>
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                </div>
                <h3 className={`text-lg font-semibold tracking-tight sm:text-xl ${isSelected ? 'text-slate-950' : 'text-slate-800'}`}>
                  {role.title}
                </h3>
                <p className={`mt-1.5 max-w-[28ch] text-sm leading-6 ${isSelected ? 'text-orange-900/80' : 'text-slate-500'}`}>
                  {role.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        <div className="mt-7 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
          <p className={`text-center text-xs font-semibold sm:text-left ${selectedRole ? 'text-orange-600' : 'text-slate-400'}`}>{selectedRole ? `Selected: ${roles.find((role) => role.id === selectedRole)?.title}` : 'Select an account type to continue.'}</p>
          <motion.button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`flex w-full items-center justify-center gap-3 rounded-full px-8 py-3.5 text-sm font-semibold transition-all sm:w-auto sm:px-9 sm:py-4 sm:text-base ${
              selectedRole 
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20 hover:-translate-y-0.5 hover:bg-orange-700'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
            }`}
            whileHover={selectedRole ? { y: -1 } : {}}
            whileTap={selectedRole ? { scale: 0.99 } : {}}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
