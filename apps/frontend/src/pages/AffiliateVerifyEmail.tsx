import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAffiliateAuthStore } from '../store/useAffiliateAuthStore';
import { useAffiliateAuth } from '../hooks/useAffiliateAuth';

export default function AffiliateVerifyEmail() {
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAffiliateAuthStore();
    const { verifyOtp, sendOtp, signup, login } = useAffiliateAuth();

    const regState = location.state as {
        firstName?: string;
        lastName?: string;
        email: string;
        password?: string;
        role?: string;
        devCode?: string;
        mode?: string;
    } | null;

    const [devCode, setDevCode] = useState<string | undefined>(regState?.devCode);
    const emailToVerify = regState?.email || user?.email || '';

    // Focus first input on mount
    useEffect(() => {
        if (inputsRef.current[0]) {
            inputsRef.current[0].focus();
        }
    }, []);

    // Cooldown countdown timer
    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handlePaste = (startIndex: number, e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedDigits = e.clipboardData.getData('text').replace(/\D/g, '');
        if (!pastedDigits) return;

        const newCode = [...code];
        // If 6 digits or pasted in the first box, start from 0; otherwise start from the focused box
        const start = pastedDigits.length === 6 ? 0 : startIndex;
        for (let i = 0; i < pastedDigits.length && (start + i) < 6; i++) {
            newCode[start + i] = pastedDigits[i];
        }
        setCode(newCode);
        setError(null);

        // Focus the next empty box or the last box
        const nextIndex = Math.min(start + pastedDigits.length, 5);
        inputsRef.current[nextIndex]?.focus();
    };

    const handleChange = (index: number, value: string) => {
        const digitsOnly = value.replace(/\D/g, '');
        if (!digitsOnly) {
            const newCode = [...code];
            newCode[index] = '';
            setCode(newCode);
            return;
        }

        // Handle multi-character input (such as mobile autofill or paste fallback)
        if (digitsOnly.length > 1) {
            const newCode = [...code];
            const start = digitsOnly.length === 6 ? 0 : index;
            for (let i = 0; i < digitsOnly.length && (start + i) < 6; i++) {
                newCode[start + i] = digitsOnly[i];
            }
            setCode(newCode);
            setError(null);
            const nextIndex = Math.min(start + digitsOnly.length, 5);
            inputsRef.current[nextIndex]?.focus();
            return;
        }

        // Single digit input
        const newCode = [...code];
        newCode[index] = digitsOnly;
        setCode(newCode);
        setError(null);

        // Auto-advance focus
        if (index < 5 && inputsRef.current[index + 1]) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0 && inputsRef.current[index - 1]) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowLeft' && index > 0) {
            inputsRef.current[index - 1]?.focus();
        } else if (e.key === 'ArrowRight' && index < 5) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length < 6) {
            setError('Please enter the complete 6-digit verification code.');
            return;
        }

        if (!emailToVerify) {
            setError('No email address provided. Please return to the registration page.');
            return;
        }

        setIsVerifying(true);
        setError(null);

        try {
            // Verify real OTP against backend
            await verifyOtp({ email: emailToVerify, code: fullCode });

            // If we have registration data, complete account creation
            if (regState?.password) {
                const normalizedRole = (regState.role || 'agent').toUpperCase().replace('-', '_');
                await signup({
                    email: regState.email,
                    password: regState.password,
                    firstName: regState.firstName,
                    lastName: regState.lastName,
                    role: normalizedRole,
                });
            }

            setSuccessMessage('Account successfully verified! Redirecting to 247GBS Affiliates portal...');

            setTimeout(() => {
                const ssoUrl = import.meta.env.VITE_AFFILIATE_SSO_URL || 'http://localhost:7088/api/v1/auth/sso/login';
                const portalUrl = import.meta.env.VITE_AFFILIATE_PORTAL_URL || 'http://localhost:7089';
                const cleanRole = (regState?.role || 'agent').toLowerCase().replace('_', '-');

                // If running in browser, launch SSO initiation or portal
                try {
                    window.location.href = ssoUrl;
                } catch {
                    window.location.href = `${portalUrl}/dashboard/${cleanRole}`;
                }
            }, 1200);

        } catch (err: any) {
            console.error('Verification failed', err);
            setError(err.response?.data?.message || err.message || 'Invalid or expired verification code. Please try again.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0 || isResending || !emailToVerify) return;

        setIsResending(true);
        setError(null);
        try {
            const res = await sendOtp(emailToVerify);
            setCooldown(60);
            if (res?.code) {
                setDevCode(res.code);
            }
            setSuccessMessage('A new verification code has been sent.');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error('Resend OTP failed', err);
            setError(err.response?.data?.message || err.message || 'Failed to resend code. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-display">
            {/* Left Side - Form */}
            <div className="w-full lg:w-1/2 flex flex-col justify-between p-8 md:p-12 lg:p-20 relative z-10">
                <div className="mb-12">
                    {/* Brand Logo */}
                    <div className="flex items-center gap-3">
                        <div className="text-primary size-8">
                            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-text-main font-display">247gbs affiliate</span>
                    </div>
                </div>

                <div className="max-w-md w-full mx-auto">
                    <div className="mb-8">
                        <Link to="/register/affiliate/signup" className="inline-flex items-center text-primary text-sm font-bold hover:underline transition-all duration-200 tracking-widest gap-2 group font-display">
                            <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Back to Signup
                        </Link>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-4xl font-bold mb-4 text-text-main tracking-tight">Verify email</h1>
                        <p className="text-text-secondary text-base leading-relaxed">
                            We've sent a 6-digit verification code to <span className="text-text-main font-bold">{emailToVerify || 'your email'}</span>. Please enter the code below to complete your registration.
                        </p>
                    </div>

                    {devCode && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl font-medium flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-amber-600 text-lg">terminal</span>
                                <div>
                                    <span className="font-bold">Dev Mode:</span> Code is <span className="font-mono font-bold tracking-widest text-base text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded">{devCode}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const digits = devCode.slice(0, 6).split('');
                                    setCode(digits);
                                    setError(null);
                                }}
                                className="text-xs bg-amber-200 hover:bg-amber-300 text-amber-900 px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer"
                            >
                                Auto-fill
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl font-medium">
                            {error}
                        </div>
                    )}

                    {successMessage && (
                        <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl font-medium flex items-center gap-2">
                            <span className="material-symbols-outlined text-emerald-600 text-xl">check_circle</span>
                            {successMessage}
                        </div>
                    )}

                    <div className="flex gap-2 sm:gap-3 mb-8 justify-between">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => { inputsRef.current[index] = el; }}
                                type="text"
                                inputMode="numeric"
                                autoComplete={index === 0 ? "one-time-code" : "off"}
                                maxLength={6}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={(e) => handlePaste(index, e)}
                                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-text-main"
                            />
                        ))}
                    </div>

                    <button
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 sm:py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-primary/25 tracking-widest active:scale-[0.98] text-sm uppercase mb-6 disabled:opacity-50 cursor-pointer"
                        type="button"
                        onClick={handleVerify}
                        disabled={isVerifying}
                    >
                        {isVerifying ? 'Verifying...' : 'Verify & Complete Account'}
                    </button>

                    <p className="text-center text-text-secondary font-medium text-sm">
                        Didn't receive the email?{' '}
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || isResending}
                            className="text-primary font-bold hover:underline disabled:opacity-50 cursor-pointer"
                        >
                            {cooldown > 0 ? `Resend Code in ${cooldown}s` : isResending ? 'Sending...' : 'Resend Code'}
                        </button>
                    </p>
                </div>

                <div className="mt-12 text-center lg:text-left">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        © 247gbs affiliate professional marketplace
                    </p>
                </div>
            </div>

            {/* Right Side - Image */}
            <div className="hidden lg:block w-1/2 relative bg-slate-900 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-slate-900/90 mix-blend-multiply z-10" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-50 grayscale hover:grayscale-0 transition-all duration-1000 transform hover:scale-105" />

                <div className="absolute bottom-20 left-12 right-12 z-20 text-white max-w-lg">
                    <div className="size-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/20">
                        <span className="material-symbols-outlined text-3xl">verified_user</span>
                    </div>
                    <h2 className="text-4xl font-bold mb-6 leading-tight">Secure & Trusted Marketplace</h2>
                    <p className="text-lg text-slate-300 font-medium leading-relaxed">
                        Join thousands of verified professionals. We ensure a safe environment for all transactions and collaborations within the 247gbs ecosystem.
                    </p>
                </div>
            </div>
        </div>
    );
}
