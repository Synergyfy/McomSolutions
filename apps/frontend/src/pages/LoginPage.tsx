import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Lock, ArrowRight, AlertCircle, LogOut, Loader2 } from 'lucide-react';
import { useLogin, usePostSsoAuthorize, useGetSsoToken, useCurrentUser, useLogout } from '../services/auth/hooks';
import { setSharedAuthCookies } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: login } = useLogin();
  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();
  const { mutateAsync: getSsoToken } = useGetSsoToken();
  const logout = useLogout();

  const clientId = searchParams.get('client_id');
  const hasSsoIntent = !!clientId;
  const { data: currentUser, isLoading: sessionLoading } = useCurrentUser(hasSsoIntent);

  const hasActiveSession = hasSsoIntent && !!currentUser && !sessionLoading;

  const performRedirect = async (clientIdParam?: string | null) => {
    const clientId = clientIdParam || searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');

    // Scenario A: Standard OAuth Flow
    if (clientId && redirectUri) {
      try {
        const authRes = await postSsoAuthorize({ clientId, redirectUri, scope: scope || undefined, state: state || undefined });
        window.location.href = `${redirectUri}?code=${authRes.code}&state=${state || ''}`;
        return;
      } catch (err) {
        console.error("SSO OAuth authorization failed", err);
      }
    }

    // Scenario B: Direct SSO / Shared Handshake Flow
    const source = searchParams.get('source') || (clientId === 'mcom-mall' ? 'mcommall' : clientId === 'mcom-loyalty' ? 'mcomloyalty' : null);
    const redirectParam = searchParams.get('redirect') || searchParams.get('callbackUrl') || state;
    
    let redirectTarget = null;
    let finalRedirectState = null;

    if (redirectParam) {
      if (redirectParam.startsWith('http://') || redirectParam.startsWith('https://')) {
        redirectTarget = redirectParam;
      } else {
        finalRedirectState = redirectParam;
      }
    }

    // Determine platform base SSO url if redirect target is relative or null
    if (!redirectTarget) {
      if (source === 'mcomloyalty') {
        redirectTarget = `${import.meta.env.VITE_MCOM_LOYALTY_URL || 'http://localhost:3005'}/sso-login`;
      } else if (source === 'mcommall') {
        redirectTarget = `${import.meta.env.VITE_MCOM_MALL_URL || 'http://localhost:3002'}/auth/sso`;
      }
    }

    if (redirectTarget) {
      try {
        const ssoRes = await getSsoToken(clientId || undefined);
        const separator = redirectTarget.includes('?') ? '&' : '?';
        const tokenParamName = redirectTarget.includes('sso_token') || redirectTarget.includes('/auth/sso') ? 'sso_token' : 'token';
        let targetUrl = `${redirectTarget}${separator}${tokenParamName}=${ssoRes.ssoToken}`;
        
        if (finalRedirectState) {
          targetUrl += `&state=${encodeURIComponent(finalRedirectState)}`;
        }
        
        window.location.href = targetUrl;
        return;
      } catch (err) {
        console.error('Failed to generate SSO token', err);
        navigate('/dashboard');
      }
    } else if (finalRedirectState) {
      navigate(finalRedirectState);
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      await performRedirect();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    const backendUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const authUrl = `${backendUrl}/auth/google`;

    const popup = window.open(
      authUrl,
      'google_oauth',
      'width=520,height=660,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      window.location.href = authUrl;
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      const allowedOrigins = [
        window.location.origin,
        'http://localhost:3010',
        'http://localhost:3000',
        'http://localhost:5173'
      ];
      if (!allowedOrigins.includes(event.origin)) return;
      if (event.data?.type !== 'GOOGLE_LOGIN_SUCCESS') return;

      window.removeEventListener('message', handleMessage);
      clearInterval(pollTimer);

      const { auth, user } = event.data;

      try {
        localStorage.setItem('auth_token', auth.accessToken);
        localStorage.setItem('business_user', JSON.stringify(user));
        setSharedAuthCookies(auth.accessToken, auth.refreshToken, user);

        await performRedirect(user.role === 'BUSINESS' ? 'mcom-mall' : undefined);
      } catch (err: any) {
        setError('Google authentication failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        window.removeEventListener('message', handleMessage);
        setLoading(false);
      }
    }, 600);
  };

  const getClientName = (id: string) => {
    if (id === 'mcom-mall') return 'MCOM Mall';
    if (id === 'mcom-loyalty') return 'MCOM Loyalty';
    if (id === '247gbs') return '24/7 GBS';
    return id;
  };

  const getInitials = (user: any) => {
    const first = user.firstName || '';
    const last = user.lastName || '';
    if (first || last) return `${first}${last}`.toUpperCase().slice(0, 2);
    return (user.email || '?')[0].toUpperCase();
  };

  const getDisplayName = (user: any) => {
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.email;
  };

  const handleContinueAsUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await performRedirect();
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentAccount = () => {
    logout();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass rounded-[2.5rem] p-10 shadow-2xl"
      >
        <AnimatePresence mode="wait">
          {hasActiveSession ? (
            <motion.div
              key="continue-as"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-xl shadow-blue-500/20">
                  24
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-500">You're already signed in to MCOM Solutions</p>
              </div>

              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-2xl flex items-center gap-2.5">
                <Lock className="w-5 h-5 shrink-0 text-blue-600" />
                <span>Signing in to access <strong>{getClientName(clientId!)}</strong></span>
              </div>

              <div className="mb-8 p-6 bg-white border border-gray-200 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-lg shrink-0">
                    {getInitials(currentUser)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900 truncate">{getDisplayName(currentUser)}</p>
                    <p className="text-sm text-gray-500 truncate">{currentUser.email}</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleContinueAsUser}
                disabled={loading}
                className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Continue as {currentUser.firstName || currentUser.email.split('@')[0]}
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <button
                onClick={handleUseDifferentAccount}
                disabled={loading}
                className="w-full mt-4 py-4 rounded-2xl font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                Use a different account
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6 shadow-xl shadow-blue-500/20">
                  24
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-500">Sign in to your 24/7 GBS account</p>
              </div>

              {clientId && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-2xl flex items-center gap-2.5">
                  <Lock className="w-5 h-5 shrink-0 text-blue-600" />
                  <span>Signing in to access <strong>{getClientName(clientId)}</strong></span>
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm font-semibold rounded-2xl flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
                  <input 
                    type="password" 
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand-blue focus:ring-brand-blue" />
                    <span className="text-gray-600">Remember me</span>
                  </label>
                  <a href="#" className="text-brand-blue font-bold hover:underline">Forgot password?</a>
                </div>

                <button 
                  disabled={loading}
                  className="w-full bg-brand-blue text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                  {!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-6">
                Don't have an account?{' '}
                <Link to={searchParams.toString() ? `/register?${searchParams.toString()}` : "/register"} className="text-brand-blue font-bold hover:underline">
                  Create Account
                </Link>
              </p>

              <div className="mt-10 pt-8 border-t border-gray-100 text-center">
                <p className="text-gray-500 mb-6">Or sign in with</p>
                <div className="flex justify-center">
                  <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full flex items-center justify-center gap-3 py-4 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-all font-bold text-gray-700 shadow-sm hover:shadow cursor-pointer"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                    Google
                  </button>
                </div>
              </div>

              <div className="mt-10 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Shield className="w-3 h-3" />
                <span>Secure SSO by 24/7 GBS Auth</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

