import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight } from 'lucide-react';

export default function FeatureShowcase() {
  return (
    <section className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        {/* Loyalty Showcase */}
        <div className="flex flex-col lg:flex-row items-center gap-16 mb-32">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 lg:max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-brand-blue text-sm font-bold mb-6">
              Core Product
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
              GBS Loyalty: <br />
              <span className="text-brand-blue">Retain at Scale.</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Transform your customer lifecycle with the world's most powerful 
              loyalty engine. Built for global retailers who demand 
              uncompromising performance and deep behavioral insights.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                'Automated Tiered Reward Systems',
                'Advanced Omnichannel Points Tracking',
                'AI-Driven Behavioral Analytics',
                'Seamless POS & E-commerce Integration'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-brand-blue" />
                  {item}
                </li>
              ))}
            </ul>
            <button className="flex items-center gap-2 text-lg font-bold text-gray-900 group">
              Explore GBS Loyalty <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex-1 relative"
          >
            <div className="glass p-3 rounded-[3rem] shadow-2xl relative z-10">
              <div className="rounded-[2.5rem] overflow-hidden shadow-xl aspect-square lg:aspect-[4/3]">
                <img 
                  src="/loyalty_app_mockup.png" 
                  alt="GBS Loyalty Interface" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="absolute -top-10 -right-10 w-64 h-64 bg-brand-blue/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-brand-accent/10 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>

        {/* Mall Showcase (Reversed) */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-1 lg:max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-50 text-cyan-600 text-sm font-bold mb-6">
              Commerce Engine
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-8 leading-tight">
              Mcom Mall: <br />
              <span className="text-cyan-600">The Modern Market.</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Launch and scale multi-vendor marketplaces in record time. 
              Mcom Mall provides the unified checkout and vendor management 
              tools that power today's digital economies.
            </p>
            <ul className="space-y-4 mb-10">
              {[
                'Unified checkout for multiple vendors',
                'Automated vendor onboarding & payouts',
                'Advanced global search & discovery',
                'Full mobile commerce optimization'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-cyan-500" />
                  {item}
                </li>
              ))}
            </ul>
            <button className="flex items-center gap-2 text-lg font-bold text-gray-900 group">
              Explore Mcom Mall <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="flex-1 relative"
          >
            <div className="glass p-3 rounded-[3rem] shadow-2xl relative z-10">
              <div className="rounded-[2.5rem] overflow-hidden shadow-xl aspect-square lg:aspect-[4/3]">
                <img 
                  src="/mall_app_mockup.png" 
                  alt="Mcom Mall Interface" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="absolute -top-10 -left-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
