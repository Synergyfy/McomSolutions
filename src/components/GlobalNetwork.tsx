import React from 'react';
import { motion } from 'motion/react';
import { Globe2, Zap, ShieldCheck } from 'lucide-react';

export default function GlobalNetwork() {
  return (
    <section className="py-32 bg-brand-dark relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-10" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-sm font-bold text-brand-blue uppercase tracking-[0.3em] mb-6">Global Infrastructure</h2>
            <h3 className="text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Scale without <br />
              <span className="text-gradient">Boundaries.</span>
            </h3>
            <p className="text-xl text-gray-400 mb-12 leading-relaxed">
              Our edge network spans across 6 continents and 190+ countries, 
              ensuring sub-50ms latency for your global operations. Wherever 
              your business grows, we're already there.
            </p>

            <div className="space-y-8">
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

          <div className="relative">
            {/* Stylized Map Visualization */}
            <div className="aspect-square relative flex items-center justify-center">
              <div className="absolute inset-0 bg-brand-blue/20 blur-[120px] rounded-full animate-pulse" />
              <div className="relative w-full h-full border border-white/10 rounded-full flex items-center justify-center">
                <div className="w-3/4 h-3/4 border border-white/10 rounded-full flex items-center justify-center">
                  <div className="w-1/2 h-1/2 border border-white/10 rounded-full" />
                </div>
                
                {/* Floating Nodes */}
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [0.3, 0.6, 0.3]
                    }}
                    transition={{ 
                      duration: 3 + Math.random() * 2, 
                      repeat: Infinity,
                      delay: Math.random() * 2
                    }}
                    className="absolute w-2 h-2 bg-brand-blue rounded-full shadow-glow"
                    style={{
                      top: `${50 + 40 * Math.sin(i * (Math.PI / 6))}%`,
                      left: `${50 + 40 * Math.cos(i * (Math.PI / 6))}%`,
                    }}
                  />
                ))}
                
                <Globe2 className="w-32 h-32 text-white/20 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-brand-blue border border-white/10 group-hover:bg-brand-blue group-hover:text-white transition-all duration-500">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h4 className="text-xl font-bold text-white mb-2">{title}</h4>
        <p className="text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
