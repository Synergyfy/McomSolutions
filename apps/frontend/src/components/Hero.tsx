import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, ChevronRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const slides = [
  {
    image: '/mcomall.png',
    name: 'Mcom Mall',
    type: 'Mcom',
  },
  {
    image: '/mcom-reward.png',
    name: 'Mcom Rewards',
    type: 'Mcom',
  },
  {
    image: '/mcom-spin.png',
    name: 'Mcom Spin',
    type: 'Mcom',
  },
];

export default function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-24 sm:pt-32 pb-16 md:pb-20 overflow-hidden bg-white">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-100/50 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-orange-200/40 blur-[100px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white shadow-sm border border-orange-100 text-orange-600 text-sm font-semibold mb-8">
            <Star className="w-4 h-4 fill-orange-500" />
            <span className="text-gray-900">Rated #1 Enterprise Suite 2026</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-6 md:mb-8 leading-[1.05]">
            One Login. <br />
            One Membership. <br />
            <span className="text-gradient">One Ecosystem.</span>
          </h1>
          
          <p className="text-lg sm:text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto mb-8 md:mb-12 leading-relaxed font-medium">
            MCOM Mall, MCOM Rewards, MCOM Spin, MCOMQ Link — plus 24/7 GBS Loyalty, 
            24/7 GBS Audit, 24/7 GBS Expo — and future MCOM &amp; 24/7 GBS platforms, 
            all from one central account.
          </p>

          <motion.div 
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-w-6xl mx-auto mb-10 md:mb-16"
          >
            <div className="relative glass p-2 sm:p-4 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border-white/50">
              <div className="rounded-[2rem] overflow-hidden aspect-[16/9] relative shadow-2xl bg-gray-900">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0"
                  >
                    <img 
                      src={slides[currentSlide].image} 
                      alt={slides[currentSlide].name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    
                    <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 flex items-center gap-2 sm:gap-3">
                      <span className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-xs sm:text-sm font-bold border border-white/30">
                        {slides[currentSlide].type}
                      </span>
                      <span className="px-3 py-1 sm:px-4 sm:py-1.5 bg-white/20 backdrop-blur-md rounded-full text-white text-xs sm:text-sm font-bold border border-white/30">
                        {slides[currentSlide].name}
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-center gap-1.5 md:gap-2 mt-3 sm:mt-4">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === currentSlide 
                        ? 'bg-brand-blue w-5 md:w-6' 
                        : 'bg-gray-300 hover:bg-gray-400 w-2'
                    }`}
                  />
                ))}
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
            <Link to="/register">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full font-semibold transition-colors flex items-center justify-center w-full sm:w-auto shadow-[0_0_20px_rgba(255,105,0,0.3)] hover:shadow-[0_0_30px_rgba(255,105,0,0.5)]"
              >
                Get Started Now
                <ArrowRight className="ml-2 w-5 h-5" />
              </motion.button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto bg-white text-gray-900 px-8 sm:px-12 py-3 sm:py-6 rounded-full font-semibold text-base sm:text-xl shadow-lg border border-gray-200 flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-gray-50">
              Login
            </Link>
            <a href="#platforms" className="w-full sm:w-auto text-orange-500 px-8 sm:px-12 py-3 sm:py-6 rounded-full font-semibold text-base sm:text-xl flex items-center justify-center gap-2 hover:bg-orange-50 transition-all active:scale-95">
              View Platforms
              <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
