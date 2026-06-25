import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import ProductDetail from './pages/ProductDetail';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AboutPage from './pages/AboutPage';
import PricingPage from './pages/PricingPage';
import MembershipPage from './pages/MembershipPage';
import PackagesPage from './pages/PackagesPage';
import LoginPage from './pages/LoginPage';
import RegistrationEntry from './pages/RegistrationEntry';
import BusinessRegistration from './pages/BusinessRegistration';
import CustomerRegistration from './pages/CustomerRegistration';
import { AnimatePresence, motion } from 'motion/react';
import { PricingProvider } from './context/PricingContext';
import { BusinessProvider } from './context/BusinessContext';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminDataProvider } from './context/AdminDataContext';

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

function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAdminAuth();
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  const isDashboard = location.pathname === '/dashboard';
  const isAdmin = location.pathname.startsWith('/admin');
  const isLogin = location.pathname === '/login';
  const isRegister = location.pathname.startsWith('/register');
  const hideNavFooter = isDashboard || isAdmin || isLogin || isRegister;

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
            path="/admin/login" 
            element={
              <PageWrapper>
                <AdminLogin />
              </PageWrapper>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedAdminRoute>
                <PageWrapper>
                  <AdminDashboard />
                </PageWrapper>
              </ProtectedAdminRoute>
            } 
          />
          <Route 
            path="/admin/pricing" 
            element={<Navigate to="/admin" replace />} 
          />
          <Route 
            path="/admin/businesses" 
            element={<Navigate to="/admin" replace />} 
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
            path="/membership" 
            element={
              <PageWrapper>
                <MembershipPage />
              </PageWrapper>
            } 
          />
          <Route 
            path="/packages" 
            element={
              <PageWrapper>
                <PackagesPage />
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
          <Route 
            path="/register" 
            element={
              <PageWrapper>
                <RegistrationEntry />
              </PageWrapper>
            } 
          />
          <Route 
            path="/register/business" 
            element={
              <PageWrapper>
                <BusinessRegistration />
              </PageWrapper>
            } 
          />
          <Route 
            path="/register/customer" 
            element={
              <PageWrapper>
                <CustomerRegistration />
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
        <AdminAuthProvider>
          <AdminDataProvider>
            <Router>
              <AnimatedRoutes />
            </Router>
          </AdminDataProvider>
        </AdminAuthProvider>
      </BusinessProvider>
    </PricingProvider>
  );
}
