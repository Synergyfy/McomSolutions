import { Link } from "react-router-dom";
import AuthSidebar from "../components/affiliate-auth/AuthSidebar";

export default function AffiliateCheckEmail() {
    return (
        <div className="min-h-screen flex bg-white font-display">
            <AuthSidebar
                title="Empowering the world's finest marketplaces."
                description="Join thousands of professionals who trust MCOM MALL for their business operations and community growth."
                imageSrc="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop"
            />

            <div className="flex flex-col flex-1 justify-center items-center px-8 py-12 lg:px-24">
                <div className="w-full max-w-md flex flex-col items-center">
                    <div className="lg:hidden flex items-center gap-3 mb-10 self-start">
                        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <span className="material-symbols-outlined text-2xl">rocket_launch</span>
                        </div>
                        <h2 className="text-2xl font-bold text-text-main font-display">247gbs affiliate</h2>
                    </div>

                    <div className="mb-10 w-full flex justify-center">
                        <div className="relative group">
                            <div className="w-28 h-28 bg-primary/10 rounded-[2.5rem] flex items-center justify-center transition-all duration-500 group-hover:bg-primary/20 group-hover:rotate-6">
                                <span className="material-symbols-outlined text-primary text-6xl">mail</span>
                            </div>
                            <div className="absolute -top-2 -right-2 w-10 h-10 bg-primary rounded-full border-4 border-white flex items-center justify-center shadow-lg shadow-primary/20">
                                <span className="material-symbols-outlined text-white text-xl">check</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center mb-10">
                        <h1 className="text-text-main text-3xl font-bold leading-tight tracking-tight mb-4 font-display">
                            Check your inbox
                        </h1>
                        <p className="text-text-secondary text-lg font-medium leading-relaxed px-4">
                            We've sent a password reset secure link to your email. Please check your spam folder if you don't see it within minutes.
                        </p>
                    </div>

                    <div className="w-full space-y-6">
                        <Link to="/login" className="w-full flex items-center justify-center rounded-2xl h-16 px-6 bg-primary text-white text-lg font-bold transition-all hover:bg-primary-hover active:scale-[0.98] shadow-2xl shadow-primary/30 tracking-widest group font-display">
                            <span className="truncate">Return to Login</span>
                            <span className="material-symbols-outlined ml-3 text-2xl group-hover:translate-x-1 transition-transform">arrow_forward</span>
                        </Link>

                        <div className="flex flex-col items-center gap-6 pt-6 border-t border-slate-50">
                            <p className="text-text-secondary text-sm font-medium">
                                Didn't receive the email?
                            </p>
                            <button className="flex items-center justify-center gap-3 text-primary font-bold text-sm hover:underline underline-offset-4 decoration-2 tracking-widest group font-display">
                                <span className="material-symbols-outlined text-xl group-hover:rotate-180 transition-transform duration-500">refresh</span>
                                <span>Resend Email</span>
                            </button>
                        </div>
                    </div>

                    <footer className="mt-20 w-full pt-10 border-t border-slate-50">
                        <div className="flex flex-wrap justify-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest mb-10 font-display">
                            <Link className="hover:text-primary transition-colors" to="/privacy">Privacy</Link>
                            <Link className="hover:text-primary transition-colors" to="/terms">Terms</Link>
                            <Link className="hover:text-primary transition-colors" to="/contact">Support</Link>
                        </div>
                        <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest font-display">
                            © 2026 247gbs affiliate professional marketplace.
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}
