import React from 'react';
import { motion } from 'motion/react';
import { Link2, Zap, ArrowRight, Database, Share2, Shield } from 'lucide-react';

export default function IntegrationFlow() {
  return (
    <section className="py-32 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-sm font-bold text-brand-blue uppercase tracking-[0.3em] mb-4">Seamless Connectivity</h2>
          <h3 className="text-4xl md:text-6xl font-bold text-gray-900 mb-8">One Ecosystem. <br />Infinite Possibilities.</h3>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Our proprietary integration layer ensures that data flows effortlessly 
            between every tool in the 24/7 GBS and Mcom suites.
          </p>
        </div>

        <div className="relative">
          {/* Connection Lines (SVG) */}
          <svg className="absolute inset-0 w-full h-full -z-10 opacity-20" viewBox="0 0 1000 400">
            <motion.path
              d="M 200 200 Q 500 50 800 200"
              fill="none"
              stroke="#0A84FF"
              strokeWidth="2"
              strokeDasharray="10 10"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.path
              d="M 200 200 Q 500 350 800 200"
              fill="none"
              stroke="#00D1FF"
              strokeWidth="2"
              strokeDasharray="10 10"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            />
          </svg>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
            <IntegrationCard 
              icon={Database} 
              title="GBS Core" 
              desc="Your enterprise source of truth for loyalty and auditing." 
              color="bg-blue-500"
            />
            
            <div className="flex flex-col items-center gap-6">
              <div className="w-20 h-20 bg-brand-blue text-white rounded-full flex items-center justify-center shadow-glow-lg animate-pulse">
                <Link2 className="w-10 h-10" />
              </div>
              <div className="text-center">
                <div className="font-bold text-gray-900">McomQ Link</div>
                <div className="text-xs text-brand-blue font-bold uppercase tracking-widest">The Bridge</div>
              </div>
            </div>

            <IntegrationCard 
              icon={Share2} 
              title="Mcom Suite" 
              desc="Consumer-facing marketplaces and reward engines." 
              color="bg-cyan-500"
            />
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8">
          <div className="p-8 glass rounded-3xl border-transparent hover:border-brand-blue/20 transition-all">
            <Zap className="w-8 h-8 text-brand-blue mb-4" />
            <h4 className="font-bold mb-2">Instant Sync</h4>
            <p className="text-sm text-gray-500">Real-time data propagation across all connected modules.</p>
          </div>
          <div className="p-8 glass rounded-3xl border-transparent hover:border-brand-blue/20 transition-all">
            <Shield className="w-8 h-8 text-brand-blue mb-4" />
            <h4 className="font-bold mb-2">Secure Tunneling</h4>
            <p className="text-sm text-gray-500">End-to-end encryption for every data packet in transit.</p>
          </div>
          <div className="p-8 glass rounded-3xl border-transparent hover:border-brand-blue/20 transition-all">
            <ArrowRight className="w-8 h-8 text-brand-blue mb-4" />
            <h4 className="font-bold mb-2">API-First</h4>
            <p className="text-sm text-gray-500">Extensible architecture that plays well with your existing stack.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntegrationCard({ icon: Icon, title, desc, color }: any) {
  return (
    <div className="p-10 glass rounded-[3rem] text-center group hover:-translate-y-2 transition-all duration-500">
      <div className={`w-16 h-16 ${color} text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
        <Icon className="w-8 h-8" />
      </div>
      <h4 className="text-2xl font-bold mb-4">{title}</h4>
      <p className="text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
