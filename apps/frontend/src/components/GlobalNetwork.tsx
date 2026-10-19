import React from 'react';
import { motion } from 'motion/react';
import { Globe2, Zap, ShieldCheck } from 'lucide-react';

export default function GlobalNetwork() {
  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden section-visibility-auto">
      <div className="absolute inset-0 bg-mesh opacity-10 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 md:gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-sm font-bold text-brand-blue uppercase tracking-[0.3em] mb-6">Global Infrastructure</h2>
            <h3 className="text-3xl sm:text-4xl md:text-6xl font-bold text-gray-900 mb-6 md:mb-8 leading-tight">
              Scale without <br />
              <span className="text-gradient">Boundaries.</span>
            </h3>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-8 md:mb-12 leading-relaxed">
              Our edge network spans across 6 continents and 190+ countries, 
              ensuring sub-50ms latency for your global operations. Wherever 
              your business grows, we're already there.
            </p>

            <div className="space-y-6 md:space-y-8">
              <FeatureItem 
                icon={Globe2} 
                title="190+ Countries" 
                desc="Localized compliance and currency support out of the box." 
              />
              <FeatureItem 
                icon={Zap} 
                title="Edge Compute" 
                desc="Real-time processing at the nearest node to your users." 
              />
              <FeatureItem 
                icon={ShieldCheck} 
                title="Data Residency" 
                desc="Maintain sovereignty with region-specific data storage." 
              />
            </div>
          </motion.div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-[15%] rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />
            <img
              src="/globe.png"
              alt="Golden globe showing connected regions around the world"
              loading="lazy"
              decoding="async"
              className="relative block h-auto w-full max-w-[510px] object-contain drop-shadow-[0_0_32px_rgba(245,158,11,0.24)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 border border-orange-100 group-hover:bg-brand-blue group-hover:text-white transition-all duration-500">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-xl font-bold text-gray-900 mb-2">{title}</h4>
        <p className="text-gray-600">{desc}</p>
      </div>
    </div>
  );
}
