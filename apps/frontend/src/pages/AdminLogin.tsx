import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Lock, Mail, Shield, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function AdminLogin() {
  const { login, isAuthenticated } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError('Invalid credentials. Please try again.');
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-brand-blue/5 blur-[150px] rounded-full" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-orange-500/5 blur-[150px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-glow mx-auto mb-6">
            AS
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-2">Admin Access</h1>
          <p className="text-gray-500 font-medium">MCOMSolutions Global Ecosystem</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 p-4 bg-red-50 rounded-2xl border border-red-100"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-sm font-bold text-red-600">{error}</span>
              </motion.div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@mcomsolutions.co.uk"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-blue/5 focus:bg-white transition-all font-bold text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-blue/5 focus:bg-white transition-all font-bold text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-2">2FA Code</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 2FA code"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-brand-blue/5 focus:bg-white transition-all font-bold text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-all shadow-glow flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" /> Sign In
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                className="text-sm font-bold text-gray-400 hover:text-brand-blue transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>

        <div className="text-center mt-8">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-brand-blue transition-colors">
            <ArrowRight className="w-4 h-4 rotate-180" /> Back to Main Site
          </a>
        </div>

        <div className="text-center mt-6">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            MCOMSolutions v2.0 — Ecosystem Control Center
          </p>
        </div>
      </motion.div>
    </div>
  );
}
