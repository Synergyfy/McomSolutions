import React from 'react';
import { Link } from 'react-router-dom';
import { PRODUCTS } from '../constants';
import { Twitter, Linkedin, Github, Youtube, Mail, ArrowRight } from 'lucide-react';

export default function Footer() {
  const gbsProducts = PRODUCTS.filter(p => p.type === 'GBS');
  const mcomProducts = PRODUCTS.filter(p => p.type === 'Mcom');

  return (
    <footer className="bg-gray-50 border-t border-gray-100 pt-24 pb-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-20">
          <div className="col-span-2 lg:col-span-2 text-center md:text-left">
            <Link to="/" className="flex items-center gap-2 mb-8 justify-center md:justify-start">
              <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg">24</div>
              <span className="font-bold text-2xl tracking-tight">GBS</span>
            </Link>
            <p className="text-gray-500 mb-8 max-w-sm leading-relaxed text-lg">
              The unified operating system for global business. Powering 
              the next generation of commerce, loyalty, and audit with 
              uncompromising performance.
            </p>
            <div className="flex gap-4 justify-center md:justify-start">
              {[Twitter, Linkedin, Github, Youtube].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-400 hover:text-brand-blue hover:border-brand-blue/20 hover:shadow-xl transition-all">
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-8 text-gray-900">GBS Suite</h4>
            <ul className="space-y-4">
              {gbsProducts.map(p => (
                <li key={p.id}>
                  <Link to={`/product/${p.id}`} className="text-gray-500 hover:text-brand-blue transition-colors font-medium">{p.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-8 text-gray-900">Mcom Suite</h4>
            <ul className="space-y-4">
              {mcomProducts.map(p => (
                <li key={p.id}>
                  <Link to={`/product/${p.id}`} className="text-gray-500 hover:text-brand-blue transition-colors font-medium">{p.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-8 text-gray-900">Resources</h4>
            <ul className="space-y-4 text-gray-500 font-medium">
              <li><Link to="/about" className="hover:text-brand-blue transition-colors">About Us</Link></li>
              <li><Link to="/pricing" className="hover:text-brand-blue transition-colors">Pricing</Link></li>
              <li><Link to="/blog" className="hover:text-brand-blue transition-colors">Insights</Link></li>
              <li><Link to="/contact" className="hover:text-brand-blue transition-colors">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-8 text-gray-900">Join the Suite</h4>
            <div className="space-y-6">
              <p className="text-sm text-gray-500 font-medium">Get the latest ecosystem updates delivered to your inbox.</p>
              <div className="relative group">
                <input 
                  type="email" 
                  placeholder="name@company.com" 
                  className="w-full pl-4 pr-12 py-3 rounded-xl bg-white border border-gray-200 outline-none focus:border-brand-blue transition-all font-medium text-sm"
                />
                <button className="absolute right-2 top-1.5 w-9 h-9 flex items-center justify-center bg-brand-blue text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg active:scale-95">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-8 text-gray-400 text-sm font-medium">
          <div className="flex flex-wrap justify-center gap-8">
            <p>© 2026 24/7 Global Business Solutions</p>
            <Link to="/privacy" className="hover:text-brand-blue transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-brand-blue transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-brand-blue transition-colors">Cookie Settings</Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Systems fully operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
