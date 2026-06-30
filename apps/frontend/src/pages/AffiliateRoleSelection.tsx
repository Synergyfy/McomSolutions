
import { Link } from "react-router-dom";

const roles = [
    {
        id: "agent",
        title: "Agent",
        description: "Entry-level specialists who complete focused micro-tasks like social post setup, basic email templates, short product descriptions, quick website checks, or small audits. Agents take a short qualification test to appear in listings.",
        icon: "person_search",
        href: "/register/affiliate/signup?role=agent",
    },
    {
        id: "account-manager",
        title: "Account Manager",
        description: "Mid-level professionals who coordinate onboarding, manage teams of agents, plan and run campaigns, and match businesses to services. Account Managers handle client communications and deliver measurable results.",
        icon: "business_center",
        href: "/register/affiliate/signup?role=account-manager",
        popular: true,
    },
    {
        id: "consultant",
        title: "Consultant",
        description: "Senior experts who provide business advice, audits, strategic plans, and deep coaching. Consultants can be visible immediately after signup but are flagged for verification. They charge per session or project.",
        icon: "insights",
        href: "/register/affiliate/signup?role=consultant",
    },
];

export default function AffiliateRoleSelection() {
    return (
        <div className="bg-white min-h-screen flex flex-col items-center justify-center p-6 text-text-main font-display">
            <div className="mb-12 flex items-center gap-3">
                <div className="text-primary size-8">
                    <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path clipRule="evenodd" d="M24 4H42V17.3333V30.6667H24V44H6V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                    </svg>
                </div>
                <span className="text-3xl font-bold tracking-tight text-text-main font-display">247gbs affiliate</span>
            </div>

            <div className="mb-4">
                <Link className="inline-flex items-center text-primary text-sm font-bold hover:underline transition-all duration-200 tracking-widest gap-2 group font-display" to="/">
                    <span className="material-symbols-outlined group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    Back to Home
                </Link>
            </div>

            <div className="text-center max-w-2xl mb-16 px-4">
                <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight text-text-main font-display">Join as a professional</h1>
                <p className="text-text-secondary text-lg lg:text-xl font-medium leading-relaxed">
                    Choose the role that best fits your expertise. Scale your business within the 247gbs affiliate ecosystem.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {roles.map((role) => (
                    <Link
                        key={role.id}
                        to={role.href}
                        className={`group p-8 rounded-[3rem] border border-gray-100 bg-white shadow-sm transition-all duration-500 flex flex-col items-center text-center relative hover:border-primary hover:shadow-2xl hover:-translate-y-3 ${role.popular ? "md:scale-105 border-primary/20 ring-1 ring-primary/5 shadow-md" : ""
                            }`}
                    >
                        {role.popular && (
                            <div className="absolute -top-4 bg-primary text-white text-[10px] font-bold tracking-widest uppercase px-6 py-2 rounded-full shadow-xl shadow-primary/30 z-10 font-display">
                                Most Popular
                            </div>
                        )}
                        <div className="w-20 h-20 bg-gray-50 rounded-4xl flex items-center justify-center mb-8 transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:rotate-12 group-hover:shadow-xl group-hover:shadow-primary/20">
                            <span className="material-symbols-outlined text-4xl text-primary group-hover:text-white transition-colors">
                                {role.icon}
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold mb-4 text-text-main group-hover:text-primary transition-colors font-display tracking-tight">
                            {role.title}
                        </h3>
                        <p className="text-text-secondary font-medium leading-relaxed mb-10 grow">
                            {role.description}
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-primary font-bold text-sm tracking-widest uppercase group-hover:gap-4 transition-all font-display">
                            Get Started <span className="material-symbols-outlined text-xl">chevron_right</span>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-16 text-center">
                <p className="text-text-secondary text-base font-medium">
                    Already have an account?{" "}
                    <Link className="text-primary font-bold hover:underline underline-offset-4 decoration-2 transition-all" to="/login">
                        Log in here
                    </Link>
                </p>
                <div className="mt-12 pt-10 border-t border-slate-50 w-full max-w-sm mx-auto">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-display">
                        ©  247gbs affiliate professional marketplace
                    </p>
                </div>
            </div>
        </div>
    );
}
