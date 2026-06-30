'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ShieldCheck, RefreshCw, X, ArrowRight, Gift, MapPin, Compass, Search, Smartphone, Mail, User, Shield, CheckCircle2, ChevronLeft, Lock } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { businessApi } from '../lib/api';

const UserRole = {
  BUSINESS: 'BUSINESS' as const,
  CUSTOMER: 'CUSTOMER' as const,
  AGENT: 'AGENT' as const,
  OWNER: 'OWNER' as const,
};

type UserRoleType = 'BUSINESS' | 'CUSTOMER' | 'AGENT' | 'OWNER';

// ═══════════════════════════════════════════════════════════
// Local Mock UI Components & Stubs
// ═══════════════════════════════════════════════════════════

// Real hooks wrapping McomSolutions API
function useCreateUser() {
  const [isPending, setIsPending] = useState(false);
  return {
    mutateAsync: async (data: any) => {
      setIsPending(true);
      try {
        const res = await businessApi.register(data);
        return res;
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
}

function useLogin() {
  const [isPending, setIsPending] = useState(false);
  return {
    mutateAsync: async (data: any) => {
      setIsPending(true);
      try {
        const res = await businessApi.login(data);
        return res;
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
}

function useSendOtp() {
  const [isPending, setIsPending] = useState(false);
  return {
    mutateAsync: async (data: any) => {
      setIsPending(true);
      try {
        const res = await businessApi.sendOtp(data.email);
        return res;
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
}

function useValidateOtp() {
  const [isPending, setIsPending] = useState(false);
  return {
    mutateAsync: async (data: any) => {
      setIsPending(true);
      try {
        const res = await businessApi.verifyOtp(data.email, data.otp);
        if (!res.valid) {
          throw new Error('Invalid verification code');
        }
        return { data: { valid: true } };
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
}

function useCheckEmail() {
  const [isPending, setIsPending] = useState(false);
  return {
    mutateAsync: async (email: string) => {
      // Direct pass-through
      return { exists: false };
    },
    isPending: false,
  };
}

function useAddShippingAddress() {
  return {
    mutateAsync: async (address: any) => {
      console.log('Mock: Shipping address added', address);
      return { success: true };
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
    <div className="flex gap-2 justify-center">
      {otp.map((digit, index) => (
        <input
          key={index}
          type="text"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          ref={(el) => { inputsRef.current[index] = el; }}
          className="w-12 h-14 text-center text-2xl border border-gray-300 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all font-bold text-gray-800 bg-gray-50"
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Customer Registration Component
// ═══════════════════════════════════════════════════════════
type Mode = 'login' | 'register' | 'forgot-password' | 'verify-email';
type Step = 'enter-email' | 'enter-otp' | 'registration-form' | 'address-details';

export default function CustomerRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect') || searchParams.get('callbackUrl') || '/dashboard';
  const roleParam = searchParams.get('role') || 'customer';

  const [mode, setMode] = useState<Mode>('register');
  const [step, setStep] = useState<Step>('enter-email');
  const [emailForVerification, setEmailForVerification] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRoleType | null>(UserRole.CUSTOMER);
  const [isRolePreselected, setIsRolePreselected] = useState(true);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '+44',
    password: '',
    confirmPassword: '',
    otp: '',
    addressLine1: '',
    city: '',
    postcode: '',
    country: 'United Kingdom',
  });

  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
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
    addressLine1: '',
    city: '',
    postcode: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showGoogleSignInPopup, setShowGoogleSignInPopup] = useState(false);

  // Load custom hooks
  const { isPending: createUserPending, mutateAsync: createUserAsync } = useCreateUser();
  const { isPending: loginPending, mutateAsync: loginAsync } = useLogin();
  const { isPending: sendOtpPending, mutateAsync: sendOtpAsync } = useSendOtp();
  const { isPending: validateOtpPending, mutateAsync: validateOtpAsync } = useValidateOtp();
  const { isPending: checkEmailPending, mutateAsync: checkEmailAsync } = useCheckEmail();
  const { mutateAsync: addAddressAsync } = useAddShippingAddress();

  useEffect(() => {
    if (roleParam === 'customer') {
      setSelectedRole(UserRole.CUSTOMER);
      setIsRolePreselected(true);
    } else if (roleParam === 'business') {
      setSelectedRole(UserRole.OWNER);
      setIsRolePreselected(true);
    } else {
      setIsRolePreselected(false);
    }
  }, [roleParam]);

  const handleToggleMode = (newMode: Mode) => {
    setMode(newMode);
    setStep('enter-email');
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '+44',
      password: '',
      confirmPassword: '',
      otp: '',
      addressLine1: '',
      city: '',
      postcode: '',
      country: 'United Kingdom',
    });
    setErrors({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      role: '',
      terms: '',
      otp: '',
      addressLine1: '',
      city: '',
      postcode: '',
    });
    setTermsAccepted(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Please enter a valid email address.';
  };

  const validatePhoneNumber = (phone: string) => {
    const phoneRegex = /^(\+44|0)7\d{9}$|^(\+44|0)\d{10}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''))
      ? ''
      : 'Please enter a valid UK phone number (e.g. +44 7911 123456).';
  };

  const validatePostcode = (postcode: string) => {
    const postcodeRegex = /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i;
    return postcodeRegex.test(postcode) ? '' : 'Please enter a valid UK postcode.';
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
      }

      if (currentStep === 'address-details') {
        if (!formData.postcode) {
          newErrors.postcode = 'Postcode is required.';
          isValid = false;
        } else {
          const postErr = validatePostcode(formData.postcode);
          if (postErr) {
            newErrors.postcode = postErr;
            isValid = false;
          }
        }

        if (!termsAccepted) {
          newErrors.terms = 'You must accept the Terms and Conditions.';
          isValid = false;
        }
      }
    } else if (mode === 'login') {
      if (!formData.email) {
        newErrors.email = 'Email is required.';
        isValid = false;
      }
      if (!formData.password) {
        newErrors.password = 'Password is required.';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSendOtp = async (email: string) => {
    try {
      await sendOtpAsync({
        email,
        type: 'VERIFICATION',
      });
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
        setStep('address-details');
      } else if (step === 'address-details') {
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

      // Save Address
      if (formData.postcode) {
        try {
          await addAddressAsync({
            addressName: 'Home',
            recipientName: `${formData.firstName} ${formData.lastName}`,
            phoneNumber: formData.phoneNumber,
            addressLine1: formData.addressLine1 || '',
            city: formData.city || '',
            state: '',
            country: formData.country,
            postalCode: formData.postcode,
            isMain: true
          });
        } catch (err) {
          console.error("Address save failed", err);
        }
      }

      setDialogMessage(`Account created successfully! Welcome, ${formData.firstName}!`);
      setIsSuccessDialogOpen(true);
      
      setTimeout(async () => {
        setIsSuccessDialogOpen(false);
        let redirectTarget = searchParams.get('redirect') || searchParams.get('callbackUrl');
        if (!redirectTarget) {
          const source = searchParams.get('source');
          if (source === 'mcomloyalty') {
            redirectTarget = 'http://localhost:3005/sso-login';
          } else if (source === 'mcommall') {
            redirectTarget = 'http://localhost:3002/auth/sso';
          }
        }

        if (redirectTarget) {
          try {
            const res = await businessApi.getSsoToken();
            const separator = redirectTarget.includes('?') ? '&' : '?';
            const tokenParamName = redirectTarget.includes('sso_token') || redirectTarget.includes('/auth/sso') ? 'sso_token' : 'token';
            window.location.href = `${redirectTarget}${separator}${tokenParamName}=${res.ssoToken}`;
          } catch (err) {
            console.error("Failed to generate SSO token", err);
            navigate(redirect);
          }
        } else {
          navigate(redirect);
        }
      }, 2000);

    } catch (error: any) {
      setDialogMessage(error.message || 'Failed to create account');
      setIsErrorDialogOpen(true);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await validateForm('enter-email');
    if (!isValid) return;

    try {
      await loginAsync({
        email: formData.email,
        password: formData.password,
      });
      
      setDialogMessage('Sign in successful!');
      setIsSuccessDialogOpen(true);
      
      setTimeout(async () => {
        setIsSuccessDialogOpen(false);
        let redirectTarget = searchParams.get('redirect') || searchParams.get('callbackUrl');
        if (!redirectTarget) {
          const source = searchParams.get('source');
          if (source === 'mcomloyalty') {
            redirectTarget = 'http://localhost:3005/sso-login';
          } else if (source === 'mcommall') {
            redirectTarget = 'http://localhost:3002/auth/sso';
          }
        }

        if (redirectTarget) {
          try {
            const res = await businessApi.getSsoToken();
            const separator = redirectTarget.includes('?') ? '&' : '?';
            const tokenParamName = redirectTarget.includes('sso_token') || redirectTarget.includes('/auth/sso') ? 'sso_token' : 'token';
            window.location.href = `${redirectTarget}${separator}${tokenParamName}=${res.ssoToken}`;
          } catch (err) {
            console.error("Failed to generate SSO token", err);
            navigate(redirect);
          }
        } else {
          navigate(redirect);
        }
      }, 1500);
    } catch (error: any) {
      setDialogMessage(error.message || 'Login failed');
      setIsErrorDialogOpen(true);
    }
  };

  const handleGoogleSignInStart = () => {
    setShowGoogleSignInPopup(true);
  };

  const handleGoogleSignInSelect = async (email: string) => {
    setShowGoogleSignInPopup(false);
    try {
      setDialogMessage('Sign in successful with Google!');
      setIsSuccessDialogOpen(true);
      setTimeout(() => {
        setIsSuccessDialogOpen(false);
        navigate(redirect);
      }, 1500);
    } catch (err: any) {
      setDialogMessage(err.message || 'Google Sign-in failed.');
      setIsErrorDialogOpen(true);
    }
  };

  return (
    <div className="flex justify-center items-center px-4 pt-16 sm:pt-24 pb-16 min-h-screen bg-gray-50/50 relative overflow-hidden">
      
      {/* Background decoration elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-200/40 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-orange-100/40 blur-[120px] pointer-events-none" />

      <button 
        onClick={() => navigate(-1)}
        className="absolute top-8 left-8 text-gray-500 hover:text-gray-900 flex items-center transition-colors font-bold text-sm bg-white/80 backdrop-blur-sm border border-gray-200 px-4 py-2 rounded-xl shadow-sm hover:shadow-md hover:scale-102 active:scale-98"
      >
        <ChevronLeft className="w-4 h-4 mr-1 text-orange-600" />
        Back
      </button>

      <div className="w-full max-w-md h-fit p-8 space-y-6 bg-white rounded-3xl shadow-2xl border border-gray-100 transition-all duration-300 relative z-10">
        
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/20 transform rotate-45">
            <span className="text-white font-black text-lg -rotate-45">M</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {mode === 'login' ? 'Sign In to McomMall' : 'Create Your Account'}
          </h1>
          {mode === 'register' && step === 'enter-otp' && (
            <p className="text-xs text-gray-400 mt-1 font-semibold">Enter OTP sent to {formData.email}</p>
          )}
        </div>

        <form className="mt-8 space-y-5" onSubmit={mode === 'login' ? handleLoginSubmit : (e) => e.preventDefault()}>
          
          {/* ═══════════════════════════════════════════════════════
              Login Mode Form
              ═══════════════════════════════════════════════════════ */}
          {mode === 'login' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    name="email" 
                    type="email"
                    value={formData.email} 
                    onChange={handleInputChange} 
                    placeholder="name@example.com" 
                    className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.email ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.email}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={formData.password} 
                    onChange={handleInputChange} 
                    placeholder="••••••••" 
                    className={`w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.password ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.password}</p>}
              </div>

              <button 
                type="submit" 
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                disabled={loginPending}
              >
                {loginPending ? 'Signing In...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-150"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest">or</span>
                <div className="flex-grow border-t border-gray-150"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignInStart}
                className="w-full h-12 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 transition-all flex items-center justify-center gap-2.5 font-bold text-xs text-gray-700 shadow-sm cursor-pointer"
              >
                <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.87z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.15C3.18 21.88 7.39 24 12 24z" />
                  <path fill="#FBBC05" d="M5.27 14.24A7.18 7.18 0 0 1 5 12c0-.79.13-1.57.38-2.32V6.53H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.37l4.06-3.13z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.39 0 3.18 2.12 1.21 5.37l4.06 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                </svg>
                Sign In with Google
              </button>

              <div className="text-center pt-2">
                <p className="text-sm text-gray-500 font-medium">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => handleToggleMode('register')} className="text-orange-600 font-bold hover:underline">
                    Sign Up
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              Register Mode Forms (Multi-step)
              ═══════════════════════════════════════════════════════ */}
          {mode === 'register' && (
            <>
              {/* Step 1: Email Address */}
              {step === 'enter-email' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        name="email" 
                        type="email"
                        value={formData.email} 
                        onChange={handleInputChange} 
                        placeholder="Enter your email" 
                        className={`w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.email ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                      />
                    </div>
                    {errors.email && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.email}</p>}
                  </div>
                  
                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
                    disabled={checkEmailPending || sendOtpPending}
                  >
                    {checkEmailPending ? 'Checking...' : sendOtpPending ? 'Sending OTP...' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  
                  <div className="text-center pt-2">
                    <p className="text-sm text-gray-500 font-medium">
                      Already have an account?{' '}
                      <button type="button" onClick={() => handleToggleMode('login')} className="text-orange-600 font-bold hover:underline">
                        Sign in
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {step === 'enter-otp' && (
                <div className="space-y-5">
                  <div className="text-center pb-2">
                    <p className="text-sm text-gray-500 font-medium">We've sent a 6-digit code to verification email.</p>
                  </div>
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
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">First Name</label>
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
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Name</label>
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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Number</label>
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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Password</label>
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
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Confirm Password</label>
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

                  <button 
                    type="button" 
                    onClick={handleNextStep} 
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98] mt-2 flex items-center justify-center gap-2"
                  >
                    Next
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Step 4: Address Details */}
              {step === 'address-details' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Postcode <span className="text-red-500">*</span></label>
                    <input 
                      name="postcode" 
                      value={formData.postcode} 
                      onChange={handleInputChange} 
                      placeholder="SW1A 1AA" 
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium ${errors.postcode ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''}`} 
                    />
                    {errors.postcode && <p className="text-red-500 text-xs mt-1 font-semibold">{errors.postcode}</p>}
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Address Line 1</label>
                    <input 
                      name="addressLine1" 
                      value={formData.addressLine1} 
                      onChange={handleInputChange} 
                      placeholder="123 High Street" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">City</label>
                    <input 
                      name="city" 
                      value={formData.city} 
                      onChange={handleInputChange} 
                      placeholder="London" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Country</label>
                    <input 
                      name="country" 
                      value={formData.country} 
                      readOnly 
                      className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 outline-none cursor-not-allowed" 
                    />
                  </div>

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
                      </Link>.
                    </label>
                  </div>
                  {errors.terms && <p className="text-red-500 text-xs font-semibold">{errors.terms}</p>}

                  <div className="flex gap-4 pt-2">
                    <button 
                      type="button" 
                      onClick={() => setStep('registration-form')} 
                      className="flex-1 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-bold transition-all active:scale-[0.98]"
                    >
                      Back
                    </button>
                    <button 
                      type="button" 
                      onClick={handleNextStep} 
                      className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-600/20 active:scale-[0.98]"
                      disabled={createUserPending}
                    >
                      {createUserPending ? 'Submitting...' : 'Sign Up'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </form>
      </div>

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

      {/* Google Mock Account Picker Popup */}
      <AnimatePresence>
        {showGoogleSignInPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setShowGoogleSignInPopup(false)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative z-10 border border-gray-100 overflow-hidden flex flex-col font-sans"
              style={{ minHeight: '380px' }}
            >
              <div className="bg-white px-4 py-3.5 flex items-center justify-between border-b border-gray-100 select-none">
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-orange-600 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">Sign in with Google</span>
                </div>
                <button type="button" onClick={() => setShowGoogleSignInPopup(false)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <svg className="w-12 h-12" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.87z" />
                      <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.15C3.18 21.88 7.39 24 12 24z" />
                      <path fill="#FBBC05" d="M5.27 14.24A7.18 7.18 0 0 1 5 12c0-.79.13-1.57.38-2.32V6.53H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.37l4.06-3.13z" />
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.39 0 3.18 2.12 1.21 5.37l4.06 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-sm font-bold text-gray-900">Choose an account</h3>
                    <p className="text-xs text-gray-400 mt-1">to continue to <span className="font-bold text-orange-600">McomSolutions</span></p>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[
                      { email: 'customer.jane@gmail.com', name: 'Jane Doe', initials: 'JD', bg: 'bg-orange-500' },
                      { email: 'guest.shopper@gmail.com', name: 'Guest Shopper', initials: 'GS', bg: 'bg-blue-500' }
                    ].map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => handleGoogleSignInSelect(acc.email)}
                        className="w-full p-3 border border-gray-150 rounded-2xl hover:bg-gray-50 transition-colors flex items-center gap-3 text-left cursor-pointer"
                      >
                        <div className={`w-8 h-8 rounded-full ${acc.bg} text-white flex items-center justify-center font-bold text-xs shadow-sm`}>
                          {acc.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 leading-none">{acc.name}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{acc.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
