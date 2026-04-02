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
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
    setActiveDropdown(null);
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
          <Link to="/pricing" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">Pricing</Link>
          <Link to="/contact" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">Contact</Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="font-medium text-gray-600 hover:text-brand-blue transition-colors">Sign In</Link>
          <Link to="/dashboard" className="bg-brand-blue text-white px-5 py-2 rounded-full font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 active:scale-95">
            Get Started
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden p-2" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t mt-4 overflow-hidden"
          >
            <div className="flex flex-col p-6 gap-6">
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Products</h3>
                {PRODUCTS.map(product => (
                  <Link key={product.id} to={`/product/${product.id}`} className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg text-white", product.color)}>
                      <product.icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium">{product.name}</span>
                  </Link>
                ))}
              </div>
              <hr />
              <Link to="/about" className="font-medium">About</Link>
              <Link to="/pricing" className="font-medium">Pricing</Link>
              <Link to="/login" className="font-medium">Sign In</Link>
              <Link to="/dashboard" className="bg-brand-blue text-white px-5 py-3 rounded-xl font-semibold text-center">
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
