import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Briefcase, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';

export default function RegistrationEntry() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const roles = [
    { id: 'business', title: 'Business', description: 'Register your company and set up your storefront', icon: Building2 },
    { id: 'customer', title: 'Customer', description: 'Create a personal account for the MCOM ecosystem', icon: User },
    { id: 'affiliate', title: 'Affiliate', description: 'Register as an affiliate or sales agent', icon: Briefcase },
  ];

  const handleContinue = () => {
    if (selectedRole === 'business') {
      navigate('/getstarted/business');
    } else if (selectedRole === 'customer') {
      navigate('/register/customer');
    } else if (selectedRole === 'affiliate') {
      navigate('/register/affiliate');
    } else {
      alert('This registration flow is coming soon!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-200/50 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-100/50 blur-[120px] pointer-events-none" />

      <motion.button 
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 text-gray-500 hover:text-gray-900 flex items-center transition-colors"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Home
      </motion.button>

      <motion.div 
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-10 shadow-xl relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Join the Ecosystem</h1>
          <p className="text-gray-600 text-lg">Who are you registering as today?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {roles.map((role) => {
            const Icon = role.icon;
            const isSelected = selectedRole === role.id;
            return (
              <motion.button
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex flex-col items-start p-6 rounded-2xl border text-left transition-all ${
                  isSelected 
                    ? 'bg-orange-50 border-orange-500 shadow-[0_0_15px_rgba(255,105,0,0.15)] ring-1 ring-orange-500' 
                    : 'bg-white border-gray-200 hover:border-orange-300 hover:shadow-md'
                }`}
              >
                <div className={`p-4 rounded-xl mb-4 transition-colors ${isSelected ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : 'bg-gray-100 text-gray-500'}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                  {role.title}
                </h3>
                <p className={`text-sm ${isSelected ? 'text-orange-800' : 'text-gray-500'}`}>
                  {role.description}
                </p>
              </motion.button>
            );
          })}
        </div>

        <div className="flex justify-center mt-8">
          <motion.button
            onClick={handleContinue}
            disabled={!selectedRole}
            className={`flex items-center justify-center w-full md:w-auto px-12 py-4 rounded-full font-bold text-lg transition-all ${
              selectedRole 
                ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            whileHover={selectedRole ? { scale: 1.05 } : {}}
            whileTap={selectedRole ? { scale: 0.95 } : {}}
          >
            Continue
            <ChevronRight className="w-6 h-6 ml-2" />
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
