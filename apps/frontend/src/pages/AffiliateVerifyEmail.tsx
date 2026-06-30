import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAffiliateAuthStore } from '../store/useAffiliateAuthStore';

export default function AffiliateVerifyEmail() {
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
    const navigate = useNavigate();
    const { user } = useAffiliateAuthStore();

    // Focus first input on mount
    useEffect(() => {
        if (inputsRef.current[0]) {
            inputsRef.current[0].focus();
        }
    }, []);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) value = value.slice(0, 1);

        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);

        // Auto-advance focus
        if (value && index < 5 && inputsRef.current[index + 1]) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !code[index] && index > 0 && inputsRef.current[index - 1]) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const handleVerify = () => {
        const fullCode = code.join('');
        if (fullCode === '123456') {
            navigate('/onboarding');
        } else {
            alert('Invalid verification code. Please try again.');
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
                        <a href="/register/affiliate/signup" className="inline-flex items-center text-primary text-sm font-bold hover:underline transition-all duration-200 tracking-widest gap-2 group font-display">
                            <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Back to Signup
                        </a>
                    </div>

                    <div className="mb-10">
                        <h1 className="text-4xl font-bold mb-4 text-text-main tracking-tight">Verify email</h1>
                        <p className="text-text-secondary text-lg leading-relaxed">
                            We've sent a 6-digit verification code to <span className="text-text-main font-bold">{user?.email || 'your email'}</span>. Please enter the code below to verify your account.
                        </p>
                    </div>

                    <div className="flex gap-3 mb-10 justify-between">
                        {code.map((digit, index) => (
                            <input
                                key={index}
                                ref={el => { inputsRef.current[index] = el }}
                                type="text"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                className="w-12 h-16 md:w-14 md:h-16 text-center text-2xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all text-text-main"
                            />
                        ))}
                    </div>

                    <div className="mb-6 bg-slate-50 p-3 rounded-lg text-center text-sm text-slate-500">
                        Demo Code: <span className="font-bold text-primary tracking-widest">123456</span>
                    </div>

                    <button
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-5 rounded-2xl transition-all duration-300 shadow-xl shadow-primary/25 tracking-widest active:scale-[0.98] text-sm uppercase mb-6"
                        type="button"
                        onClick={handleVerify}
                    >
                        Verify Account
                    </button>

                    <p className="text-center text-text-secondary font-medium">
                        Didn't receive the email? <button className="text-primary font-bold hover:underline">Resend Code</button>
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
