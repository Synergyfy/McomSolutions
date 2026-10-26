'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ShieldCheck, RefreshCw, X, ArrowRight, Gift, MapPin, Compass, Search, Smartphone, Mail, User, Shield, CheckCircle2, ChevronLeft, Lock, Loader2 } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useRegister, useLogin as useLoginHook, useSendOtp as useSendOtpHook, useVerifyOtp as useVerifyOtpHook, usePostSsoAuthorize, useGetSsoToken } from '../services/auth/hooks';
import CHSLogo from '../components/CHSLogo';
import FieldRequirementHint from '../components/onboarding/FieldRequirementHint';

import { apiClient, setSharedAuthCookies } from '../services/api';
import { validateEmailAddress } from '../lib/validation';
import { persistReferralCodeFromSearchParams, getStoredReferralCode } from '../lib/referral';
import { isAuthOrOnboardingRedirect } from '../lib/redirects';

const UserRole = {
  BUSINESS: 'BUSINESS' as const,
  CUSTOMER: 'CUSTOMER' as const,
  AGENT: 'AGENT' as const,
  CONSULTANT: 'CONSULTANT' as const,
  ACCOUNT_MANAGER: 'ACCOUNT_MANAGER' as const,
  OWNER: 'OWNER' as const,
};

type UserRoleType = 'BUSINESS' | 'CUSTOMER' | 'AGENT' | 'CONSULTANT' | 'ACCOUNT_MANAGER' | 'OWNER';

// ═══════════════════════════════════════════════════════════
// Local UI helpers wrapping McomSolutions API hooks
// ═══════════════════════════════════════════════════════════

// Real hooks wrapping McomSolutions API
function useCreateUser() {
  const { mutateAsync, isPending } = useRegister();
  return { mutateAsync, isPending };
}

function useLogin() {
  const { mutateAsync, isPending } = useLoginHook();
  return { mutateAsync, isPending };
}

function useSendOtp() {
  const { mutateAsync, isPending } = useSendOtpHook();
  return {
    mutateAsync: async (data: { email: string; type?: string }) => {
      return mutateAsync(data.email);
    },
    isPending,
  };
}

function useValidateOtp() {
  const { mutateAsync, isPending } = useVerifyOtpHook();
  return {
    mutateAsync: async (data: { email: string; otp: string; type?: string }) => {
      const res = await mutateAsync({ email: data.email, code: data.otp });
      if (!res?.valid) {
        throw new Error('Invalid or expired verification code');
      }
      return { data: { valid: true } };
    },
    isPending,
  };
}

function useCheckEmail() {
  return {
    mutateAsync: async (email: string) => {
      const res = await apiClient.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
      return res.data;
    },
    isPending: false,
  };
}

// ═══════════════════════════════════════════════════════════
// OTP Input Component (ported from McomMall)
// ═══════════════════════════════════════════════════════════
interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
}

function OTPInput({ length = 6, value, onChange }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (value && value.length === length) {
      setOtp(value.split(''));
    }
  }, [value, length]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    if (isNaN(Number(val))) return;

    const newOtp = [...otp];
    newOtp[index] = val.substring(val.length - 1);
    setOtp(newOtp);
    onChange(newOtp.join(''));

    if (val && index < length - 1 && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0 && inputsRef.current[index - 1]) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, length);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('');
    while (newOtp.length < length) newOtp.push('');
    setOtp(newOtp);
    onChange(newOtp.join(''));

    const focusIndex = Math.min(pastedData.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  };

  return (
    <div className="flex gap-1.5 sm:gap-2 justify-center">
      {otp.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          ref={(el) => { inputsRef.current[index] = el; }}
          className="w-9 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl border border-gray-300 rounded-lg sm:rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-bold text-gray-800 bg-gray-50"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Customer Registration Component
// ═══════════════════════════════════════════════════════════
type Step = 'enter-email' | 'enter-otp' | 'registration-form';

export default function CustomerRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || searchParams.get('callbackUrl') || '/customer';
  const roleParam = searchParams.get('role') || 'customer';

  const getClientName = (id: string) => {
    if (id === 'mcom-mall') return 'MCOM Mall';
    if (id === 'mcom-loyalty' || id === 'mcom-reward') return 'MCOM Loyalty';
    if (id === '247gbs') return '24/7 GBS';
    return id;
  };

  const clientId = searchParams.get('client_id');
  const redirectUri = searchParams.get('redirect_uri');
  const state = searchParams.get('state');
  const scope = searchParams.get('scope');
  const loginParams = new URLSearchParams(searchParams);
  for (const key of ['redirect', 'callbackUrl']) {
    const value = loginParams.get(key);
    if (value && isAuthOrOnboardingRedirect(value)) loginParams.delete(key);
  }
  const universalLoginHref = loginParams.toString() ? `/login?${loginParams.toString()}` : '/login';

  // Persist ?ref= so referral attribution survives the OTP + form steps.
  useEffect(() => {
    persistReferralCodeFromSearchParams(searchParams);
  }, [searchParams]);

  const mode = 'register' as const;
  const [step, setStep] = useState<Step>('enter-email');
  const [emailForVerification, setEmailForVerification] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRoleType | null>(UserRole.CUSTOMER);
  const [isRolePreselected, setIsRolePreselected] = useState(true);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: searchParams.get('email') || '',
    phoneNumber: '+44',
    password: '',
    confirmPassword: '',
    otp: '',
    country: 'United Kingdom',
  });

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: '',
    terms: '',
    otp: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpMode, setOtpMode] = useState<'mock' | 'email' | null>(null);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  // Load custom hooks
  const { isPending: createUserPending, mutateAsync: createUserAsync } = useCreateUser();
  const { mutateAsync: loginAsync } = useLogin();
  const { isPending: sendOtpPending, mutateAsync: sendOtpAsync } = useSendOtp();
  const { isPending: validateOtpPending, mutateAsync: validateOtpAsync } = useValidateOtp();
  const { isPending: checkEmailPending, mutateAsync: checkEmailAsync } = useCheckEmail();

  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();
  const { mutateAsync: getSsoToken } = useGetSsoToken();

  // Backend enforces a 60s OTP cooldown; mirror it in the UI.
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpResendCooldown]);

  const performRedirect = async () => {
    if (clientId && redirectUri) {
      try {
        const authRes = await postSsoAuthorize({ clientId, redirectUri, scope: scope || undefined, state: state || undefined });
        window.location.href = `${redirectUri}?code=${authRes.code}&state=${state || ''}`;
        return;
      } catch (err) {
        console.error("SSO OAuth authorization failed", err);
      }
    }

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

    if (!redirectTarget) {
      if (source === 'mcomloyalty' || source === 'rewards' || source === 'mcom-loyalty') {
        redirectTarget = `${import.meta.env.VITE_MCOM_LOYALTY_URL || 'http://localhost:3005'}/sso-login`;
      } else if (source === 'mcommall' || source === 'mcom-mall') {
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
        console.error("Failed to generate SSO token", err);
        navigate(redirect.startsWith('/dashboard') ? '/customer' : redirect);
      }
    } else if (finalRedirectState && !finalRedirectState.startsWith('/dashboard')) {
      navigate(finalRedirectState);
    } else {
      navigate('/customer');
    }
  };

  const handleGoogleAuth = () => {
    setIsGoogleLoading(true);
    const backendUrl = import.meta.env.VITE_API_URL || '/api/v1';
    const refCode = getStoredReferralCode() || searchParams.get('ref') || '';
    const params = new URLSearchParams({
      returnUrl: window.location.origin,
      role: 'CUSTOMER',
      mode: mode,
    });
    if (refCode) params.set('ref', refCode);

    const authUrl = `${backendUrl}/auth/google?${params.toString()}`;

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
        return;
      }

      if (event.data?.type === 'GOOGLE_LOGIN_FAILURE') {
        completed = true;
        window.removeEventListener('message', handleMessage);
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        try { if (!popup.closed) popup.close(); } catch { /* noop */ }
        setDialogMessage(event.data?.error || 'Google authentication failed. Please try again.');
        setIsErrorDialogOpen(true);
        setIsGoogleLoading(false);
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

        const welcomeName = user?.name || user?.firstName || 'Customer';
        setDialogMessage(`Welcome, ${welcomeName}! Signed in successfully.`);
        setIsSuccessDialogOpen(true);

        setTimeout(async () => {
          setIsSuccessDialogOpen(false);
          await performRedirect();
        }, 1200);
      } catch (err: any) {
        setDialogMessage('Google authentication failed. Please try again.');
        setIsErrorDialogOpen(true);
      } finally {
        setIsGoogleLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer);
        clearTimeout(timeoutTimer);
        window.removeEventListener('message', handleMessage);
        if (!completed) {
          setIsGoogleLoading(false);
        }
      }
    }, 600);

    const timeoutTimer = setTimeout(() => {
      if (completed) return;
      window.removeEventListener('message', handleMessage);
      clearInterval(pollTimer);
      try { if (!popup.closed) popup.close(); } catch { /* noop */ }
      setIsGoogleLoading(false);
    }, 180000);
  };

  useEffect(() => {
    const r = (roleParam || '').toLowerCase().replace('-', '_');
    if (r === 'customer') {
      setSelectedRole(UserRole.CUSTOMER);
      setIsRolePreselected(true);
    } else if (r === 'business') {
      setSelectedRole(UserRole.OWNER);
      setIsRolePreselected(true);
    } else if (r === 'agent') {
      setSelectedRole(UserRole.AGENT);
      setIsRolePreselected(true);
    } else if (r === 'consultant') {
      setSelectedRole(UserRole.CONSULTANT);
      setIsRolePreselected(true);
    } else if (r === 'account_manager') {
      setSelectedRole(UserRole.ACCOUNT_MANAGER);
      setIsRolePreselected(true);
    } else {
      setIsRolePreselected(false);
    }
  }, [roleParam]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateEmail = (email: string) => {
    return validateEmailAddress(email) ?? '';
  };

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^(\+44|0)7\d{9}$|^(\+44|0)\d{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''))
      ? ''
      : 'Please enter a valid UK phone number (e.g. +44 7911 123456).';
  };

  const validateForm = async (currentStep: Step) => {
    let isValid = true;
    const newErrors = { ...errors };

    if (mode === 'register') {
      if (currentStep === 'enter-email') {
        if (!formData.email) {
          newErrors.email = 'Email is required.';
          isValid = false;
        } else {
          const emailError = validateEmail(formData.email);
          if (emailError) {
            newErrors.email = emailError;
            isValid = false;
          } else {
            try {
              const result = await checkEmailAsync(formData.email);
              if (result.exists) {
                newErrors.email = 'This email is already registered. Please sign in.';
                isValid = false;
              } else {
                newErrors.email = '';
              }
            } catch (error) {
              console.error('Email check failed', error);
            }
          }
        }
      }

      if (currentStep === 'enter-otp') {
        if (!formData.otp || formData.otp.length < 6) {
          newErrors.otp = 'Please enter a valid 6-digit OTP.';
          isValid = false;
        } else {
          newErrors.otp = '';
        }
      }

      if (currentStep === 'registration-form') {
        if (!formData.firstName) {
          newErrors.firstName = 'First Name is required.';
          isValid = false;
        }
        if (!formData.lastName) {
          newErrors.lastName = 'Last Name is required.';
          isValid = false;
        }
        if (!formData.phoneNumber) {
          newErrors.phoneNumber = 'Phone number is required.';
          isValid = false;
        } else {
          const phoneErr = validatePhoneNumber(formData.phoneNumber);
          if (phoneErr) {
            newErrors.phoneNumber = phoneErr;
            isValid = false;
          }
        }

        if (!formData.password) {
          newErrors.password = 'Password is required.';
          isValid = false;
        }
        if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match.';
          isValid = false;
        }

        if (!termsAccepted) {
          newErrors.terms = 'You must accept the Terms and Conditions.';
          isValid = false;
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSendOtp = async (email: string) => {
    try {
      const res = await sendOtpAsync({
        email,
        type: 'VERIFICATION',
      });
      setOtpMode((res as any)?.mode ?? null);
      setDevOtpCode((res as any)?.code ?? null);
      setOtpResendCooldown(60);
      return true;
    } catch (error: any) {
      setDialogMessage(error.message || 'Failed to send OTP');
      setIsErrorDialogOpen(true);
      return false;
    }
  };

  const handleNextStep = async () => {
    if (mode === 'register') {
      const isValid = await validateForm(step);
      if (!isValid) return;

      if (step === 'enter-email') {
        const sent = await handleSendOtp(formData.email);
        if (sent) {
          setEmailForVerification(formData.email);
          setStep('enter-otp');
        }
      } else if (step === 'enter-otp') {
        try {
          await validateOtpAsync({
            email: formData.email,
            otp: formData.otp,
            type: 'VERIFICATION',
          });
          setStep('registration-form');
        } catch (error: any) {
          setErrors(prev => ({ ...prev, otp: error.message || 'Invalid OTP' }));
        }
      } else if (step === 'registration-form') {
        handleSubmitRegistration();
      }
    }
  };

  const handleSubmitRegistration = async () => {
    const payload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      password: formData.password,
      confirm_password: formData.confirmPassword,
      role: selectedRole!,
    };

    try {
      await createUserAsync(payload);
      
      // Auto login after registration
      const response = await loginAsync({
        email: formData.email,
        password: formData.password,
      });

      setDialogMessage(`Account created successfully! Welcome, ${formData.firstName}!`);
      setIsSuccessDialogOpen(true);
      
      setTimeout(async () => {
        setIsSuccessDialogOpen(false);
        await performRedirect();
      }, 2000);

    } catch (error: any) {
      setDialogMessage(error.message || 'Failed to create account');
      setIsErrorDialogOpen(true);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#f6f8fc] text-slate-950">
      <div className="pointer-events-none absolute -left-40 -top-48 h-[26rem] w-[26rem] rounded-full bg-orange-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 -right-40 h-[30rem] w-[30rem] rounded-full bg-blue-100/50 blur-3xl" />

      <button
        onClick={() => navigate(-1)}
        className="absolute left-4 top-4 z-20 inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3.5 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-orange-200 hover:text-slate-950 sm:left-8 sm:top-7 sm:px-4"
      >
        <ChevronLeft className="h-4 w-4 text-orange-600" />
        Back
      </button>

      <main className="relative mx-auto flex min-h-dvh w-full max-w-7xl items-center justify-center px-4 py-20 sm:px-8 sm:py-24">
        <section className="grid w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white bg-white shadow-[0_28px_90px_rgba(20,30,48,0.14)] sm:rounded-[2rem] lg:min-h-[600px] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#fff6ed] via-[#fffaf5] to-[#eef4ff] p-10 lg:flex xl:p-12">
            <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full border border-orange-200/70" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-44 w-44 rounded-full border border-orange-200/60" />
            <div className="relative">
              <CHSLogo variant="full" size="lg" imageClassName="h-11 w-auto" />
              <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-700">One connected ecosystem</p>
              <h2 className="mt-4 max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 xl:text-[2.8rem]">
                Your world, <span className="text-orange-600">all connected.</span>
              </h2>
              <p className="mt-5 max-w-sm text-base leading-7 text-slate-600">
                Create one CHS account to bring your MCOM experience together, from rewards and your wallet to local offers.
              </p>
            </div>
            <p className="relative text-xs font-medium tracking-wide text-slate-500">CENTRAL HUB SOLUTION · CUSTOMER ACCOUNT</p>
          </aside>

          <div className="relative flex min-w-0 flex-col justify-center px-5 py-8 sm:px-10 sm:py-11 lg:px-12 xl:px-16">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <CHSLogo variant="full" size="md" imageClassName="h-9 w-auto" />
              <span className="rounded-full bg-orange-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-orange-700">Customer signup</span>
            </div>

            <div className="mb-7">
              <p className="hidden text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700 lg:block">Create your CHS account</p>
              <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
                {step === 'enter-email' ? 'Create your account' : step === 'enter-otp' ? 'Verify your email' : 'Complete your profile'}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                {step === 'enter-email' ? 'Start with Google or use your email address.' : step === 'enter-otp' ? `Enter the code we sent to ${formData.email}.` : 'Add your details to finish setting up your account.'}
              </p>
            </div>

            {clientId && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
                <Lock className="h-4 w-4 shrink-0 text-orange-600" />
                <span>Creating your CHS account for <strong>{getClientName(clientId)}</strong></span>
              </div>
            )}

            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          {/* ═══════════════════════════════════════════════════════
              Register Mode Forms (Multi-step)
              ═══════════════════════════════════════════════════════ */}
          {mode === 'register' && (
            <>
              {/* Step 1: Email Address */}
              {step === 'enter-email' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isGoogleLoading || checkEmailPending || sendOtpPending}
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 group"
                  >
                    {isGoogleLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                        <span>Connecting to Google...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold text-gray-400">
                      <span className="bg-white px-3">or use email</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="signup-email" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Email address<FieldRequirementHint kind="required" /></label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input 
                        id="signup-email"
                        name="email" 
                        type="email"
                        value={formData.email} 
                        onChange={handleInputChange} 
                        placeholder="Enter your email" 
                        autoComplete="email"
                        className={`h-12 w-full rounded-xl border bg-slate-50 pl-11 pr-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 sm:text-sm ${errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200'}`}
                      />
                    </div>
                    {errors.email && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{errors.email}</p>}
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f45100] to-[#ff6900] px-4 py-3.5 font-semibold text-white shadow-[0_10px_22px_rgba(244,81,0,0.2)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={checkEmailPending || sendOtpPending}
                  >
                    {checkEmailPending ? 'Checking...' : sendOtpPending ? 'Sending OTP...' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  
                  <div className="text-center pt-2">
                    <p className="text-sm text-gray-500 font-medium">
                      Already have an account?{' '}
                      <Link to={universalLoginHref} className="text-orange-600 font-bold hover:underline">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {step === 'enter-otp' && (
                <div className="space-y-5">
                  <div className="text-center pb-2">
                    <p className="text-sm text-gray-500 font-medium">
                      We've sent a 6-digit code to <span className="font-bold text-gray-800">{formData.email}</span>.
                    </p>
                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-gray-500">Verification code<FieldRequirementHint kind="required" /></p>
                  </div>
                  {otpMode === 'mock' && devOtpCode && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-700">Mock verification code</p>
                      <p className="mt-1 text-3xl font-black tracking-[0.3em] text-amber-900">{devOtpCode}</p>
                    </div>
                  )}
                  <OTPInput length={6} value={formData.otp} onChange={(otp) => setFormData(prev => ({ ...prev, otp }))} />
                  {errors.otp && <p className="text-red-500 text-xs text-center font-semibold">{errors.otp}</p>}
                  
                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]"
                    disabled={validateOtpPending}
                  >
                    {validateOtpPending ? 'Verifying...' : 'Verify OTP'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendOtp(formData.email)}
                    disabled={sendOtpPending || otpResendCooldown > 0}
                    className="w-full py-2 text-xs text-gray-500 hover:text-orange-600 rounded-xl font-bold transition-colors uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sendOtpPending
                      ? 'Sending...'
                      : otpResendCooldown > 0
                        ? `Resend code in ${otpResendCooldown}s`
                        : "Didn't receive it? Resend code"}
                  </button>
                  
                  <button 
                    type="button" 
                    onClick={() => setStep('enter-email')} 
                    className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 rounded-xl font-bold hover:bg-gray-50 transition-colors uppercase tracking-widest"
                  >
                    Change Email
                  </button>
                </div>
              )}

              {/* Step 3: Registration Form */}
              {step === 'registration-form' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">First Name<FieldRequirementHint kind="required" /></label>
                      <input 
                        name="firstName" 
                        value={formData.firstName} 
                        onChange={handleInputChange} 
                        placeholder="John" 
                        className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.firstName ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                      />
                      {errors.firstName && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.firstName}</p>}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Name<FieldRequirementHint kind="required" /></label>
                      <input 
                        name="lastName" 
                        value={formData.lastName} 
                        onChange={handleInputChange} 
                        placeholder="Doe" 
                        className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.lastName ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                      />
                      {errors.lastName && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number<FieldRequirementHint kind="required" /></label>
                    <input 
                      name="phoneNumber" 
                      value={formData.phoneNumber} 
                      onChange={handleInputChange} 
                      placeholder="+44 7911 123456" 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.phoneNumber ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                    />
                    {errors.phoneNumber && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.phoneNumber}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password<FieldRequirementHint kind="required" /></label>
                    <div className="relative">
                      <input 
                        name="password" 
                        type={showPassword ? 'text' : 'password'} 
                        value={formData.password} 
                        onChange={handleInputChange} 
                        placeholder="••••••••" 
                        className={`w-full px-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.password ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm Password<FieldRequirementHint kind="required" /></label>
                    <div className="relative">
                      <input 
                        name="confirmPassword" 
                        type={showConfirmPassword ? 'text' : 'password'} 
                        value={formData.confirmPassword} 
                        onChange={handleInputChange} 
                        placeholder="••••••••" 
                        className={`w-full px-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.confirmPassword}</p>}
                  </div>

                  {!isRolePreselected && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Role</label>
                      <div className="flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => setSelectedRole(UserRole.CUSTOMER)} 
                          className={`flex-1 py-3 rounded-xl font-bold border text-sm transition-all ${
                            selectedRole === UserRole.CUSTOMER 
                              ? 'bg-orange-600 border-orange-600 text-white shadow-md' 
                              : 'bg-white border-gray-200 text-gray-600 hover:border-orange-200'
                          }`}
                        >
                          Customer
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setSelectedRole(UserRole.OWNER)} 
                          className={`flex-1 py-3 rounded-xl font-bold border text-sm transition-all ${
                            selectedRole === UserRole.OWNER 
                              ? 'bg-orange-600 border-orange-600 text-white shadow-md' 
                              : 'bg-white border-gray-200 text-gray-600 hover:border-orange-200'
                          }`}
                        >
                          Business
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2.5 pt-2">
                    <input 
                      type="checkbox" 
                      id="terms" 
                      checked={termsAccepted} 
                      onChange={(e) => setTermsAccepted(e.target.checked)} 
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 accent-orange-600" 
                    />
                    <label htmlFor="terms" className="text-xs text-gray-600 font-medium leading-relaxed">
                      I accept the{' '}
                      <Link to="/terms" className="text-orange-600 font-bold hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-orange-600 font-bold hover:underline">
                        Privacy Policy
                      </Link>.<FieldRequirementHint kind="required" />
                    </label>
                  </div>
                  {errors.terms && <p className="text-red-500 text-xs font-semibold">{errors.terms}</p>}

                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                    disabled={createUserPending}
                  >
                    {createUserPending ? 'Submitting...' : 'Sign Up'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
            </form>
          </div>
        </section>
      </main>

      {/* Success Dialog Overlay */}
      <AnimatePresence>
        {isSuccessDialogOpen && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Success!</h2>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed">{dialogMessage}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Dialog Overlay */}
      <AnimatePresence>
        {isErrorDialogOpen && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <X className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-black text-red-600 mb-2">Error Occurred</h2>
              <p className="text-sm font-semibold text-gray-500 leading-relaxed mb-6">{dialogMessage}</p>
              <button 
                onClick={() => setIsErrorDialogOpen(false)} 
                className="w-full py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
