import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Store, Search, Globe, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function BusinessRegistration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: '',
    country: '',
    phone: '',
    email: '',
    isOnGoogle: null as boolean | null,
    address: '',
    industry: '',
    category: '',
    description: '',
    website: '',
    logoUrl: '',
    openingHours: '',
    socialMedia: '',
    password: '',
    agreeTerms: false
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData({ ...formData, [name]: val });
  };

  const nextStep = () => {
    if (step === 2 && formData.isOnGoogle === true) {
      setStep(3); // Screen 3A
    } else if (step === 2 && formData.isOnGoogle === false) {
      setStep(4); // Screen 3B mapped to 4 here internally
    } else if (step === 3) {
      setStep(5); // Skip 3B, go to Storefront setup (Screen 4)
    } else if (step < 8) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step === 5 && formData.isOnGoogle === true) {
      setStep(3);
    } else if (step === 5 && formData.isOnGoogle === false) {
      setStep(4);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 7) {
      setStep(8); // Success screen
    } else {
      nextStep();
    }
  };

  const renderStepIndicator = () => {
    return (
      <div className="flex justify-center items-center mb-10 space-x-2">
        {[1, 2, 3, 4, 5, 6, 7].map((s) => (
          <div 
            key={s} 
            className={`h-2 rounded-full transition-all duration-300 ${
              step >= s ? 'bg-orange-500 w-10' : 'bg-gray-200 w-4'
            }`}
          />
        ))}
      </div>
    );
  };

  const inputClass = "w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all";
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-200/50 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-100/50 blur-[120px] pointer-events-none" />

      {step < 8 && (
        <motion.button 
          onClick={() => step === 1 ? navigate('/register') : prevStep()}
          className="absolute top-8 left-8 text-gray-500 hover:text-gray-900 flex items-center transition-colors z-20 font-medium"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          {step === 1 ? 'Back to Roles' : 'Previous Step'}
        </motion.button>
      )}

      <motion.div 
        className="w-full max-w-2xl bg-white border border-gray-200 rounded-3xl p-10 shadow-xl relative z-10 min-h-[550px] flex flex-col"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {step < 8 && renderStepIndicator()}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            
            {/* SCREEN 1: Business Information */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Business Information</h2>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Business Name</label>
                    <input type="text" name="businessName" required value={formData.businessName} onChange={handleChange} className={inputClass} placeholder="Acme Corp" />
                  </div>
                  <div>
                    <label className={labelClass}>Business Type</label>
                    <select name="businessType" required value={formData.businessType} onChange={handleChange} className={inputClass}>
                      <option value="">Select Type</option>
                      <option value="retail">Retail</option>
                      <option value="service">Service</option>
                      <option value="b2b">B2B / Wholesale</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Country</label>
                      <input type="text" name="country" required value={formData.country} onChange={handleChange} className={inputClass} placeholder="e.g. United States" />
                    </div>
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input type="tel" name="phone" required value={formData.phone} onChange={handleChange} className={inputClass} placeholder="+1 234 567 890" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" name="email" required value={formData.email} onChange={handleChange} className={inputClass} placeholder="contact@acme.com" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 2: Google Business Question */}
            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col justify-center items-center text-center py-10">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-8 shadow-inner">
                  <Globe className="w-12 h-12 text-blue-500" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Is your business already on Google?</h2>
                <p className="text-gray-500 mb-10 text-lg">We can import your details directly from Google Business to save you time.</p>
                <div className="flex space-x-4 w-full">
                  <button type="button" onClick={() => { setFormData({ ...formData, isOnGoogle: true }); nextStep(); }} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full font-bold transition-colors shadow-lg shadow-orange-500/20">
                    Yes, Connect Google
                  </button>
                  <button type="button" onClick={() => { setFormData({ ...formData, isOnGoogle: false }); nextStep(); }} className="flex-1 bg-white hover:bg-gray-50 text-gray-700 py-4 rounded-full font-bold transition-colors border border-gray-200">
                    No, Enter Manually
                  </button>
                </div>
              </motion.div>
            )}

            {/* SCREEN 3A: GOOGLE BUSINESS FLOW */}
            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col justify-center items-center text-center py-10">
                <Search className="w-20 h-20 text-orange-500 mb-8" />
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Connect Google Business</h2>
                <p className="text-gray-500 mb-8 text-lg">This is where the OAuth flow would open. For this demo, we'll simulate a successful connection.</p>
                <div className="bg-green-50 p-6 rounded-2xl border border-green-200 w-full max-w-md">
                  <p className="text-gray-900 font-bold mb-2 text-lg">Found Business: {formData.businessName || 'Your Business'}</p>
                  <p className="text-green-600 font-medium flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> Verified Profile
                  </p>
                </div>
              </motion.div>
            )}

            {/* SCREEN 3B: MANUAL BUSINESS FLOW */}
            {step === 4 && (
              <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Manual Business Entry</h2>
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Address</label>
                    <input type="text" name="address" required value={formData.address} onChange={handleChange} className={inputClass} placeholder="123 Commerce St" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Industry</label>
                      <input type="text" name="industry" required value={formData.industry} onChange={handleChange} className={inputClass} placeholder="Technology" />
                    </div>
                    <div>
                      <label className={labelClass}>Category</label>
                      <input type="text" name="category" required value={formData.category} onChange={handleChange} className={inputClass} placeholder="Software" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Description</label>
                    <textarea name="description" rows={3} required value={formData.description} onChange={handleChange} className={inputClass} placeholder="Tell us about your business..." />
                  </div>
                  <div>
                    <label className={labelClass}>Website URL (Optional)</label>
                    <input type="url" name="website" value={formData.website} onChange={handleChange} className={inputClass} placeholder="https://..." />
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 4: Storefront Setup */}
            {step === 5 && (
              <motion.div key="step5" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Storefront Setup</h2>
                <div className="space-y-5">
                  <div className="flex items-center space-x-6 mb-6">
                    <div className="w-24 h-24 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300">
                      <ImageIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                      <button type="button" className="px-6 py-3 bg-white text-gray-700 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors font-semibold shadow-sm">
                        Upload Logo
                      </button>
                      <p className="text-xs text-gray-400 mt-2">Recommended size: 500x500px</p>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Storefront Description</label>
                    <textarea name="description" rows={3} required value={formData.description} onChange={handleChange} className={inputClass} placeholder="Briefly describe what your storefront offers to customers..." />
                  </div>
                  <div>
                    <label className={labelClass}>Opening Hours</label>
                    <input type="text" name="openingHours" value={formData.openingHours} onChange={handleChange} className={inputClass} placeholder="e.g. Mon-Fri 9am-5pm" />
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 5: Business Profile Review */}
            {step === 6 && (
              <motion.div key="step6" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Review Business Profile</h2>
                <div className="bg-gray-50 p-8 rounded-2xl border border-gray-200 mb-6">
                  <div className="flex items-center mb-8">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-2xl font-bold text-orange-600 shadow-sm border border-orange-200">
                      {formData.businessName ? formData.businessName.charAt(0) : 'B'}
                    </div>
                    <div className="ml-5">
                      <h3 className="text-2xl font-bold text-gray-900">{formData.businessName || 'Business Name'}</h3>
                      <p className="text-orange-500 font-medium">{formData.businessType || 'Type'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div><span className="text-gray-500 block font-medium mb-1">Email</span> <span className="text-gray-900 font-semibold">{formData.email}</span></div>
                    <div><span className="text-gray-500 block font-medium mb-1">Phone</span> <span className="text-gray-900 font-semibold">{formData.phone}</span></div>
                    <div><span className="text-gray-500 block font-medium mb-1">Country</span> <span className="text-gray-900 font-semibold">{formData.country}</span></div>
                  </div>
                </div>
                <p className="text-gray-500 text-sm text-center font-medium">Everything look correct? You can always edit this later in your dashboard.</p>
              </motion.div>
            )}

            {/* SCREEN 6: Account Creation */}
            {step === 7 && (
              <motion.div key="step7" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-8">Create Your Account</h2>
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Set a Password</label>
                    <input type="password" name="password" required value={formData.password} onChange={handleChange} className={inputClass} placeholder="••••••••" />
                  </div>
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-start">
                    <input type="checkbox" name="agreeTerms" id="agreeTerms" required checked={formData.agreeTerms} onChange={handleChange} className="mt-1 h-5 w-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 bg-white" />
                    <label htmlFor="agreeTerms" className="ml-3 block text-sm text-gray-700 font-medium">
                      I agree to the <a href="#" className="text-orange-500 hover:text-orange-600 underline">Terms of Service</a> and <a href="#" className="text-orange-500 hover:text-orange-600 underline">Privacy Policy</a> of the MCOM Ecosystem.
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* SCREEN 7: Success */}
            {step === 8 && (
              <motion.div key="step8" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col justify-center items-center text-center py-10">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-8 shadow-inner">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">Registration Success!</h2>
                <p className="text-gray-600 mb-10 max-w-sm text-lg">Congratulations. Your business profile has been created and you are now part of the MCOM Ecosystem.</p>
                <button type="button" onClick={() => navigate('/dashboard')} className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full font-bold text-lg transition-colors shadow-lg shadow-orange-500/30">
                  Proceed to Dashboard
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons for Form Steps */}
          {step !== 2 && step !== 8 && (
            <div className="mt-10 flex justify-end pt-6 border-t border-gray-100">
              <button type="submit" className="flex items-center px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold transition-colors shadow-lg shadow-orange-500/20">
                {step === 7 ? 'Complete Registration' : 'Continue'}
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}
