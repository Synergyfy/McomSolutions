import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import ProductDetail from './pages/ProductDetail';
import Dashboard from './pages/Dashboard';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import { AnimatePresence, motion } from 'motion/react';

function AnimatedRoutes() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isLogin = location.pathname === '/login';
  const hideNavFooter = isDashboard || isLogin;

  return (
    <>
      {!hideNavFooter && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route 
            path="/" 
            element={
              <PageWrapper>
                <LandingPage />
              </PageWrapper>
            } 
          />
          <Route 
            path="/product/:id" 
            element={
              <PageWrapper>
                <ProductDetail />
              </PageWrapper>
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <PageWrapper>
                <Dashboard />
              </PageWrapper>
            } 
          />
          <Route 
            path="/about" 
            element={
              <PageWrapper>
                <AboutPage />
              </PageWrapper>
            } 
          />
          <Route 
            path="/pricing" 
            element={
              <PageWrapper>
                <PricingPage />
              </PageWrapper>
            } 
          />
          <Route 
            path="/login" 
            element={
              <PageWrapper>
                <LoginPage />
              </PageWrapper>
            } 
          />
        </Routes>
      </AnimatePresence>
      {!hideNavFooter && <Footer />}
    </>
  );
}

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-12 mb-16">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center text-white font-bold">24</div>
              <span className="font-bold text-xl">GBS</span>
            </div>
            <p className="text-gray-500 max-w-xs leading-relaxed">
              Powering the next generation of global business solutions with 
              integrated tools for loyalty, audit, and commerce.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-6">Products</h4>
            <ul className="space-y-4 text-gray-500">
              <li><Link to="/product/gbs-loyalty" className="hover:text-brand-blue transition-colors">GBS Loyalty</Link></li>
              <li><Link to="/product/gbs-audit" className="hover:text-brand-blue transition-colors">GBS Audit</Link></li>
              <li><Link to="/product/mcom-mall" className="hover:text-brand-blue transition-colors">Mcom Mall</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-gray-500">
              <li><Link to="/about" className="hover:text-brand-blue transition-colors">About Us</Link></li>
              <li><Link to="/careers" className="hover:text-brand-blue transition-colors">Careers</Link></li>
              <li><Link to="/contact" className="hover:text-brand-blue transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-gray-500">
              <li><Link to="/privacy" className="hover:text-brand-blue transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-brand-blue transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-gray-400 text-sm">
          <p>© 2026 24/7 Global Business Solutions. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-brand-blue transition-colors">Twitter</a>
            <a href="#" className="hover:text-brand-blue transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-brand-blue transition-colors">GitHub</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <Router>
      <AnimatedRoutes />
    </Router>
  );
}
