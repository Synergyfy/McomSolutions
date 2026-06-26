import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Gift, MapPin, Compass, Search, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CustomerLandingPage() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden selection:bg-orange-500 selection:text-white pt-16">
            
            {/* Consumer Hero Section */}
            <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 px-6 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white pointer-events-none" />
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl" />
                <div className="absolute top-20 -left-20 w-72 h-72 bg-amber-300/20 rounded-full blur-3xl" />

                <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="space-y-6 md:space-y-8"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-200 bg-white shadow-sm text-orange-600 text-xs font-bold tracking-widest uppercase">
                            <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                            For Shoppers
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1]">
                            Discover rewards, offers and <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-500">experiences around you.</span>
                        </h1>
                        
                        <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed">
                            Support local businesses and get rewarded every time. Connect with your community and uncover the best spots on your high street.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Link to="/signup?role=customer" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 px-8 rounded-xl shadow-xl shadow-orange-500/20 transition-all hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2">
                                Join Rewards <ArrowRight size={18} />
                            </Link>
                            <Link to="/search" className="w-full sm:w-auto bg-white border border-slate-200 hover:border-slate-300 text-slate-700 font-bold py-4 px-8 rounded-xl shadow-sm transition-all hover:bg-slate-50 flex items-center justify-center gap-2">
                                <Search size={18} className="text-slate-400" />
                                Explore Offers
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* WHAT YOU GET Section */}
            <section className="py-20 md:py-32 px-6 bg-slate-50 border-t border-slate-100">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">Your Member Benefits</h2>
                        <p className="text-slate-500 font-medium max-w-xl mx-auto">Unlock exclusive perks just by supporting your favorite local spots.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        <BenefitCard
                            icon={<Gift className="w-8 h-8 text-orange-500" />}
                            title="Rewards"
                            description="Earn rewards from businesses you already shop with."
                        />
                        <BenefitCard
                            icon={<Smartphone className="w-8 h-8 text-amber-500" />}
                            title="Loyalty"
                            description="Keep all your loyalty cards digitally in one place."
                        />
                        <BenefitCard
                            icon={<MapPin className="w-8 h-8 text-rose-500" />}
                            title="Nearby Deals"
                            description="Find offers and experiences happening around you."
                        />
                        <BenefitCard
                            icon={<Compass className="w-8 h-8 text-emerald-500" />}
                            title="Local Discovery"
                            description="Discover hidden businesses and community experiences nearby."
                        />
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS Section */}
            <section className="py-20 md:py-32 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-16 space-y-4">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">How It Works</h2>
                        <p className="text-slate-500 font-medium">Three simple steps to start earning.</p>
                    </div>

                    <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                        
                        {/* Step 1 */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-orange-500 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                1
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
                                <h3 className="font-bold text-xl text-slate-900 mb-2">Join the community</h3>
                                <p className="text-slate-500 font-medium text-sm">Sign up in seconds and get instant access to the MCOM network.</p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-amber-500 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                2
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
                                <h3 className="font-bold text-xl text-slate-900 mb-2">Discover local rewards</h3>
                                <p className="text-slate-500 font-medium text-sm">Browse the map to find active campaigns and experiences near you.</p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-rose-500 text-white font-bold shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                                3
                            </div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-2xl bg-white border border-slate-100 shadow-xl shadow-slate-200/50">
                                <h3 className="font-bold text-xl text-slate-900 mb-2">Earn points & exclusive access</h3>
                                <p className="text-slate-500 font-medium text-sm">Shop, scan, and watch your rewards stack up automatically.</p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Consumer Signup Flow / CTA */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-900" />
                <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl md:text-5xl font-black mb-6 text-white tracking-tight">Your next favourite local find is waiting</h2>
                    <p className="text-slate-300 text-lg mb-10 font-medium">Join thousands of shoppers earning daily rewards.</p>
                    <Link
                        to="/signup?role=customer"
                        className="inline-flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-orange-50 text-lg font-bold px-10 py-5 rounded-2xl shadow-xl hover:-translate-y-1 transition-all duration-300"
                    >
                        Create Your Account <ArrowRight className="w-5 h-5 text-orange-500" />
                    </Link>
                </div>
            </section>
        </div>
    );
}

function BenefitCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5 }}
            className="p-8 rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:border-orange-500/30 transition-all hover:-translate-y-1 group"
        >
            <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                {icon}
            </div>
            <h3 className="text-2xl font-bold mb-3 text-slate-900 tracking-tight">{title}</h3>
            <p className="text-slate-500 leading-relaxed font-medium">
                {description}
            </p>
        </motion.div>
    );
}
