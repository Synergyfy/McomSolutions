import { motion } from 'motion/react';
import { Link2, Zap, ArrowRight, Database, Share2, Shield } from 'lucide-react';
import { cn } from '../lib/utils';

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

        <div className="relative group p-4 glass rounded-[3rem] overflow-hidden shadow-2xl">
          <div className="aspect-[21/9] relative rounded-[2.5rem] overflow-hidden">
            <img 
              src="/src/assets/global_connectivity_mockup.png" 
              alt="Global Data Ecosystem Connectivity" 
              className="w-full h-full object-cover transition-transform duration-[10s] group-hover:scale-110"
            />
            {/* Glossy Overlay with Content */}
            <div className="absolute inset-0 bg-blue-900/40 backdrop-blur-[2px] flex items-center justify-center">
              <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-24">
                <IntegrationCard 
                  icon={Database} 
                  title="GBS Core" 
                  desc="Enterprise source of truth." 
                  color="bg-blue-500"
                  mini
                />
                
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-xl text-white rounded-full flex items-center justify-center border border-white/30 shadow-glow-lg animate-pulse z-10">
                    <Link2 className="w-10 h-10" />
                  </div>
                  <div className="text-center z-10">
                    <div className="font-bold text-white text-xl">McomQ Link</div>
                    <div className="text-xs text-blue-200 font-bold uppercase tracking-[0.2em]">The Universal Bridge</div>
                  </div>
                </div>

                <IntegrationCard 
                  icon={Share2} 
                  title="Mcom Suite" 
                  desc="Consumer commerce tools." 
                  color="bg-cyan-500"
                  mini
                />
              </div>
            </div>
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

function IntegrationCard({ icon: Icon, title, desc, color, mini = false }: any) {
  return (
    <div className={cn(
      "p-10 rounded-[3rem] text-center group transition-all duration-500",
      mini ? "p-6 bg-white/10 backdrop-blur-md border border-white/20 text-white w-64" : "glass text-gray-900 hover:-translate-y-2 shadow-2xl"
    )}>
      <div className={cn(
        "w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-110 transition-transform",
        color
      )}>
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h4 className={cn("text-2xl font-bold mb-4", mini ? "text-white" : "text-gray-900")}>{title}</h4>
      <p className={cn("leading-relaxed", mini ? "text-blue-100 text-sm" : "text-gray-500")}>{desc}</p>
    </div>
  );
}
