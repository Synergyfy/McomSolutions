import React from 'react';
import { motion } from 'motion/react';
import { Shield, Globe, Zap, Heart } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-20">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-bold mb-6"
          >
            Our Vision for the <br />
            <span className="text-brand-blue">Future of Business</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 leading-relaxed"
          >
            24/7 GBS was founded on the principle that enterprise software 
            should be as intuitive as it is powerful. We build tools that 
            empower teams to work smarter, not harder.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
          <ValueCard 
            icon={Globe} 
            title="Global Scale" 
            description="Infrastructure built to support businesses across every continent."
          />
          <ValueCard 
            icon={Shield} 
            title="Enterprise Security" 
            description="Bank-grade encryption and compliance at the core of every product."
          />
          <ValueCard 
            icon={Zap} 
            title="Instant Performance" 
            description="Optimized for speed so your team never has to wait on software."
          />
          <ValueCard 
            icon={Heart} 
            title="Human Centric" 
            description="Designed with the end-user in mind, ensuring high adoption rates."
          />
        </div>

        <div className="glass rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-blue-500/5 -z-10" />
          <h2 className="text-3xl md:text-4xl font-bold mb-8">Ready to transform your business?</h2>
          <p className="text-lg text-gray-600 mb-10 max-w-xl mx-auto">
            Join over 10,000 companies worldwide that trust 24/7 GBS to power 
            their daily operations.
          </p>
          <button className="bg-brand-blue text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-600 transition-all shadow-xl shadow-blue-500/20">
            Get Started Today
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="p-8 glass rounded-3xl border-transparent hover:border-brand-blue/20 transition-all group">
      <div className="w-12 h-12 bg-blue-50 text-brand-blue rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
