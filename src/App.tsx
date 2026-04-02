import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ProductDetail from './pages/ProductDetail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PricingManager from './pages/PricingManager';
import AllBusinesses from './pages/AllBusinesses';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import LoginPage from './pages/LoginPage';
import { AnimatePresence, motion } from 'motion/react';
import { PricingProvider } from './context/PricingContext';
import { BusinessProvider } from './context/BusinessContext';

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

function AnimatedRoutes() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAdmin = location.pathname.startsWith('/admin');
  const isLogin = location.pathname === '/login';
  const hideNavFooter = isDashboard || isLogin || isAdmin;

  return (
    <>
      {!hideNavFooter && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes location={location}>
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
            path="/admin" 
            element={
              <PageWrapper>
                <AdminDashboard />
              </PageWrapper>
            } 
          />
          <Route 
            path="/admin/pricing" 
            element={
              <PageWrapper>
                <PricingManager />
              </PageWrapper>
            } 
          />
          <Route 
            path="/admin/businesses" 
            element={
              <PageWrapper>
                <AllBusinesses />
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

export default function App() {
  return (
    <PricingProvider>
      <BusinessProvider>
        <Router>
          <AnimatedRoutes />
        </Router>
      </BusinessProvider>
    </PricingProvider>
  );
}
