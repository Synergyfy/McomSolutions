import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ChevronDown, LayoutGrid, ExternalLink } from 'lucide-react';
import { PRODUCTS } from '../constants';
import { cn } from '../lib/utils';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
    setIsLoggedIn(!!localStorage.getItem('auth_token'));
  }, [location]);

  const gbsProducts = PRODUCTS.filter(p => p.type === 'GBS');
  const mcomProducts = PRODUCTS.filter(p => p.type === 'Mcom');

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
      scrolled ? "bg-white/80 backdrop-blur-lg shadow-sm py-3" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:scale-110 transition-transform">
            24
          </div>
          <span className="font-bold text-xl tracking-tight">GBS</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <div className="relative group" 
               onMouseEnter={() => setActiveDropdown('products')}
               onMouseLeave={() => setActiveDropdown(null)}>
            <button className="flex items-center gap-1 font-medium text-gray-600 hover:text-brand-blue transition-colors py-2">
              Products <ChevronDown className={cn("w-4 h-4 transition-transform", activeDropdown === 'products' && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {activeDropdown === 'products' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 w-[600px] glass rounded-2xl shadow-2xl p-6 grid grid-cols-2 gap-8 mt-2"
                >
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Core GBS Tools</h3>
                    <div className="space-y-4">
                      {gbsProducts.map(product => (
                        <Link key={product.id} to={`/product/${product.id}`} className="flex items-start gap-3 group/item">
                          <div className={cn("p-2 rounded-lg text-white", product.color)}>
                            <product.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover/item:text-brand-blue transition-colors">{product.name}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{product.tagline}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Mcom Solutions</h3>
                    <div className="space-y-4">
                      {mcomProducts.map(product => (
                        <Link key={product.id} to={`/product/${product.id}`} className="flex items-start gap-3 group/item">
                          <div className={cn("p-2 rounded-lg text-white", product.color)}>
                            <product.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 group-hover/item:text-brand-blue transition-colors">{product.name}</div>
                            <div className="text-xs text-gray-500 line-clamp-1">{product.tagline}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link to="/about" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">About</Link>
          <div className="relative group" 
               onMouseEnter={() => setActiveDropdown('pricing')}
               onMouseLeave={() => setActiveDropdown(null)}>
            <button className="flex items-center gap-1 font-medium text-gray-600 hover:text-brand-blue transition-colors py-2">
              Pricing <ChevronDown className={cn("w-4 h-4 transition-transform", activeDropdown === 'pricing' && "rotate-180")} />
            </button>
            <AnimatePresence>
              {activeDropdown === 'pricing' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 w-56 glass rounded-2xl shadow-2xl p-3 mt-2"
                >
                  <Link to="/membership" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group/item">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover/item:text-brand-blue transition-colors text-sm">Membership</div>
                      <div className="text-xs text-gray-500">Plans & subscriptions</div>
                    </div>
                  </Link>
                  <Link to="/packages" className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group/item">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 group-hover/item:text-brand-blue transition-colors text-sm">Packages</div>
                      <div className="text-xs text-gray-500">Platform-specific add-ons</div>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Link to="/contact" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">Contact</Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {isLoggedIn ? (
            <Link to="/dashboard" className="bg-brand-blue text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">Sign In</Link>
              <Link to="/register" className="bg-brand-blue text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                Get Started
              </Link>
            </>
          )}
        </div>

      {/* Mobile Toggle */}
        <button 
          className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors" 
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white/95 backdrop-blur-xl border border-gray-100 mt-3 rounded-2xl shadow-2xl overflow-hidden max-h-[calc(100dvh-5rem)] flex flex-col"
          >
            <div className="flex flex-col p-5 gap-5 overflow-y-auto overscroll-contain">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Products</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRODUCTS.map(product => (
                    <Link 
                      key={product.id} 
                      to={`/product/${product.id}`} 
                      onClick={() => setIsOpen(false)}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <div className={cn("p-2 rounded-lg text-white shrink-0", product.color)}>
                        <product.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium text-sm text-gray-900 block truncate">{product.name}</span>
                        <span className="text-xs text-gray-500 block truncate">{product.tagline}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              <hr className="border-gray-100" />
              <div className="flex flex-col gap-2">
                <Link 
                  to="/about" 
                  onClick={() => setIsOpen(false)}
                  className="font-medium text-gray-700 hover:text-brand-blue py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  About
                </Link>
                <Link 
                  to="/contact" 
                  onClick={() => setIsOpen(false)}
                  className="font-medium text-gray-700 hover:text-brand-blue py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Contact
                </Link>
              </div>
              <hr className="border-gray-100" />
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Pricing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Link 
                    to="/membership" 
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium text-sm"
                  >
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-600 shrink-0"><LayoutGrid className="w-4 h-4" /></div>
                    <div>
                      <span className="text-gray-900 block">Membership</span>
                      <span className="text-xs text-gray-500 block">Plans & subscriptions</span>
                    </div>
                  </Link>
                  <Link 
                    to="/packages" 
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors font-medium text-sm"
                  >
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-600 shrink-0"><LayoutGrid className="w-4 h-4" /></div>
                    <div>
                      <span className="text-gray-900 block">Packages</span>
                      <span className="text-xs text-gray-500 block">Platform-specific add-ons</span>
                    </div>
                  </Link>
                </div>
              </div>
              <div className="pt-2">
                {isLoggedIn ? (
                  <Link 
                    to="/dashboard" 
                    onClick={() => setIsOpen(false)}
                    className="block w-full bg-brand-blue text-white px-5 py-3 rounded-xl font-semibold text-center hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    Dashboard
                  </Link>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    <Link 
                      to="/login" 
                      onClick={() => setIsOpen(false)}
                      className="block w-full py-2.5 text-center font-medium text-gray-700 hover:text-brand-blue rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      Sign In
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={() => setIsOpen(false)}
                      className="block w-full bg-brand-blue text-white py-3 rounded-xl font-semibold text-center hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      Get Started
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
