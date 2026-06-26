import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import AffiliateRoleSelection from './pages/AffiliateRoleSelection';
import CustomerLandingPage from './pages/CustomerLandingPage';
import GetStartedRoleSelect from './pages/getstarted/GetStartedRoleSelect';
import BusinessOnboarding from './pages/getstarted/BusinessOnboarding';
import BusinessOnboardingUX from './pages/section/ui/ux/page';
import HighStreetExplanationUX from './pages/section/ui/ux/high-street/page';
import { AnimatePresence, motion } from 'motion/react';
import { PricingProvider } from './context/PricingContext';
import { BusinessProvider } from './context/BusinessContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AffiliateSignup from './pages/AffiliateSignup';
import AffiliateCheckEmail from './pages/AffiliateCheckEmail';
import AffiliateVerifyEmail from './pages/AffiliateVerifyEmail';

const queryClient = new QueryClient();

function SignupRedirect() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const navigate = useNavigate();

  React.useEffect(() => {
    if (role === 'customer') {
      navigate('/register/customer', { replace: true });
    } else if (role === 'business') {
      navigate('/getstarted/business', { replace: true });
    } else {
      navigate('/register', { replace: true });
    }
  }, [role, navigate]);

  return null;
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
  const isGetStarted = location.pathname.startsWith('/getstarted') || location.pathname.startsWith('/section/ui/ux') || location.pathname.startsWith('/signup');
  const hideNavFooter = isDashboard || isLogin || isAdmin || isRegister || isGetStarted;

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
            path="/customer" 
            element={
              <PageWrapper>
                <CustomerLandingPage />
              </PageWrapper>
            } 
          />
          <Route 
            path="/signup" 
            element={
              <PageWrapper>
                <SignupRedirect />
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
          <Route 
            path="/register/affiliate" 
            element={
              <PageWrapper>
                <AffiliateRoleSelection />
              </PageWrapper>
            } 
          />
          <Route 
            path="/register/affiliate/signup" 
            element={
              <PageWrapper>
                <AffiliateSignup />
              </PageWrapper>
            } 
          />
          <Route 
            path="/register/affiliate/check-email" 
            element={
              <PageWrapper>
                <AffiliateCheckEmail />
              </PageWrapper>
            } 
          />
          <Route 
            path="/register/affiliate/verify-email" 
            element={
              <PageWrapper>
                <AffiliateVerifyEmail />
              </PageWrapper>
            } 
          />
          <Route 
            path="/getstarted" 
            element={
              <PageWrapper>
                <GetStartedRoleSelect />
              </PageWrapper>
            } 
          />
          <Route 
            path="/getstarted/business" 
            element={
              <PageWrapper>
                <BusinessOnboarding />
              </PageWrapper>
            } 
          />
          <Route 
            path="/getstarted/business/high-street" 
            element={
              <PageWrapper>
                <HighStreetExplanationUX />
              </PageWrapper>
            } 
          />
          <Route 
            path="/section/ui/ux" 
            element={
              <PageWrapper>
                <BusinessOnboardingUX />
              </PageWrapper>
            } 
          />
          <Route 
            path="/section/ui/ux/high-street" 
            element={
              <PageWrapper>
                <HighStreetExplanationUX />
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
    <QueryClientProvider client={queryClient}>
      <PricingProvider>
        <BusinessProvider>
          <Router>
            <AnimatedRoutes />
          </Router>
        </BusinessProvider>
      </PricingProvider>
    </QueryClientProvider>
  );
}
