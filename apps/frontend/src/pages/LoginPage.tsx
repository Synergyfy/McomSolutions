import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Lock, ArrowRight, AlertCircle, LogOut, Loader2, Eye, EyeOff, UserX, X, Mail, KeyRound, CheckCircle2 } from 'lucide-react';
import { useLogin, usePostSsoAuthorize, useGetSsoToken, useCurrentUser, useLogout, useForgotPassword, useResetPassword } from '../services/auth/hooks';
import { authApi } from '../services/auth';
import { useAdminAuth } from '../context/AdminAuthContext';
import { setSharedAuthCookies } from '../services/api';
import { isAuthOrOnboardingRedirect } from '../lib/redirects';
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

  // Forgot-password flow: request a reset code, then exchange it for a new password.
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<'email' | 'reset' | 'done'>('email');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [forgotConfirm, setForgotConfirm] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotInfo, setForgotInfo] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const { mutateAsync: requestPasswordReset } = useForgotPassword();
  const { mutateAsync: submitPasswordReset } = useResetPassword();

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

  // When handing off to onboarding, keep the SSO intent but drop any
  // redirect that points back into the auth/onboarding funnel. Otherwise a
  // login started from the onboarding "Log in here" link bounces straight
  // back into onboarding (with a nested ?redirect=...) forever.
  const buildOnboardingSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ['redirect', 'callbackUrl']) {
      const value = params.get(key);
      if (value && isAuthOrOnboardingRedirect(value)) params.delete(key);
    }
    const search = params.toString();
    return search ? `?${search}` : '';
  };

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

  const performRedirect = async (userRole?: string | null) => {
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');

    // Scenario A: Standard OAuth Flow
    if (clientId && redirectUri) {
      try {
        const authRes = await postSsoAuthorize({ clientId, redirectUri, scope: scope || undefined, state: state || undefined });
        window.location.href = `${redirectUri}?code=${authRes.code}&state=${state || ''}`;
        return;
      } catch (err: any) {
        console.error("SSO OAuth authorization failed", err);
        setError(err.response?.data?.message || 'SSO authorization failed. Please try again or contact support.');
        return;
      }
    }

    // Scenario B: Direct SSO / Shared Handshake Flow
    const rawSource = searchParams.get('source');
    const source = rawSource || (
      clientId === 'mcom-mall' ? 'mcommall' : 
      (clientId === 'mcom-loyalty' || clientId === 'mcom-reward' || clientId === 'rewards') ? 'mcomloyalty' : 
      null
    );
    const redirectParam = searchParams.get('redirect') || searchParams.get('callbackUrl');
    
    let redirectTarget = null;
    let finalRedirectState = null;

    if (redirectParam) {
      // A redirect into /login, /register, /getstarted, etc. is not a real
      // destination — it would send an authenticated user back into the
      // signup funnel. Fall through to the role-appropriate default.
      if (isAuthOrOnboardingRedirect(redirectParam)) {
        // no-op
      } else if (redirectParam.startsWith('http://') || redirectParam.startsWith('https://')) {
        redirectTarget = redirectParam;
      } else {
        finalRedirectState = redirectParam;
      }
    } else if (state && (state.startsWith('/') || state.startsWith('http://') || state.startsWith('https://'))) {
      if (!isAuthOrOnboardingRedirect(state)) {
        if (state.startsWith('http://') || state.startsWith('https://')) {
          redirectTarget = state;
        } else {
          finalRedirectState = state;
        }
      }
    }

    // Determine platform base SSO url if redirect target is relative or null
    if (!redirectTarget) {
      if (source === 'mcomloyalty' || source === 'rewards' || source === 'mcom-loyalty' || source === 'mcom-reward' || source === 'reward') {
        redirectTarget = `${import.meta.env.VITE_MCOM_LOYALTY_URL || 'http://localhost:3005'}/sso-login`;
      } else if (source === 'mcommall' || source === 'mcom-mall' || source === 'mall') {
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
        
        if (state) {
          targetUrl += `&state=${encodeURIComponent(state)}`;
        }
        
        window.location.href = targetUrl;
        return;
      } catch (err: any) {
        console.error('Failed to generate SSO token', err);
        setError(err.response?.data?.message || 'Failed to generate single sign-on token.');
        return;
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
        const searchStr = buildOnboardingSearch();
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
      if (!err.response) {
        setError('We could not reach the sign-in service. Please check that the backend is running and try again.');
        return;
      }
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

  // Escape also dismisses the forgot-password dialog (never mid-request).
  useEffect(() => {
    if (!showForgotModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeForgotModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForgotModal, forgotLoading]);

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
          const searchStr = buildOnboardingSearch();
          navigate(`/getstarted/business${searchStr}`);
          return;
        }

        // Affiliate roles logging in directly (not via SSO) belong on the
        // 247GBS affiliate portal, not the business dashboard.
        if (await redirectAffiliateToPortal(user?.role)) {
          return;
        }

        await performRedirect(user?.role);
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
        const searchStr = buildOnboardingSearch();
        navigate(`/getstarted/business${searchStr}`);
        return;
      }
      // Affiliate roles with an existing session and no SSO intent belong on
      // the 247GBS affiliate portal, not the business dashboard.
      if (await redirectAffiliateToPortal((currentUser as any)?.role)) {
        return;
      }
      await performRedirect((currentUser as any)?.role);
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

  const openForgotModal = () => {
    setForgotEmail(email);
    setForgotStep('email');
    setForgotCode('');
    setForgotPassword('');
    setForgotConfirm('');
    setForgotError(null);
    setForgotInfo(null);
    setShowForgotModal(true);
  };

  const closeForgotModal = () => {
    if (forgotLoading) return;
    setShowForgotModal(false);
    setForgotError(null);
    setForgotInfo(null);
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim();
    if (!targetEmail) {
      setForgotError('Enter the email address linked to your account.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    setForgotInfo(null);
    try {
      const res = await requestPasswordReset(targetEmail);
      // The backend returns the code directly in mock/dev mode (no mailer).
      if (res?.resetCode) {
        setForgotCode(res.resetCode);
        setForgotInfo(`Development mode: your reset code is ${res.resetCode}.`);
      } else {
        setForgotInfo(`A 6-digit reset code is on its way to ${targetEmail}. Check your inbox and spam folder.`);
      }
      setForgotStep('reset');
    } catch (err: any) {
      if (!err?.response) {
        setForgotError('We could not reach the sign-in service. Check your connection and try again.');
      } else if (err.response.status === 429) {
        setForgotError('Too many requests. Please wait a minute before trying again.');
      } else {
        setForgotError(err.response?.data?.message || 'We could not send a reset code. Please try again.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim();
    const code = forgotCode.trim();
    if (!code) {
      setForgotError('Enter the reset code from your email.');
      return;
    }
    if (forgotPassword !== forgotConfirm) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (
      forgotPassword.length < 8 ||
      !/[A-Z]/.test(forgotPassword) ||
      !/[0-9]/.test(forgotPassword) ||
      !/[!@#$%^&*(),.?":{}|<>]/.test(forgotPassword)
    ) {
      setForgotError('Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character.');
      return;
    }
    setForgotLoading(true);
    setForgotError(null);
    try {
      await submitPasswordReset({ email: targetEmail, code, newPassword: forgotPassword });
      setForgotStep('done');
      setEmail(targetEmail);
      setPassword('');
    } catch (err: any) {
      if (!err?.response) {
        setForgotError('We could not reach the sign-in service. Check your connection and try again.');
      } else if (err.response.status === 429) {
        setForgotError('Too many attempts. Please wait a minute before trying again.');
      } else {
        setForgotError(err.response?.data?.message || 'That reset code is invalid or has expired. Request a new one.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-start justify-center overflow-x-hidden bg-[#f5f7fb] px-4 pb-8 pt-20 sm:items-center sm:px-8 sm:py-24">
      <div className="pointer-events-none absolute -right-40 -top-44 h-[30rem] w-[30rem] rounded-full bg-orange-100/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 -left-40 h-[28rem] w-[28rem] rounded-full bg-blue-100/60 blur-3xl" />
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute left-4 top-4 z-20 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-orange-200 hover:text-slate-950 sm:left-8 sm:top-7 sm:px-4"
      >
        <ArrowRight className="h-4 w-4 rotate-180 text-orange-600" />
        Back
      </button>
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_28px_90px_rgba(20,30,48,0.16)] sm:rounded-[2rem] md:grid-cols-[0.86fr_1.14fr] lg:min-h-[650px]"
      >
        <section className="relative flex flex-col justify-between overflow-hidden bg-[#14243a] px-5 py-5 text-white sm:px-8 sm:py-7 md:px-9 md:py-10 lg:px-12 lg:py-12" aria-label="Welcome">
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full border border-orange-400/20" />
          <div className="relative">
            <CHSLogo variant="full" size="xl" imageClassName="h-9 sm:h-11 md:h-12" />
          </div>
          <div className="relative mt-5 hidden md:mt-14 md:block lg:mt-20">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-orange-300 sm:text-xs">One connected ecosystem</p>
            <h1 className="max-w-md text-[1.55rem] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-2xl md:text-4xl lg:text-[2.7rem]">
              One account.<br />Your whole world, <span className="text-orange-400">connected.</span>
            </h1>
            <p className="mt-3 max-w-md text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6 md:mt-5 md:text-base">
              For customers, businesses, partners, and teams: one secure sign-in for your Central Hub services.
            </p>
          </div>
          <p className="relative mt-5 hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 md:mt-12 md:block">Customers <span className="mx-1 text-orange-400">·</span> Businesses <span className="mx-1 text-orange-400">·</span> Partners</p>
        </section>
        <section className="min-w-0 bg-white px-5 py-7 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-9 sm:py-10 lg:px-14 lg:py-12" aria-label="Sign in">
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
              <div className="mb-5">
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
                <p className="text-gray-500">You're already signed in to Central Hub Solution.</p>
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
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">Welcome back</p>
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">Sign in to your account</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Access your CHS services with one secure sign-in.</p>
              </div>

              {clientId && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-semibold rounded-xl flex items-center gap-2.5">
                  <Lock className="w-5 h-5 shrink-0 text-blue-600" />
                  <span>Signing in to access <strong>{getClientName(clientId)}</strong></span>
                </div>
              )}

              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700" role="alert">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                  className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-orange-600" /> : (
                  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.2 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                {loading ? 'Connecting to Google…' : 'Continue with Google'}
              </button>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                <div className="relative flex justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400"><span className="bg-white px-3">or sign in with email</span></div>
              </div>

              <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Email address</label>
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-600">Password</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'} 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-orange-600 focus:ring-orange-500" />
                    <span className="text-slate-600">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={openForgotModal}
                    className="text-brand-blue font-bold hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                <button 
                  disabled={loading}
                  className="group flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f45100] to-[#ff6900] py-3.5 text-base font-semibold text-white shadow-[0_10px_22px_rgba(244,81,0,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Signing In...' : 'Sign In'}
                  {!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
                </button>
              </form>

              <p className="text-center text-sm text-gray-600 mt-4">
                Don't have an account?{' '}
                <Link to={searchParams.toString() ? `/register?${searchParams.toString()}` : "/register"} className="font-semibold text-orange-700 hover:underline">
                  Create Account
                </Link>
              </p>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
                <Shield className="h-3.5 w-3.5 text-orange-600" />
                <span>Secure sign-in by Central Hub Solution</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </section>
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

      {/* Forgot-password modal: request code → set new password → confirmation */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            key="forgot-password"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6"
            onClick={closeForgotModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
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
                onClick={closeForgotModal}
                disabled={forgotLoading}
                aria-label="Close"
                className="absolute right-4 top-4 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>

              {forgotStep === 'email' && (
                <form onSubmit={handleForgotRequest}>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-brand-blue">
                    <Mail className="h-7 w-7" />
                  </div>
                  <h2 id="forgot-password-title" className="mb-2 text-center text-xl font-bold text-gray-900 sm:text-2xl">
                    Reset your password
                  </h2>
                  <p className="mb-6 text-center text-sm text-gray-500">
                    Enter the email linked to your account and we'll send you a 6-digit reset code.
                  </p>

                  {forgotError && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <label htmlFor="forgot-email" className="mb-2 block text-sm font-bold text-gray-700">
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base transition-all focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue py-3.5 text-base font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.99] disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Send reset code
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    disabled={forgotLoading}
                    className="mt-3 w-full rounded-2xl py-3.5 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                  >
                    Back to sign in
                  </button>
                </form>
              )}

              {forgotStep === 'reset' && (
                <form onSubmit={handleForgotReset}>
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-brand-blue">
                    <KeyRound className="h-7 w-7" />
                  </div>
                  <h2 id="forgot-password-title" className="mb-2 text-center text-xl font-bold text-gray-900 sm:text-2xl">
                    Enter your reset code
                  </h2>
                  <p className="mb-5 break-all text-center text-sm text-gray-500">
                    We sent a code to <span className="font-bold text-gray-900">{forgotEmail.trim()}</span>
                  </p>

                  {forgotInfo && (
                    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                      {forgotInfo}
                    </div>
                  )}
                  {forgotError && (
                    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                      <AlertCircle className="h-5 w-5 shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <label htmlFor="forgot-code" className="mb-2 block text-sm font-bold text-gray-700">
                    Reset Code
                  </label>
                  <input
                    id="forgot-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    maxLength={6}
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg font-bold tracking-[0.4em] transition-all focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />

                  <label htmlFor="forgot-new-password" className="mb-2 mt-4 block text-sm font-bold text-gray-700">
                    New Password
                  </label>
                  <input
                    id="forgot-new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={forgotPassword}
                    onChange={(e) => setForgotPassword(e.target.value)}
                    placeholder="••••••••"
                    className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base transition-all focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />

                  <label htmlFor="forgot-confirm-password" className="mb-2 mt-4 block text-sm font-bold text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    id="forgot-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={forgotConfirm}
                    onChange={(e) => setForgotConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="min-h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base transition-all focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    At least 8 characters with 1 uppercase letter, 1 number, and 1 special character.
                  </p>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue py-3.5 text-base font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.99] disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Updating password...
                      </>
                    ) : (
                      <>
                        Reset password
                        <ArrowRight className="h-5 w-5" />
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep('email');
                      setForgotError(null);
                      setForgotInfo(null);
                      setForgotCode('');
                    }}
                    disabled={forgotLoading}
                    className="mt-3 w-full rounded-2xl py-3.5 text-sm font-bold text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
                  >
                    Use a different email
                  </button>
                </form>
              )}

              {forgotStep === 'done' && (
                <div className="text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-600">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <h2 id="forgot-password-title" className="mb-2 text-xl font-bold text-gray-900 sm:text-2xl">
                    Password updated
                  </h2>
                  <p className="mb-6 text-sm text-gray-500">
                    Your password has been reset and any other sessions were signed out. You can now sign in with your new password.
                  </p>
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-blue py-3.5 text-base font-bold text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-600 active:scale-[0.99]"
                  >
                    Back to sign in
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

