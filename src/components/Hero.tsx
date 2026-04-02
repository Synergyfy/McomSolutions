import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Play, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden bg-mesh">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-200/30 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-brand-accent/20 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-gray-100 text-brand-blue text-sm font-semibold mb-8">
            <Star className="w-4 h-4 fill-brand-blue" />
            <span className="text-gray-900">Rated #1 Enterprise Suite 2026</span>
          </div>
          
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-gray-900 mb-8 leading-[1.05]">
            The Operating System <br />
            <span className="text-gradient">For Modern Business.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto mb-12 leading-relaxed font-medium">
            24/7 GBS is the unified ecosystem that powers loyalty, auditing, 
            and global commerce for the world's most ambitious brands.
          </p>

          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-6xl mx-auto mb-16"
          >
            <div className="relative glass p-4 rounded-[2.5rem] shadow-2xl border-white/50">
              <div className="rounded-[2rem] overflow-hidden aspect-[16/9] relative shadow-2xl bg-gray-900 flex items-center justify-center">
                <iframe 
                  className="w-full h-full"
                  src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&controls=0&loop=1&playlist=jfKfPfyJRdk" 
                  title="24/7 GBS Ecosystem" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
                {/* Overlay Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 pointer-events-none" />
              </div>
            </div>

            {/* Floating Stats */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-10 -right-10 glass p-6 rounded-3xl shadow-2xl hidden lg:block"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 -rotate-45" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">+124%</div>
                  <div className="text-xs font-bold text-gray-400 uppercase">Growth Rate</div>
                </div>
              </div>
            </motion.div>
          </motion.div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link to="/dashboard" className="w-full sm:w-auto bg-brand-blue text-white px-12 py-6 rounded-full font-semibold text-xl shadow-glow-lg flex items-center justify-center gap-2 group active:scale-95 transition-all hover:bg-blue-600">
              Get Started Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
