'use client';

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Zap, 
  Building2, 
  MapPin, 
  Compass, 
  Globe, 
  CheckCircle2, 
  ShieldCheck, 
  Activity 
} from 'lucide-react';

export default function HighStreetExplanationPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fff8f6] text-[#261812] font-sans pt-12 pb-24 px-4 sm:px-6">
      <main className="max-w-2xl mx-auto w-full space-y-10">
        
        {/* Back navigation */}
        <div className="flex justify-start">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-bold text-[#a23f00] hover:opacity-80 transition-opacity active:scale-95"
          >
            <ArrowLeft size={16} /> Back to Onboarding
          </button>
        </div>

        {/* Hero Section */}
        <header className="space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-[#a23f00] shadow-sm">
            <Zap size={24} className="fill-[#a23f00]/10" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#0b1c30] tracking-tight">
            High Street Activation
          </h1>
          <p className="text-base text-gray-600 leading-relaxed font-medium">
            Mcom Mall operates a dynamic Geographic Commerce Intelligence Engine. We digitize local shopping corridors into unified, local digital malls.
          </p>
        </header>

        {/* Section 1: What is High Street Activation */}
        <section className="bg-white border border-[#e2bfb0]/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <ShieldCheck className="text-[#a23f00]" size={20} />
            How the Location Matching Works
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium">
            When you enter your business postcode during onboarding, the platform uses coordinates to dynamically calculate the distance between your business location and the center of the nearest active commercial district (high street).
          </p>
          <div className="bg-[#fff8f6] rounded-2xl p-4 border border-orange-100/50 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[#a23f00] font-bold text-xs">
              <Activity size={14} className="animate-pulse" />
              Dynamic Proximity calculation Flow
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider mt-1">
              <span>Postcode entered</span>
              <span className="text-orange-400">→</span>
              <span>Geocoding active</span>
              <span className="text-orange-400">→</span>
              <span>Classification match</span>
            </div>
          </div>
        </section>

        {/* Section 2: Proximity Classification Tiers */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-[#a23f00] px-1">
            Proximity Classification Tiers
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {/* Tier 1: High Street */}
            <div className="bg-white border border-[#e2bfb0]/40 rounded-3xl p-5 flex gap-4 transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6900] shrink-0 border border-orange-100/30">
                <Building2 size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[#0b1c30]">High Street Priority Zone</h4>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">
                    Premium Placement
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Under 0.5 miles from High Street</p>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium pt-1">
                  Businesses located inside the core commercial corridor qualify for prominent listing positioning in the borough feeds, participation in virtual expos, and priority local campaign visibility.
                </p>
              </div>
            </div>

            {/* Tier 2: Hyperlocal */}
            <div className="bg-white border border-[#e2bfb0]/40 rounded-3xl p-5 flex gap-4 transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6900] shrink-0 border border-orange-100/30">
                <MapPin size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0b1c30]">Hyperlocal Ecosystem</h4>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">0 – 5 miles from High Street</p>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium pt-1">
                  Active neighborhood businesses that participate directly in radius-based targeting, local cashback/loyalty systems, and localized group circles.
                </p>
              </div>
            </div>

            {/* Tier 3: Nearby */}
            <div className="bg-white border border-[#e2bfb0]/40 rounded-3xl p-5 flex gap-4 transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6900] shrink-0 border border-orange-100/30">
                <Compass size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0b1c30]">Nearby Network</h4>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">5 – 8 miles from High Street</p>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium pt-1">
                  Regional participants that qualify for extended distance-based discovery and broader borough-wide campaigns.
                </p>
              </div>
            </div>

            {/* Tier 4: National */}
            <div className="bg-white border border-[#e2bfb0]/40 rounded-3xl p-5 flex gap-4 transition-all hover:shadow-md">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#ff6900] shrink-0 border border-orange-100/30">
                <Globe size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#0b1c30]">National Delivery &amp; Remote</h4>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">8+ miles from High Street</p>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed font-medium pt-1">
                  Standard digital merchants that offer courier shipping options and participate in national commerce groups without local high-street footprints.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Value Proposition */}
        <section className="bg-white border border-[#e2bfb0]/60 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-[#0b1c30]">Why activation is required:</h2>
          <ul className="space-y-3">
            {[
              'Enables proximity-driven discoveries inside the consumer app.',
              'Ensures location-aware campaigns target the correct hyperlocal audience.',
              'Qualifies you for local high-street and borough-wide promotions.',
              'Automatically populates your transaction density metrics on your Dashboard.'
            ].map((text, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-gray-500 font-medium">
                <CheckCircle2 size={16} className="text-[#a23f00] shrink-0 mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Call-to-action Footer */}
        <div className="flex flex-col gap-3 pt-4 border-t border-slate-200/80">
          <button 
            onClick={() => navigate(-1)}
            className="w-full bg-[#a23f00] hover:bg-[#a23f00]/95 text-white py-4 rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Return to Onboarding
          </button>
        </div>

      </main>
    </div>
  );
}
