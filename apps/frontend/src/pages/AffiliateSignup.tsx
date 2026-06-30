import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import AuthSidebar from "../components/affiliate-auth/AuthSidebar";
import AuthInput from "../components/affiliate-auth/AuthInput";
import { useAffiliateAuth } from "../hooks/useAffiliateAuth";
import { UserRole } from "../types/affiliate-auth";

export default function AffiliateSignup() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { signup, isSigningUp } = useAffiliateAuth();
    const [role, setRole] = useState<UserRole>('agent');

    useEffect(() => {
        const roleParam = searchParams.get("role");
        if (roleParam) {
            const mappedRole = roleParam === 'account-manager' ? 'account_manager' : roleParam;
            if (['agent', 'account_manager', 'consultant'].includes(mappedRole)) {
                setRole(mappedRole as UserRole);
            }
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const firstName = formData.get('firstName') as string;
        const lastName = formData.get('lastName') as string;
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            await signup({ email, password, firstName, lastName, role });
        } catch (error: any) {
            console.error("Signup failed", error);
            if (error.response?.status === 409) {
                alert("This email is already registered. Please sign in or use a different email.");
            } else {
                alert(error.response?.data?.message || "An error occurred during signup. Please try again.");
            }
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-display">
            <AuthSidebar
                title="Scale your professional services with confidence."
                imageSrc="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2026&auto=format&fit=crop"
                description=""
                features={[
                    "Access to a network of high-value corporate clients.",
                    "Advanced project management & analytics dashboard.",
                    "Secure payment automation and contract tracking."
                ]}
            />

            <div className="w-full lg:w-1/2 flex flex-col items-center p-8 md:p-16 lg:p-24 bg-white overflow-y-auto">
                <div className="w-full max-w-md">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="text-primary size-8">
                            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                            </svg>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-text-main font-display">247gbs affiliate</span>
                    </div>

                    <div className="mb-8">
                        <Link className="inline-flex items-center text-primary text-sm font-bold hover:underline transition-all duration-200 tracking-widest gap-2 group font-display" to="/register/affiliate">
                            <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Back to Role Selection
                        </Link>
                    </div>

                    <div className="mb-10">
                        <h1 className="text-3xl font-bold tracking-tight text-text-main mb-3 font-display">Create an account</h1>
                        <p className="text-text-secondary font-medium">Join thousands of professionals on the leading commerce marketplace.</p>
                    </div>

                    <div className="flex flex-col gap-4 mb-8">
                        <button className="flex items-center justify-center gap-3 w-full py-3 px-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all font-bold text-text-main shadow-sm">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                            </svg>
                            Sign up with Google
                        </button>
                    </div>

                    <div className="relative mb-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100"></div>
                        </div>
                        <div className="relative flex justify-center text-xs tracking-widest font-bold uppercase">
                            <span className="px-4 bg-white text-slate-400 font-display">Or continue with email</span>
                        </div>
                    </div>

                    <form className="space-y-5" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-2 gap-4">
                            <AuthInput
                                id="firstName"
                                name="firstName"
                                label="First Name"
                                type="text"
                                placeholder="John"
                                required
                            />
                            <AuthInput
                                id="lastName"
                                name="lastName"
                                label="Last Name"
                                type="text"
                                placeholder="Doe"
                                required
                            />
                        </div>

                        <AuthInput
                            id="email"
                            name="email"
                            label="Email Address"
                            type="email"
                            placeholder="john@example.com"
                            icon="mail"
                            required
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-text-main ml-1 uppercase tracking-wider font-display">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                                    <span className="material-symbols-outlined text-xl">lock</span>
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    className="block w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary bg-white text-text-main placeholder-gray-400 transition-all outline-none font-medium"
                                    placeholder="••••••••"
                                    type="password"
                                    required
                                />
                                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-text-main" type="button">
                                    <span className="material-symbols-outlined text-xl">visibility</span>
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider ml-1 font-display">Must be at least 8 characters with one special symbol.</p>
                        </div>

                        <div className="flex items-start gap-3 py-2">
                            <input
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                                id="terms"
                                type="checkbox"
                                required
                            />
                            <label className="text-sm text-text-secondary font-medium leading-relaxed" htmlFor="terms">
                                I agree to the <Link className="text-text-main font-bold hover:text-primary underline decoration-primary/20" to="#">Terms of Service</Link> and <Link className="text-text-main font-bold hover:text-primary underline decoration-primary/20" to="#">Privacy Policy</Link>.
                            </label>
                        </div>

                        <button
                            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-2xl shadow-primary/20 transition-all duration-300 transform active:scale-[0.98] tracking-widest font-display disabled:opacity-50"
                            type="submit"
                            disabled={isSigningUp}
                        >
                            {isSigningUp ? "Creating Account..." : "Create Account"}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm">
                        <p className="text-text-secondary font-medium">
                            Already have an account?{" "}
                            <Link className="text-primary font-bold hover:underline underline-offset-4 decoration-2" to="/login">Sign in here</Link>
                        </p>
                    </div>

                    <p className="mt-12 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest font-display">
                        © {new Date().getFullYear()} 247gbs affiliate professional marketplace
                    </p>
                </div>
            </div>
        </div>
    );
}
