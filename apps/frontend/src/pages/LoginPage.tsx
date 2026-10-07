import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Lock, ArrowRight, AlertCircle, LogOut, Loader2, Eye, EyeOff, UserX, X } from 'lucide-react';
import { useLogin, usePostSsoAuthorize, useGetSsoToken, useCurrentUser, useLogout } from '../services/auth/hooks';
import { authApi } from '../services/auth';
import { useAdminAuth } from '../context/AdminAuthContext';
import { setSharedAuthCookies } from '../services/api';
import CHSLogo from '../components/CHSLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAdminUser } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [notFoundEmail, setNotFoundEmail] = useState('');

  const { mutateAsync: login } = useLogin();
  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();
  const { mutateAsync: getSsoToken } = useGetSsoToken();
  const logout = useLogout();

  const clientId = searchParams.get('client_id');
  const source = searchParams.get('source');
  const redirectParam = searchParams.get('redirect') || searchParams.get('callbackUrl');
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
  const hasCookie = typeof document !== 'undefined' && (document.cookie.includes('access=') || document.cookie.includes('mcom_session=') || document.cookie.includes('userId='));
  const hasSsoIntent = !!clientId || !!source || !!redirectParam || !!searchParams.get('redirect_uri') || !!searchParams.get('state');
  // Only verify session if credentials actually exist in browser storage/cookies
  const shouldCheckSession = hasToken || hasCookie;

  // Affiliate roles have no dashboard here — a direct login (no SSO params)
  // sends them to the 247GBS affiliate portal instead of /dashboard.
  const getAffiliateDashboardUrl = () =>
    `${(import.meta.env.VITE_AFFILIATE_PORTAL_URL || 'https://247gbsaffiliates.centralhubsolution.com').replace(/\/$/, '')}/dashboard`;

  const redirectAffiliateToPortal = async (role?: string | null) => {
    if (!role || hasSsoIntent) return false;
    if (role !== 'AGENT' && role !== 'CONSULTANT' && role !== 'ACCOUNT_MANAGER') return false;
    const dashboardUrl = getAffiliateDashboardUrl();
    try {
      const ssoRes = await getSsoToken('247gbs-affiliate');
      const token = ssoRes?.ssoToken || ssoRes?.sso_token || ssoRes?.token;
      window.location.href = token ? `${dashboardUrl}?sso_token=${token}` : dashboardUrl;
    } catch {
      window.location.href = dashboardUrl;
    }
    return true;
  };

  const { data: currentUser, isLoading: sessionLoading } = useCurrentUser(shouldCheckSession);

  const hasActiveSession = !!currentUser && !sessionLoading;

  // Surfaced when the OAuth popup loses window.opener and falls back to a
  // full-page redirect (?googleError=...) instead of postMessage.
  // googleCode=NO_ACCOUNT means the Google email isn't registered → show
  // the same "No account found" modal as the password flow.
  useEffect(() => {
    const googleError = searchParams.get('googleError');
    if (googleError) {
      if (searchParams.get('googleCode') === 'NO_ACCOUNT') {
        setNotFoundEmail(searchParams.get('googleEmail') || '');
        setShowNotFoundModal(true);
        setError(null);
      } else {
        setError(googleError);
      }
      setLoading(false);
    }
  }, [searchParams]);

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
    const source = searchParams.get('source') || (clientId === 'mcom-mall' ? 'mcommall' : (clientId === 'mcom-loyalty' || clientId === 'mcom-reward') ? 'mcomloyalty' : null);
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
      if (source === 'mcomloyalty' || source === 'rewards' || source === 'mcom-loyalty') {
        redirectTarget = `${import.meta.env.VITE_MCOM_LOYALTY_URL || 'http://localhost:3005'}/sso-login`;
      } else if (source === 'mcommall' || source === 'mcom-mall') {
        redirectTarget = `${import.meta.env.VITE_MCOM_MALL_URL || 'http://localhost:3003'}/auth/sso`;
      }
    }

    const storedUser = localStorage.getItem('business_user');
    let effectiveRole = userRole;
    if (!effectiveRole && storedUser) {
      try { effectiveRole = JSON.parse(storedUser)?.role; } catch {}
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
        navigate(effectiveRole === 'CUSTOMER' ? '/customer' : '/dashboard');
      }
    } else if (finalRedirectState) {
      if (effectiveRole === 'CUSTOMER' && finalRedirectState.startsWith('/dashboard')) {
        navigate('/customer');
      } else {
        navigate(finalRedirectState);
      }
    } else {
      navigate(effectiveRole === 'CUSTOMER' ? '/customer' : '/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await login({ email, password });
      if (res?.user?.role === 'ADMIN') {
        const adminData = {
          id: res.user.id,
          email: res.user.email,
          name: res.user.name || `${res.user.firstName || ''} ${res.user.lastName || ''}`.trim() || 'System Admin',
          role: 'ADMIN',
        };
        localStorage.setItem('admin_user', JSON.stringify(adminData));
        setAdminUser(adminData);
        navigate('/admin');
        return;
      }

      // If business user without completed onboarding, take to /getstarted/business
      const userBizId = res?.user?.businessId || res?.user?.businessProfile?.id;
      const userIsOnboarded = res?.user?.isOnboarded ?? !!userBizId;
      if (res?.user?.role === 'BUSINESS' && (!userIsOnboarded || !userBizId)) {
        const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
        navigate(`/getstarted/business${searchStr}`);
        return;
      }

      // Affiliate roles logging in directly (not via SSO) belong on the
      // 247GBS affiliate portal, not the business dashboard.
      if (await redirectAffiliateToPortal(res?.user?.role)) {
        return;
      }

      // Customer roles logging in directly (not via SSO) belong on the customer portal
      if (res?.user?.role === 'CUSTOMER' && !hasSsoIntent) {
        navigate('/customer');
        return;
      }

      await performRedirect(res?.user?.role);
    } catch (err: any) {
      const status = err.response?.status;
      const attemptedEmail = email.trim();
      // Unknown email → offer registration instead of a dead-end error.
      // check-email is throttled server-side; failure falls back to the
      // generic message so login never breaks if the lookup fails.
      if (status === 401 && attemptedEmail.includes('@')) {
        try {
          const { exists } = await authApi.checkEmail(attemptedEmail);
          if (!exists) {
            setNotFoundEmail(attemptedEmail);
            setShowNotFoundModal(true);
            setError(null);
            return;
          }
        } catch {
          /* fall through to generic error below */
        }
      }
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Close the not-found modal with Escape for keyboard users.
  useEffect(() => {
    if (!showNotFoundModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowNotFoundModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNotFoundModal]);

  // /register keeps every SSO query param so the user lands back on the
  // originating platform (e.g. MCOM Mall "login with MCOM Solutions")
  // after completing registration. The typed email rides along as ?email=.
  const handleRegisterFromModal = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (notFoundEmail && !params.get('email')) params.set('email', notFoundEmail);
    setShowNotFoundModal(false);
    navigate(`/register?${params.toString()}`);
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    const backendUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const authUrl = `${backendUrl}/auth/google?returnUrl=${encodeURIComponent(window.location.origin)}`;

    const popup = window.open(
      authUrl,
      'google_oauth',
      'width=520,height=660,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      window.location.href = authUrl;
      return;
    }

    let completed = false;
    const handleMessage = async (event: MessageEvent) => {
      const getOrigin = (urlStr?: string) => {
        if (!urlStr) return '';
        try { return new URL(urlStr).origin; } catch { return ''; }
      };
      const allowedOrigins = [
        window.location.origin,
        getOrigin(import.meta.env.VITE_BACKEND_URL),
        getOrigin(import.meta.env.VITE_API_URL),
        'https://centralhubsolution.com',
        'https://www.centralhubsolution.com',
        'http://localhost:3010',
        'http://localhost:3000',
        'http://localhost:5173'
      ].filter(Boolean);
      if (!allowedOrigins.includes(event.origin)) {
        if (import.meta.env.DEV) {
          console.debug('[Google OAuth] ignored message from unexpected origin:', event.origin, event.data?.type);
        }
        return;
      }

      if (event.data?.type === 'GOOGLE_LOGIN_FAILURE') {
        completed = true;
        window.removeEventListener('message', handleMessage);
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        try { if (!popup.closed) popup.close(); } catch { /* noop */ }
        // Unknown Google email → same "No account found" modal as password
        // login, with the Gmail prefilled for the register handoff.
        if (event.data?.code === 'NO_ACCOUNT') {
          setNotFoundEmail(event.data?.email || '');
          setShowNotFoundModal(true);
          setError(null);
        } else {
          setError(event.data?.error || 'Google authentication failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      if (event.data?.type !== 'GOOGLE_LOGIN_SUCCESS') return;

      completed = true;
      window.removeEventListener('message', handleMessage);
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      try { if (!popup.closed) popup.close(); } catch { /* noop */ }

      const { auth, user } = event.data;

      try {
        localStorage.setItem('auth_token', auth.accessToken);
        localStorage.setItem('business_user', JSON.stringify(user));
        setSharedAuthCookies(auth.accessToken, auth.refreshToken, user);

        // If the user has not completed onboarding, take them directly to /getstarted/business
        const googleBizId = user?.businessId || user?.businessProfile?.id;
        const googleIsOnboarded = user?.isOnboarded ?? !!googleBizId;
        if (user?.role === 'BUSINESS' && (!googleIsOnboarded || !googleBizId)) {
          const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
          navigate(`/getstarted/business${searchStr}`);
          return;
        }

        // Affiliate roles logging in directly (not via SSO) belong on the
        // 247GBS affiliate portal, not the business dashboard.
        if (await redirectAffiliateToPortal(user?.role)) {
          return;
        }

        await performRedirect();
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
        clearTimeout(timeoutTimer);
        window.removeEventListener('message', handleMessage);
        if (!completed) {
          setError('Google sign-in was closed before completing. Please try again.');
        }
        setLoading(false);
      }
    }, 600);

    // Google account chooser can take a while, but never leave the parent
    // spinner running forever if the handoff (postMessage) never arrives —
    // e.g. opener severed, popup redirected to /login?googleError=....
    const timeoutTimer = setTimeout(() => {
      if (completed) return;
      window.removeEventListener('message', handleMessage);
      clearInterval(pollTimer);
      try { if (!popup.closed) popup.close(); } catch { /* noop */ }
      setLoading(false);
      setError((prev) => prev || 'Google sign-in timed out. Please try again.');
    }, 180000);
  };

  const getClientName = (id?: string | null) => {
    if (!id) return 'MCOM Solutions';
    if (id === 'mcom-mall' || id === 'mcommall') return 'MCOM Mall';
    if (id === 'mcom-loyalty' || id === 'mcomloyalty') return 'MCOM Loyalty';
    if (id === '247gbs' || id === '247gbs-affiliate') return '24/7 GBS Affiliate';
    return id;
  };

  const getInitials = (user: any) => {
    if (!user) return '?';
    const first = user.firstName || '';
    const last = user.lastName || '';
    if (first || last) return `${first}${last}`.toUpperCase().slice(0, 2);
    if (user.name) return user.name.slice(0, 2).toUpperCase();
    return (user.email || '?')[0].toUpperCase();
  };

  const getDisplayName = (user: any) => {
    if (!user) return 'User';
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    return name || user.name || user.email || 'User';
  };

  const handleContinueAsUser = async () => {
    setLoading(true);
    setError(null);
    try {
      if (currentUser?.role === 'ADMIN' && !clientId) {
        navigate('/admin');
        return;
      }
      const currentBizId = currentUser?.businessId || (currentUser as any)?.businessProfile?.id;
      const currentIsOnboarded = currentUser?.isOnboarded ?? !!currentBizId;
      if (currentUser?.role === 'BUSINESS' && (!currentIsOnboarded || !currentBizId) && !clientId) {
        const searchStr = searchParams.toString() ? `?${searchParams.toString()}` : '';
        navigate(`/getstarted/business${searchStr}`);
        return;
      }
      // Affiliate roles with an existing session and no SSO intent belong on
      // the 247GBS affiliate portal, not the business dashboard.
      if (await redirectAffiliateToPortal((currentUser as any)?.role)) {
        return;
      }
      await performRedirect();
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentAccount = () => {
    const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
    logout(`/login${search}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full glass rounded-[2.5rem] p-10 shadow-2xl"
      >
        <AnimatePresence>
          {shouldCheckSession && sessionLoading ? (
            <motion.div
              key="checking-session"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-8"
            >
              <div className="flex justify-center mb-6">
                <CHSLogo variant="full" size="xl" imageClassName="h-16" />
              </div>
              <div className="flex items-center justify-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
                <h2 className="text-xl font-bold text-gray-900">Verifying session...</h2>
              </div>
              <p className="text-sm text-gray-500">
                {clientId ? `Checking sign-in for ${getClientName(clientId)}` : 'Checking authentication status...'}
              </p>
            </motion.div>
          ) : hasActiveSession ? (
            <motion.div
              key="continue-as"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="text-center mb-10">
                <div className="flex justify-center mb-6">
                  <CHSLogo variant="full" size="xl" imageClassName="h-16" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-500">You're already signed in to Central Hub Solution (CHS)</p>
              </div>

              {clientId && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-2xl flex items-center gap-2.5">
                  <Lock className="w-5 h-5 shrink-0 text-blue-600" />
                  <span>Signing in to access <strong>{getClientName(clientId)}</strong></span>
                </div>
              )}

              <div className="mb-8 p-6 bg-white border border-gray-200 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-lg shrink-0">
                    {getInitials(currentUser)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-gray-900 truncate">{getDisplayName(currentUser)}</p>
                    <p className="text-sm text-gray-500 truncate">{currentUser?.email || ''}</p>
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
                    Continue as {currentUser?.firstName || currentUser?.name || currentUser?.email?.split('@')[0] || 'User'}
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
                <div className="flex justify-center mb-6">
                  <CHSLogo variant="full" size="xl" imageClassName="h-16" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                <p className="text-gray-500">Sign in to your Central Hub Solution (CHS) account</p>
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
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-5 py-4 pr-12 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
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
                <span>Secure SSO by Central Hub Solution (CHS)</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Email-not-found modal: mobile-first, bottom-sheet on small screens */}
      <AnimatePresence>
        {showNotFoundModal && (
          <motion.div
            key="email-not-found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
            onClick={() => setShowNotFoundModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-not-found-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 48, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 32, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:p-8"
            >
              <button
                type="button"
                onClick={() => setShowNotFoundModal(false)}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                <UserX className="h-7 w-7" />
              </div>

              <h2 id="email-not-found-title" className="mb-2 text-center text-xl font-bold text-gray-900 sm:text-2xl">
                No account found
              </h2>
              <p className="mb-1 text-center text-sm text-gray-500 sm:text-base">
                We couldn't find an account for
              </p>
              <p className="mb-5 break-all text-center text-sm font-bold text-gray-900 sm:text-base">
                {notFoundEmail}
              </p>
              <p className="mb-6 text-center text-sm text-gray-500">
                {hasSsoIntent
                  ? 'Create an account and we’ll take you straight back to continue signing in.'
                  : 'Create an account to get started — it only takes a minute.'}
              </p>

              <button
                type="button"
                onClick={handleRegisterFromModal}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue py-4 text-base font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.99]"
              >
                Create an account
                <ArrowRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowNotFoundModal(false)}
                className="mt-3 w-full rounded-2xl py-3.5 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-800"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

