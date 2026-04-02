import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, Globe, BarChart3, Users2, Cpu } from 'lucide-react';

export default function BentoGrid() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-sm font-bold text-brand-blue uppercase tracking-[0.2em] mb-4">Why 24/7 GBS?</h2>
          <p className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">Built for the next decade of business.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
          {/* Large Feature */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-3 md:row-span-2 bento-card bg-mesh flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-brand-blue text-white rounded-2xl flex items-center justify-center mb-6 shadow-glow">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-3xl font-bold mb-4">AI-Powered Core</h3>
              <p className="text-gray-600 text-lg leading-relaxed">
                Every tool in the GBS ecosystem is infused with proprietary AI models 
                that predict trends, automate compliance, and personalize customer 
                experiences in real-time.
              </p>
            </div>
            <div className="mt-8 relative h-48 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full px-8 space-y-4">
                  <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: '70%' }}
                      className="h-full bg-brand-blue"
                    />
                  </div>
                  <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: '90%' }}
                      transition={{ delay: 0.2 }}
                      className="h-full bg-brand-blue"
                    />
                  </div>
                  <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: '45%' }}
                      transition={{ delay: 0.4 }}
                      className="h-full bg-brand-blue"
                    />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Medium Feature 1 */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-3 bento-card flex items-center gap-8"
          >
            <div className="flex-1">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold mb-2">Zero-Trust Security</h3>
              <p className="text-gray-500 text-sm">Military-grade protection for your enterprise data.</p>
            </div>
            <div className="hidden sm:block w-32 h-32 bg-indigo-50 rounded-full flex items-center justify-center">
              <Shield className="w-12 h-12 text-indigo-200" />
            </div>
          </motion.div>

          {/* Small Feature 1 */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-1 bento-card flex flex-col items-center justify-center text-center"
          >
            <Globe className="w-8 h-8 text-brand-blue mb-4" />
            <span className="text-2xl font-bold">190+</span>
            <span className="text-xs text-gray-400 uppercase font-bold">Countries</span>
          </motion.div>

          {/* Small Feature 2 */}
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="md:col-span-2 bento-card flex flex-col justify-center"
          >
            <div className="flex items-center gap-4 mb-4">
              <Users2 className="w-6 h-6 text-brand-blue" />
              <h3 className="font-bold">Unified Identity</h3>
            </div>
            <p className="text-gray-500 text-xs">One account for all GBS and Mcom products.</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
