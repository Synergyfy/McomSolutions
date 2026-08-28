'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronLeft, Upload, Check,
  Shield, Crown, Compass, MapPin,
  Trophy, Building2, Globe, Eye, EyeOff, Image, AlertCircle, Phone, User,
  Mail, ShieldCheck, X, Search, Star, Clock, ArrowRight, HelpCircle, Map, MessageSquare, RefreshCw, CheckCircle2, CloudDownload, ShoppingBag, Utensils, UtensilsCrossed, Umbrella, Wine, Coffee, Lightbulb, Bell, Package, Briefcase, ChevronUp, ChevronDown, Badge, Rocket, Fingerprint, Info, Heart, Gift, Megaphone, Gamepad2, Calendar, CalendarDays, Ticket, Store, BadgeCheck, Archive, Puzzle, Truck, Settings, Circle, LayoutDashboard, Share2, Award, UserPlus, Sparkles,   Calculator, Plane, Palette, CreditCard, Croissant, Landmark, Zap, FileSearch, Factory, HardHat, GraduationCap, Cpu,   Sprout, Users, Monitor, Target, BarChart3, FileText, TrendingUp, ShoppingCart, LogOut
} from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiClient, setSharedAuthCookies, clearSharedAuthCookies } from '../../services/api';
import { businessApi } from '../../services/business';
import { useRegister, useLogin as useLoginHook, useSendOtp as useSendOtpHook, useVerifyOtp as useVerifyOtpHook, usePostSsoAuthorize, useGetSsoToken, useCurrentUser, useLogout } from '../../services/auth/hooks';
import { usePricing, ICON_MAP, SubTier } from '../../context/PricingContext';
import { usePlatformPlans, usePlatformStripeInitiate, usePlatformPaypalInitiate } from '../../services/payment/hooks';
import PlatformPaymentModal from '../../components/payment/PlatformPaymentModal';
import { cn } from '../../lib/utils';
import { SECTORS, CATEGORIES, SUBCATEGORIES } from '../../data/sectors';
import { useGetSectors, useGetCategoriesBySector, useGetSubCategoriesByCategory } from '../../hooks/useCategoryData';
import { useOnboardingWizard } from '../../hooks/useOnboardingWizard';
import { useGeolocation } from '../../hooks/useGeolocation';
import GoogleMapSection from '../../components/GoogleMapSection';
import WizardProgressBar from '../../components/WizardProgressBar';
import ImageCropModal from '../../components/ImageCropModal';


// ═══════════════════════════════════════════════════════════
// Local UI Component & Router Adapters
// ═══════════════════════════════════════════════════════════
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className || ''}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

function useRouter() {
  const navigate = useNavigate();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => navigate(-1),
  };
}

// ═══════════════════════════════════════════════════════════
// Live API Hooks, Redux, and Services (Calling NestJS Backend)
// ═══════════════════════════════════════════════════════════
const UserRole = {
  BUSINESS: 'BUSINESS' as const,
  CUSTOMER: 'CUSTOMER' as const,
  AGENT: 'AGENT' as const,
  OWNER: 'OWNER' as const,
};

function useCreateUser() {
  const { mutateAsync, isPending } = useRegister();
  return {
    mutateAsync: async (data: any) => {
      console.log('Registering user during onboarding:', data);
      const res = await businessApi.register({
        email: data.email,
        password: data.password,
        businessName: data.businessName || 'Business Owner',
        businessType: 'retail',
        country: 'United Kingdom',
        phone: data.phone || '',
      });
      return { data: res };
    },
    isPending,
  };
}

function useLogin() {
  const { mutateAsync, isPending } = useLoginHook();
  return {
    mutateAsync: async (data: any) => {
      console.log('Logging in user during onboarding:', data);
      const res = await businessApi.login({
        email: data.email,
        password: data.password,
      });
      return { data: res };
    },
    isPending,
  };
}

function useSendOtp() {
  const { mutateAsync, isPending } = useSendOtpHook();
  return {
    mutateAsync: async (data: any) => {
      console.log('Sending OTP to email via backend:', data);
      await businessApi.sendOtp(data.email);
      return { success: true };
    },
    isPending,
  };
}

// Validation pipe helper
function useValidateOtp() {
  const { mutateAsync, isPending } = useVerifyOtpHook();
  return {
    mutateAsync: async (data: any) => {
      console.log('Validating OTP code via backend:', data);
      const res = await businessApi.verifyOtp(data.email, data.otp);
      return { data: { valid: res.valid } };
    },
    isPending,
  };
}

function useCheckEmail() {
  return {
    mutateAsync: async (email: string) => {
      try {
        const res = await apiClient.get(`/auth/check-email?email=${encodeURIComponent(email)}`);
        return res.data;
      } catch {
        return { exists: false };
      }
    },
    isPending: false,
  };
}

function useAddListing() {
  return {
    mutateAsync: async (data: any) => {
      const res = await apiClient.put('/business/profile', data);
      return { data: res.data };
    },
    isPending: false,
  };
}

async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await apiClient.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

const useDispatch = () => (action: any) => console.log('Dispatch:', action);
const setAuthTokens = (tokens: any) => ({ type: 'SET_TOKENS', tokens });
const setUserData = (user: any) => ({ type: 'SET_USER', user });
const loadAuthFromCookies = () => ({ type: 'LOAD_AUTH' });

const Cookies = {
  set: (key: string, value: string, options?: any) => console.log(`Cookie Set: ${key} = ${value}`),
  get: (key: string) => null,
};

const api = {
  post: async (endpoint: string, payload: any): Promise<{ data: any }> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await apiClient.post(cleanEndpoint, payload);
    return res;
  },
  get: async (endpoint: string): Promise<{ data: any }> => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const res = await apiClient.get(cleanEndpoint);
    return res;
  },
  defaults: apiClient.defaults,
};
const baseURL = '/api/v1';



// ═══════════════════════════════════════════════════════════
// Quest Configuration — brand-palette warm tones
// ═══════════════════════════════════════════════════════════
const QUESTS = [
  {
    id: 'email',
    title: 'Create Your Business Account',
    flavor: 'Enter your business email address to get started.',
    label: 'Email',
    color: '#ea580c',
    colorLight: '#fff7ed',
    Icon: Mail,
  },
  {
    id: 'otp',
    title: 'Verify Your Email',
    flavor: 'Enter the 6-digit verification code we sent to your inbox.',
    label: 'OTP',
    color: '#f97316',
    colorLight: '#ffedd5',
    Icon: ShieldCheck,
  },
  {
    id: 'postcode',
    title: 'Business Location',
    flavor: 'Enter your postcode to find and verify your business address.',
    label: 'Address',
    color: '#d97706',
    colorLight: '#fffbeb',
    Icon: MapPin,
  },
  {
    id: 'borough_detected',
    title: 'Borough Detected',
    flavor: 'Review and confirm your local business district.',
    label: 'Borough',
    color: '#7c3aed',
    colorLight: '#f5f3ff',
    Icon: Building2,
  },
  {
    id: 'high_street_activation',
    title: 'High Street Activation',
    flavor: 'Activate your high street presence in the local network.',
    label: 'High Street',
    color: '#c2410c',
    colorLight: '#fff7ed',
    Icon: Store,
  },
  {
    id: 'storefront',
    title: 'Add Your Storefront',
    flavor: 'Set up your business storefront with images and description.',
    label: 'Storefront',
    color: '#0891b2',
    colorLight: '#ecfeff',
    Icon: Image,
  },
  {
    id: 'category',
    title: 'Category Selection',
    flavor: 'Select categories to power your positioning and partnership recommendations.',
    label: 'Category',
    color: '#f97316',
    colorLight: '#ffedd5',
    Icon: Compass,
  },
  {
    id: 'business_type',
    title: 'How Does Your Business Operate?',
    flavor: 'Select the primary way you conduct your business to help us tailor your dashboard.',
    label: 'Type',
    color: '#ea580c',
    colorLight: '#fff7ed',
    Icon: Shield,
  },
  {
    id: 'details',
    title: 'Your Account Details',
    flavor: 'Set up your name, phone number and a secure password.',
    label: 'Details',
    color: '#ef4444',
    colorLight: '#fef2f2',
    Icon: User,
  },
];

// ═══════════════════════════════════════════════════════════
// Particle Burst — fires from card center on step completion
// ═══════════════════════════════════════════════════════════
function ParticleBurst({ color, trigger }: { color: string; trigger: number }) {
  if (trigger === 0) return null;

  const palette = [color, '#fbbf24', '#fb923c'];

  return (
    <>
      {Array.from({ length: 18 }, (_, i) => {
        const angle = (360 / 18) * i + (Math.random() - 0.5) * 25;
        const dist = 55 + Math.random() * 85;
        const rad = angle * (Math.PI / 180);
        const x = Math.cos(rad) * dist;
        const y = Math.sin(rad) * dist;
        const size = 3 + Math.random() * 5;

        return (
          <motion.div
            key={`p-${trigger}-${i}`}
            className="absolute rounded-full pointer-events-none z-50"
            style={{
              width: size,
              height: size,
              backgroundColor: palette[i % palette.length],
              left: '50%',
              top: '50%',
              marginLeft: -size / 2,
              marginTop: -size / 2,
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x, y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.5 + Math.random() * 0.3, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// Confetti Rain — completion celebration
// ═══════════════════════════════════════════════════════════
function ConfettiRain() {
  const palette = ['#f97316', '#ef4444', '#fbbf24', '#ea580c', '#dc2626', '#d97706', '#fb923c'];

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {Array.from({ length: 28 }, (_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2.5;
        const duration = 2.5 + Math.random() * 3;
        const size = 6 + Math.random() * 7;
        const rotation = Math.random() * 360;

        return (
          <motion.div
            key={`c-${i}`}
            className="absolute"
            style={{
              left: `${left}%`,
              top: -20,
              width: size,
              height: size * 0.55,
              backgroundColor: palette[i % palette.length],
              borderRadius: 2,
            }}
            animate={{
              y: ['0vh', '105vh'],
              rotate: [rotation, rotation + 360 + Math.random() * 360],
              x: [0, (Math.random() - 0.5) * 80],
            }}
            transition={{
              duration,
              delay,
              ease: 'linear',
              repeat: Infinity,
            }}
          />
        );
      })}
    </div>
  );
}

function HighStreetActivationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 backdrop-blur-md bg-orange-950/25"
          />
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="bg-white rounded-3xl w-full max-w-lg max-h-[85dvh] overflow-y-auto shadow-2xl relative z-10 border border-gray-100 flex flex-col"
          >
            <div className="h-2.5 bg-gradient-to-r from-orange-500 to-red-500 shrink-0" />
            <div className="p-6 sm:p-8 overflow-y-auto">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-4 mx-auto">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 tracking-tight text-center">High Street Activation</h3>
              <p className="text-gray-500 text-sm text-center mb-6">By validating your postcode, your store is integrated into your local borough's digital business network.</p>
              <div className="w-full space-y-4 mb-6 text-left">
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Active High Street Listing</h4>
                    <p className="text-xs text-gray-500">Your store will appear in the local borough's active directory, making you easily discoverable to nearby shoppers.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Virtual Hub Integration</h4>
                    <p className="text-xs text-gray-500">Gain access to digital co-promotions, local business collaborations, and district-wide marketing campaigns.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-800">Community Engagement</h4>
                    <p className="text-xs text-gray-500">Connect with local merchant association groups, consumer feedback channels, and digital neighborhood forums.</p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-xl font-bold text-base shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

const BOROUGH_DATA: Record<string, {
  name: string;
  mallName: string;
  district: string;
  detectedImage: string;
  activationImage: string;
  nearbyBusinesses: number;
  activeCampaigns: number;
  localShoppers: string;
  networkBusinesses: string;
}> = {
  'Camden Borough': {
    name: 'Camden Borough',
    mallName: 'Camden High Street Mall',
    district: 'NW1 District • Central London',
    detectedImage: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&q=80',
    activationImage: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80',
    nearbyBusinesses: 42,
    activeCampaigns: 8,
    localShoppers: '1.2k',
    networkBusinesses: '248',
  },
  'Richmond Borough': {
    name: 'Richmond Borough',
    mallName: 'Richmond High Street Mall',
    district: 'TW9 District • Greater London',
    detectedImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    activationImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80',
    nearbyBusinesses: 35,
    activeCampaigns: 5,
    localShoppers: '950',
    networkBusinesses: '180',
  },
  'Islington Borough': {
    name: 'Islington Borough',
    mallName: 'Islington High Street Mall',
    district: 'N1 District • North London',
    detectedImage: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80',
    activationImage: 'https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800&q=80',
    nearbyBusinesses: 51,
    activeCampaigns: 12,
    localShoppers: '1.8k',
    networkBusinesses: '310',
  },
  'Westminster Borough': {
    name: 'Westminster Borough',
    mallName: 'Westminster High Street Mall',
    district: 'SW1 District • Central London',
    detectedImage: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=80',
    activationImage: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800&q=80',
    nearbyBusinesses: 64,
    activeCampaigns: 15,
    localShoppers: '2.4k',
    networkBusinesses: '420',
  }
};

// ═══════════════════════════════════════════════════════════
// Main Business Onboarding Component
// ═══════════════════════════════════════════════════════════
function BusinessOnboardingInner() {
  const { plans } = usePricing();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    businessName: '',
    shortDescription: '',
    businessPhone: '',
    logo: null as string | null,
    address: '',
    postcode: '',
    city: '',
    businessType: 'products' as 'products' | 'services' | 'both',
    businessOperation: '' as 'physical' | 'home' | 'mobile' | 'online' | '',
    sectorId: '',
    categoryId: '',
    subCategoryId: '',
    isStandardHours: true,
    is247: false,
    isCustomHours: false,
    customHours: [
      { dayOfWeek: 1, name: 'Monday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 2, name: 'Tuesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 3, name: 'Wednesday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 4, name: 'Thursday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 5, name: 'Friday', isOpen: true, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 6, name: 'Saturday', isOpen: false, openTime: '09:00', closeTime: '17:00' },
      { dayOfWeek: 0, name: 'Sunday', isOpen: false, openTime: '09:00', closeTime: '17:00' },
    ],
    sellingModes: ['pickup'] as string[],
    bookingAcceptance: 'manual' as 'auto' | 'manual',
    minimumNotice: '24h',
    cancellationPolicy: '',
    bufferTime: '15m',
    maxDailyBookings: '',
    serviceFulfillmentModel: 'in_store' as 'in_store' | 'mobile' | 'virtual',
    travelRadius: '',
  });

  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const exteriorInputRef = useRef<HTMLInputElement>(null);
  const gridInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number>(-1);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropModalSrc(reader.result as string);
        setCropModalAspect(16 / 6);
        setCropModalTitle('Crop Cover Image');
        setCropModalTarget('cover');
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExteriorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setExteriorFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setExteriorImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGridUploadClick = (index: number) => {
    replaceIndexRef.current = index;
    gridInputRef.current?.click();
  };

  const handleGridFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (replaceIndexRef.current === -1) {
        setGridImages(prev => [...prev, dataUrl]);
        setGridFiles(prev => [...prev, file]);
      } else {
        const idx = replaceIndexRef.current;
        setGridImages(prev => {
          const next = [...prev];
          next[idx] = dataUrl;
          return next;
        });
        setGridFiles(prev => {
          const next = [...prev];
          next[idx] = file;
          return next;
        });
      }
    };
    reader.readAsDataURL(file);
  };
  const router = useRouter();
  const logout = useLogout();
  const [searchParams] = useSearchParams();

  const handleLogout = () => {
    localStorage.removeItem('businessOnboardingState');
    localStorage.removeItem('businessOnboarding');
    localStorage.removeItem('businessOnboardingStep');
    localStorage.removeItem('businessOnboardingCompleted');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
    localStorage.removeItem('pendingPlatformPurchase');
    localStorage.removeItem('onboardingPaymentSuccess');
    localStorage.removeItem('firstDashboardLogin');
    clearSharedAuthCookies();
    logout();
  };

  const handleRestartOnboarding = () => {
    localStorage.removeItem('businessOnboardingState');
    localStorage.removeItem('businessOnboarding');
    localStorage.removeItem('businessOnboardingStep');
    localStorage.removeItem('businessOnboardingCompleted');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
    localStorage.removeItem('pendingPlatformPurchase');
    localStorage.removeItem('onboardingPaymentSuccess');
    clearSharedAuthCookies();
    window.location.reload();
  };

  const { mutateAsync: postSsoAuthorize } = usePostSsoAuthorize();
  const { mutateAsync: getSsoToken } = useGetSsoToken();

  const performSSORedirect = async (fallbackRoute: string = '/dashboard') => {
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const state = searchParams.get('state');
    const scope = searchParams.get('scope');

    // Scenario A: Standard OAuth Flow
    if (clientId && redirectUri) {
      try {
        const authRes = await postSsoAuthorize({ clientId, redirectUri, scope: scope || undefined, state: state || undefined });
        window.location.href = `${redirectUri}?code=${authRes.code}&state=${state || ''}`;
        return;
      } catch (err) {
        console.error("SSO OAuth authorization failed", err);
      }
    }

    // Scenario B: Direct SSO / Shared Handshake Flow
    const source = searchParams.get('source') || (clientId === 'mcom-mall' ? 'mcommall' : clientId === 'mcom-loyalty' ? 'mcomloyalty' : null);
    const redirectParam = searchParams.get('redirect') || searchParams.get('callbackUrl') || state;
    
    let redirectTarget = null;
    let finalRedirectState = null;

    if (redirectParam) {
      if (redirectParam.startsWith('http://') || redirectParam.startsWith('https://')) {
        redirectTarget = redirectParam;
      } else {
        finalRedirectState = redirectParam;
      }
    }

    // Determine platform base SSO url if redirect target is relative or null
    if (!redirectTarget) {
      if (source === 'mcomloyalty') {
        redirectTarget = `${import.meta.env.VITE_MCOM_LOYALTY_URL || 'http://localhost:3005'}/sso-login`;
      } else if (source === 'mcommall') {
        redirectTarget = `${import.meta.env.VITE_MCOM_MALL_URL || 'http://localhost:3002'}/auth/sso`;
      }
    }

    if (redirectTarget) {
      try {
        const ssoRes = await getSsoToken(clientId || undefined);
        const separator = redirectTarget.includes('?') ? '&' : '?';
        const tokenParamName = redirectTarget.includes('sso_token') || redirectTarget.includes('/auth/sso') ? 'sso_token' : 'token';
        let targetUrl = `${redirectTarget}${separator}${tokenParamName}=${ssoRes.ssoToken}`;
        
        if (finalRedirectState) {
          targetUrl += `&state=${encodeURIComponent(finalRedirectState)}`;
        }
        
        window.location.href = targetUrl;
        return;
      } catch (err) {
        console.error('Failed to generate SSO token', err);
      }
    } else if (finalRedirectState) {
      router.push(finalRedirectState);
      return;
    }

    router.push(fallbackRoute);
  };

  const dispatch = useDispatch();

  // ── Handle OAuth popup callback ──────────────────────────────────────────
  // When Google redirects back, the popup reloads this page with ?claim=...
  // We detect that, notify the parent window, then close the popup.
  useEffect(() => {
    const claimStatus = searchParams.get('claim');
    const claimPlaceId = searchParams.get('placeId');
    if (!claimStatus) return;

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        {
          type: 'GOOGLE_CLAIM_RESULT',
          success: claimStatus === 'success',
          placeId: claimPlaceId,
        },
        window.location.origin
      );
      window.close();
    }
  }, []);
  // ─────────────────────────────────────────────────────────────────────────
  
  const activeQuests = QUESTS;

  const WIZARD_STEPS = [
    { label: 'Account', description: 'Create your business account' },
    { label: 'Verify', description: 'Verify your email' },
    { label: 'Location', description: 'Set your business location' },
    { label: 'Borough', description: 'Confirm your local borough' },
    { label: 'High Street', description: 'Activate high street presence' },
    { label: 'Storefront', description: 'Set up your storefront' },
    { label: 'Categories', description: 'Select business categories' },
    { label: 'Operations', description: 'Business operation type' },
    { label: 'Details', description: 'Your personal details' },
  ];

  const { wizardStepIndex, completedWizardSteps, nextWizardStep, prevWizardStep } = useOnboardingWizard(WIZARD_STEPS.length);

  const { mutateAsync: createUser } = useCreateUser();
  const { mutateAsync: login } = useLogin();
  const { mutateAsync: sendOtp } = useSendOtp();
  const { mutateAsync: validateOtp } = useValidateOtp();
  const { mutateAsync: checkEmail } = useCheckEmail();
  const { mutateAsync: addListing } = useAddListing();

  const { data: sectors, isLoading: sectorsLoading, error: sectorsError } = useGetSectors();
  const { data: categories, isLoading: categoriesLoading } = useGetCategoriesBySector(formData.sectorId);
  const { data: subcategories, isLoading: subcategoriesLoading } = useGetSubCategoriesByCategory(formData.categoryId);

  // --- Google Onboarding State ---
  const [isGoogleOnboarding, setIsGoogleOnboarding] = useState(false);
  const [googleStep, setGoogleStep] = useState<'branch_select' | 'fail_safe_form' | 'review_claim' | null>(null);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleBranches, setGoogleBranches] = useState<any[]>([]);
  const [selectedGoogleBranch, setSelectedGoogleBranch] = useState<any>(null);
  const [googleMapping, setGoogleMapping] = useState<any>(null);
  

  // Fail-Safe Edit Form state
  const [googlePhoneInput, setGooglePhoneInput] = useState('');
  const [googleSectorId, setGoogleSectorId] = useState('');
  const [googleCategoryId, setGoogleCategoryId] = useState('');
  const [googleSubCategoryId, setGoogleSubCategoryId] = useState('');

  // Review & Claim Step state
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');
  const [ownerBusinessType, setOwnerBusinessType] = useState<'products' | 'services' | 'both'>('products');

  // Load Google mapping categories dynamically based on selected sector/category
  const { data: googleCategories } = useGetCategoriesBySector(googleSectorId);
  const { data: googleSubcategories } = useGetSubCategoriesByCategory(googleCategoryId);

  // Dynamic Search state for real Google Places queries
  const [searchName, setSearchName] = useState('');
  const [searchLoc, setSearchLoc] = useState('');
  const [searchRadius, setSearchRadius] = useState(5);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const extractPostcode = (address: string) => {
    // UK postcode: SW1A 2AA, EC1A 1BB, etc.
    const ukMatch = address.match(/[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}/i);
    if (ukMatch) return ukMatch[0];
    // Nigerian / generic numeric postal code: 5-6 digits (e.g. 900211, 100001)
    const numMatch = address.match(/\b(\d{5,6})\b/);
    if (numMatch) return numMatch[1];
    // US zip+4 or zip: 12345 or 12345-6789
    const usMatch = address.match(/\b(\d{5}(?:-\d{4})?)\b/);
    if (usMatch) return usMatch[1];
    return '';
  };

  const handleSearch = async () => {
    if (!searchName.trim() && !searchLoc.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);
    try {
      const queryText = `${searchName} ${searchLoc}`.trim();
      const res = await api.get(`google/google-business?queryText=${encodeURIComponent(queryText)}&radius=${searchRadius}`);
      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.places)
        ? raw.places
        : Array.isArray(raw?.results)
        ? raw.results
        : Array.isArray(raw?.businesses)
        ? raw.businesses
        : [];

      const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

      const places = list.map((p: any) => {
        const placeId = p.place_id || p.placeId || p.googlePlaceId || p.id;
        const name = p.name || p.displayName?.text || 'Business Name';
        const formatted_address = p.formatted_address || p.formattedAddress || p.vicinity || '';
        const types = p.types || [];
        const primaryType = types[0] || 'establishment';
        const photoRef = p.photos?.[0]?.photo_reference || p.photos?.[0]?.photoReference;
        const photoName = p.photos?.[0]?.name;

        const heroPhotoUrl = p.heroImg || (photoName
          ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${googleApiKey}`
          : photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${googleApiKey}`
          : '');

        const thumbPhotoUrl = p.thumbImg || (photoName
          ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=200&key=${googleApiKey}`
          : photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photoRef}&key=${googleApiKey}`
          : '');

        const allPhotoUrls = p.allPhotos || (p.photos || []).slice(0, 5).map((ph: any) =>
          ph.name
            ? `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=800&key=${googleApiKey}`
            : ph.photo_reference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ph.photo_reference}&key=${googleApiKey}`
            : ''
        ).filter(Boolean);

        const weekdayText =
          p.openingHours?.weekday_text || p.opening_hours?.weekday_text || [];
        const hoursText =
          p.hours || weekdayText[new Date().getDay()] || (p.isOpenNow || p.opening_hours?.open_now ? 'Open now' : 'Closed');
        const isOpen =
          p.isOpenNow ?? p.openingHours?.open_now ?? p.opening_hours?.open_now ?? false;

        return {
          place_id: placeId,
          placeId: placeId,
          googlePlaceId: placeId,
          name: name,
          formatted_address: formatted_address,
          formattedAddress: formatted_address,
          postcode: p.postcode || extractPostcode(formatted_address),
          lat: p.lat || p.location?.latitude || p.geometry?.location?.lat || 0,
          lng: p.lng || p.location?.longitude || p.geometry?.location?.lng || 0,
          types: types,
          primaryType: primaryType,
          primaryTypeDisplayName: primaryType.replace(/_/g, ' '),
          formatted_phone_number: p.formatted_phone_number || p.businessPhone || p.internationalPhoneNumber || p.international_phone_number || '',
          international_phone_number:
            p.international_phone_number || p.internationalPhoneNumber || p.businessPhone || '',
          website: p.website || p.websiteUri || '',
          rating: p.rating || 0,
          user_ratings_total: p.user_ratings_total || p.userRatingsTotal || p.userRatingCount || 0,
          photos: p.photos || [],
          heroImg: heroPhotoUrl,
          thumbImg: thumbPhotoUrl,
          allPhotos: allPhotoUrls,
          hours: hoursText,
          isOpenNow: isOpen,
        };
      });

      setSearchResults(places);
    } catch (err: any) {
      setSearchError('Failed to search businesses. Please check your network or try a different search term.');
      console.error('Business search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGoogleStart = async () => {
    console.log("handleGoogleStart triggered. selectedPreviewBusiness:", selectedPreviewBusiness);
    if (!selectedPreviewBusiness?.googlePlaceId) {
      console.warn("Cannot start Google OAuth: googlePlaceId is missing.", selectedPreviewBusiness);
      setSubmitError("Failed to start Google connection: No Google Place ID is associated with this business.");
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);

    // ─── OAuth popup flow ───
    try {
      const returnUrl = `${window.location.origin}/getstarted/business`;
      const res = await api.post('claim/start', {
        placeId: selectedPreviewBusiness.googlePlaceId,
        returnUrl,
      });
      const { authUrl } = res.data;

      const popup = window.open(
        authUrl,
        'google_oauth',
        'width=520,height=660,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        window.location.href = authUrl;
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        const getOrigin = (urlStr?: string) => {
          if (!urlStr) return '';
          try { return new URL(urlStr).origin; } catch { return ''; }
        };
        const allowedOrigins = [
          window.location.origin,
          getOrigin(import.meta.env.VITE_BACKEND_URL),
          getOrigin(import.meta.env.VITE_API_URL),
          'http://localhost:3010',
          'http://localhost:3000',
          'http://localhost:5173'
        ].filter(Boolean);
        if (!allowedOrigins.includes(event.origin)) return;
        if (event.data?.type !== 'GOOGLE_CLAIM_RESULT') return;
        window.removeEventListener('message', handleMessage);
        clearInterval(pollTimer);
        setIsSubmitting(false);
        if (event.data.success) {
          if (event.data.email) {
            setGoogleEmail(event.data.email);
          }
          setIsGoogleOnboarding(true);
          setShowConnectGooglePage(false);
          handleGoogleSelectBranch({
            googlePlaceId: selectedPreviewBusiness.googlePlaceId,
            businessName: selectedPreviewBusiness.businessName,
            address: selectedPreviewBusiness.address,
            postcode: selectedPreviewBusiness.postcode,
            businessPhone: selectedPreviewBusiness.businessPhone,
            googleCategoryId: selectedPreviewBusiness.googleCategoryId,
          });
        } else {
          setSubmitError(
            'We could not verify your ownership of this business on Google. ' +
            'Please try again or enter your details manually.'
          );
        }
      };
      window.addEventListener('message', handleMessage);

      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener('message', handleMessage);
          setIsSubmitting(false);
        }
      }, 600);
    } catch (err: any) {
      setSubmitError(
        err?.response?.data?.message ||
        'Failed to connect to Google. Please ensure Google credentials are configured.'
      );
      setIsSubmitting(false);
    }
  };

  const handleGoogleSelectBranch = async (branch: any) => {
    setSelectedGoogleBranch(branch);
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.get(`google-business/map-category?googleCategoryId=${encodeURIComponent(branch.googleCategoryId)}`);
      const mapping = res.data;
      setGoogleMapping(mapping);

      if (mapping && mapping.sectorId && mapping.categoryId && mapping.subCategoryId && branch.businessPhone) {
        setGoogleSectorId(mapping.sectorId);
        setGoogleCategoryId(mapping.categoryId);
        setGoogleSubCategoryId(mapping.subCategoryId);
        setGooglePhoneInput(branch.businessPhone);
        setGoogleStep('review_claim');
      } else {
        setGooglePhoneInput(branch.businessPhone || '');
        setGoogleSectorId(mapping?.sectorId || '');
        setGoogleCategoryId(mapping?.categoryId || '');
        setGoogleSubCategoryId(mapping?.subCategoryId || '');
        setGoogleStep('fail_safe_form');
      }
    } catch (err) {
      setGooglePhoneInput(branch.businessPhone || '');
      setGoogleSectorId('');
      setGoogleCategoryId('');
      setGoogleSubCategoryId('');
      setGoogleStep('fail_safe_form');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleFailSafeSubmit = () => {
    setSubmitError(null);
    if (!googlePhoneInput) {
      setSubmitError('Phone number is required.');
      return;
    }
    if (!googleSectorId || !googleCategoryId || !googleSubCategoryId) {
      setSubmitError('All category levels must be selected.');
      return;
    }
    setGoogleStep('review_claim');
  };

  const handleGoogleCompleteClaim = async () => {
    setSubmitError(null);
    if (!ownerFirstName || !ownerLastName) {
      setSubmitError('Please enter your First Name and Last Name.');
      return;
    }
    setIsSubmitting(true);
    try {
      const b = selectedPreviewBusiness || selectedGoogleBranch || {};
      const businessName = b.businessName || b.name || '';
      const address = b.address || b.formatted_address || '';
      const postcode = b.postcode || extractPostcode(address) || '';
      const phone = googlePhoneInput || b.businessPhone || b.formatted_phone_number || '';

      // Call backend to complete onboarding
      const res = await api.post('google-business/complete-onboarding', {
        email: googleEmail,
        password: formData.password,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        businessType: ownerBusinessType,
        googlePlaceId: b.googlePlaceId || b.place_id || '',
        businessName,
        businessPhone: phone,
        address,
        postcode,
        sectorId: googleSectorId,
        categoryId: googleCategoryId,
        subCategoryId: googleSubCategoryId,
        logoUrl: b.heroImg || '',
        source: searchParams.get('source') || 'direct',
      });

      const { auth, user, listing } = res.data;
      api.defaults.headers.common['Authorization'] = `Bearer ${auth.accessToken}`;
      setSharedAuthCookies(auth.accessToken, auth.refreshToken, user);
      dispatch(setAuthTokens({ accessToken: auth.accessToken, refreshToken: auth.refreshToken }));
      dispatch(setUserData({
        id: user?.id || user?._id || 'user_id',
        userName: user?.firstName ? `${user.firstName} ${user.lastName || ''}` : `${ownerFirstName} ${ownerLastName}`,
        userRole: user?.role || 'owner',
        packageInfo: user?.packageInfo ? { planType: user.packageInfo.planType } : null,
      }));

      // ─── BOTH MODES: Sync form data and proceed ───
      setFormData((prev: any) => ({
        ...prev,
        email: googleEmail || prev.email,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        businessName,
        businessPhone: phone,
        address,
        postcode,
        sectorId: googleSectorId || prev.sectorId,
        categoryId: googleCategoryId || prev.categoryId,
        subCategoryId: googleSubCategoryId || prev.subCategoryId,
        logo: b.heroImg || prev.logo || null,
      }));

      localStorage.setItem('businessOnboarding', JSON.stringify({
        businessName,
        postcode,
        address,
        logo: b.heroImg || null,
        sectorId: googleSectorId,
        categoryId: googleCategoryId,
        subCategoryId: googleSubCategoryId,
      }));

      setShowConnectGooglePage(false);
      setShowProgrammeIntro(true);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || err?.message || 'Failed to complete onboarding. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleBack = () => {
    setSubmitError(null);
    if (googleStep === 'branch_select') {
      setIsGoogleOnboarding(false);
      setGoogleStep(null);
      setShowInitialPrompt(true);
    } else if (googleStep === 'fail_safe_form') {
      setGoogleStep('branch_select');
    } else if (googleStep === 'review_claim') {
      const mapping = googleMapping;
      if (mapping && mapping.sectorId && mapping.categoryId && mapping.subCategoryId && selectedGoogleBranch?.businessPhone) {
        setGoogleStep('branch_select');
      } else {
        setGoogleStep('fail_safe_form');
      }
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropModalSrc(reader.result as string);
        setCropModalAspect(1);
        setCropModalTitle('Crop Logo');
        setCropModalTarget('logo');
        setCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    }
  };
  const [isClient, setIsClient] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showComplete, setShowComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [otp, setOtp] = useState(''); const [otpResending, setOtpResending] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // ─── Post-Quest Screens (Steps 5-7) ──────────────────
  const [showProgrammeIntro, setShowProgrammeIntro] = useState(false);
  const [showChoosePlan, setShowChoosePlan] = useState(false);
  const [showInitialAssessment, setShowInitialAssessment] = useState(false);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, string>>({});
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [planSubTier, setPlanSubTier] = useState<SubTier>('Normal');
  const [planBillingCycle, setPlanBillingCycle] = useState<'quarterly' | 'yearly'>('quarterly');

  // ─── Platform Plans (from external services) ──────────
  const sourceParam = searchParams.get('source');
  const platformMap: Record<string, string> = {
    'mcomloyalty': 'MCOM Rewards',
    'mcommall': 'MCOM Mall',
  };
  const platformName = sourceParam ? platformMap[sourceParam] : null;
  const { data: externalPlansRes, isLoading: isLoadingPlans } = usePlatformPlans(platformName);
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
  const { data: currentUser } = useCurrentUser(hasToken);

  useEffect(() => {
    if (currentUser?.businessProfile?.id && platformName) {
      setShowInitialPrompt(false);
      setShowChoosePlan(true);
    }
  }, [currentUser, platformName]);

  const externalPlans = Array.isArray(externalPlansRes?.data) 
    ? externalPlansRes.data 
    : Array.isArray(externalPlansRes) 
    ? externalPlansRes 
    : Array.isArray((externalPlansRes as any)?.plans)
    ? (externalPlansRes as any).plans
    : [];
  const stripeInitiate = usePlatformStripeInitiate();
  const paypalInitiate = usePlatformPaypalInitiate();
  const [selectedPlatformPlan, setSelectedPlatformPlan] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPlatformPaymentModal, setShowPlatformPaymentModal] = useState(false);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isCheckingProximity, setIsCheckingProximity] = useState(false);
  const [proximityResult, setProximityResult] = useState<{
    status: 'active' | 'inactive';
    resolvedArea?: string;
    localMallName?: string;
    localMallId?: string;
    businessCount?: number;
    activeCampaignsCount?: number;
    consumerCount?: number;
    message: string;
  } | null>(null);
  const [showProximityModal, setShowProximityModal] = useState(false);
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);
  const [showInitialPrompt, setShowInitialPrompt] = useState(true);
  const [showGoogleCategoryPage, setShowGoogleCategoryPage] = useState(false);
  const [googleCatDrillSector, setGoogleCatDrillSector] = useState<string | null>(null);
  const [googleCatDrillGroup, setGoogleCatDrillGroup] = useState<string | null>(null);
  const [showFindClaimPage, setShowFindClaimPage] = useState(false);
  const [showBusinessPreviewPage, setShowBusinessPreviewPage] = useState(false);
  const [showVerifyOwnershipPage, setShowVerifyOwnershipPage] = useState(false);
  const [showConnectGooglePage, setShowConnectGooglePage] = useState(false);
  const [showBusinessTypePage, setShowBusinessTypePage] = useState(false);
  const [showBusinessCategoryPage, setShowBusinessCategoryPage] = useState(false);
  const [showLocalNetworkPage, setShowLocalNetworkPage] = useState(false);
  const [showQuickSetupPage, setShowQuickSetupPage] = useState(false);
  const [showMembershipRoutingPage, setShowMembershipRoutingPage] = useState(false);
  const [showLinkAccountPage, setShowLinkAccountPage] = useState(false);
  const [showMembershipSelectionPage, setShowMembershipSelectionPage] = useState(false);
  const [showReviewStorefrontPage, setShowReviewStorefrontPage] = useState(false);
  const [showBuildingStorefrontPage, setShowBuildingStorefrontPage] = useState(false);
  const [isFinalizingStorefront, setIsFinalizingStorefront] = useState(false);
  const [showWelcomeChecklistPage, setShowWelcomeChecklistPage] = useState(false);
  const [storefrontLive, setStorefrontLive] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [lockedFeatureAttempt, setLockedFeatureAttempt] = useState<string | null>(null);
  const [cobrandedTab, setCobrandedTab] = useState<'standard' | 'pro' | 'plus'>('standard');
  const [selectedPlan, setSelectedPlan] = useState<'payg' | 'standard' | 'pro' | 'plus'>('standard');
  const [quickSetupToggles, setQuickSetupToggles] = useState({
    loyalty: true,
    rewards: true,
    promotions: true,
    gamification: false,
    bookings: false,
    events: false,
    vouchers: true
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['Restaurant', 'Italian']);
  const [storefrontProgress, setStorefrontProgress] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchHeaderCollapsed, setIsSearchHeaderCollapsed] = useState(false);
  const [verifyMethod, setVerifyMethod] = useState<'google' | 'email' | 'sms'>('google');
  const [selectedPreviewBusiness, setSelectedPreviewBusiness] = useState<any>(null);
  const [mapViewToggle, setMapViewToggle] = useState<'list' | 'map'>('list');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  // ─── Manual Onboarding States ────────────────────────
  const [showBoroughBrowser, setShowBoroughBrowser] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [exteriorImage, setExteriorImage] = useState<string | null>(null);
  const [exteriorFile, setExteriorFile] = useState<File | null>(null);
  const [gridImages, setGridImages] = useState<string[]>([]);
  const [gridFiles, setGridFiles] = useState<(File | null)[]>([]);

  // ─── Image Crop Modal State ──────────────────────────
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropModalSrc, setCropModalSrc] = useState('');
  const [cropModalAspect, setCropModalAspect] = useState(1);
  const [cropModalTitle, setCropModalTitle] = useState('Crop Image');
  const [cropModalTarget, setCropModalTarget] = useState<'logo' | 'cover'>('logo');
  const [selectedBorough, setSelectedBorough] = useState<string>('Camden Borough');
  const [boroughSearchQuery, setBoroughSearchQuery] = useState<string>('');

  const geo = useGeolocation();


  // ─── Debounced address suggestion lookup ──────────────
  useEffect(() => {
    if (!formData.postcode || formData.postcode.trim().length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // If address is already pre-filled (e.g. from Google import), skip backend lookup
    if (formData.address && formData.address.trim().length > 5) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const res = await api.get(`business/search-address?postcode=${encodeURIComponent(formData.postcode)}`);
        const list = Array.isArray(res?.data) 
          ? res.data 
          : Array.isArray(res?.data?.addresses) 
          ? res.data.addresses 
          : Array.isArray(res?.data?.suggestions)
          ? res.data.suggestions
          : [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      } catch (err) {
        console.error('Error fetching suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [formData.postcode, formData.address]);

  // ─── Load from cache ─────────────────────────────────
  const [restoreToast, setRestoreToast] = useState(false);
  useEffect(() => {
    setIsClient(true);
    try {
      const draft = localStorage.getItem('business_onboarding_draft');
      if (draft) {
        const parsed = JSON.parse(draft);
        if (parsed.formData) setFormData((prev: any) => ({ ...prev, ...parsed.formData }));
        if (parsed.step !== undefined) {
          setCurrentStep(parsed.step);
        }
        if (parsed.completedWizardSteps) setCompletedSteps(new Set(parsed.completedWizardSteps));
        if (parsed.showInitialPrompt !== undefined) setShowInitialPrompt(parsed.showInitialPrompt);
        if (parsed.showGoogleCategoryPage !== undefined) setShowGoogleCategoryPage(parsed.showGoogleCategoryPage);
        if (parsed.showFindClaimPage !== undefined) setShowFindClaimPage(parsed.showFindClaimPage);
        if (parsed.showBusinessPreviewPage !== undefined) setShowBusinessPreviewPage(parsed.showBusinessPreviewPage);
        if (parsed.showConnectGooglePage !== undefined) setShowConnectGooglePage(parsed.showConnectGooglePage);
        if (parsed.showBusinessTypePage !== undefined) setShowBusinessTypePage(parsed.showBusinessTypePage);
        if (parsed.showProgrammeIntro !== undefined) setShowProgrammeIntro(parsed.showProgrammeIntro);
        if (parsed.showChoosePlan !== undefined) setShowChoosePlan(parsed.showChoosePlan);
        if (parsed.showInitialAssessment !== undefined) setShowInitialAssessment(parsed.showInitialAssessment);
        if (parsed.selectedPreviewBusiness) setSelectedPreviewBusiness(parsed.selectedPreviewBusiness);
        if (parsed.googleSectorId) setGoogleSectorId(parsed.googleSectorId);
        if (parsed.googleCategoryId) setGoogleCategoryId(parsed.googleCategoryId);
        if (parsed.googleSubCategoryId) setGoogleSubCategoryId(parsed.googleSubCategoryId);
        if (parsed.googleStep) setGoogleStep(parsed.googleStep);
        if (parsed.searchName) setSearchName(parsed.searchName);
        if (parsed.searchLoc) setSearchLoc(parsed.searchLoc);
        if (parsed.searchRadius) setSearchRadius(parsed.searchRadius);
        setRestoreToast(true);
        setTimeout(() => setRestoreToast(false), 5000);
      } else {
        const cached = localStorage.getItem('businessOnboarding');
        const cachedStep = localStorage.getItem('businessOnboardingStep');
        const cachedCompleted = localStorage.getItem('businessOnboardingCompleted');
        if (cached) setFormData((prev: any) => ({ ...prev, ...JSON.parse(cached) }));
        if (cachedStep) {
          const step = parseInt(cachedStep, 10);
          setCurrentStep(step);
          if (step > 0) setShowInitialPrompt(false);
        }
        if (cachedCompleted) setCompletedSteps(new Set(JSON.parse(cachedCompleted)));
        if (cached || cachedStep) {
          setRestoreToast(true);
          setTimeout(() => setRestoreToast(false), 5000);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ─── Handle Payment Success Redirect ─────────────────
  useEffect(() => {
    if (!isClient) return;

    const paymentSuccess = localStorage.getItem('onboardingPaymentSuccess') === 'true';
    if (!paymentSuccess) return;

    // Check localStorage for cached business profile (fast path)
    const userRaw = localStorage.getItem('business_user');
    let hasBusinessProfile = false;
    if (userRaw) {
      try {
        const user = JSON.parse(userRaw);
        if (user?.businessProfile?.id) {
          hasBusinessProfile = true;
        }
      } catch (e) {}
    }

    if (currentUser?.businessProfile?.id || hasBusinessProfile) {
      localStorage.removeItem('onboardingPaymentSuccess');
      localStorage.removeItem('businessOnboardingState');
      performSSORedirect();
      return;
    }

    // If authenticated (has token) but user profile hasn't loaded yet, wait.
    if (hasToken && currentUser === undefined) {
      return;
    }

    // Default: new user signing up from scratch. Go to assessment.
    localStorage.removeItem('onboardingPaymentSuccess');
    localStorage.setItem('businessOnboardingState', 'assessment');
    setShowInitialPrompt(false);
    setShowChoosePlan(false);
    setShowProgrammeIntro(false);
    setShowInitialAssessment(true);
  }, [isClient, currentUser, hasToken]);

  useEffect(() => {
    if (!isClient) return;
    const currentQuestId = activeQuests[currentStep]?.id;
    if (
      (currentQuestId === 'borough_detected' || currentQuestId === 'high_street_activation') &&
      formData.postcode &&
      !proximityResult &&
      !isCheckingProximity
    ) {
      runLocationCheck(formData.postcode).catch((err) => console.error(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, isClient]);

  // ─── Save to cache ───────────────────────────────────
  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem('businessOnboarding', JSON.stringify(formData));
    localStorage.setItem('businessOnboardingStep', currentStep.toString());
    localStorage.setItem('businessOnboardingCompleted', JSON.stringify([...completedSteps]));
    // Also save to new wizard draft key with full screen state
    try {
      localStorage.setItem('business_onboarding_draft', JSON.stringify({
        step: currentStep,
        wizardStepIndex: currentStep,
        formData,
        completedWizardSteps: [...completedSteps],
        // Screen state
        showInitialPrompt,
        showGoogleCategoryPage,
        showFindClaimPage,
        showBusinessPreviewPage,
        showConnectGooglePage,
        showBusinessTypePage,
        showProgrammeIntro,
        showChoosePlan,
        showInitialAssessment,
        // Google import state
        selectedPreviewBusiness,
        googleSectorId,
        googleCategoryId,
        googleSubCategoryId,
        googleStep,
        searchName,
        searchLoc,
        searchRadius,
      }));
    } catch { /* ignore */ }
  }, [formData, currentStep, isClient, completedSteps]);

  // ─── Storefront Progress Simulation ───────────────────
  // Replaced by standalone BuildingStorefrontPage component

  // ─── Derived ─────────────────────────────────────────
  const currentQuest = activeQuests[currentStep] || activeQuests[0];
  const QuestIcon = currentQuest.Icon;

  const runLocationCheck = async (postcode: string) => {
    if (!postcode) {
      console.error('runLocationCheck: no postcode provided, skipping');
      setIsCheckingProximity(false);
      return;
    }
    setIsCheckingProximity(true);
    try {
      const res = await apiClient.post('/localmall/onboarding/check-location', { postcode }, { timeout: 10000 });
      const result = res.data;
      setProximityResult(result);
      if (result.resolvedArea) {
        const key = result.resolvedArea.includes('Borough')
          ? result.resolvedArea
          : `${result.resolvedArea} Borough`;
        setSelectedBorough(key);
      }
      
      // Persist to local storage for the dashboard
      if (result.status === 'active') {
        localStorage.setItem('businessProximityTier', 'high_street');
        localStorage.setItem('businessArea', result.resolvedArea || '');
        localStorage.setItem('localMallName', result.localMallName || '');
        localStorage.setItem('localMallId', result.localMallId || '');
      } else {
        localStorage.setItem('businessProximityTier', 'national');
        localStorage.setItem('businessArea', result.resolvedArea || 'Remote');
      }
      return result;
    } catch (err: any) {
      console.error('Error checking proximity:', err);
      throw err;
    } finally {
      setIsCheckingProximity(false);
    }
  };

  // ─── Handlers ────────────────────────────────────────
  const handleSelectSuggestion = async (suggestion: any) => {
    setFormData((prev: any) => ({
      ...prev,
      address: suggestion.displayName,
      postcode: suggestion.postcode,
    }));
    setShowSuggestions(false);

    try {
      await runLocationCheck(suggestion.postcode);
      const next = new Set(completedSteps);
      next.add(currentStep);
      setCompletedSteps(next);
      setParticleTrigger((p) => p + 1);
      setTimeout(() => setCurrentStep(currentStep + 1), 300);
    } catch (err) {
      console.error('Error in handleSelectSuggestion location check:', err);
    }
  };

  const handleModalContinue = () => {
    setShowProximityModal(false);
    handleNext();
  };

  const handleNext = async () => {
    setSubmitError(null);

    // ── Step 0: Send OTP to email ────────────────────────────
    if (currentStep === 0) {
      if (!formData.email) { setSubmitError('Please enter your email address.'); return; }
      setIsSubmitting(true);
      try {
        await sendOtp({ email: formData.email, type: 'VERIFICATION' });
        const next = new Set(completedSteps);
        next.add(0);
        setCompletedSteps(next);
        setParticleTrigger((p) => p + 1);
        setTimeout(() => setCurrentStep(1), 300);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setSubmitError(e?.message || 'Failed to send verification code. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Step 1: Validate OTP ───────────────────────────────
    if (currentStep === 1) {
      if (!otp || otp.length < 6) { setSubmitError('Please enter the full 6-digit code.'); return; }
      setIsSubmitting(true);
      try {
        await validateOtp({ email: formData.email, otp, type: 'VERIFICATION' });

        // Check if an account with this email already exists
        try {
          const emailCheck = await checkEmail(formData.email);
          if (emailCheck?.exists) {
            setSubmitError('An account with this email already exists. Please log in instead.');
            setIsSubmitting(false);
            return;
          }
        } catch {
          // If check-email endpoint fails, allow the user to continue
        }

        const next = new Set(completedSteps);
        next.add(1);
        setCompletedSteps(next);
        setParticleTrigger((p) => p + 1);
        setTimeout(() => setCurrentStep(2), 300);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setSubmitError(e?.message || 'Invalid code. Please check and try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Step 2: Postcode Location Check ────────────────────
    if (currentQuest.id === 'postcode') {
      if (!formData.postcode || formData.postcode.trim().length < 3) {
        setSubmitError('Please enter a valid UK postcode.');
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await runLocationCheck(formData.postcode);

        // If the postcode check failed or is completely invalid (not UK)
        if (result.status === 'inactive' && !result.options?.allowWaitlist && result.message) {
          setSubmitError(result.message);
          setIsSubmitting(false);
          return;
        }

        const next = new Set(completedSteps);
        if (!next.has(currentStep)) {
          next.add(currentStep);
          setCompletedSteps(next);
          setParticleTrigger((p) => p + 1);
        }
        setTimeout(() => setCurrentStep((c) => c + 1), 300);
      } catch (err: any) {
        setSubmitError(err?.response?.data?.message || err?.message || 'Failed to verify postcode location. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Category Step Validation ───────────────────────────
    if (currentQuest.id === 'category') {
      if (!formData.sectorId || !formData.categoryId || !formData.subCategoryId) {
        setSubmitError('Please select your sector, category, and subcategory.');
        return;
      }
    }

    // ── Details Step Validation ────────────────────────────
    if (currentQuest.id === 'details') {
      if (!formData.firstName.trim() || !formData.lastName.trim()) {
        setSubmitError('Please enter your first name and last name.');
        return;
      }
      if (!formData.password) {
        setSubmitError('Please enter a password.');
        return;
      }
      if (formData.password.length < 8) {
        setSubmitError('Password must be at least 8 characters long.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setSubmitError('Passwords do not match.');
        return;
      }
      if (!termsAccepted || !privacyAccepted) {
        setSubmitError('Please accept the Terms of Service and Privacy Policy.');
        return;
      }
    }

    // ── Profile Step Validation ────────────────────────────
    if (currentQuest.id === 'profile') {
      if (!formData.businessName.trim()) {
        setSubmitError('Please enter your business name.');
        return;
      }
    }

    // ── Final step: register + auto-login + create profile ──────────────────
    if (currentStep === activeQuests.length - 1) {
      if (!formData.sectorId || !formData.categoryId || !formData.subCategoryId) {
        setSubmitError('Please select your business categories.');
        return;
      }
      setIsSubmitting(true);
      try {
        if (!hasRegistered) {
          try {
            await createUser({
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              phoneNumber: formData.phoneNumber,
              password: formData.password,
              confirm_password: formData.confirmPassword,
              role: UserRole.OWNER,
            });
          } catch (err: any) {
            const msg = err?.response?.data?.message || err?.message || '';
            const code = err?.response?.data?.code || err?.code || '';
            if (
              msg.toLowerCase().includes('email has been used') ||
              msg.toLowerCase().includes('email_exists') ||
              code === 'EMAIL_EXISTS'
            ) {
              await login({
                email: formData.email,
                password: formData.password,
                role: UserRole.OWNER,
              });
            } else {
              throw err;
            }
          }

          if (!api.defaults.headers.common['Authorization']) {
            await login({
              email: formData.email,
              password: formData.password,
              role: UserRole.OWNER,
            });
          }

          setHasRegistered(true);
        }

        let uploadedLogoUrl = '';
        if (logoFile) {
          try {
            const uploadRes = await uploadFile(logoFile);
            uploadedLogoUrl = uploadRes.secure_url;
          } catch (uploadErr) {
            setSubmitError('Logo upload failed. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }

        let uploadedCoverUrl = '';
        if (coverFile) {
          try {
            const uploadRes = await uploadFile(coverFile);
            uploadedCoverUrl = uploadRes.secure_url;
          } catch (uploadErr) {
            setSubmitError('Cover image upload failed. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }

        let uploadedExteriorUrl = '';
        if (exteriorFile) {
          try {
            const uploadRes = await uploadFile(exteriorFile);
            uploadedExteriorUrl = uploadRes.secure_url;
          } catch (uploadErr) {
            setSubmitError('Storefront exterior image upload failed. Please try again.');
            setIsSubmitting(false);
            return;
          }
        }

        const payload: any = {
          listingType: formData.businessType === 'both' ? ['product', 'service'] : formData.businessType === 'products' ? ['product'] : ['service'],
          businessName: formData.businessName,
          shortDescription: formData.shortDescription || 'Fresh local business profile.',
          businessPhone: formData.businessPhone || formData.phoneNumber,
          businessEmail: formData.email,
          location: {
            postcode: formData.postcode,
            addressLine1: formData.address || 'Local Street Address',
            city: selectedBorough || localStorage.getItem('businessArea') || 'London',
            showPublicly: true,
          },
          sectorId: formData.sectorId,
          categoryId: formData.categoryId,
          subCategoryId: formData.subCategoryId,
          status: 'published',
          businessHours: formData.isStandardHours && !formData.is247 && !formData.isCustomHours
            ? [
                { dayOfWeek: 1, openTime: '09:00', closeTime: '17:00' },
                { dayOfWeek: 2, openTime: '09:00', closeTime: '17:00' },
                { dayOfWeek: 3, openTime: '09:00', closeTime: '17:00' },
                { dayOfWeek: 4, openTime: '09:00', closeTime: '17:00' },
                { dayOfWeek: 5, openTime: '09:00', closeTime: '17:00' },
              ]
            : formData.is247 
              ? [
                  { dayOfWeek: 1, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 2, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 3, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 4, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 5, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 6, openTime: '00:00', closeTime: '23:59', is24h: true },
                  { dayOfWeek: 0, openTime: '00:00', closeTime: '23:59', is24h: true },
                ]
              : formData.isCustomHours
                ? formData.customHours
                    .filter(day => day.isOpen)
                    .map(day => ({
                      dayOfWeek: day.dayOfWeek,
                      openTime: day.openTime,
                      closeTime: day.closeTime,
                    }))
                : undefined,
        };

        if (uploadedLogoUrl) {
          payload.logoUrl = uploadedLogoUrl;
        }

        if (uploadedCoverUrl) {
          payload.bannerUrl = uploadedCoverUrl;
        }

        const uploadedGridUrls: string[] = [];
        for (const file of gridFiles) {
          if (file) {
            try {
              const uploadRes = await uploadFile(file);
              uploadedGridUrls.push(uploadRes.secure_url);
            } catch (uploadErr) {
              setSubmitError('One or more grid image uploads failed. Please try again.');
              setIsSubmitting(false);
              return;
            }
          }
        }

        const mediaArray: string[] = [];
        if (uploadedExteriorUrl) {
          mediaArray.push(uploadedExteriorUrl);
        }
        if (uploadedGridUrls.length > 0) {
          mediaArray.push(...uploadedGridUrls);
        }
        if (mediaArray.length > 0) {
          payload.media = mediaArray;
        }

        if (payload.listingType.includes('product')) {
          payload.productSellerProfile = {
            sellingModes: formData.sellingModes.length > 0 ? formData.sellingModes : ['pickup'],
            hasAgeRestrictedItems: false,
          };
        }
        if (payload.listingType.includes('service')) {
          payload.serviceProviderProfile = {
            quoteOnly: false,
            hasPublicLiabilityInsurance: false,
            bookingAcceptance: formData.bookingAcceptance,
            minimumNotice: formData.minimumNotice,
            cancellationPolicy: formData.cancellationPolicy,
            bufferTime: formData.bufferTime,
            maxDailyBookings: formData.maxDailyBookings ? parseInt(formData.maxDailyBookings) : null,
            fulfillmentModel: formData.serviceFulfillmentModel,
            travelRadius: formData.travelRadius ? parseInt(formData.travelRadius) : null,
          };
        }

        await addListing(payload);

        const next = new Set(completedSteps);
        next.add(currentStep);
        setCompletedSteps(next);
        setParticleTrigger((p) => p + 1);

        localStorage.setItem('businessOnboarding', JSON.stringify({
          businessName: formData.businessName,
          postcode: formData.postcode,
          address: formData.address,
          logo: formData.logo,
        }));
        localStorage.removeItem('businessOnboardingStep');
        localStorage.removeItem('businessOnboardingCompleted');
        localStorage.removeItem('business_onboarding_draft');

        localStorage.setItem('businessOnboardingState', 'plan_selection');
        setShowProgrammeIntro(true);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setSubmitError(e?.message || 'Registration and profile creation failed. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Intermediate steps ─────────────────────────────────
    const next = new Set(completedSteps);
    if (!next.has(currentStep)) {
      next.add(currentStep);
      setCompletedSteps(next);
      setParticleTrigger((p) => p + 1);
    }
    setTimeout(() => setCurrentStep((c) => c + 1), 300);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((c) => c - 1);
    } else if (currentStep === 0) {
      setShowInitialPrompt(true);
    }
  };

  useEffect(() => {
    if (currentStep === 1 && otp.length === 6 && !isSubmitting && !submitError) {
      handleNext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp]);

  if (!isClient) return null;

  // ═══════════════════════════════════════════════════════
  // Pre-Onboarding Prompt
  // ═══════════════════════════════════════════════════════
  if (showInitialPrompt) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col relative overflow-y-auto overflow-x-hidden font-sans pt-6">
        {/* Subtle dot grid background */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />


        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="w-full max-w-[500px] flex flex-col space-y-6 sm:space-y-8 bg-white p-6 sm:p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 my-auto"
          >
            
            {/* Hero Illustration/Icon */}
            <div className="flex justify-center mb-2">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center shadow-inner transform rotate-3 hover:rotate-0 transition-transform">
                <svg className="w-10 h-10" viewBox="0 0 24 24">
                   <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.53-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-8.87z" />
                   <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.08 1.16-3.13 0-5.78-2.11-6.73-4.96H1.21v3.15C3.18 21.88 7.39 24 12 24z" />
                   <path fill="#FBBC05" d="M5.27 14.24A7.18 7.18 0 0 1 5 12c0-.79.13-1.57.38-2.32V6.53H1.21A11.94 11.94 0 0 0 0 12c0 1.92.45 3.74 1.21 5.37l4.06-3.13z" />
                   <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.39 0 3.18 2.12 1.21 5.37l4.06 3.15c.95-2.85 3.6-4.96 6.73-4.96z" />
                 </svg>
              </div>
            </div>

            {/* Content Group */}
            <div className="text-center space-y-3">
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight leading-tight">
                Is your business on Google?
              </h1>
              <p className="text-base text-gray-500 max-w-sm mx-auto font-medium">
                Importing your business from Google saves time and ensures your profile is accurate.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3 pt-2">
              <button 
                onClick={() => {
                  setShowInitialPrompt(false);
                  setShowBusinessPreviewPage(false);
                  setShowVerifyOwnershipPage(false);
                  setShowConnectGooglePage(false);
                  setShowBusinessTypePage(false);
                  setShowBusinessCategoryPage(false);
                  setShowLocalNetworkPage(false);
                  setShowQuickSetupPage(false);
                  setShowMembershipRoutingPage(false);
                  setShowLinkAccountPage(false);
                  setShowMembershipSelectionPage(false);
                  setShowReviewStorefrontPage(false);
                  setShowFindClaimPage(false);
                  setShowGoogleCategoryPage(true);
                }}
                className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold text-base flex items-center justify-center shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 active:scale-[0.98] transition-all"
              >
                YES, IMPORT FROM GOOGLE
              </button>
              <button 
                onClick={() => {
                  setShowGoogleCategoryPage(false);
                  setShowFindClaimPage(false);
                  setShowBusinessPreviewPage(false);
                  setShowVerifyOwnershipPage(false);
                  setShowConnectGooglePage(false);
                  setShowBusinessTypePage(false);
                  setShowBusinessCategoryPage(false);
                  setShowLocalNetworkPage(false);
                  setShowQuickSetupPage(false);
                  setShowMembershipRoutingPage(false);
                  setShowLinkAccountPage(false);
                  setShowMembershipSelectionPage(false);
                  setShowReviewStorefrontPage(false);
                  setShowInitialPrompt(false);
                }}
                className="w-full h-14 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold text-base flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all"
              >
                NO, ENTER MANUALLY
              </button>
            </div>

            {/* Information Card */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
              <div className="bg-blue-100 p-1.5 rounded-lg shrink-0">
                <Shield className="text-blue-600 w-4 h-4" />
              </div>
              <p className="text-sm text-blue-900 font-medium leading-relaxed">
                You can always manually enter your business details later if you choose "NO".
              </p>
            </div>

          </motion.div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Google Category Selection Page
  // ═══════════════════════════════════════════════════════
  if (showGoogleCategoryPage) {
    const SECTOR_ICON_MAP: Record<string, React.ReactNode> = {
      'hospitality-food': <Utensils className="w-8 h-8 mb-2 mx-auto" />,
      'retail-wholesale': <ShoppingBag className="w-8 h-8 mb-2 mx-auto" />,
      'manufacturing-industrial': <Factory className="w-8 h-8 mb-2 mx-auto" />,
      'professional-business': <Briefcase className="w-8 h-8 mb-2 mx-auto" />,
      'construction-property': <HardHat className="w-8 h-8 mb-2 mx-auto" />,
      'health-wellness': <Heart className="w-8 h-8 mb-2 mx-auto" />,
      'education-training': <GraduationCap className="w-8 h-8 mb-2 mx-auto" />,
      'transport-logistics': <Truck className="w-8 h-8 mb-2 mx-auto" />,
      'technology-digital': <Cpu className="w-8 h-8 mb-2 mx-auto" />,
      'financial-insurance': <Landmark className="w-8 h-8 mb-2 mx-auto" />,
      'tourism-travel': <Plane className="w-8 h-8 mb-2 mx-auto" />,
      'agriculture-environment': <Sprout className="w-8 h-8 mb-2 mx-auto" />,
      'community-public': <Users className="w-8 h-8 mb-2 mx-auto" />,
      'online-micro': <Monitor className="w-8 h-8 mb-2 mx-auto" />,
    };

    const activeSector = googleCatDrillSector ? SECTORS.find(s => s.id === googleCatDrillSector) : null;
    const activeCategory = googleCatDrillGroup
      ? CATEGORIES.find(c => c.id === googleCatDrillGroup)
      : null;

    let displayItems: { id: string; name: string; icon: React.ReactNode; tag?: string; onClick: () => void }[] = [];
    let pageTitle = 'Categories';
    let showBack = false;
    let onBack = () => {};

    if (activeCategory) {
      // Level 3: Show subcategories within the category
      pageTitle = activeCategory.name;
      showBack = true;
      onBack = () => setGoogleCatDrillGroup(null);
      const subs = SUBCATEGORIES.filter(sc => sc.categoryId === activeCategory.id);
      displayItems = subs.map(sc => ({
        id: sc.id,
        name: sc.name,
        icon: <Building2 className="w-8 h-8 mb-2 mx-auto" />,
        onClick: () => {
          setSearchName(sc.name);
          setShowGoogleCategoryPage(false);
          setGoogleCatDrillSector(null);
          setGoogleCatDrillGroup(null);
          setShowFindClaimPage(true);
        },
      }));
    } else if (activeSector) {
      // Level 2: Show categories within the sector
      pageTitle = activeSector.name;
      showBack = true;
      onBack = () => setGoogleCatDrillSector(null);
      const cats = CATEGORIES.filter(c => c.sectorId === activeSector.id);
      displayItems = cats.map(c => ({
        id: c.id,
        name: c.name,
        icon: SECTOR_ICON_MAP[activeSector.id] || <Building2 className="w-8 h-8 mb-2 mx-auto" />,
        onClick: () => setGoogleCatDrillGroup(c.id),
      }));
    } else {
      // Level 1: Show all sectors
      pageTitle = 'Categories';
      displayItems = SECTORS.map(s => ({
        id: s.id,
        name: s.name,
        icon: SECTOR_ICON_MAP[s.id] || <Building2 className="w-8 h-8 mb-2 mx-auto" />,
        onClick: () => setGoogleCatDrillSector(s.id),
      }));
    }

    const filteredCategories = (() => {
      const query = categorySearchQuery.trim();
      if (!query) return displayItems;

      const q = query.toLowerCase();
      const matches: { id: string; name: string; icon: React.ReactNode; tag?: string; onClick: () => void }[] = [];

      // Universal search across every taxonomy level, regardless of the
      // current drill-down location.
      SECTORS.forEach(s => {
        if (!s.name.toLowerCase().includes(q)) return;
        matches.push({
          id: s.id,
          name: s.name,
          icon: SECTOR_ICON_MAP[s.id] || <Building2 className="w-8 h-8 mb-2 mx-auto" />,
          tag: 'Sector',
          onClick: () => {
            setGoogleCatDrillGroup(null);
            setGoogleCatDrillSector(s.id);
          },
        });
      });

      CATEGORIES.forEach(c => {
        if (!c.name.toLowerCase().includes(q)) return;
        const sector = SECTORS.find(s => s.id === c.sectorId);
        matches.push({
          id: c.id,
          name: c.name,
          icon: SECTOR_ICON_MAP[c.sectorId] || <Building2 className="w-8 h-8 mb-2 mx-auto" />,
          tag: sector ? `Sector • ${sector.name}` : 'Category',
          onClick: () => setGoogleCatDrillGroup(c.id),
        });
      });

      SUBCATEGORIES.forEach(sc => {
        if (!sc.name.toLowerCase().includes(q)) return;
        const cat = CATEGORIES.find(c => c.id === sc.categoryId);
        const sector = cat ? SECTORS.find(s => s.id === cat.sectorId) : null;
        matches.push({
          id: sc.id,
          name: sc.name,
          icon: <Building2 className="w-8 h-8 mb-2 mx-auto" />,
          tag: [sector?.name, cat?.name].filter(Boolean).join(' > ') || 'Subcategory',
          onClick: () => {
            setSearchName(sc.name);
            setShowGoogleCategoryPage(false);
            setGoogleCatDrillSector(null);
            setGoogleCatDrillGroup(null);
            setShowFindClaimPage(true);
          },
        });
      });

      return matches;
    })();

    return (
      <div className="fixed top-0 inset-x-0 bottom-0 bg-gray-50 flex flex-col font-sans z-40 overflow-y-auto">
        {/* Top Bar */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 w-full py-4 px-4 sm:px-6 md:px-8 shadow-md z-10 sticky top-0">
          <div className="w-full mx-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-[2] w-full relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <MapPin className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                value={searchLoc}
                onChange={(e) => setSearchLoc(e.target.value)}
                className="block w-full pl-11 pr-10 py-3 bg-white border-none rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-black font-medium shadow-sm"
                placeholder="Search location..."
              />
              <button 
                onClick={() => setSearchLoc('')} 
                className="absolute inset-y-0 right-0 pr-4 flex items-center"
              >
                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            
            {/* Distance Radar / Slider */}
            <div className="flex-[1.5] w-full flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl shadow-sm">
              <Map className="w-5 h-5 text-gray-500" />
              <div className="flex flex-col flex-1 w-full">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Distance</span>
                  <span className="text-xs font-bold text-gray-900">{searchRadius} km</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="50" 
                  value={searchRadius}
                  onChange={(e) => setSearchRadius(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500" 
                />
              </div>
            </div>

            {/* Back to Prompt Button */}
            <button 
              onClick={() => {
                setShowGoogleCategoryPage(false);
                setGoogleCatDrillSector(null);
                setGoogleCatDrillGroup(null);
                setShowInitialPrompt(true);
              }}
              className="hidden sm:block p-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-grow max-w-6xl w-full mx-auto p-4 sm:p-6 md:p-8">
          
          <div className="mb-8 mt-4">
            <div className="flex items-center gap-3 mb-2">
              {showBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-3xl font-black text-gray-900">{pageTitle}</h1>
            </div>
            {!activeSector && (
              <p className="text-sm text-gray-500 mb-4">Select your industry to find your business</p>
            )}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && categorySearchQuery.trim()) {
                    setSearchName(categorySearchQuery);
                    setShowGoogleCategoryPage(false);
                    setGoogleCatDrillSector(null);
                    setGoogleCatDrillGroup(null);
                    setShowFindClaimPage(true);
                  }
                }}
                className="block w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-black shadow-sm text-lg"
                placeholder="Find a category..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredCategories.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col items-center justify-center text-center shadow-sm hover:shadow-md hover:border-gray-300 active:scale-95 transition-all group"
              >
                <div className="text-gray-700 group-hover:text-black transition-colors">
                  {item.icon}
                </div>
                <span className="font-bold text-gray-800 text-sm mt-1">{item.name}</span>
                {item.tag && (
                  <span className="text-[10px] font-medium text-gray-400 mt-0.5 uppercase tracking-wide line-clamp-2">{item.tag}</span>
                )}
              </button>
            ))}

            {filteredCategories.length === 0 && (
              <div className="col-span-full text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200 p-8 shadow-sm">
                <p className="text-gray-500 font-semibold mb-4 text-base">Can't find your category in our quick-list?</p>
                <button
                  onClick={() => {
                    setSearchName(categorySearchQuery);
                    setShowGoogleCategoryPage(false);
                    setGoogleCatDrillSector(null);
                    setGoogleCatDrillGroup(null);
                    setShowFindClaimPage(true);
                  }}
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
                >
                  Search Google Maps for "{categorySearchQuery}"
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Find & Claim Your Business Page
  // ═══════════════════════════════════════════════════════
  if (showFindClaimPage) {
    return (
      <div className="fixed top-0 inset-x-0 bottom-0 bg-white flex flex-col font-sans z-40">
        <main className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
          {/* Sidebar Search and Results */}
          <div className={`relative flex flex-col z-30 h-full transition-all duration-300 ease-in-out flex-shrink-0 ${isSidebarCollapsed ? 'w-0' : 'w-full md:w-[400px] lg:w-[480px]'} ${mapViewToggle === 'map' ? 'hidden md:flex' : 'flex'}`}>
            <aside className={`w-full h-full bg-white border-r border-gray-200 flex flex-col shadow-sm overflow-hidden transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
              <div className="w-full md:w-[400px] lg:w-[480px] h-full flex flex-col flex-shrink-0">
                {/* Search Header */}
                <div className="p-4 pt-3 md:pt-3 border-b border-gray-100 flex-shrink-0 transition-all duration-300 relative z-20">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-2">
                      <button onClick={() => { setShowFindClaimPage(false); setShowInitialPrompt(true); }} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors shrink-0">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <div className="pr-2">
                        <h2 className="text-xl font-bold text-gray-900 leading-tight">Find & Claim Your Business</h2>
                        <p className="text-sm text-gray-500 mt-1 font-medium leading-snug">Search the directory to link your official business profile.</p>
                      </div>
                    </div>
                    {/* Mobile Collapse Arrow */}
                    <button 
                      onClick={() => setIsSearchHeaderCollapsed(!isSearchHeaderCollapsed)} 
                      className="md:hidden p-2 -mr-2 bg-gray-50 border border-gray-100 rounded-full hover:bg-gray-100 text-gray-400 transition-colors shrink-0 shadow-sm"
                      aria-label="Toggle search fields"
                    >
                      {isSearchHeaderCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                    </button>
                  </div>
              
                  {/* Collapsible Content */}
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSearchHeaderCollapsed ? 'max-h-0 opacity-0 mb-0' : 'max-h-[400px] opacity-100 mb-2 mt-4 space-y-4'}`}>
                    {/* Multi-input Search Box */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          value={searchName}
                          onChange={(e) => setSearchName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium" 
                          placeholder="Business name or category" 
                          type="text" 
                        />
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                          value={searchLoc}
                          onChange={(e) => setSearchLoc(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm font-medium" 
                          placeholder="Borough, postcode, or city" 
                          type="text" 
                        />
                      </div>
                      <button 
                        onClick={handleSearch}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all active:scale-[0.98]"
                      >
                        {isSearching ? 'Searching...' : 'Search Google Maps'}
                      </button>
                    </div>

                    {/* Radius Slider */}
                    <div className="pt-2 pb-2">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Search Radius</label>
                        <span className="text-xs font-bold text-orange-600">{searchRadius} km</span>
                      </div>
                      <input 
                        value={searchRadius}
                        onChange={(e) => setSearchRadius(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500" 
                        max="50" 
                        min="1" 
                        type="range" 
                      />
                    </div>
                  </div>
                </div>

            {/* View Toggle & Sort (Mobile Friendly) */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-xs font-bold text-gray-500">
                {isSearching ? 'Searching...' : `${hasSearched ? searchResults.length : 0} results found nearby`}
              </span>
              <div className="flex p-1 bg-gray-200 rounded-lg">
                <button onClick={() => setMapViewToggle('list')} className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${mapViewToggle === 'list' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                   List
                </button>
                <button onClick={() => setMapViewToggle('map')} className={`flex md:hidden items-center gap-1 px-3 py-1 rounded-md text-xs font-bold transition-all ${mapViewToggle === 'map' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500'}`}>
                   Map
                </button>
              </div>
            </div>

            {/* Results Scroll Area */}
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {searchResults.length > 0 ? (
                searchResults.map((result: any) => {
                  const placeId = result.place_id || result.placeId || result.googlePlaceId;
                  const postcode = extractPostcode(result.formatted_address || result.formattedAddress || result.vicinity || '');
                  const photoRef = result.photos?.[0]?.photo_reference || result.photos?.[0]?.photoReference;
                  const typeLabel = result.types?.[0] 
                    ? result.types[0].replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) 
                    : 'Business';

                  return (
                    <div key={placeId} onClick={() => {
                        if (result.lat && result.lng) setMapCenter({ lat: result.lat, lng: result.lng });
                        setSelectedPreviewBusiness({
                          googlePlaceId: placeId,
                          businessName: result.name,
                          address: result.formatted_address || '',
                          type: typeLabel,
                        });
                      }} className="group bg-white border border-gray-200 rounded-2xl p-3 flex gap-4 hover:border-orange-400 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer">
                      <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {result.heroImg ? (
                          <img className="w-full h-full object-cover" src={result.heroImg} alt={result.name} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                            <Store className="w-8 h-8" />
                          </div>
                        )}
                      </div>
                      <div className="flex-grow flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{result.name}</h3>
                            <span className="bg-blue-50 text-blue-600 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-200">Unclaimed</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500 mt-1 text-xs">
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                            <span className="font-bold">{result.rating || '0.0'}</span>
                            <span className="text-gray-400">• {typeLabel}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 font-medium">{result.formatted_address || result.vicinity}</p>
                        </div>
                        <button onClick={() => {
                            const placeId = result.place_id || result.placeId;
                            
                            setSelectedPreviewBusiness({
                              googlePlaceId: placeId,
                              businessName: result.name,
                              address: result.formatted_address || '',
                              postcode: postcode || extractPostcode(result.formatted_address || ''),
                              googleCategoryId: result.types?.[0] ? `gcid:${result.types[0]}` : 'gcid:unknown_or_generic_category',
                              businessPhone: result.formatted_phone_number || result.international_phone_number || '',
                              rating: String(result.rating || '4.0'),
                              reviews: String(result.user_ratings_total || '0'),
                              type: typeLabel,
                              website: result.website || '',
                              hours: result.hours || (result.isOpenNow ? 'Open now' : 'Closed'),
                              heroImg: result.heroImg || '',
                              thumbImg: result.thumbImg || '',
                              allPhotos: result.allPhotos || [],
                              lat: result.lat,
                              lng: result.lng,
                            });
                            
                            const mapGoogleCategory = async () => {
                              try {
                                const mapRes = await api.get(`google-business/map-category?googleCategoryId=${encodeURIComponent(result.types?.[0] ? `gcid:${result.types[0]}` : '')}`);
                                if (mapRes.data) {
                                  setFormData((prev: any) => ({
                                    ...prev,
                                    sectorId: mapRes.data.sectorId || '',
                                    categoryId: mapRes.data.categoryId || '',
                                    subCategoryId: mapRes.data.subCategoryId || '',
                                    businessName: result.name,
                                    address: result.formatted_address || '',
                                    postcode: postcode || extractPostcode(result.formatted_address || ''),
                                    businessPhone: result.formatted_phone_number || '',
                                  }));
                                }
                              } catch (mapErr) {
                                console.error('Failed to map category:', mapErr);
                              }
                            };
                            mapGoogleCategory();

                            setShowFindClaimPage(false);
                            setShowBusinessPreviewPage(true);
                        }} className="mt-2 text-orange-600 text-xs font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform self-start">
                          Claim this business <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : searchError ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 text-xs font-semibold space-y-2">
                  <AlertCircle className="w-6 h-6 mx-auto text-red-500" />
                  <p>{searchError}</p>
                  <button
                    onClick={handleSearch}
                    className="mt-2 px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                  >
                    Retry Search
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center text-gray-500 text-xs font-semibold">
                  {hasSearched
                    ? 'No businesses found. Try adjusting your search or expanding the radius.'
                    : 'Search for your business above to begin claiming it.'}
                </div>
              )}

              {/* Not seeing your business? */}
              <div className="mt-8 p-6 bg-orange-50/50 rounded-2xl border border-dashed border-orange-200 text-center">
                <h4 className="font-bold text-gray-900">Can't find your business?</h4>
                <p className="text-xs text-gray-500 mt-2 mb-4 font-medium leading-relaxed">If you're new or just moved in, you can create a fresh business listing on our platform.</p>
                <button onClick={() => {
                  setShowFindClaimPage(false);
                  setCurrentStep(0); // Manual flow
                }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-[0.98]">
                    Add a New Business
                </button>
              </div>
            </div>
            </div>
            </aside>
            
            {/* Collapse/Expand Toggle Button */}
            <button 
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex absolute top-[180px] right-0 translate-x-full w-8 h-16 bg-white border border-l-0 border-gray-200 rounded-r-xl shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] items-center justify-center text-gray-400 hover:text-orange-600 z-[60] transition-colors cursor-pointer outline-none focus:outline-none"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>

          {/* Map Section (Desktop Right) */}
          <section className={`flex-grow relative bg-gray-100 ${mapViewToggle === 'map' ? 'block absolute inset-0 z-20' : 'hidden md:block'}`}>
            <div className="absolute inset-0">
              <GoogleMapSection
                businesses={searchResults}
                selectedBusiness={selectedPreviewBusiness}
                onSelectBusiness={(business) => {
                  setSelectedPreviewBusiness({
                    googlePlaceId: business.place_id || business.placeId,
                    businessName: business.name,
                    address: business.formatted_address || business.vicinity || '',
                    type: business.types?.[0]?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Business',
                  });
                  const pos = business.lat && business.lng ? { lat: business.lat, lng: business.lng } : business.geometry?.location ? { lat: business.geometry.location.lat, lng: business.geometry.location.lng } : null;
                  if (pos) setMapCenter(pos);
                }}
                userLocation={geo.latitude && geo.longitude ? { lat: geo.latitude, lng: geo.longitude } : null}
                mapCenter={mapCenter}
              />
            </div>

            {/* Geolocation status banner */}
            {geo.loading && (
              <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-72 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-gray-200 shadow-lg z-30 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-gray-600">Detecting your location...</span>
              </div>
            )}
            {geo.permissionDenied && (
              <div className="absolute top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-amber-50/90 backdrop-blur-md p-3 rounded-xl border border-amber-200 shadow-lg z-30 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-amber-800">Location access denied. Enter your location manually or use the search fields.</span>
              </div>
            )}
            
            {/* Overlay Card (Contextual) */}
            <div className="absolute top-16 left-6 w-72 bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-gray-200 shadow-xl hidden lg:block z-30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Live Search Area</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                {isSearching ? (
                  <span>Searching for matching business profiles...</span>
                ) : searchResults.length > 0 ? (
                  <span>
                    We've found <strong className="text-gray-900">{searchResults.length} matches</strong> within {searchRadius} km of your current selection. Drag the map or adjust the slider to expand.
                  </span>
                ) : (
                  <span>
                    {geo.latitude && geo.longitude
                      ? 'Showing your current location. Search above to find businesses.'
                      : 'No search results found. Try adjusting the search radius slider or your query parameters above.'}
                  </span>
                )}
              </p>
            </div>
          </section>
        </main>
        
        {/* Mobile footer navigation */}
        {mapViewToggle === 'map' && (
           <footer className="fixed bottom-0 left-0 w-full z-50 flex justify-between items-center px-4 py-3 bg-white border-t border-gray-200 md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
             <button onClick={() => setMapViewToggle('list')} className="text-gray-600 font-bold text-sm px-4 py-2 hover:bg-gray-50 rounded-xl">Back to List</button>
           </footer>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Business Profile Preview Page
  // ═══════════════════════════════════════════════════════
  if (showBusinessPreviewPage && selectedPreviewBusiness) {
    return (
      <div className="bg-gray-50 min-h-screen flex flex-col font-sans overflow-x-hidden pt-6 pb-12">
        {/* Hero Section */}
        <div className="relative w-full h-64 overflow-hidden">
          {/* Floating Back Button */}
          <button 
            onClick={() => { setShowBusinessPreviewPage(false); setShowFindClaimPage(true); }}
            className="absolute top-4 left-4 z-30 w-10 h-10 bg-white/80 hover:bg-white text-orange-600 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm active:scale-95 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          {selectedPreviewBusiness.heroImg ? (
            <img
              alt="Business cover"
              className="w-full h-full object-cover"
              src={selectedPreviewBusiness.heroImg}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fb = e.currentTarget.nextElementSibling as HTMLElement;
                if (fb) fb.classList.remove('hidden');
              }}
              loading="lazy"
            />
          ) : null}
          <div className={`${selectedPreviewBusiness.heroImg ? 'hidden' : ''} absolute inset-0 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 flex flex-col items-center justify-center gap-3`}>
            <Building2 className="w-16 h-16 text-white/70" />
            <span className="text-white/80 text-sm font-bold tracking-wide">{selectedPreviewBusiness.businessName || 'Business'}</span>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          
          {/* Storefront Thumbnail Overlay */}
          <div className="absolute -bottom-6 left-6">
            <div className="w-24 h-24 rounded-xl border-4 border-white overflow-hidden shadow-lg bg-white">
              {selectedPreviewBusiness.thumbImg ? (
                <img
                  alt="Storefront"
                  className="w-full h-full object-cover"
                  src={selectedPreviewBusiness.thumbImg}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fb = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fb) fb.classList.remove('hidden');
                  }}
                  loading="lazy"
                />
              ) : null}
              <div className={`${selectedPreviewBusiness.thumbImg ? 'hidden' : ''} w-full h-full flex items-center justify-center bg-orange-100 text-orange-400`}>
                <Store className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {selectedPreviewBusiness.allPhotos && selectedPreviewBusiness.allPhotos.length > 1 && (
          <div className="px-6 mt-4 max-w-3xl mx-auto w-full">
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
              {selectedPreviewBusiness.allPhotos.map((photo: string, idx: number) => (
                <div key={idx} className="flex-shrink-0 w-32 h-24 rounded-xl overflow-hidden snap-start border border-gray-200">
                  <img
                    src={photo}
                    alt={`${selectedPreviewBusiness.businessName} photo ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 px-6 flex flex-col gap-6 max-w-3xl mx-auto w-full">
          {/* Business Identity */}
          <section className="flex flex-col gap-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">{selectedPreviewBusiness.businessName}</h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center text-orange-600">
                <Star className="w-4 h-4 fill-current" />
                <span className="font-bold text-sm ml-1">{selectedPreviewBusiness.rating}</span>
              </div>
              <span className="text-gray-500 font-medium text-sm">({selectedPreviewBusiness.reviews} reviews) • {selectedPreviewBusiness.type}</span>
            </div>
          </section>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 active:scale-95 transition-all text-orange-600">
              <Map className="w-6 h-6 mb-1" />
              <span className="font-bold text-[10px] tracking-wider">DIRECTIONS</span>
            </button>
            <button className="flex flex-col items-center justify-center p-4 bg-orange-50 rounded-xl border border-orange-100 hover:bg-orange-100 active:scale-95 transition-all text-orange-600">
              <Phone className="w-6 h-6 mb-1" />
              <span className="font-bold text-[10px] tracking-wider">CALL</span>
            </button>
          </div>

          {/* Detailed Info List */}
          <section className="flex flex-col gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-start gap-4">
              <MapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm">Address</span>
                <p className="text-gray-500 text-sm font-medium">{selectedPreviewBusiness.address}</p>
              </div>
            </div>
            <div className="w-full h-px bg-gray-100"></div>
            
            <div className="flex items-start gap-4">
              <Clock className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">Opening Hours</span>
                  {selectedPreviewBusiness.isOpenNow !== undefined && (
                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${selectedPreviewBusiness.isOpenNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {selectedPreviewBusiness.isOpenNow ? 'Open' : 'Closed'}
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-sm font-medium">{selectedPreviewBusiness.hours || 'Hours not available'}</p>
              </div>
            </div>
            <div className="w-full h-px bg-gray-100"></div>

            <div className="flex items-start gap-4">
              <Globe className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm">Website</span>
                <a className="text-orange-600 text-sm font-bold underline" href="#">{selectedPreviewBusiness.website}</a>
              </div>
            </div>
          </section>

          {/* Verification Banner */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-5 rounded-2xl flex gap-4 items-center shadow-lg shadow-orange-500/20">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base">Verify Ownership</span>
              <p className="text-sm font-medium opacity-90 mt-0.5">Confirming this is your business unlocks premium merchant tools.</p>
            </div>
          </div>
        </div>

        {/* Bottom CTA Shell */}
        <footer className="w-full mt-10 px-6">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">
            <div className="text-center">
              <span className="font-bold text-[10px] text-gray-400 tracking-[0.2em] uppercase">Is this your business?</span>
            </div>
            <button onClick={() => {
                setShowBusinessPreviewPage(false);
                setShowVerifyOwnershipPage(true);
            }} className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold text-sm shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
              <span>CLAIM NOW</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => {
                setShowBusinessPreviewPage(false);
                setShowFindClaimPage(true);
            }} className="w-full text-gray-500 hover:text-gray-900 font-bold text-xs py-2 active:opacity-60 transition-colors">
              NOT MY BUSINESS, SEARCH AGAIN
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Verify Ownership Page
  // ═══════════════════════════════════════════════════════
  if (showVerifyOwnershipPage && selectedPreviewBusiness) {
    return (
      <div className="bg-white min-h-screen flex flex-col font-sans overflow-x-hidden pb-40 pt-6 md:pt-16">
        <main className="flex-grow flex flex-col px-6 pt-4 md:pt-8 max-w-xl mx-auto w-full">
          {/* Back button */}
          <div className="flex justify-start mb-6">
            <button 
              onClick={() => { setShowVerifyOwnershipPage(false); setShowBusinessPreviewPage(true); }}
              className="flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>
          </div>
          {/* Headline Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Verify Ownership</h1>
            <p className="text-gray-500 font-medium">Choose how you'd like to verify you are the owner of this business.</p>
          </div>

          {/* Verification Options List */}
          <div className="space-y-4">
            {/* Option 1: Google (Recommended) */}
            <label className={`relative flex items-center p-4 bg-white border ${verifyMethod === 'google' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'} rounded-2xl cursor-pointer hover:border-orange-300 transition-all active:scale-[0.98]`}>
              <input checked={verifyMethod === 'google'} onChange={() => setVerifyMethod('google')} className="hidden" name="verify_method" type="radio" value="google" />
              <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mr-4">
                <ShieldCheck className="text-orange-600 w-7 h-7" />
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-sm">Google Verification</span>
                  <span className="bg-orange-100 text-orange-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter border border-orange-200">Recommended</span>
                </div>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Instant verification via linked account</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${verifyMethod === 'google' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                {verifyMethod === 'google' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
            </label>

            {/* Option 2: Email */}
            <label className={`relative flex items-center p-4 bg-white border ${verifyMethod === 'email' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'} rounded-2xl cursor-pointer hover:border-orange-300 transition-all active:scale-[0.98]`}>
              <input checked={verifyMethod === 'email'} onChange={() => setVerifyMethod('email')} className="hidden" name="verify_method" type="radio" value="email" />
              <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mr-4">
                <Mail className="text-orange-600 w-7 h-7" />
              </div>
              <div className="flex-grow">
                <span className="font-bold text-gray-900 text-sm">Email Verification</span>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {selectedPreviewBusiness.website
                    ? `to owner@${(() => {
                        try {
                          const url = selectedPreviewBusiness.website.startsWith('http') ? selectedPreviewBusiness.website : `https://${selectedPreviewBusiness.website}`;
                          return new URL(url).hostname.replace('www.', '');
                        } catch {
                          return 'business.com';
                        }
                      })()}`
                    : 'Send a verification code to your registered email'}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${verifyMethod === 'email' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                {verifyMethod === 'email' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
            </label>

            {/* Option 3: SMS */}
            {selectedPreviewBusiness.businessPhone && (
            <label className={`relative flex items-center p-4 bg-white border ${verifyMethod === 'sms' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200'} rounded-2xl cursor-pointer hover:border-orange-300 transition-all active:scale-[0.98]`}>
              <input checked={verifyMethod === 'sms'} onChange={() => setVerifyMethod('sms')} className="hidden" name="verify_method" type="radio" value="sms" />
              <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mr-4">
                <MessageSquare className="text-orange-600 w-7 h-7" />
              </div>
              <div className="flex-grow">
                <span className="font-bold text-gray-900 text-sm">SMS Verification</span>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  to •••• ••• {selectedPreviewBusiness.businessPhone.slice(-2)}
                </p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-2 ${verifyMethod === 'sms' ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                {verifyMethod === 'sms' && <div className="w-2 h-2 bg-white rounded-full"></div>}
              </div>
            </label>
            )}
          </div>

          {/* Illustration / Decor */}
          <div className="mt-12 flex justify-center pb-8">
            <div className="relative w-full max-w-[280px] aspect-square rounded-full bg-orange-50/50 border border-orange-100 flex items-center justify-center overflow-hidden">
              {/* Security Illustration */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20 animate-pulse">
                  <ShieldCheck className="w-10 h-10 text-white" />
                </div>
                <div className="w-12 h-1.5 rounded-full bg-orange-200/50 blur-[2px] mt-2"></div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-orange-100/50 to-transparent"></div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border border-gray-100">
                <ShieldCheck className="text-green-500 w-4 h-4" />
                <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Secure Verification</span>
              </div>
            </div>
          </div>
        </main>

        {/* Footer Action */}
        <footer className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-100 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-xl mx-auto w-full">
            <button onClick={() => {
              if (verifyMethod === 'google') {
                setShowVerifyOwnershipPage(false);
                setShowConnectGooglePage(true);
              } else {
                // Mock logic for SMS/Email
                alert('Verification code sent via ' + verifyMethod.toUpperCase());
                setShowVerifyOwnershipPage(false);
                setShowConnectGooglePage(true);
              }
            }} className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold shadow-lg shadow-orange-500/25 active:scale-95 transition-transform flex items-center justify-center gap-2 hover:from-orange-600 hover:to-red-600">
              Continue
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <p className="text-center text-xs font-medium text-gray-500 mt-4">
              Having trouble? <a className="text-orange-600 font-bold hover:underline" href="#">Contact Support</a>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Connect Google Business Page
  // ═══════════════════════════════════════════════════════
  if (showConnectGooglePage && selectedPreviewBusiness) {
    return (
      <div className="bg-white min-h-screen flex flex-col font-sans overflow-x-hidden pt-16">
        <main className="flex-1 flex flex-col px-6 pt-8 pb-10 max-w-xl mx-auto w-full">
          {/* Back button */}
          <div className="flex justify-start mb-6">
            <button 
              onClick={() => { setShowConnectGooglePage(false); setShowVerifyOwnershipPage(true); }}
              className="flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-5 h-5" /> Back
            </button>
          </div>
          {/* Header Text */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black text-gray-900 mb-2">Connect your Google Business</h1>
            <p className="text-gray-500 font-medium">Import your business information automatically to speed up your setup process.</p>
          </div>

          {/* Central Visualization */}
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-orange-500 opacity-5 blur-3xl rounded-full transform group-hover:scale-110 transition-transform duration-1000"></div>
              
              <div className="relative w-32 h-32 md:w-40 md:h-40 bg-white rounded-3xl shadow-sm border border-gray-100 flex items-center justify-center transform hover:rotate-3 transition-transform duration-300">
                <div className="grid grid-cols-2 gap-2 p-6">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-[#4285F4] rounded-sm"></div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-[#EA4335] rounded-sm"></div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-[#FBBC05] rounded-sm"></div>
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-[#34A853] rounded-sm"></div>
                </div>
              </div>
              
              <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center shadow-md animate-bounce border border-orange-200">
                <RefreshCw className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </div>

          {/* Action Section */}
          <div className="mt-auto space-y-4">
            {/* Error message */}
            {submitError && (
              <div className="flex flex-col gap-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-red-600 leading-relaxed">{submitError}</p>
                </div>
                {!selectedPreviewBusiness?.googlePlaceId && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitError(null);
                        setShowConnectGooglePage(false);
                        setShowFindClaimPage(true);
                      }}
                      className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Go to Search
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSubmitError(null);
                        setShowConnectGooglePage(false);
                        setShowBusinessTypePage(true);
                      }}
                      className="text-xs bg-white border border-red-200 text-red-700 hover:bg-red-50 font-bold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Set Up Manually
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGoogleStart}
              disabled={isSubmitting}
              className="w-full bg-white border border-gray-200 text-gray-900 h-14 rounded-xl flex items-center justify-center gap-3 px-6 shadow-sm active:scale-[0.98] transition-all hover:bg-gray-50 group disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
                  <span className="font-bold text-sm tracking-tight text-gray-600">Connecting to Google…</span>
                </>
              ) : (
                <>
                  <svg height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.6001 10.2272C19.6001 9.51813 19.5364 8.83631 19.4183 8.18176H10.0001V12.0499H15.3819C15.1501 13.2999 14.4455 14.359 13.3864 15.0681V17.5772H16.6183C18.5092 15.8363 19.6001 13.2727 19.6001 10.2272Z" fill="#4285F4" />
                    <path d="M10.0001 20C12.7001 20 14.9637 19.1045 16.6183 17.5773L13.3864 15.0682C12.491 15.6682 11.3455 16.0227 10.0001 16.0227C7.38642 16.0227 5.17279 14.2545 4.38188 11.8727H1.04553V14.4591C2.69553 17.7364 6.08188 20 10.0001 20Z" fill="#34A853" />
                    <path d="M4.38188 11.8727C4.18188 11.2727 4.06824 10.6409 4.06824 9.99995C4.06824 9.35905 4.18188 8.72723 4.38188 8.12723V5.54087H1.04553C0.377353 6.88178 0 8.39541 0 9.99995C0 11.6045 0.377353 13.1181 1.04553 14.459L4.38188 11.8727Z" fill="#FBBC05" />
                    <path d="M10.0001 3.97727C11.4683 3.97727 12.7864 4.48182 13.8228 5.47273L16.691 2.60455C14.9592 0.990909 12.6955 0 10.0001 0C6.08188 0 2.69553 2.26364 1.04553 5.54091L4.38188 8.12727C5.17279 5.74545 7.38642 3.97727 10.0001 3.97727Z" fill="#EA4335" />
                  </svg>
                  <span className="font-bold text-sm tracking-tight text-gray-700 group-hover:text-gray-900 transition-colors">SIGN IN WITH GOOGLE</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setSubmitError(null);
                setShowConnectGooglePage(false);
                setCurrentStep(0);
              }}
              className="w-full h-12 flex items-center justify-center text-gray-500 hover:text-orange-600 transition-colors active:scale-95 duration-100"
            >
              <span className="font-bold text-[10px] tracking-widest uppercase">I'LL ENTER DETAILS MANUALLY</span>
            </button>
          </div>

          {/* Informational Footer */}
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-start gap-3">
            <ShieldCheck className="text-orange-600 w-5 h-5 shrink-0" />
            <p className="text-xs font-medium text-gray-500 leading-relaxed">
              We only import your verified business location, hours, and contact info. We never post to your profile without permission.
            </p>
          </div>
        </main>

        {/* Contextual "Save and Exit" */}
        <footer className="p-4 flex justify-center pb-8">
          <button className="text-gray-400 font-bold text-xs hover:text-gray-900 hover:underline decoration-orange-500 underline-offset-4 transition-all">
            Save and Exit
          </button>
        </footer>
      </div>
    );
  }







  // ═══════════════════════════════════════════════════════
  // Local Network Page (Step 9)
  // ═══════════════════════════════════════════════════════
  if (showLocalNetworkPage) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans pb-32">
        {/* Top AppBar */}
        <header className="bg-white flex justify-between items-center w-full px-4 h-14 z-50 fixed top-0 left-0 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowLocalNetworkPage(false); setShowBoroughBrowser(true); }} className="hover:bg-gray-100 p-2 rounded-full transition-colors active:scale-95">
              <ChevronLeft className="w-6 h-6 text-orange-600" />
            </button>
            <h1 className="text-xl font-black text-orange-600 tracking-tight">MCOMMALL</h1>
          </div>
          <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest pr-2">
             Step 9 of 12
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-grow pt-18 md:pt-24 pb-12 px-6 flex justify-center w-full">
          <div className="w-full max-w-[640px] flex flex-col gap-8">
            {/* Title Section */}
            <section className="text-center md:text-left">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Local Network</h2>
              <p className="text-sm font-medium text-gray-500">We've identified your business district to help you connect with the right shoppers.</p>
            </section>

            {/* Map & Location Card (Bento-style layout) */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl overflow-hidden shadow-sm border border-gray-200">
              {/* Visual Map Area */}
              <div className="h-48 w-full relative bg-[#f4f3f0] overflow-hidden">
                <svg className="absolute inset-0 w-full h-full opacity-35" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="bento-map" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1cfc7" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#bento-map)" />
                  <path d="M-50,80 L600,80" fill="none" stroke="#e3e1d9" strokeWidth="16" />
                  <path d="M200,-50 L200,300" fill="none" stroke="#e3e1d9" strokeWidth="20" />
                  <circle cx="200" cy="80" r="40" fill="#cbdcf7" fillOpacity="0.4" />
                </svg>
                <div className="absolute inset-0 bg-gradient-to-t from-white/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 bg-white px-3 py-1.5 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-orange-600 rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-bold text-orange-600 tracking-wider">LIVE LOCATION DETECTED</span>
                </div>
              </div>
              {/* Location Details */}
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-50 rounded-xl text-orange-600 shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current Designation</p>
                    <h3 className="text-lg font-bold text-orange-600">Birmingham High Street Mall</h3>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 mb-1">Borough</p>
                    <p className="font-bold text-gray-900 text-sm">Birmingham B2</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 mb-1">High Street</p>
                    <p className="font-bold text-gray-900 text-sm">Birmingham High St</p>
                  </div>
                </div>
                
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center gap-3">
                  <CheckCircle2 className="text-orange-600 w-5 h-5 shrink-0" />
                  <p className="text-sm text-orange-800 font-bold">You are joining: Birmingham High Street Mall</p>
                </div>
              </div>
            </div>

            {/* Nearby Community Section */}
            <section className="flex flex-col gap-4">
              <div className="flex justify-between items-end">
                <h4 className="text-lg font-bold text-gray-900">Nearby participating businesses</h4>
                <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-1 rounded-md">42 active</span>
              </div>
              <div className="flex flex-col gap-3">
                {/* Merchant Avatars */}
                <div className="flex -space-x-3 overflow-hidden p-1">
                  <div className="w-12 h-12 rounded-full border-2 border-white ring-2 ring-gray-100 overflow-hidden bg-gray-200 cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => {
                      setShowMembershipRoutingPage(false);
                      setShowLocalNetworkPage(true);
                    }}>
                    <div className="w-full h-full flex items-center justify-center bg-amber-100 text-amber-700 font-bold text-sm">JS</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-white ring-2 ring-gray-100 overflow-hidden bg-gray-200">
                    <div className="w-full h-full flex items-center justify-center bg-blue-100 text-blue-700 font-bold text-sm">MR</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-white ring-2 ring-gray-100 overflow-hidden bg-gray-200">
                    <div className="w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-700 font-bold text-sm">LH</div>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-white ring-2 ring-gray-100 overflow-hidden bg-gray-200">
                    <div className="w-full h-full flex items-center justify-center bg-purple-100 text-purple-700 font-bold text-sm">AK</div>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 border-2 border-white ring-2 ring-gray-100 text-xs font-black">
                    +38
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-500 italic">Join 40+ other local merchants already on the MCOMMALL network.</p>
              </div>
            </section>
          </div>
        </main>

        {/* Fixed Navigation Footer */}
        <footer className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 px-4 py-4 z-50">
          <div className="max-w-[640px] mx-auto flex flex-col gap-4">
            {/* Progress Bar */}
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-orange-600 h-full rounded-full transition-all duration-500 w-[75%]"></div>
            </div>
            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4">
              <button 
                onClick={() => { setShowLocalNetworkPage(false); setShowBoroughBrowser(true); }}
                className="px-6 py-3.5 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-colors active:scale-95 text-sm"
              >
                Back
              </button>
              <button 
                onClick={() => {
                  setShowLocalNetworkPage(false);
                  setShowMembershipRoutingPage(true);
                }}
                className="flex-grow px-6 py-3.5 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-md hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Membership Routing Page (Step 11)
  // ═══════════════════════════════════════════════════════
  if (showMembershipRoutingPage) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans pb-32">
        {/* Top AppBar */}
        <header className="bg-white flex justify-between items-center w-full px-4 h-14 z-50 fixed top-0 left-0 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowMembershipRoutingPage(false); setShowLocalNetworkPage(true); }} className="hover:bg-gray-100 p-2 rounded-full transition-colors active:scale-95">
              <ChevronLeft className="w-6 h-6 text-orange-600" />
            </button>
            <h1 className="text-xl font-black text-orange-600 tracking-tight">MCOMMALL</h1>
          </div>
          <button onClick={() => router.push('/dashboard')} className="hover:bg-gray-100 p-2 rounded-full transition-colors active:scale-95">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-grow pt-18 md:pt-24 pb-12 px-6 flex justify-center w-full">
          <div className="w-full max-w-[640px] flex flex-col gap-8">
            {/* Onboarding Progress Stepper */}
            <div className="w-full">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">Step 11 of 12</span>
                <span className="font-bold text-[10px] text-orange-600 uppercase tracking-widest">ALMOST THERE</span>
              </div>
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-600 transition-all duration-500 w-[91.6%]"></div>
              </div>
            </div>

            {/* Heading Section */}
            <section className="text-center md:text-left">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Choose Your Membership Path</h2>
              <p className="text-sm font-medium text-gray-500">Whether you're continuing a legacy or starting fresh, we have the right tools for your business growth.</p>
            </section>

            {/* Routing Cards */}
            <div className="space-y-4">
              {/* Path A: Already a Member */}
              <button 
                onClick={() => { setShowMembershipRoutingPage(false); setShowLinkAccountPage(true); }}
                className="w-full group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <Badge className="w-6 h-6" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Already a Member</h3>
                    <p className="text-sm text-gray-500 font-medium">Link your 247GBS or MCOM membership using your unique ID</p>
                  </div>
                  <div className="self-center">
                    <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-orange-600 transition-colors" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-orange-600 group-hover:w-full transition-all duration-300"></div>
              </button>

              {/* Path B: Select a Plan */}
              <button 
                onClick={() => { setShowMembershipRoutingPage(false); setShowMembershipSelectionPage(true); }}
                className="w-full group relative overflow-hidden bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                    <Rocket className="w-6 h-6" />
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Select a Plan</h3>
                    <p className="text-sm text-gray-500 font-medium">Choose a new growth tier for your business</p>
                  </div>
                  <div className="self-center">
                    <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-orange-600 transition-colors" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 h-1 w-0 bg-orange-600 group-hover:w-full transition-all duration-300"></div>
              </button>
            </div>

            {/* Decorative Image */}
            <div className="mt-4 rounded-2xl overflow-hidden relative h-48 bg-gradient-to-tr from-orange-600 to-amber-500 border border-gray-200">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-200/20 via-transparent to-transparent"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent flex flex-col justify-end p-6">
                <p className="text-sm font-medium text-gray-200 italic">"Success is a journey of continuous growth and collaboration."</p>
              </div>
            </div>

            {/* Secondary Action */}
            <div className="mt-8 flex flex-col items-center">
              <button className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-orange-600 transition-colors py-4">
                Save and Exit
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Link Your Account Page (Step 12)
  // ═══════════════════════════════════════════════════════
  if (showLinkAccountPage) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans pb-32">
        {/* Top Navigation Bar */}
        <header className="bg-white flex justify-between items-center w-full px-4 h-14 z-50 fixed top-0 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowLinkAccountPage(false); setShowMembershipRoutingPage(true); }} className="text-orange-600 hover:bg-gray-100 p-2 rounded-full active:scale-95 duration-100">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-black text-orange-600 tracking-tight">MCOMMALL</h1>
          </div>
          <button className="text-orange-600 hover:bg-gray-100 p-2 rounded-full active:scale-95 duration-100">
            <Bell className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 flex flex-col items-center justify-start px-6 pt-18 md:pt-24 pb-10 max-w-[640px] mx-auto w-full">
          {/* Onboarding Progress Section */}
          <div className="w-full mb-8">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Existing Membership</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">STEP 11 OF 12</span>
            </div>
            <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-orange-600 transition-all duration-500 w-[91.6%]"></div>
            </div>
          </div>

          {/* Visual Hero Element */}
          <div className="w-full aspect-[16/9] mb-8 rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative bg-gradient-to-tr from-slate-900 to-slate-800 p-6 flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-t from-orange-600/10 to-transparent z-10 pointer-events-none"></div>
            
            {/* Custom Premium Merchant UI Mockup */}
            <div className="flex justify-between items-start z-10 w-full">
              <div className="space-y-1">
                <div className="w-20 h-3 bg-white/10 rounded"></div>
                <div className="w-28 h-5 bg-white/20 rounded"></div>
              </div>
              <div className="w-6 h-6 rounded-full bg-white/15"></div>
            </div>
            
            <div className="flex gap-4 z-10 w-full">
              <div className="flex-grow h-20 bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
                <div className="w-10 h-2.5 bg-white/15 rounded"></div>
                <div className="w-16 h-4 bg-white/25 rounded"></div>
              </div>
              <div className="w-1/3 h-20 bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col justify-between">
                <div className="w-8 h-2.5 bg-white/15 rounded"></div>
                <div className="w-12 h-4 bg-white/25 rounded"></div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="w-full text-center mb-8">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Link Your Account</h2>
            <p className="text-sm font-medium text-gray-500">Synchronize your established credentials to unlock premium merchant features.</p>
          </div>

          {/* Verification Form */}
          <div className="w-full bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-200 space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-900 mb-2 ml-1" htmlFor="member_id">Member Unique ID / Code</label>
              <div className="relative group">
                <input 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder:text-gray-400" 
                  id="member_id" 
                  placeholder="e.g. MCOM-12345" 
                  type="text" 
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
                  <Fingerprint className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl border border-orange-100">
              <Info className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-orange-900 leading-relaxed">
                Enter your 247GBS or MCOM credentials to sync your existing benefits and data.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="w-full mt-8 space-y-4">
            <button 
              onClick={() => { setShowLinkAccountPage(false); setShowQuickSetupPage(true); }}
              className="w-full bg-gray-900 text-white h-14 rounded-xl font-bold text-sm hover:bg-black transition-colors shadow-md active:scale-95 duration-100"
            >
              Verify &amp; Continue
            </button>
            <button 
              onClick={() => { setShowLinkAccountPage(false); setShowMembershipRoutingPage(true); }}
              className="w-full bg-transparent text-gray-500 h-14 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors active:scale-95 duration-100"
            >
              Back
            </button>
          </div>

          {/* Secondary Info */}
          <div className="mt-8 text-center">
            <p className="text-xs font-medium text-gray-500">
              Need help finding your ID? <a className="text-orange-600 font-bold hover:underline" href="#">Contact Support</a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Membership Selection Page (Step 11 alternative)
  // ═══════════════════════════════════════════════════════
  if (showMembershipSelectionPage) {
    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans pb-32">
        {/* Top Navigation Bar */}
        <header className="bg-white flex justify-between items-center w-full px-4 h-14 z-50 fixed top-0 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowMembershipSelectionPage(false); setShowMembershipRoutingPage(true); }} className="text-orange-600 hover:bg-gray-100 p-2 rounded-full active:scale-95 duration-100">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-black text-orange-600 tracking-tight">MCOMMALL</h1>
          </div>
          <button className="text-orange-600 hover:bg-gray-100 p-2 rounded-full active:scale-95 duration-100">
            <Bell className="w-5 h-5" />
          </button>
        </header>

        {/* Onboarding Stepper */}
        <div className="fixed top-14 left-0 w-full h-1 bg-gray-200 z-40">
          <div className="h-full bg-orange-600 w-[91.6%] transition-all duration-700 ease-out"></div>
        </div>

        <main className="flex-1 flex flex-col items-center justify-start px-6 pt-18 md:pt-24 pb-10 max-w-[1024px] mx-auto w-full">
          {/* Header Section */}
          <section className="mb-8 w-full text-center">
            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-2">Step 11 of 12</p>
            <h2 className="text-3xl md:text-4xl font-black mb-3">Membership Selection</h2>
            <p className="text-sm text-gray-500 font-medium max-w-[600px] mx-auto">Choose a tier that matches your business velocity. Unlock premium features and community multipliers.</p>
          </section>

          {/* Membership Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {/* PAY-AS-YOU-GO Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 flex flex-col h-full border border-gray-200 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
              <div className="mb-4">
                <span className="text-[10px] font-bold px-3 py-1 bg-gray-100 rounded-full text-gray-600 uppercase tracking-widest">Seasonal</span>
                <h3 className="text-2xl font-black mt-3 mb-1">PAY-AS-YOU-GO</h3>
                <p className="text-xs text-gray-500 font-medium">Basic Access to MCOM Ecosystem – Limited to services in the purchased seasonal package.</p>
              </div>
              
              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900">Custom</span>
                <span className="text-xs text-gray-500 font-medium">/ season</span>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  'External Evergreen Reward Programme QR Code',
                  'Directory Listing on 247GBS & MCOM Lead Traffic Hub',
                  'MCOM Wallet Access for payment & rewards',
                  'Seasonal Campaign Participation',
                  'Spare Capacity & Stock Audit Tool',
                  'Basic Consumer Rewards via Evergreen Programme',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-gray-700 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => { setSelectedPlan('payg'); setShowMembershipSelectionPage(false); setShowQuickSetupPage(true); }}
                className="w-full py-4 bg-gray-100 text-gray-900 hover:bg-gray-200 rounded-xl font-bold text-sm transition-all active:scale-95"
              >
                Select PAYG
              </button>
            </div>

            {/* CO-BRANDED Card */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 flex flex-col h-full border border-orange-200 shadow-lg hover:-translate-y-1 hover:shadow-xl transition-all duration-300 relative overflow-hidden ring-1 ring-orange-500">
              <div className="absolute -right-12 top-6 bg-orange-600 text-white px-12 py-1 rotate-45 text-[10px] font-bold tracking-widest uppercase shadow-md">Premium</div>
              <div className="mb-4">
                <span className="text-[10px] font-bold px-3 py-1 bg-orange-100 rounded-full text-orange-600 uppercase tracking-widest">Enterprise</span>
                <h3 className="text-2xl font-black mt-3 mb-1 text-orange-600">CO-BRANDED</h3>
                <p className="text-xs text-gray-500 font-medium">Highest tier – comprehensive access and control for serious growth.</p>
              </div>

              {/* Internal Tabs */}
              <div className="bg-gray-100 p-1 rounded-lg flex mb-4">
                <button 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${cobrandedTab === 'standard' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setCobrandedTab('standard')}
                >
                  Standard
                </button>
                <button 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${cobrandedTab === 'pro' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setCobrandedTab('pro')}
                >
                  Pro
                </button>
                <button 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-md transition-all ${cobrandedTab === 'plus' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setCobrandedTab('plus')}
                >
                  Plus
                </button>
              </div>

              <div className="mb-6 flex items-baseline gap-1">
                <span className="text-3xl font-black text-gray-900">
                  {cobrandedTab === 'standard' ? 'Standard' : cobrandedTab === 'pro' ? 'Pro' : 'Plus'}
                </span>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                {[
                  'All PAYG Benefits with full access',
                  'Customisable Rewards & Loyalty Program',
                  'White-Label Branding for cards & materials',
                  'Multiple QR Codes for branches',
                  ...(cobrandedTab === 'pro' || cobrandedTab === 'plus' ? [
                    'Priority Marketing Campaigns',
                    'Advanced Stock Audit Integration',
                    'Hyper-Local Partnerships',
                  ] : []),
                  ...(cobrandedTab === 'plus' ? [
                    'All Features Activated – No restrictions',
                    'Complete Automation & preset campaigns',
                    'Unlimited Consumer Rewards',
                  ] : []),
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-gray-700 leading-relaxed font-bold">{text}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => { setSelectedPlan(cobrandedTab); setShowMembershipSelectionPage(false); setShowQuickSetupPage(true); }}
                className="w-full py-4 bg-orange-600 text-white hover:bg-orange-700 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                Select {cobrandedTab === 'standard' ? 'Standard' : cobrandedTab === 'pro' ? 'Pro' : 'Plus'}
              </button>
            </div>
          </div>
          
          <div className="mt-12 flex flex-col items-center gap-4">
            <button className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-orange-600 transition-colors">
              Save and Exit
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Review Storefront Page (Step 13)
  // ═══════════════════════════════════════════════════════
  if (showReviewStorefrontPage) {
    const handleConfirm = async () => {
      if (!termsAccepted) {
        setTermsError(true);
        setTimeout(() => setTermsError(false), 500);
        return;
      }
      
      setIsSubmitting(true);
      setSubmitError(null);
      
      try {
        const serializeOpeningHours = () => {
          if (formData.is247) return 'Open 24/7';
          if (formData.isStandardHours) return 'Mon-Fri 09:00 - 17:00';
          if (formData.isCustomHours) {
            const active = formData.customHours.filter(h => h.isOpen);
            if (active.length === 0) return 'Closed';
            return active.map(h => `${h.name}: ${h.openTime}-${h.closeTime}`).join(', ');
          }
          return 'Not specified';
        };
        const sectorName = sectors?.find((s: any) => s.id === formData.sectorId)?.name || '';
        const categoryName = categories?.find((c: any) => c.id === formData.categoryId)?.name || '';
        const subcategoryName = subcategories?.find((s: any) => s.id === formData.subCategoryId)?.name || '';

        const onboardingPayload = {
          email: googleEmail || formData.email,
          firstName: ownerFirstName || formData.firstName,
          lastName: ownerLastName || formData.lastName,
          businessType: formData.businessType || 'products',
          googlePlaceId: selectedPreviewBusiness?.googlePlaceId,
          businessName: selectedPreviewBusiness?.businessName || formData.businessName,
          businessPhone: selectedPreviewBusiness?.businessPhone || formData.businessPhone || formData.phoneNumber || '',
          address: selectedPreviewBusiness?.address || formData.address,
          postcode: selectedPreviewBusiness?.postcode || formData.postcode,
          sectorId: formData.sectorId,
          categoryId: formData.categoryId,
          subCategoryId: formData.subCategoryId,
          industry: sectorName,
          category: categoryName,
          subCategory: subcategoryName,
          logoUrl: '',
          password: formData.password,
          shortDescription: selectedPreviewBusiness?.shortDescription || formData.shortDescription,
          selectedPlan: selectedPlan,
          openingHours: serializeOpeningHours(),
          source: searchParams.get('source') || 'direct',
        };

        const res = await apiClient.post('/google-business/complete-onboarding', onboardingPayload);
        const resData = res.data;

        const { auth, user, listing } = resData;

        // Persist auth token to localStorage so Dashboard auth guard finds it
        if (auth?.accessToken) {
          localStorage.setItem('auth_token', auth.accessToken);
          localStorage.setItem('business_user', JSON.stringify(user));
          
          // Set shared cookies for localhost ports SSO
          setSharedAuthCookies(auth.accessToken, auth.refreshToken, user);
        }

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${auth.accessToken}`;

        // ─── Check if there's a pending platform purchase ───
        const pendingPurchase = localStorage.getItem('pendingPlatformPurchase');

        dispatch(
          setAuthTokens({
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
          })
        );
        dispatch(
          setUserData({
            id: user?.id || 'mock_user_id',
            userName: `${user?.firstName || formData.firstName || 'Merchant'} ${user?.lastName || formData.lastName || 'User'}`,
            userRole: user?.role || 'owner',
            packageInfo: null,
          })
        );

        localStorage.setItem('businessOnboarding', JSON.stringify({
          businessName: listing?.businessName || selectedPreviewBusiness?.businessName || formData.businessName,
          postcode: listing?.postcode || selectedPreviewBusiness?.postcode || formData.postcode,
          address: listing?.address || selectedPreviewBusiness?.address || formData.address,
          logo: null,
        }));
        localStorage.setItem('businessArea', 'London');
        localStorage.setItem('businessProximityTier', 'high_street');

        setShowReviewStorefrontPage(false);
        setIsFinalizingStorefront(true);
        setShowBuildingStorefrontPage(true);
      } catch (err: any) {
        console.error('Failed complete-onboarding:', err);
        setSubmitError(err?.response?.data?.message || err?.message || 'Failed to claim business storefront.');
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="bg-orange-50/30 text-gray-900 min-h-screen flex flex-col font-sans pb-32 relative">
        {/* Header Navigation */}
        <header className="fixed top-0 w-full z-50 bg-white flex justify-between items-center px-4 h-16 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowReviewStorefrontPage(false); setShowQuickSetupPage(true); }} className="active:scale-95 transition-all p-2 hover:bg-gray-100 rounded-full">
              <ChevronLeft className="w-6 h-6 text-orange-600" />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">STEP 13 OF 13</span>
              <h1 className="text-lg font-black text-orange-600 leading-tight">MCOMMALL</h1>
            </div>
          </div>
          <button className="hover:bg-gray-100 transition-colors text-orange-600 font-bold px-4 py-2 rounded-xl text-sm">
            Save & Exit
          </button>
        </header>

        {/* Onboarding Stepper Indicator */}
        <div className="pt-16 w-full">
          <div className="h-1 w-full bg-gray-200 flex">
            <div className="h-full bg-orange-600 w-full transition-all duration-700"></div>
          </div>
        </div>

        <main className="max-w-[800px] mx-auto px-4 pt-4 md:pt-8 space-y-6 w-full flex-grow">
          {/* Title & Intro */}
          <header className="text-center space-y-2 mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">Review Your Storefront</h2>
            <p className="text-sm font-medium text-gray-500 px-4 max-w-lg mx-auto">Ensure everything is perfect before launching your business to the community.</p>
          </header>

          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-semibold mb-4">
              {submitError}
            </div>
          )}

          {/* Asymmetric Bento-style Grid Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Business Profile Card (Full Width) */}
            <section className="md:col-span-2 bg-white/80 backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                    <Store className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Business Profile</h3>
                    <p className="text-xs font-medium text-gray-500">The core identity of your brand.</p>
                  </div>
                </div>
                <button onClick={() => { setShowReviewStorefrontPage(false); setCurrentStep(6); }} className="text-orange-600 font-bold text-[10px] uppercase tracking-widest hover:underline">EDIT</button>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Legal Name</p>
                  <p className="text-base font-bold text-gray-900">{formData.businessName || 'Artisanal Roast & Co.'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</p>
                  <p className="text-base font-bold text-gray-900">{selectedCategories.join(', ') || 'Specialty Cafe'}</p>
                </div>
              </div>
            </section>

            {/* Local Placement */}
            <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-bold text-gray-900">Local Placement</h3>
                </div>
                <button onClick={() => { setShowReviewStorefrontPage(false); setCurrentStep(2); }} className="text-orange-600 font-bold text-[10px] uppercase tracking-widest hover:underline">EDIT</button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100/50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Primary Hub</p>
                  <p className="text-sm font-bold text-gray-900">{formData.city || 'Richmond Borough'} / {formData.postcode || 'High Street'}</p>
                </div>
                <div className="h-32 w-full rounded-xl overflow-hidden relative shadow-inner bg-[#f4f3f0] flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full opacity-35" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <pattern id="local-placement-map" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#d1cfc7" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#local-placement-map)" />
                    <path d="M-20,40 L300,40" fill="none" stroke="#e3e1d9" strokeWidth="10" />
                    <path d="M100,-20 L100,150" fill="none" stroke="#e3e1d9" strokeWidth="12" />
                  </svg>
                  <MapPin className="w-6 h-6 text-orange-600 animate-bounce relative z-10" />
                </div>
              </div>
            </section>

            {/* Membership Plan */}
            <section className="bg-blue-50/50 backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-blue-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-gray-900">Membership</h3>
                </div>
                <button onClick={() => { setShowReviewStorefrontPage(false); setShowMembershipSelectionPage(true); }} className="text-blue-600 font-bold text-[10px] uppercase tracking-widest hover:underline">EDIT</button>
              </div>
              <div className="space-y-4">
                <div className="flex flex-col">
                  <span className="text-3xl font-black text-blue-600">Growth</span>
                  <span className="text-xs font-bold text-blue-400">Annual Subscription</span>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    <span>Unlimited Community Posts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <CheckCircle2 className="w-4 h-4 text-blue-500" />
                    <span>Advanced Operational Analytics</span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Products & Services */}
            <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Archive className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-bold text-gray-900">Inventory</h3>
                </div>
                <button onClick={() => { setShowReviewStorefrontPage(false); setShowBusinessTypePage(true); }} className="text-orange-600 font-bold text-[10px] uppercase tracking-widest hover:underline">EDIT</button>
              </div>
              <div className="flex gap-4 h-full items-center">
                {(formData.businessType === 'products' || formData.businessType === 'both') && (
                  <div className="flex-1 text-center border-r border-gray-100 py-2 last:border-r-0">
                    <p className="text-4xl font-black text-orange-600">00</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Products (Pending)</p>
                  </div>
                )}
                {(formData.businessType === 'services' || formData.businessType === 'both') && (
                  <div className="flex-1 text-center py-2">
                    <p className="text-4xl font-black text-orange-600">00</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Services (Pending)</p>
                  </div>
                )}
              </div>
            </section>

            {/* Enabled Features */}
            <section className="bg-white/80 backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 shadow-sm border border-orange-100 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Puzzle className="w-5 h-5 text-orange-600" />
                  <h3 className="text-lg font-bold text-gray-900">Features</h3>
                </div>
                <button onClick={() => { setShowReviewStorefrontPage(false); setShowQuickSetupPage(true); }} className="text-orange-600 font-bold text-[10px] uppercase tracking-widest hover:underline">EDIT</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {Object.entries(quickSetupToggles).filter(([_, enabled]) => enabled).map(([key, _]) => {
                  const map: Record<string, { label: string; Icon: React.ComponentType<any> }> = {
                    loyalty: { label: 'Loyalty', Icon: Heart },
                    rewards: { label: 'Rewards', Icon: Gift },
                    promotions: { label: 'Promotions', Icon: Megaphone },
                    gamification: { label: 'Gamification', Icon: Gamepad2 },
                    bookings: { label: 'Bookings', Icon: Calendar },
                    events: { label: 'Events', Icon: CalendarDays },
                    vouchers: { label: 'Vouchers', Icon: Ticket },
                  };
                  const item = map[key];
                  if (!item) return null;
                  const { label, Icon } = item;
                  return (
                    <span key={key} className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border border-orange-200">
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </span>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Terms Agreement */}
          <div className={`flex items-start gap-3 p-5 bg-white/50 border rounded-2xl transition-all duration-300 ${termsError ? 'border-red-500 bg-red-50/50 animate-shake' : 'border-gray-200'}`}>
            <input 
              className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-5 w-5 cursor-pointer" 
              id="terms" 
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
            />
            <label className="text-sm font-medium text-gray-600 leading-relaxed cursor-pointer" htmlFor="terms">
              I confirm that all provided information is accurate and I agree to the MCOMMALL <a className="text-orange-600 font-bold hover:underline" href="#">Terms of Service</a> and <a className="text-orange-600 font-bold hover:underline" href="#">Community Guidelines</a>.
            </label>
          </div>
        </main>

        {/* Bottom Action Bar (Fixed) */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-100 flex flex-col gap-3 z-40">
          <div className="max-w-[800px] mx-auto w-full flex flex-col md:flex-row-reverse gap-3">
            <button 
              onClick={handleConfirm}
              className="w-full md:w-2/3 bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-orange-700"
            >
              CONFIRM & GO LIVE
              <Rocket className="w-5 h-5" />
            </button>
            <button className="w-full md:w-1/3 text-gray-500 font-bold py-4 rounded-xl transition-colors hover:bg-gray-100 uppercase tracking-widest text-xs">
              Save for later
            </button>
          </div>
        </div>

        {/* Success Feedback Overlay */}
        <AnimatePresence>
          {storefrontLive && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                  className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </motion.div>
                <h2 className="text-3xl font-black text-gray-900 mb-2">Storefront Live!</h2>
                <p className="text-base font-medium text-gray-500 mb-8 leading-relaxed">Congratulations, your business is now visible to the local community.</p>
                <button 
                  onClick={async () => {
                    await performSSORedirect('/dashboard');
                  }}
                  className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all active:scale-95"
                >
                  Go to Dashboard
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out 0s 2; }
        `}} />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Quick Setup Page (Step 10)
  // ═══════════════════════════════════════════════════════
  if (showQuickSetupPage) {
    const premiumFeatures = ['promotions', 'gamification', 'bookings', 'events'];

    const handleToggle = (key: keyof typeof quickSetupToggles) => {
      // If trying to turn ON a premium feature
      if (premiumFeatures.includes(key as any) && !quickSetupToggles[key]) {
        setLockedFeatureAttempt(key);
        return;
      }
      setQuickSetupToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
      <div className="bg-gray-50 text-gray-900 min-h-screen flex flex-col font-sans pb-32">
        {/* Top Navigation Bar */}
        <header className="bg-white flex justify-between items-center w-full px-4 h-14 z-50 fixed top-0 border-b border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => { setShowQuickSetupPage(false); setShowMembershipSelectionPage(true); }} className="hover:bg-gray-100 p-2 rounded-full transition-colors active:scale-95">
              <ChevronLeft className="w-6 h-6 text-orange-600" />
            </button>
            <h1 className="text-xl font-black text-orange-600 tracking-tight">MCOMMALL</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="hover:bg-gray-100 p-2 rounded-full transition-colors">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>
            <div className="w-8 h-8 rounded-full bg-orange-100 border border-orange-200 flex items-center justify-center">
              <span className="text-orange-600 font-bold text-xs">JD</span>
            </div>
          </div>
        </header>

        <main className="max-w-[1280px] mx-auto px-6 pt-18 md:pt-24 pb-32 w-full flex-grow flex justify-center">
          <div className="w-full max-w-[640px]">
            {/* Onboarding Stepper */}
            <div className="w-full mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Merchant Onboarding</span>
                <span className="text-xs font-bold text-orange-600 uppercase tracking-widest">Step 10 of 12</span>
              </div>
              <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-600 transition-all duration-700 ease-in-out w-[83.33%]"></div>
              </div>
            </div>

            <div className="mb-8 text-center md:text-left">
              <h2 className="text-3xl font-black text-gray-900 mb-2">Quick Setup</h2>
              <p className="text-sm font-medium text-gray-500">Toggle the features you'd like to enable for your storefront. You can customize these later in your dashboard.</p>
            </div>

            {/* Feature Toggles Card */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
              <div className="divide-y divide-gray-100">
                {/* Toggle Row: Loyalty */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Heart className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Loyalty</h3>
                      <p className="text-xs font-medium text-gray-500">Allow customers to earn points on every purchase.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.loyalty} onChange={() => handleToggle('loyalty')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.loyalty ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.loyalty ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Rewards */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Gift className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Rewards</h3>
                      <p className="text-xs font-medium text-gray-500">Offer milestone gifts and birthday surprises.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.rewards} onChange={() => handleToggle('rewards')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.rewards ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.rewards ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Promotions */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Promotions</h3>
                      <p className="text-xs font-medium text-gray-500">Run flash sales and seasonal discount campaigns.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.promotions} onChange={() => handleToggle('promotions')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.promotions ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.promotions ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Gamification */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Gamepad2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Gamification</h3>
                      <p className="text-xs font-medium text-gray-500">Add interactive challenges and leaderboards.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.gamification} onChange={() => handleToggle('gamification')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.gamification ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.gamification ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Bookings */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Bookings</h3>
                      <p className="text-xs font-medium text-gray-500">Accept appointments and reservations directly.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.bookings} onChange={() => handleToggle('bookings')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.bookings ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.bookings ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Events */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <CalendarDays className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Events</h3>
                      <p className="text-xs font-medium text-gray-500">Promote and sell tickets for in-store events.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.events} onChange={() => handleToggle('events')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.events ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.events ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
                {/* Toggle Row: Vouchers */}
                <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Enable Vouchers</h3>
                      <p className="text-xs font-medium text-gray-500">Issue digital gift cards and store credit.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only" checked={quickSetupToggles.vouchers} onChange={() => handleToggle('vouchers')} />
                    <div className={`w-11 h-6 rounded-full transition-colors ${quickSetupToggles.vouchers ? 'bg-orange-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-[2px] left-[2px] bg-white w-5 h-5 rounded-full transition-transform border border-gray-200 ${quickSetupToggles.vouchers ? 'translate-x-5' : ''}`}></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-4 mt-8">
              <button 
                onClick={() => { setShowQuickSetupPage(false); setShowMembershipRoutingPage(true); }}
                className="w-full md:w-auto px-10 py-3.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition-all active:scale-95"
              >
                Back
              </button>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <button className="hidden md:block px-6 py-3 rounded-full text-gray-500 font-bold text-xs uppercase tracking-widest hover:text-orange-600 transition-colors">
                  Save and Exit
                </button>
                <button 
                  onClick={() => { setShowQuickSetupPage(false); setShowReviewStorefrontPage(true); }}
                  className="w-full md:w-auto px-10 py-3.5 rounded-xl bg-gray-900 text-white font-bold text-sm shadow-md hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button className="md:hidden mt-4 w-full text-center text-gray-500 font-bold text-xs uppercase tracking-widest">
              Save and Exit
            </button>
          </div>
        </main>

        {/* Premium Upgrade Modal Overlay */}
        <AnimatePresence>
          {lockedFeatureAttempt && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm px-4"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-red-500"></div>
                <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-6 mx-auto">
                  <Crown className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-center mb-2 text-gray-900 capitalize">
                  Unlock {lockedFeatureAttempt}
                </h3>
                <p className="text-sm font-medium text-gray-500 text-center mb-8">
                  This is a premium feature. Subscribe to a Co-Branded or PAYG plan to enable {lockedFeatureAttempt} for your storefront.
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setLockedFeatureAttempt(null);
                      setShowQuickSetupPage(false);
                      setShowMembershipRoutingPage(true);
                    }}
                    className="w-full py-4 rounded-xl bg-orange-600 text-white font-bold text-sm shadow-lg hover:bg-orange-700 transition-all active:scale-95"
                  >
                    View Plans
                  </button>
                  <button 
                    onClick={() => setLockedFeatureAttempt(null)}
                    className="w-full py-4 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-all active:scale-95"
                  >
                    Not Now
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Step 5 — Programme Introduction (mandatory)
  // ═══════════════════════════════════════════════════════
  if (showProgrammeIntro) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }} className="mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-400/40">
            <Sparkles className="w-14 h-14 text-white" />
          </div>
        </motion.div>

        <motion.h1 initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="text-3xl md:text-4xl font-black text-gray-900 mb-4 text-center tracking-tight">
          Welcome to Your<br />Business Success Programme
        </motion.h1>

        <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="text-base text-gray-500 mb-6 text-center max-w-lg">
          Over the next 90 days, MCOM will help you:
        </motion.p>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="max-w-lg w-full space-y-3 mb-8">
          {[
            'Build your digital business profile',
            'Strengthen your brand',
            'Increase customer loyalty',
            'Expand your business network',
            'Improve your online presence',
            'Prepare for a professional Business Audit',
            'Receive personalised recommendations for growth',
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-orange-50 rounded-xl px-4 py-3 border border-orange-100">
              <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0" />
              <span className="text-sm font-medium text-gray-700">{item}</span>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }} className="bg-amber-50 rounded-2xl p-5 max-w-lg w-full mb-8 border border-amber-200">
          <p className="text-sm text-amber-800 font-medium text-center leading-relaxed">
            Most businesses complete the programme within 90 days. Some complete it in as little as 2 weeks. You can progress at your own pace. Your dashboard will guide you every step of the way.
          </p>
        </motion.div>

        <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9 }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          onClick={() => { setShowProgrammeIntro(false); setShowChoosePlan(true); }}
          className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all shadow-xl shadow-orange-500/25 flex items-center gap-2"
        >
          Continue <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Step 6 — Choose Annual Plan
  // ═══════════════════════════════════════════════════════
  if (showChoosePlan) {
    const QUARTERLY_DISCOUNT = 0.1;
    const YEARLY_DISCOUNT = 0.2;

    // Map source param to platform name for external plans

    const handlePlatformPlanSelect = async (plan: any, provider: 'stripe' | 'paypal') => {
      const billingCycle = planBillingCycle === 'yearly' ? 'annual' : 'quarterly';
      const displayPrice = planBillingCycle === 'yearly' ? plan.annualPrice : plan.quarterlyPrice;

      // Save the selected plan to localStorage
      localStorage.setItem('selectedMembership', JSON.stringify({
        tier: plan.name,
        subTier: 'Normal',
        billing: planBillingCycle,
        price: displayPrice || 0,
      }));

      localStorage.setItem('pendingPlatformPurchase', JSON.stringify({
        platform: platformName,
        externalPlanId: plan.id,
        planName: plan.name,
        billingCycle,
        provider,
        source: sourceParam || '',
        redirect: searchParams.get('redirect') || '',
      }));

      if (provider === 'stripe') {
        setShowPlatformPaymentModal(true);
      } else if (provider === 'paypal') {
        setIsProcessingPayment(true);
        setSelectedPlatformPlan(plan);
        try {
          const res = await paypalInitiate.mutateAsync({
            platform: platformName!,
            externalPlanId: plan.id,
            billingCycle,
            returnUrl: `${window.location.origin}/checkout/paypal-return?platform=${encodeURIComponent(platformName!)}&onboarding=true&source=${encodeURIComponent(sourceParam || '')}&redirect=${encodeURIComponent(searchParams.get('redirect') || '')}`,
            cancelUrl: window.location.href,
          });

          if (res?.approvalUrl) {
            window.location.href = res.approvalUrl;
          } else {
            console.error('PayPal initiation response did not contain approvalUrl:', res);
          }
        } catch (err) {
          console.error('Failed to initiate PayPal platform payment:', err);
        } finally {
          setIsProcessingPayment(false);
        }
      }
    };

    // ─── Platform-Specific Plans (from external service) ────────────────────
    if (platformName) {
      const PLAN_COLORS = [
        'from-blue-500 to-blue-600',
        'from-orange-500 to-orange-600',
        'from-green-500 to-green-600',
        'from-purple-500 to-purple-600',
      ];
      const PLAN_ICONS = [Trophy, Star, Rocket, Crown];

      return (
        <>
          <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  {currentUser?.businessProfile?.id && (
                    <button
                      onClick={() => performSSORedirect()}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700 bg-orange-50 px-4 py-2 rounded-xl hover:bg-orange-100 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to {platformName}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestartOnboarding}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
                  >
                    <RefreshCw className="w-4 h-4" /> Restart Onboarding
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
                  >
                    <LogOut className="w-4 h-4" /> Log Out
                  </button>
                </div>
              </div>
            <div className="text-center max-w-3xl mx-auto mb-12">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold mb-4">
                  <Crown className="w-4 h-4" />
                  {platformName} Plans
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                  Select Your <span className="text-orange-600">{platformName}</span> Plan
                </h1>
                <p className="text-base sm:text-lg text-gray-600 font-medium">
                  Choose a plan to activate your {platformName} platform access.
                </p>
              </motion.div>

              {/* Billing Cycle Toggle */}
              <div className="mt-8 flex justify-center">
                <div className="flex p-1 bg-gray-100 rounded-full">
                  {(['quarterly', 'yearly'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      onClick={() => setPlanBillingCycle(cycle)}
                      className={cn(
                        "px-6 md:px-8 py-3 rounded-full text-sm font-semibold transition-all",
                        planBillingCycle === cycle ? "bg-white text-orange-600 shadow-lg" : "text-gray-500 hover:text-gray-700"
                      )}
                    >
                      {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                      {cycle === 'quarterly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 10%</span>}
                      {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 20%</span>}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Loading State */}
            {isLoadingPlans && (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading {platformName} plans...</p>
              </div>
            )}

            {/* External Plan Cards */}
            {!isLoadingPlans && externalPlans.length > 0 && (
              <div className={cn(
                "grid gap-6 mb-12",
                externalPlans.length <= 2 ? "sm:grid-cols-2 max-w-4xl mx-auto" :
                externalPlans.length === 3 ? "sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto" :
                "sm:grid-cols-2 lg:grid-cols-4"
              )}>
                {externalPlans.map((plan, index) => {
                  const isDefault = plan.isDefault;
                  const colorClass = PLAN_COLORS[index % PLAN_COLORS.length];
                  const PlanIcon = PLAN_ICONS[index % PLAN_ICONS.length];

                  // Determine price based on billing cycle
                  let displayPrice: number | null = null;
                  if (planBillingCycle === 'quarterly' && plan.quarterlyPrice) {
                    displayPrice = plan.quarterlyPrice;
                  } else if (planBillingCycle === 'yearly' && plan.annualPrice) {
                    displayPrice = plan.annualPrice;
                  } else if (plan.monthlyPrice) {
                    displayPrice = plan.monthlyPrice;
                  }

                  const isTrial = plan.type === 'TRIAL';

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className={cn(
                        "relative p-6 md:p-8 rounded-3xl flex flex-col transition-all duration-300",
                        isDefault
                          ? "bg-orange-500 text-white shadow-2xl shadow-orange-500/30 scale-[1.02] md:scale-105 z-10"
                          : "bg-white border border-gray-100 hover:border-orange-200 hover:shadow-xl"
                      )}
                    >
                      {isDefault && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg whitespace-nowrap">
                          <Star className="w-3 h-3 fill-current" /> RECOMMENDED
                        </div>
                      )}

                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4",
                        isDefault ? "bg-white/20" : `bg-gradient-to-br ${colorClass} text-white`
                      )}>
                        <PlanIcon className="w-6 h-6" />
                      </div>

                      <h3 className={cn("text-xl font-bold mb-1",
                        isDefault ? "text-white" : "text-gray-900"
                      )}>
                        {plan.name}
                      </h3>

                      {plan.description && (
                        <p className={cn("text-sm mb-4 leading-relaxed",
                          isDefault ? "text-orange-100" : "text-gray-500"
                        )}>
                          {plan.description}
                        </p>
                      )}

                      <div className="mb-6">
                        {isTrial ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">Free</span>
                            {plan.trialDuration && (
                              <span className={cn("text-sm", isDefault ? "text-orange-200" : "text-gray-400")}>
                                {plan.trialDuration} days trial
                              </span>
                            )}
                          </div>
                        ) : displayPrice ? (
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">£{displayPrice}</span>
                            <span className={cn("text-sm", isDefault ? "text-orange-200" : "text-gray-400")}>
                              /{planBillingCycle === 'yearly' ? 'yr' : 'qtr'}
                            </span>
                          </div>
                        ) : (
                          <span className={cn("text-sm", isDefault ? "text-orange-200" : "text-gray-400")}>
                            Contact for pricing
                          </span>
                        )}
                      </div>

                      {/* Features */}
                      {Array.isArray(plan?.features) && plan.features.length > 0 && (
                        <div className="space-y-2 mb-8 flex-1">
                          <div className={cn("text-xs font-bold uppercase tracking-widest mb-3",
                            isDefault ? "text-orange-200/60" : "text-gray-400"
                          )}>Included</div>
                          {plan.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Check className={cn("w-4 h-4 shrink-0", isDefault ? "text-orange-300" : "text-orange-500")} />
                              <span className={cn("text-sm", isDefault ? "text-white" : "text-gray-700")}>{f}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Payment Buttons */}
                      <div className="space-y-2">
                        {isTrial ? (
                          <button
                            onClick={() => handlePlatformPlanSelect(plan, 'stripe')}
                            disabled={isProcessingPayment}
                            className={cn(
                              "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95",
                              isDefault
                                ? "bg-white text-orange-600 hover:bg-orange-50"
                                : "bg-orange-500 text-white hover:bg-orange-600",
                              isProcessingPayment && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {isProcessingPayment ? (
                              <span className="flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                              </span>
                            ) : (
                              'Start Free Trial'
                            )}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handlePlatformPlanSelect(plan, 'stripe')}
                              disabled={isProcessingPayment}
                              className={cn(
                                "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2",
                                isDefault
                                  ? "bg-white text-orange-600 hover:bg-orange-50"
                                  : "bg-orange-500 text-white hover:bg-orange-600",
                                isProcessingPayment && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isProcessingPayment && selectedPlatformPlan?.id === plan.id ? (
                                <span className="flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                                </span>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4" /> Pay with Card
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handlePlatformPlanSelect(plan, 'paypal')}
                              disabled={isProcessingPayment}
                              className={cn(
                                "w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2",
                                isDefault
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200",
                                isProcessingPayment && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {isProcessingPayment && selectedPlatformPlan?.id === plan.id ? (
                                <span className="flex items-center gap-2">
                                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
                                </span>
                              ) : (
                                <>
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106z" />
                                  </svg>
                                  Pay with PayPal
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>

                      {plan.type && plan.type !== 'STANDARD' && (
                        <div className={cn("mt-3 text-center text-xs font-semibold uppercase tracking-wider",
                          isDefault ? "text-orange-100" : "text-gray-400"
                        )}>
                          {plan.type}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!isLoadingPlans && externalPlans.length === 0 && (
              <div className="text-center py-20">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No plans available for {platformName} at this time.</p>
                <button
                  onClick={() => {
                    if (currentUser?.businessProfile?.id) {
                      performSSORedirect();
                    } else {
                      setShowChoosePlan(false);
                    }
                  }}
                  className="mt-4 text-orange-600 font-semibold hover:underline"
                >
                  Go back
                </button>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 font-medium mt-4">
              Secure payment powered by Stripe &amp; PayPal
            </p>
          </div>
        </div>
        <PlatformPaymentModal
          isOpen={showPlatformPaymentModal}
          onClose={() => {
            setShowPlatformPaymentModal(false);
            const onboardingState = localStorage.getItem('businessOnboardingState');
            if (onboardingState !== 'plan_selection') {
              localStorage.removeItem('pendingPlatformPurchase');
              setShowWelcomeChecklistPage(true);
            }
          }}
          onSuccess={() => {
            setShowPlatformPaymentModal(false);
            if (currentUser?.businessProfile?.id) {
              localStorage.removeItem('businessOnboardingState');
              localStorage.removeItem('onboardingPaymentSuccess');
              performSSORedirect();
              return;
            }
            const onboardingState = localStorage.getItem('businessOnboardingState');
            if (onboardingState === 'plan_selection' || onboardingState === 'assessment' || localStorage.getItem('onboardingPaymentSuccess') === 'true') {
              localStorage.setItem('businessOnboardingState', 'assessment');
              setShowChoosePlan(false);
              setShowInitialAssessment(true);
            } else {
              setShowWelcomeChecklistPage(true);
            }
          }}
        />
      </>
    );
    }

    // ─── Default MCOM Solutions Membership Plans ────────────────────────────
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={handleRestartOnboarding}
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
            >
              <RefreshCw className="w-4 h-4" /> Restart Onboarding
            </button>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
            >
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
          <div className="text-center max-w-3xl mx-auto mb-12">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold mb-4">
                <Crown className="w-4 h-4" />
                Choose Your {platformName ? platformName : 'Membership'} Plan
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3 tracking-tight">
                Select Your <span className="text-orange-600">Growth Plan</span>
              </h1>
              <p className="text-base sm:text-lg text-gray-600 font-medium">
                {platformName
                  ? `Choose a ${platformName} plan to get started with your platform access.`
                  : 'Your membership includes access to the Business Success Programme and all included platform tools.'
                }
              </p>
            </motion.div>

            {/* Billing Toggle */}
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex p-1 bg-gray-100 rounded-full">
                {(['quarterly', 'yearly'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setPlanBillingCycle(cycle)}
                    className={cn(
                      "px-6 md:px-8 py-3 rounded-full text-sm font-semibold transition-all",
                      planBillingCycle === cycle ? "bg-white text-orange-600 shadow-lg" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    {cycle === 'quarterly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 10%</span>}
                    {cycle === 'yearly' && <span className="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded-full uppercase">Save 20%</span>}
                  </button>
                ))}
              </div>

              {/* Sub-tier Toggle (only for default MCOM Solutions plans) */}
              {!platformName && (
                <div className="flex gap-2 p-1.5 bg-orange-50 rounded-2xl border border-orange-100">
                  {(['Normal', 'Pro', 'Pro+'] as SubTier[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setPlanSubTier(tier)}
                      className={cn(
                        "px-4 md:px-6 py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center min-w-[90px] md:min-w-[120px]",
                        planSubTier === tier
                          ? "bg-orange-500 text-white shadow-lg"
                          : "text-orange-600/60 hover:text-orange-600 hover:bg-orange-100"
                      )}
                    >
                      {tier}
                      <span className="text-[10px] opacity-80 font-normal">
                        {tier === 'Normal' && 'Basic Access'}
                        {tier === 'Pro' && 'More Growth'}
                        {tier === 'Pro+' && 'Max Visibility'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Membership Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {plans.map((plan, index) => {
              const isGold = plan.id === 'Gold';
              const baseMonthly = plan.price[planSubTier];
              const discount = planBillingCycle === 'yearly' ? YEARLY_DISCOUNT : QUARTERLY_DISCOUNT;
              const perMonthDiscounted = Math.floor(baseMonthly * (1 - discount));
              const totalPerCycle = planBillingCycle === 'yearly' ? perMonthDiscounted * 12 : perMonthDiscounted * 3;
              const PlanIcon = ICON_MAP[plan.iconName as keyof typeof ICON_MAP];

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={cn(
                    "relative p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] flex flex-col transition-all duration-500",
                    isGold
                      ? "bg-orange-500 text-white shadow-2xl shadow-orange-500/40 scale-[1.02] md:scale-105 z-10"
                      : "bg-white border border-gray-100 hover:border-orange-200 hover:shadow-2xl"
                  )}
                >
                  {isGold && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 font-bold px-3 md:px-4 py-1 rounded-full text-xs flex items-center gap-1 shadow-lg whitespace-nowrap">
                      <Star className="w-3 h-3 fill-current" /> MOST POPULAR
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className={cn("w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center p-2.5 md:p-3 shadow-sm",
                      isGold ? "bg-white/20" : plan.color
                    )}>
                      <PlanIcon className="w-full h-full" />
                    </div>
                    <div className={cn("text-xs font-semibold uppercase tracking-widest",
                      isGold ? "text-orange-100" : "text-gray-400"
                    )}>
                      {plan.name}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl md:text-4xl font-bold">£{perMonthDiscounted}</span>
                      <span className={cn("text-sm", isGold ? "text-orange-200" : "text-gray-400")}>/mo</span>
                    </div>
                    <div className={cn("text-xs font-bold mt-1", isGold ? "text-green-300" : "text-green-500")}>
                      £{totalPerCycle}/{planBillingCycle === 'yearly' ? 'yr' : 'qtr'}
                    </div>
                  </div>

                  <p className={cn("mb-6 md:mb-8 text-sm font-medium leading-relaxed",
                    isGold ? "text-orange-50" : "text-gray-500"
                  )}>
                    {plan.description}
                  </p>

                  <div className={cn("h-px w-full mb-6 md:mb-8", isGold ? "bg-white/20" : "bg-gray-100")} />

                  <div className="space-y-3 md:space-y-4 mb-8 md:mb-10 flex-1">
                    <div className={cn("text-xs font-bold uppercase tracking-widest",
                      isGold ? "text-orange-200/60" : "text-gray-400"
                    )}>Features</div>
                    {(Array.isArray(plan?.features) ? plan.features : []).map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Check className={cn("w-4 h-4 shrink-0", isGold ? "text-orange-300" : "text-orange-500")} />
                        <span className={cn("text-sm font-semibold", isGold ? "text-white" : "text-gray-700")}>{f}</span>
                      </div>
                    ))}

                    <div className={cn("h-px w-8 my-3 md:my-4", isGold ? "bg-white/10" : "bg-gray-100")} />

                    <div className={cn("text-xs font-bold uppercase tracking-widest",
                      isGold ? "text-orange-200/60" : "text-gray-400"
                    )}>{planSubTier} Access</div>
                    {(Array.isArray(plan?.tierFeatures?.[planSubTier]) ? plan.tierFeatures[planSubTier] : []).map((f, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Zap className={cn("w-4 h-4 shrink-0", isGold ? "text-amber-300" : "text-amber-500")} />
                        <span className={cn("text-sm font-bold", isGold ? "text-white" : "text-gray-900")}>{f}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      localStorage.setItem('selectedMembership', JSON.stringify({ tier: plan.id, subTier: planSubTier, billing: planBillingCycle, price: totalPerCycle }));
                      localStorage.setItem('businessOnboardingState', 'plan_selected');
                      setShowChoosePlan(false);
                      setShowInitialAssessment(true);
                    }}
                    className={cn(
                      "w-full py-3 md:py-4 rounded-2xl font-black text-base md:text-lg transition-all active:scale-95 shadow-lg",
                      isGold ? "bg-white text-orange-600 hover:bg-orange-50" : "bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20"
                    )}
                  >
                    Select Membership
                  </button>

                  <div className={cn("mt-4 md:mt-6 text-center text-xs font-semibold uppercase tracking-wider",
                    isGold ? "text-orange-100" : "text-gray-400"
                  )}>
                    FOR {plan.whoItIsFor}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <p className="text-center text-xs text-gray-400 font-medium">Annual billing · Includes 90-Day Business Success Programme</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Step 7 — Initial Business Assessment (Interactive Wizard)
  // ═══════════════════════════════════════════════════════
  if (showInitialAssessment) {
    // Load questions from admin panel (localStorage), fall back to defaults
    const ICON_MAP: Record<string, any> = { Clock, Users, Globe, Heart, Target, Megaphone, HelpCircle, Zap, Award, Briefcase, BarChart3, Sparkles, MessageSquare, FileText, Star, TrendingUp, ShoppingCart, Package, MapPin };

    const defaultQuestions = [
      { id: 'yearsInBusiness', question: 'How long has your business been operating?', iconName: 'Clock', fieldType: 'single-choice', options: ['Less than 1 year', '1–3 years', '3–5 years', '5+ years'], hint: 'This helps us understand your growth stage' },
      { id: 'employeeCount', question: 'How many employees does your business have?', iconName: 'Users', fieldType: 'single-choice', options: ['Just me', '2–5', '6–20', '20+'], hint: 'We tailor recommendations to your team size' },
      { id: 'onlinePresence', question: 'How would you rate your current online presence?', iconName: 'Globe', fieldType: 'single-choice', options: ['No online presence', 'Basic website only', 'Website + social media', 'Strong online presence'], hint: 'This determines your digital starting point' },
      { id: 'customerBase', question: 'Approximately how many active customers do you serve monthly?', iconName: 'Heart', fieldType: 'number', options: [], hint: 'We use this to set realistic growth targets' },
      { id: 'mainGoal', question: 'What is your primary goal for the next 90 days?', iconName: 'Target', fieldType: 'single-choice', options: ['Increase customer loyalty', 'Grow customer base', 'Improve online visibility', 'Launch marketing campaigns'], hint: 'Your goal shapes your personalised action plan' },
      { id: 'marketingChannels', question: 'Which marketing channels do you currently use?', iconName: 'Megaphone', fieldType: 'multi-choice', options: ['None', 'Social media only', 'Social media + email', 'Multiple channels'], hint: 'We will fill any gaps in your strategy' },
    ];

    let rawQuestions: any[];
    try {
      const saved = localStorage.getItem('admin_assessment_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        rawQuestions = parsed.filter((q: any) => q.enabled !== false).sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
      } else {
        rawQuestions = defaultQuestions;
      }
    } catch { rawQuestions = defaultQuestions; }

    const assessmentQuestions = rawQuestions.map(q => ({
      ...q,
      icon: ICON_MAP[q.iconName] || HelpCircle,
      fieldType: q.fieldType || 'single-choice',
    }));

    const totalSteps = assessmentQuestions.length;
    const currentQuestion = assessmentQuestions[assessmentStep];
    const ft = currentQuestion.fieldType || 'single-choice';
    const isCurrentAnswered = ft === 'multi-choice'
      ? (assessmentAnswers[currentQuestion.id] || '').length > 0
      : ft === 'yes-no'
        ? assessmentAnswers[currentQuestion.id] === 'Yes' || assessmentAnswers[currentQuestion.id] === 'No'
        : ft === 'rating'
          ? !!assessmentAnswers[currentQuestion.id]
          : ft === 'number'
            ? assessmentAnswers[currentQuestion.id] !== undefined && assessmentAnswers[currentQuestion.id] !== ''
            : !!assessmentAnswers[currentQuestion.id];
    const answeredCount = Object.keys(assessmentAnswers).length;
    const progressPercent = Math.round((answeredCount / totalSteps) * 100);
    const isLastStep = assessmentStep === totalSteps - 1;
    const allAnswered = answeredCount === totalSteps;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 flex flex-col">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col flex-1">

            {/* Top Bar with Restart and Logout */}
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={handleRestartOnboarding}
                className="text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Restart
              </button>
              <button
                onClick={handleLogout}
                className="text-xs font-semibold text-red-600 hover:text-red-700 bg-white border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100"
              >
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            </div>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 text-orange-600 text-sm font-semibold mb-4">
                <FileSearch className="w-4 h-4" />
                Step 7 of 8
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">Initial Business Assessment</h1>
              <p className="text-gray-500 font-medium text-sm">This quick assessment determines your starting point and recommended pathway.</p>
            </div>

            {/* Step Circles */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {assessmentQuestions.map((q, i) => {
                const isCompleted = !!assessmentAnswers[q.id];
                const isCurrent = i === assessmentStep;
                return (
                  <React.Fragment key={q.id}>
                    <button
                      onClick={() => setAssessmentStep(i)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 cursor-pointer ${
                        isCompleted
                          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                          : isCurrent
                            ? 'bg-orange-100 text-orange-600 border-2 border-orange-500 shadow-md'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                    </button>
                    {i < totalSteps - 1 && (
                      <div className={`flex-1 h-0.5 max-w-[24px] rounded-full transition-all duration-500 ${
                        isCompleted ? 'bg-orange-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="mb-8">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-gray-500">{answeredCount} of {totalSteps} answered</span>
                <span className="text-orange-600">{progressPercent}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={assessmentStep}
                  initial={{ opacity: 0, x: 40, scale: 0.98 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -40, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200 shadow-sm flex-1 flex flex-col"
                >
                  {/* Question number */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <currentQuestion.icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">
                      Question {assessmentStep + 1} of {totalSteps}
                    </span>
                  </div>

                  {/* Question text */}
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-2 leading-tight">
                    {currentQuestion.question}
                  </h2>
                  <p className="text-sm text-gray-400 font-medium mb-6">{currentQuestion.hint}</p>

                  {/* Answer Input — renders based on fieldType */}
                  <div className="flex-1 flex flex-col">
                    {ft === 'single-choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentQuestion.options.map((opt: string) => {
                          const isSelected = assessmentAnswers[currentQuestion.id] === opt;
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: opt }));
                                if (!isLastStep) setTimeout(() => setAssessmentStep(s => s + 1), 350);
                              }}
                              className={`p-4 rounded-2xl text-left font-semibold transition-all border-2 ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-white bg-white/30' : 'border-gray-300'}`}>
                                  {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                                </div>
                                <span className="text-sm sm:text-base">{opt}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {ft === 'multi-choice' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentQuestion.options.map((opt: string) => {
                          const selected = (assessmentAnswers[currentQuestion.id] || '').split(',').filter(Boolean);
                          const isSelected = selected.includes(opt);
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                const next = isSelected ? selected.filter(s => s !== opt) : [...selected, opt];
                                setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: next.join(',') }));
                              }}
                              className={`p-4 rounded-2xl text-left font-semibold transition-all border-2 ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'border-white bg-white/30' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
                                </div>
                                <span className="text-sm sm:text-base">{opt}</span>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {ft === 'text' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <input
                          type="text"
                          value={assessmentAnswers[currentQuestion.id] || ''}
                          onChange={e => setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                          placeholder="Type your answer..."
                          autoFocus
                          className="w-full text-lg font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none"
                        />
                      </div>
                    )}

                    {ft === 'textarea' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <textarea
                          value={assessmentAnswers[currentQuestion.id] || ''}
                          onChange={e => setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                          placeholder="Type your answer..."
                          autoFocus
                          rows={4}
                          className="w-full text-lg font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none resize-none"
                        />
                      </div>
                    )}

                    {ft === 'number' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <input
                          type="number"
                          value={assessmentAnswers[currentQuestion.id] || ''}
                          onChange={e => setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                          placeholder="0"
                          autoFocus
                          min="0"
                          className="w-full text-lg font-semibold text-gray-900 placeholder:text-gray-300 focus:outline-none"
                        />
                      </div>
                    )}

                    {ft === 'date' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-4">
                        <input
                          type="date"
                          value={assessmentAnswers[currentQuestion.id] || ''}
                          onChange={e => setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                          className="w-full text-lg font-semibold text-gray-900 focus:outline-none"
                        />
                      </div>
                    )}

                    {ft === 'rating' && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-center gap-3">
                        {[1,2,3,4,5].map(s => {
                          const val = parseInt(assessmentAnswers[currentQuestion.id] || '0');
                          const active = s <= val;
                          return (
                            <motion.button
                              key={s}
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => {
                                setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: String(s) }));
                                if (!isLastStep) setTimeout(() => setAssessmentStep(step => step + 1), 400);
                              }}
                              className="transition-all"
                            >
                              <Star className={`w-10 h-10 transition-colors ${active ? 'text-orange-400 fill-orange-400' : 'text-gray-300'}`} />
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {ft === 'yes-no' && (
                      <div className="flex gap-4 justify-center">
                        {['Yes', 'No'].map(opt => {
                          const isSelected = assessmentAnswers[currentQuestion.id] === opt;
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setAssessmentAnswers(prev => ({ ...prev, [currentQuestion.id]: opt }));
                                if (!isLastStep) setTimeout(() => setAssessmentStep(s => s + 1), 350);
                              }}
                              className={`px-10 py-5 rounded-2xl text-lg font-bold transition-all border-2 ${
                                isSelected
                                  ? 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20'
                                  : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                              }`}
                            >
                              {opt}
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between mt-6 gap-4">
              <button
                onClick={() => assessmentStep > 0 && setAssessmentStep(s => s - 1)}
                disabled={assessmentStep === 0}
                className="flex items-center gap-1.5 text-sm font-semibold px-5 py-3 rounded-xl transition-all outline-none text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {isLastStep ? (
                <motion.button
                  whileHover={allAnswered ? { scale: 1.03 } : {}}
                  whileTap={allAnswered ? { scale: 0.97 } : {}}
                  onClick={() => {
                    if (!allAnswered) return;
                    localStorage.removeItem('businessOnboarding');
                    localStorage.removeItem('businessOnboardingStep');
                    localStorage.removeItem('businessOnboardingCompleted');
                    localStorage.removeItem('business_onboarding_draft');
                    localStorage.setItem('firstDashboardLogin', 'true');
                    localStorage.setItem('assessmentCompleted', JSON.stringify(assessmentAnswers));
                    router.push('/dashboard');
                  }}
                  disabled={!allAnswered}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base transition-all active:scale-95 ${
                    allAnswered
                      ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25 hover:from-orange-600 hover:to-red-600 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <span className="hidden sm:inline">Complete Assessment & Enter Dashboard</span>
                  <span className="sm:hidden">Complete</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (isCurrentAnswered) setAssessmentStep(s => s + 1);
                  }}
                  disabled={!isCurrentAnswered}
                  className={`flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base transition-all ${
                    isCurrentAnswered
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 cursor-pointer'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              )}
            </div>
            <p className="text-center text-xs text-gray-400 mt-3 font-medium">
              Your answers help us personalise your 90-day journey
            </p>

          </motion.div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Completion Screen
  // ═══════════════════════════════════════════════════════
  if (showComplete) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-x-hidden">
        <ConfettiRain />

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.2 }}
          className="mb-8"
        >
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-400/40">
            <Trophy className="w-14 h-14 text-white" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-4xl md:text-5xl font-black text-gray-900 mb-3 text-center tracking-tight"
        >
          You&apos;re All Set!
        </motion.h1>

        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-lg text-gray-500 mb-10 text-center max-w-md"
        >
          <span className="font-bold text-gray-700">{formData.businessName || 'Your business'}</span>{' '}
          is successfully registered and ready to establish your storefront on LocalMall.
        </motion.p>

        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={async () => {
            let targetRoute = '/dashboard';
            if (formData.businessType === 'both') {
              targetRoute = '/dashboard/store/products/add-product?fromOnboarding=true&hybridFlow=true';
            } else if (formData.businessType === 'products') {
              targetRoute = '/dashboard/store/products/add-product?fromOnboarding=true';
            } else if (formData.businessType === 'services') {
              targetRoute = '/dashboard/services/add-service?fromOnboarding=true';
            }
            await performSSORedirect(targetRoute);
          }}
          className="px-10 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white text-lg font-bold rounded-2xl hover:from-orange-600 hover:to-red-600 transition-all shadow-xl shadow-orange-500/25 flex items-center gap-2"
        >
          {formData.businessType === 'products' || formData.businessType === 'both' ? 'Start Product Setup' : 'Start Service Setup'}
          <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // Building Storefront Page (Immersive Loading State)
  // ═══════════════════════════════════════════════════════
  if (showBuildingStorefrontPage) {
    return (
      <BuildingStorefrontPage
        onComplete={() => {
          setShowBuildingStorefrontPage(false);
          if (isFinalizingStorefront) {
            // Check if there's a pending platform purchase — show payment modal
            if (localStorage.getItem('pendingPlatformPurchase')) {
              setShowPlatformPaymentModal(true);
            } else {
              setShowWelcomeChecklistPage(true);
            }
          } else {
            setShowBusinessTypePage(true);
          }
        }}
      />
    );
  }

  // ═══════════════════════════════════════════════════════
  // Welcome Checklist Page (Final Dashboard Destination)
  // ═══════════════════════════════════════════════════════
  if (showWelcomeChecklistPage) {
    return (
      <WelcomeChecklistPage 
        onComplete={async () => {
          localStorage.removeItem('businessOnboarding');
          localStorage.removeItem('businessOnboardingStep');
          localStorage.removeItem('businessOnboardingCompleted');
          localStorage.removeItem('business_onboarding_draft');
          localStorage.removeItem('businessArea');
          localStorage.removeItem('localMallName');
          localStorage.removeItem('localMallId');
          localStorage.removeItem('businessProximityTier');
          await performSSORedirect('/dashboard');
        }} 
      />
    );
  }

  // ═══════════════════════════════════════════════════════
  // Override: Select Your Borough browser overlay
  // ═══════════════════════════════════════════════════════
  if (showBoroughBrowser) {
    const filteredBoroughs = Object.keys(BOROUGH_DATA).filter(key => {
      const q = boroughSearchQuery.toLowerCase();
      const b = BOROUGH_DATA[key];
      return key.toLowerCase().includes(q) || 
             b.mallName.toLowerCase().includes(q) || 
             b.district.toLowerCase().includes(q);
    });

    return (
      <div className="min-h-screen bg-[#fafafa] relative overflow-x-hidden font-sans">
        {/* Subtle dot grid background */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Warm brand gradient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-b from-orange-200/15 to-transparent pointer-events-none" />
        <div className="absolute top-32 right-0 w-72 h-72 bg-amber-100/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-32 left-0 w-80 h-80 bg-rose-100/20 rounded-full blur-3xl pointer-events-none" />

        <main className="relative z-10 w-full max-w-3xl mx-auto px-4 py-6 md:py-12">
          {/* Back button */}
          <motion.button
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => setShowBoroughBrowser(false)}
            className="flex items-center gap-1.5 text-sm font-bold text-orange-600 hover:text-orange-700 transition-colors active:scale-95 mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </motion.button>

          {/* Header */}
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 shadow-lg shadow-orange-500/20 mb-4">
              <Compass className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Select Your Borough</h1>
            <p className="text-gray-500 text-sm mt-1.5 max-w-md mx-auto">
              Search or select a local business district to connect your storefront.
            </p>
          </motion.section>

          {/* Search bar */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="w-full mb-8 relative"
          >
            <div className="relative flex items-center bg-white border border-orange-200 rounded-xl shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100 transition-all">
              <Search className="w-5 h-5 text-orange-300 ml-4 absolute pointer-events-none" />
              <input 
                type="text"
                value={boroughSearchQuery}
                onChange={(e) => setBoroughSearchQuery(e.target.value)}
                placeholder="Search boroughs, districts or postcodes..."
                className="w-full pl-12 pr-4 py-4 bg-transparent border-none rounded-xl text-gray-900 placeholder-gray-300 focus:ring-0 text-base"
              />
              {boroughSearchQuery && (
                <button
                  onClick={() => setBoroughSearchQuery('')}
                  className="mr-3 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Borough grid */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-5"
          >
            {filteredBoroughs.map((key, idx) => {
              const b = BOROUGH_DATA[key];
              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx + 0.2 }}
                  onClick={async () => {
                    setSelectedBorough(key);
                    const defaultPostcodes: Record<string, string> = {
                      'Camden Borough': 'NW1 1AA',
                      'Richmond Borough': 'TW9 1EZ',
                      'Islington Borough': 'N1 0QH',
                      'Westminster Borough': 'SW1A 1AA',
                    };
                    const targetPostcode = defaultPostcodes[key] || formData.postcode;
                    setFormData((prev: any) => ({
                      ...prev,
                      postcode: targetPostcode,
                      city: key,
                    }));
                    setShowBoroughBrowser(false);
                    try {
                      await runLocationCheck(targetPostcode);
                    } catch (err) {
                      console.error('Borough browser location check error:', err);
                    }
                  }}
                  className="group cursor-pointer rounded-2xl border border-gray-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col active:scale-[0.98]"
                  whileHover={{ y: -4 }}
                >
                  {/* Image area */}
                  <div className="h-36 w-full overflow-hidden relative">
                    <img
                      src={b.detectedImage}
                      alt={b.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    {/* Badge */}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                        {b.nearbyBusinesses} merchants
                      </span>
                    </div>
                    {/* Borough name overlay */}
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-base font-bold text-white drop-shadow-sm">{b.name}</h3>
                      <p className="text-[11px] text-white/80 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {b.district}
                      </p>
                    </div>
                  </div>
                  {/* Details */}
                  <div className="p-4 flex flex-col gap-3 flex-grow">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">{b.mallName}</h4>
                      <p className="text-xs text-gray-400">{b.district}</p>
                    </div>
                    {/* Stats row */}
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5 text-orange-400" />
                        <span>{b.networkBusinesses} network</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-orange-400" />
                        <span>{b.localShoppers} shoppers</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-orange-400" />
                        <span>{b.activeCampaigns} campaigns</span>
                      </div>
                    </div>
                    {/* CTA */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400 font-medium">Select this borough</span>
                      <span className="bg-gradient-to-r from-orange-500 to-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg group-hover:shadow-md group-hover:shadow-orange-500/20 transition-shadow">
                        Choose
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Empty state */}
          {filteredBoroughs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Search className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No boroughs match your search</p>
              <button
                onClick={() => setBoroughSearchQuery('')}
                className="mt-3 text-orange-600 font-bold text-sm hover:underline"
              >
                Clear search
              </button>
            </motion.div>
          )}
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // High Street Activation Learn More Modal
  // ═══════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════
  // Main Onboarding Flow
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#fafafa] relative overflow-x-hidden font-sans">
      {/* Subtle dot grid background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Colored accent strip — changes with each quest */}
      <motion.div
        className="h-1 w-full relative z-20"
        animate={{ backgroundColor: currentQuest.color }}
        transition={{ duration: 0.4 }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-32 sm:pb-20">
        {/* ─── Top Header Bar with Logout ─── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-gray-900">
              Business Onboarding
            </span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold text-gray-500 hover:text-red-600 bg-white border border-gray-200/80 hover:border-red-200 hover:bg-red-50/50 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 duration-100 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Log Out
          </button>
        </div>

        {/* ─── Restore Toast ─── */}
        <AnimatePresence>
          {restoreToast && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-orange-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Restored your saved progress
            </motion.div>
          )}
        </AnimatePresence>
        {/* ─── Wizard Progress Bar ─── */}
        {!isGoogleOnboarding && (
          <WizardProgressBar
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        )}

        {/* ─── Step Card ───────────────────────────────── */}
        <div className="relative">
          <ParticleBurst color={isGoogleOnboarding ? '#ea580c' : currentQuest.color} trigger={particleTrigger} />

          <AnimatePresence mode="wait">
            <motion.div
              key={isGoogleOnboarding ? `google-${googleStep}` : currentStep}
              initial={{ opacity: 0, x: 40, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.98 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-2xl shadow-xl shadow-gray-200/40 border border-gray-100/80 overflow-hidden"
            >
              {/* Colored top stripe */}
              <div className="h-1" style={{ backgroundColor: isGoogleOnboarding ? '#ea580c' : currentQuest.color }} />

              <div className="p-6 sm:p-8 lg:p-10">
                {/* Quest header */}
                <div className="flex items-start gap-4 mb-8 sm:mb-10">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{ backgroundColor: isGoogleOnboarding ? '#fff7ed' : currentQuest.colorLight }}
                  >
                    {isGoogleOnboarding ? (
                      <svg className="w-6 h-6" viewBox="0 0 24 24">
                        <path fill="#ea580c" d="M21.35 11.1H12v2.7h5.38c-.24 1.28-.96 2.37-2.05 3.1l3.17 2.46c1.85-1.71 2.9-4.22 2.9-7.26c0-.62-.05-1.21-.15-2z" />
                        <path fill="#f97316" d="M12 21c2.43 0 4.47-.8 5.96-2.2l-3.17-2.46c-.88.6-2.01.96-3.12.96c-2.4 0-4.44-1.63-5.17-3.82l-3.28 2.54C4.7 18.73 8.08 21 12 21z" />
                        <path fill="#f59e0b" d="M6.83 13.48a5.35 5.35 0 0 1 0-2.96L3.55 7.98A9.9 9.9 0 0 0 2 12c0 1.48.33 2.89.92 4.16l3.91-3.08z" />
                        <path fill="#ef4444" d="M12 5.7c1.32 0 2.5.45 3.44 1.35l2.58-2.58C16.46 3.03 14.42 2.3 12 2.3C8.08 2.3 4.7 4.57 2.92 8l3.28 2.54c.73-2.19 2.77-3.84 5.17-3.84z" />
                      </svg>
                    ) : (
                      <QuestIcon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: currentQuest.color }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
                      {isGoogleOnboarding ? (
                        googleStep === 'branch_select' ? 'Select Your Branch' :
                        googleStep === 'fail_safe_form' ? 'Complete Profile Gaps' :
                        'Review & Claim Storefront'
                      ) : currentQuest.title}
                    </h2>
                    <p className="text-gray-500 mt-1 text-sm sm:text-base leading-relaxed">
                      {isGoogleOnboarding ? (
                        googleStep === 'branch_select' ? 'Select the Google Business Profile branch you want to onboard.' :
                        googleStep === 'fail_safe_form' ? 'Google was missing some info. Fill the gaps below to proceed.' :
                        'Verify your details and click Claim to create your account.'
                      ) : currentQuest.flavor}
                    </p>
                  </div>
                </div>

                {/* --- Google Onboarding Step: Branch Select --- */}
                {isGoogleOnboarding && googleStep === 'branch_select' && (
                  <div className="space-y-4">
                    {isSubmitting ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full"
                        />
                        <p className="text-sm text-gray-500 font-semibold animate-pulse">Fetching managed branches...</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-3">
                          {googleBranches.map((branch) => (
                            <motion.button
                              key={branch.googlePlaceId}
                              whileHover={{ y: -3, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}
                              whileTap={{ scale: 0.99 }}
                              onClick={() => handleGoogleSelectBranch(branch)}
                              className="w-full p-4 rounded-xl border border-gray-100 bg-white hover:border-orange-200 text-left transition-colors flex items-start gap-4 shadow-sm"
                            >
                              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                                <Building2 className="w-5 h-5 text-orange-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 text-sm truncate">{branch.businessName}</h4>
                                <p className="text-xs text-gray-400 mt-0.5 truncate flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                                  {branch.address}
                                </p>
                                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                                  Category: {branch.googleCategoryId.replace('gcid:', '').replace('_', ' ')}
                                </span>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-300 self-center" />
                            </motion.button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* --- Google Onboarding Step: Fail Safe Form --- */}
                {isGoogleOnboarding && googleStep === 'fail_safe_form' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-500 mb-1">Business Name (Imported)</label>
                      <div className="relative">
                        <Input value={selectedGoogleBranch?.businessName || ''} disabled className="h-11 rounded-xl bg-gray-50 border-gray-200 text-gray-500 pr-10 font-bold" />
                        <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-500 mb-1">Business Address (Imported)</label>
                      <div className="relative">
                        <Input value={selectedGoogleBranch?.address || ''} disabled className="h-11 rounded-xl bg-gray-50 border-gray-200 text-gray-500 pr-10" />
                        <ShieldCheck className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Phone Number {(!selectedGoogleBranch?.businessPhone) && <span className="text-red-500">*</span>}
                      </label>
                      <Input
                        value={googlePhoneInput}
                        onChange={(e) => setGooglePhoneInput(e.target.value)}
                        className={`h-11 rounded-xl bg-white border-gray-200 text-sm ${(!selectedGoogleBranch?.businessPhone) ? 'border-amber-300 focus-visible:ring-amber-300 bg-amber-50/10' : ''}`}
                        placeholder="+44 7700 900000"
                      />
                      {(!selectedGoogleBranch?.businessPhone) && (
                        <p className="text-[11px] text-amber-600 mt-1 font-semibold">Google did not provide a phone number. Please enter it here.</p>
                      )}
                    </div>

                    <div className="p-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/20 space-y-4">
                      <p className="text-xs text-amber-800 font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                        Assign Storefront Categories
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Sector</label>
                          <select
                            value={googleSectorId}
                            onChange={(e) => {
                              setGoogleSectorId(e.target.value);
                              setGoogleCategoryId('');
                              setGoogleSubCategoryId('');
                            }}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-300"
                          >
                            <option value="">Select Sector</option>
                            {(Array.isArray(sectors) ? sectors : []).map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                          <select
                            value={googleCategoryId}
                            onChange={(e) => {
                              setGoogleCategoryId(e.target.value);
                              setGoogleSubCategoryId('');
                            }}
                            disabled={!googleSectorId}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50"
                          >
                            <option value="">Select Category</option>
                            {(Array.isArray(googleCategories) ? googleCategories : []).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Subcategory</label>
                          <select
                            value={googleSubCategoryId}
                            onChange={(e) => setGoogleSubCategoryId(e.target.value)}
                            disabled={!googleCategoryId}
                            className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50"
                          >
                            <option value="">Select Subcategory</option>
                            {(Array.isArray(googleSubcategories) ? googleSubcategories : []).map(sc => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <p className="text-red-500 text-xs font-bold">{submitError}</p>
                    )}
                  </div>
                )}

                {/* --- Google Onboarding Step: Review & Claim --- */}
                {isGoogleOnboarding && googleStep === 'review_claim' && (
                  <div className="space-y-4">
                    {/* Storefront Review Summary Card */}
                    <div className="p-5 rounded-2xl border border-orange-100 bg-orange-50/20 relative overflow-hidden">
                      <div className="absolute right-4 top-4">
                        <span className="flex items-center gap-1 bg-green-500/10 border border-green-500/25 rounded-full px-2.5 py-0.5 text-[10px] font-black text-green-700 uppercase">
                          <Check className="w-3.5 h-3.5 text-green-600" strokeWidth={3} />
                          Verified
                        </span>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md shadow-orange-500/20 shrink-0">
                          {selectedGoogleBranch?.businessName[0]}
                        </div>
                        <div className="flex-1 min-w-0 pr-16">
                          <h4 className="font-extrabold text-gray-900 text-base leading-tight truncate">{selectedGoogleBranch?.businessName}</h4>
                          <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">{selectedGoogleBranch?.address}</p>
                          <p className="text-xs text-gray-400 mt-1">{googlePhoneInput}</p>
                        </div>
                      </div>
                    </div>

                    {/* Personal Account Information */}
                    <div className="p-4 rounded-xl border border-gray-150/40 bg-gray-50/50 space-y-4">
                      <h4 className="font-bold text-gray-800 text-sm">Owner Account Details</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                          <Input value={ownerFirstName} onChange={(e) => setOwnerFirstName(e.target.value)} placeholder="Jane" className="h-10 rounded-lg text-xs" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                          <Input value={ownerLastName} onChange={(e) => setOwnerLastName(e.target.value)} placeholder="Smith" className="h-10 rounded-lg text-xs" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Login Email (Verified Google Account)</label>
                        <Input value={googleEmail} disabled className="h-10 rounded-lg text-xs bg-gray-100 text-gray-400" />
                      </div>
                    </div>

                    {/* McomMall Commerce Model */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">What do you sell in your storefront?</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['products', 'services', 'both'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setOwnerBusinessType(t)}
                            className="p-3.5 rounded-xl border text-center transition-colors font-bold text-xs uppercase cursor-pointer"
                            style={{
                              borderColor: ownerBusinessType === t ? '#ea580c' : '#e5e7eb',
                              backgroundColor: ownerBusinessType === t ? '#fff7ed' : '#fff',
                              color: ownerBusinessType === t ? '#ea580c' : '#4b5563',
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {submitError && (
                      <p className="text-red-500 text-xs font-bold">{submitError}</p>
                    )}
                  </div>
                )}

                {/* ─── Step 0: Email (Normal flow) ────────────────── */}
                {!isGoogleOnboarding && currentQuest.id === 'email' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        We'll use this email to create your account, send verification codes, and keep you updated on your programme progress.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">
                        Business Email Address
                      </label>
                      <p className="text-xs text-gray-500 -mt-1">This will be your login and primary contact email</p>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 pl-10 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                          placeholder="you@yourbusiness.com"
                          autoFocus
                        />
                      </div>

                      <div className="text-center pt-4 border-t border-gray-100 mt-6">
                        <p className="text-sm text-gray-500 font-medium">
                          Already have an account?{' '}
                          <Link
                            to={`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                            className="text-orange-600 font-bold hover:underline"
                          >
                            Log in here
                          </Link>
                        </p>
                      </div>
                    </div>



                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{submitError}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ─── Step 1: OTP Verification ─────── */}
                {!isGoogleOnboarding && currentQuest.id === 'otp' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        Check your inbox for a 6-digit verification code. This confirms you own this email address and keeps your account secure.
                      </p>
                    </div>
                    <div className="text-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                      <p className="text-sm text-gray-500 font-medium">
                        Code sent to
                      </p>
                      <p className="text-base font-bold text-gray-900 mt-0.5">{formData.email}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight text-center">
                        Verification Code
                      </label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => {
                          setOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          if (submitError) setSubmitError(null);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        className="h-16 rounded-xl border-gray-200 bg-white text-3xl text-center font-black tracking-[0.4em] placeholder:text-gray-200 placeholder:font-normal placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                        placeholder="000000"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        setOtpResending(true);
                        try { await sendOtp({ email: formData.email, type: 'VERIFICATION' }); }
                        catch { /* silent */ }
                        finally { setOtpResending(false); }
                      }}
                      className="w-full text-center text-sm text-gray-400 hover:text-orange-500 transition-colors"
                    >
                      {otpResending ? 'Sending...' : "Didn't receive it? Resend code"}
                    </button>
                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{submitError}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ─── Step 2: Postcode / Address ───── */}
                {currentQuest.id === 'postcode' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        We use your business address to verify your location, connect you with nearby customers, and determine your High Street eligibility.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">
                        Business Postcode
                      </label>
                      <p className="text-xs text-gray-500 -mt-1">Enter the postcode where your business operates from</p>
                      <div className="relative">
                        <Input
                          value={formData.postcode}
                          onChange={(e) =>
                            setFormData({ ...formData, postcode: e.target.value.toUpperCase() })
                          }
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-14 rounded-xl border-gray-200 bg-white text-2xl text-center font-black tracking-[0.15em] uppercase placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                          placeholder="AB12 3CD"
                          autoFocus
                        />
                        {loadingSuggestions && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-gray-50 z-30 relative"
                      >
                        {suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="w-full text-left px-4 py-3 hover:bg-orange-50/50 transition-colors flex items-start gap-3 text-sm text-gray-700 group focus:outline-none focus:bg-orange-50"
                          >
                            <MapPin className="w-4 h-4 text-gray-400 group-hover:text-orange-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <span className="font-semibold text-gray-900 group-hover:text-orange-600 block">
                                {suggestion.displayName.split(',')[0]}
                              </span>
                              <span className="text-gray-500 text-xs line-clamp-1">
                                {suggestion.displayName}
                              </span>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                    {formData.address && !showSuggestions && (
                      <div className="p-4 bg-orange-50/40 border border-orange-100/55 rounded-xl flex items-start gap-3">
                        <Check className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                        <div className="text-left flex-1">
                          <div className="text-xs font-semibold text-orange-800">Verified Address:</div>
                          <div className="text-sm text-orange-950 font-medium">{formData.address}</div>
                          {formData.postcode && (
                            <div className="text-xs text-orange-700 font-bold mt-1 tracking-wide">Postcode: {formData.postcode}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {isCheckingProximity && (
                      <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-500 font-semibold animate-pulse">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full"
                        />
                        Calculating proximity to nearest High Street...
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Step 3: Borough Detected ─────── */}
                {!isGoogleOnboarding && currentQuest.id === 'borough_detected' && (
                  <div className="space-y-6">
                    {isCheckingProximity || !proximityResult ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                          className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full"
                        />
                        <p className="text-sm font-bold text-gray-500 animate-pulse">Verifying your business location...</p>
                        <p className="text-xs text-gray-400">Checking local merchant network in your area</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4">
                          <p className="text-sm text-purple-900 font-medium leading-relaxed">
                            We've matched your postcode to a local business district. Review the details below and confirm your borough to continue.
                          </p>
                        </div>

                        {/* Borough card */}
                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                          <div className="h-36 bg-gradient-to-br from-purple-500 to-indigo-600 flex items-end p-4">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-5 h-5 text-white" />
                              <span className="text-white font-bold text-lg">{selectedBorough}</span>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Local Mall</span>
                              <span className="text-sm text-gray-900 font-bold">{proximityResult?.localMallName || BOROUGH_DATA[selectedBorough]?.mallName || `${selectedBorough} Mall`}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Nearby Businesses</span>
                              <span className="text-sm text-orange-600 font-bold">{proximityResult?.businessCount ?? '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Active Shoppers</span>
                              <span className="text-sm text-gray-900 font-bold">{proximityResult?.consumerCount ? (proximityResult.consumerCount >= 1000 ? `${(proximityResult.consumerCount / 1000).toFixed(1)}k` : String(proximityResult.consumerCount)) : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">Postcode</span>
                              <span className="text-sm text-gray-900 font-bold">{formData.postcode}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-gray-400 text-center">
                            Not your area? <button onClick={() => setShowBoroughBrowser(true)} className="text-purple-600 font-bold hover:underline cursor-pointer">Browse other boroughs</button>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─── Step 4: High Street Activation ─────── */}
                {!isGoogleOnboarding && currentQuest.id === 'high_street_activation' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        Your business is joining <strong>{selectedBorough}</strong>'s digital ecosystem. Here's what's available in your area.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50/30">
                        <div className="flex items-center gap-3">
                          <Store className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-bold text-gray-800">High Street Status</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">ACTIVE</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50/30">
                        <div className="flex items-center gap-3">
                          <Globe className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-bold text-gray-800">Virtual Hub</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">LIVE</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-gray-200 bg-gray-50/30 opacity-70">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-gray-400" />
                          <span className="text-sm font-bold text-gray-500">Physical Hub</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">COMING SOON</span>
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-green-200 bg-green-50/30">
                        <div className="flex items-center gap-3">
                          <Users className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-bold text-gray-800">Community Group</span>
                        </div>
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">ACTIVE</span>
                      </div>
                    </div>

                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4">
                      <p className="text-xs text-amber-800 font-medium">
                        <strong>{proximityResult?.businessCount ?? '—'}</strong> active merchants in <strong>{selectedBorough}</strong>. Your store will be listed in the local directory.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowLearnMoreModal(true)}
                      className="text-sm text-orange-600 font-bold hover:underline cursor-pointer bg-transparent border-none mx-auto block"
                    >
                      Learn more about High Street Activation
                    </button>
                  </div>
                )}

                {/* ─── Step 5: Storefront Setup ─────── */}
                {!isGoogleOnboarding && currentQuest.id === 'storefront' && (
                  <div className="space-y-6">
                    <div className="bg-cyan-50/60 border border-cyan-100 rounded-xl p-4">
                      <p className="text-sm text-cyan-900 font-medium leading-relaxed">
                        Add photos and a description to make your storefront stand out. Don't worry about dimensions — auto-crop is active.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Business Name</label>
                      <Input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        className="h-12 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300"
                        placeholder="Your business name"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Short Description</label>
                      <textarea
                        value={formData.shortDescription}
                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 bg-white text-base placeholder:text-gray-300 p-3 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-0 outline-none resize-none"
                        placeholder="Tell customers what your business is about..."
                      />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-gray-800 tracking-tight mb-2">Brand Logo</p>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden"
                      >
                        {formData.logo ? (
                          <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-gray-800 tracking-tight mb-2">Cover Image</p>
                      <div
                        onClick={() => coverInputRef.current?.click()}
                        className="w-full aspect-[16/6] border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors overflow-hidden"
                      >
                        {coverImage ? (
                          <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <Image className="w-6 h-6 text-gray-400" />
                            <span className="text-xs text-gray-400 font-medium">Upload cover image</span>
                          </div>
                        )}
                      </div>
                      <input type="file" ref={coverInputRef} onChange={handleCoverChange} accept="image/*" className="hidden" />
                    </div>
                  </div>
                )}

                {/* ─── Step 6: Personal Details ─────── */}
                {currentQuest.id === 'details' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        Set up your account credentials. This information is used to secure your account and will appear as the primary contact for your business profile.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">First Name</label>
                      <p className="text-xs text-gray-500 -mt-1">Your personal first name for the account</p>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 pl-10 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                          placeholder="e.g. Jane"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Last Name</label>
                      <p className="text-xs text-gray-500 -mt-1">Your personal last name for the account</p>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 pl-10 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                          placeholder="e.g. Smith"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Phone Number</label>
                      <p className="text-xs text-gray-500 -mt-1">A contact number where customers and partners can reach you</p>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <Input
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 pl-10 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                          placeholder="+44 7700 900000"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Password</label>
                      <p className="text-xs text-gray-500 -mt-1">Choose a strong password to protect your account</p>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0 pr-10"
                          placeholder="At least 8 characters"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Confirm Password</label>
                      <p className="text-xs text-gray-500 -mt-1">Re-enter your password to make sure it's correct</p>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={formData.confirmPassword}
                          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                          className="h-12 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0 pr-10"
                          placeholder="Re-enter your password"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                      <div className="space-y-3 pt-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-5 w-5 shrink-0"
                          />
                          <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                            I accept the{' '}
                            <a href="/terms" target="_blank" className="text-orange-600 font-bold hover:underline">Terms of Service</a>
                          </span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={privacyAccepted}
                            onChange={(e) => setPrivacyAccepted(e.target.checked)}
                            className="mt-0.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 h-5 w-5 shrink-0"
                          />
                          <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">
                            I accept the{' '}
                            <a href="/privacy" target="_blank" className="text-orange-600 font-bold hover:underline">Privacy Policy</a>
                          </span>
                        </label>
                      </div>

                    {submitError && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">{submitError}</p>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ─── Step 4: Business Profile Setup ─── */}
                {currentQuest.id === 'profile' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Business Name
                      </label>
                      <Input
                        value={formData.businessName}
                        onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        className="h-12 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                        placeholder="Your business name"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Business Description
                      </label>
                      <textarea
                        value={formData.shortDescription}
                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                        className="w-full min-h-[5.5rem] p-3 rounded-xl border border-gray-200 bg-white text-base placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-300"
                        placeholder="Describe your business in a few sentences..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Business Phone Number
                      </label>
                      <Input
                        value={formData.businessPhone}
                        onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        className="h-12 rounded-xl border-gray-200 bg-white text-base placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                        placeholder="+44 7700 900000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                        Business Logo
                      </label>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoChange}
                        accept="image/*"
                        className="hidden"
                        id="logo-file-input"
                      />
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
                        style={{
                          minHeight: '8rem',
                          borderColor: formData.logo ? '#ea580c' : '#d1d5db',
                          backgroundColor: formData.logo ? '#fff7ed' : '#fafafa',
                        }}
                      >
                        {formData.logo ? (
                          <div className="flex flex-col items-center justify-center gap-2 py-4 px-4 w-full">
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="w-16 h-16 rounded-xl overflow-hidden shadow-md border border-orange-100 bg-white flex-shrink-0"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={formData.logo} alt="Business Logo Preview" className="w-full h-full object-cover" />
                            </motion.div>
                            <span className="font-bold text-orange-700 text-xs">Logo selected</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-5 gap-1.5">
                            <Upload className="w-8 h-8 text-gray-300" />
                            <span className="font-semibold text-gray-400 text-xs">Click to select your logo</span>
                            <span className="text-gray-300 text-[10px]">PNG, SVG, or JPG</span>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                )}

                {/* ─── Step 5: Business Type Selection ─── */}
                {currentQuest.id === 'business_type' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        Tell us how you operate so we can tailor your dashboard, set the right shipping and tax defaults, and recommend the best tools for your business.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                      {/* Option: Physical Store */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, businessOperation: 'physical', businessType: 'products' })}
                        className={`group relative flex flex-col items-start p-6 bg-white border rounded-2xl text-left transition-all duration-200 ${
                          formData.businessOperation === 'physical'
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                          formData.businessOperation === 'physical'
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                        }`}>
                          <Store className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-base">Physical Store</h3>
                        <p className="text-xs text-gray-505 mt-1 leading-relaxed">Brick-and-mortar retail space or showroom for customers.</p>
                        <div className={`absolute top-4 right-4 transition-all duration-200 ${
                          formData.businessOperation === 'physical'
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                        }`}>
                          <CheckCircle2 className="w-6 h-6 text-orange-600" />
                        </div>
                      </button>

                      {/* Option: Home Business */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, businessOperation: 'home', businessType: 'both' })}
                        className={`group relative flex flex-col items-start p-6 bg-white border rounded-2xl text-left transition-all duration-200 ${
                          formData.businessOperation === 'home'
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                          formData.businessOperation === 'home'
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                        }`}>
                          <Building2 className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-base">Home Business</h3>
                        <p className="text-xs text-gray-505 mt-1 leading-relaxed">Operated from a private residence with or without visitors.</p>
                        <div className={`absolute top-4 right-4 transition-all duration-200 ${
                          formData.businessOperation === 'home'
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                        }`}>
                          <CheckCircle2 className="w-6 h-6 text-orange-600" />
                        </div>
                      </button>

                      {/* Option: Mobile Business */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, businessOperation: 'mobile', businessType: 'services' })}
                        className={`group relative flex flex-col items-start p-6 bg-white border rounded-2xl text-left transition-all duration-200 ${
                          formData.businessOperation === 'mobile'
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                          formData.businessOperation === 'mobile'
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                        }`}>
                          <Truck className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-base">Mobile Business</h3>
                        <p className="text-xs text-gray-505 mt-1 leading-relaxed">Services provided at client locations or on-the-go.</p>
                        <div className={`absolute top-4 right-4 transition-all duration-200 ${
                          formData.businessOperation === 'mobile'
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                        }`}>
                          <CheckCircle2 className="w-6 h-6 text-orange-600" />
                        </div>
                      </button>

                      {/* Option: Online Business */}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, businessOperation: 'online', businessType: 'products' })}
                        className={`group relative flex flex-col items-start p-6 bg-white border rounded-2xl text-left transition-all duration-200 ${
                          formData.businessOperation === 'online'
                            ? 'border-orange-500 bg-orange-50/50 shadow-sm'
                            : 'border-gray-200 hover:border-orange-300'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
                          formData.businessOperation === 'online'
                            ? 'bg-orange-600 text-white'
                            : 'bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-white'
                        }`}>
                          <Globe className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-gray-900 text-base">Online Business</h3>
                        <p className="text-xs text-gray-550 mt-1 leading-relaxed">E-commerce, digital services, or remote operations.</p>
                        <div className={`absolute top-4 right-4 transition-all duration-200 ${
                          formData.businessOperation === 'online'
                            ? 'opacity-100 scale-100'
                            : 'opacity-0 scale-50'
                        }`}>
                          <CheckCircle2 className="w-6 h-6 text-orange-600" />
                        </div>
                      </button>
                    </div>

                    {/* Additional Context Illustration Card */}
                    <div className="w-full bg-[#fff1eb] rounded-2xl p-5 flex items-start sm:items-center gap-4 border border-[#e2bfb0]/30 shadow-sm">
                      <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-inner border border-white">
                        <img className="w-full h-full object-cover" alt="Merchant Tip Visual" src="https://lh3.googleusercontent.com/aida/AP1WRLuT-cyMk_5SJq4_a0IypGgxzxzf7ZCVGltAtELjippWSQEUd2rpwXQU_HINozI_SURzix0SJeEEH9T0LbAylYcLQ7BRkAg5ZQQp2cQ4ccljRzYxBERWKRaihouLxzvffrR7Tmv_welD8NB9nUgZuLnvMpq09tg7p_8CIlFL6iRRgryg1AEsc98zZoSfWJV-iBd1LIOaLJ8_AZUPcuYzNeTyV4AhUc10JNtLL3N9NHPZ26nmp5NQxWnYXWQ"/>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 leading-relaxed font-medium">
                          <strong className="text-orange-950 font-bold">Tip:</strong> You can change this later in your profile settings. This selection helps us automate your tax and shipping defaults.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Step 6: Category Selection ─── */}
                {currentQuest.id === 'category' && (
                  <div className="space-y-6">
                    <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
                      <p className="text-sm text-orange-900 font-medium leading-relaxed">
                        Choose the categories that best describe your business. This powers your dashboard insights, partnership recommendations, and how customers find you.
                      </p>
                    </div>

                    {sectorsError && (
                      <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-700 font-medium">Failed to load categories. Using offline data.</p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Sector</label>
                      <p className="text-xs text-gray-500 -mt-1">Choose the broad industry your business belongs to</p>
                      {sectorsLoading ? (
                        <div className="w-full h-12 rounded-xl bg-gray-100 animate-pulse" />
                      ) : (
                        <select
                          value={formData.sectorId}
                          onChange={(e) => setFormData({ ...formData, sectorId: e.target.value, categoryId: '', subCategoryId: '' })}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300"
                        >
                          <option value="">Select a Sector</option>
                          {sectors?.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Primary Category</label>
                      <p className="text-xs text-gray-500 -mt-1">Narrow down to the specific group within your sector</p>
                      {categoriesLoading ? (
                        <div className="w-full h-12 rounded-xl bg-gray-100 animate-pulse" />
                      ) : (
                        <select
                          value={formData.categoryId}
                          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value, subCategoryId: '' })}
                          disabled={!formData.sectorId}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select a Category</option>
                          {categories?.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-gray-800 tracking-tight">Business Type</label>
                      <p className="text-xs text-gray-500 -mt-1">Pick the exact type that matches your operations (optional)</p>
                      {subcategoriesLoading ? (
                        <div className="w-full h-12 rounded-xl bg-gray-100 animate-pulse" />
                      ) : (
                        <select
                          value={formData.subCategoryId}
                          onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                          disabled={!formData.categoryId}
                          className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:bg-gray-50 disabled:cursor-not-allowed"
                        >
                          <option value="">Select a Business Type</option>
                          {subcategories?.map(sc => (
                            <option key={sc.id} value={sc.id}>{sc.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── Step 7: Operating Hours ─── */}
                {currentQuest.id === 'hours' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-500 text-center mb-2">
                      You can set detailed day-by-day hours later in your dashboard.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData({ ...formData, isStandardHours: true, is247: false, isCustomHours: false })}
                        className="p-4 sm:p-5 rounded-xl border-2 text-left transition-colors outline-none flex flex-col items-center text-center justify-center"
                        style={{
                          borderColor: formData.isStandardHours && !formData.is247 && !formData.isCustomHours ? currentQuest.color : '#e5e7eb',
                          backgroundColor: formData.isStandardHours && !formData.is247 && !formData.isCustomHours ? currentQuest.colorLight : '#fff',
                        }}
                      >
                        <div className="font-bold text-gray-900 text-sm sm:text-base mb-1">Standard Hours</div>
                        <div className="text-xs text-gray-500">Mon-Fri, 9am - 5pm</div>
                      </motion.button>

                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData({ ...formData, isStandardHours: false, is247: true, isCustomHours: false })}
                        className="p-4 sm:p-5 rounded-xl border-2 text-left transition-colors outline-none flex flex-col items-center text-center justify-center"
                        style={{
                          borderColor: formData.is247 ? currentQuest.color : '#e5e7eb',
                          backgroundColor: formData.is247 ? currentQuest.colorLight : '#fff',
                        }}
                      >
                        <div className="font-bold text-gray-900 text-sm sm:text-base mb-1">Open 24/7</div>
                        <div className="text-xs text-gray-500">Always open</div>
                      </motion.button>

                      <motion.button
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData({ ...formData, isStandardHours: false, is247: false, isCustomHours: true })}
                        className="p-4 sm:p-5 rounded-xl border-2 text-left transition-colors outline-none flex flex-col items-center text-center justify-center"
                        style={{
                          borderColor: formData.isCustomHours ? currentQuest.color : '#e5e7eb',
                          backgroundColor: formData.isCustomHours ? currentQuest.colorLight : '#fff',
                        }}
                      >
                        <div className="font-bold text-gray-900 text-sm sm:text-base mb-1">Custom Setup</div>
                        <div className="text-xs text-gray-500">Set day-by-day</div>
                      </motion.button>
                    </div>

                    {/* Custom Hours Panel */}
                    <AnimatePresence>
                      {formData.isCustomHours && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 overflow-hidden"
                        >
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                            {formData.customHours.map((day, idx) => (
                              <div key={day.dayOfWeek} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => {
                                      const newHours = formData.customHours.map((h, i) => 
                                        i === idx ? { ...h, isOpen: !h.isOpen } : h
                                      );
                                      setFormData({ ...formData, customHours: newHours });
                                    }}
                                    className={`w-12 h-6 rounded-full p-1 transition-colors ${day.isOpen ? 'bg-orange-500' : 'bg-gray-300'}`}
                                  >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${day.isOpen ? 'translate-x-6' : 'translate-x-0'}`} />
                                  </button>
                                  <span className={`font-semibold text-sm ${day.isOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {day.name}
                                  </span>
                                </div>
                                
                                {day.isOpen ? (
                                  <div className="flex items-center gap-2 pl-14 sm:pl-0">
                                    <input
                                      type="time"
                                      value={day.openTime}
                                      onChange={(e) => {
                                        const newHours = formData.customHours.map((h, i) => 
                                          i === idx ? { ...h, openTime: e.target.value } : h
                                        );
                                        setFormData({ ...formData, customHours: newHours });
                                      }}
                                      className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                    />
                                    <span className="text-gray-400 text-sm">to</span>
                                    <input
                                      type="time"
                                      value={day.closeTime}
                                      onChange={(e) => {
                                        const newHours = formData.customHours.map((h, i) => 
                                          i === idx ? { ...h, closeTime: e.target.value } : h
                                        );
                                        setFormData({ ...formData, customHours: newHours });
                                      }}
                                      className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                                    />
                                  </div>
                                ) : (
                                  <div className="pl-14 sm:pl-0 text-sm text-gray-400 italic">
                                    Closed
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* ─── Service Step: Booking Preferences ─── */}
                {currentQuest.id === 'booking_prefs' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Booking Acceptance</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData({ ...formData, bookingAcceptance: 'auto' })}
                          className="p-4 rounded-xl border-2 text-left transition-colors flex items-center gap-3"
                          style={{
                            borderColor: formData.bookingAcceptance === 'auto' ? currentQuest.color : '#e5e7eb',
                            backgroundColor: formData.bookingAcceptance === 'auto' ? currentQuest.colorLight : '#fff',
                          }}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.bookingAcceptance === 'auto' ? 'border-orange-500' : 'border-gray-300'}`}>
                            {formData.bookingAcceptance === 'auto' && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">Auto-Accept</div>
                            <div className="text-[11px] text-gray-500">Confirm bookings instantly</div>
                          </div>
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormData({ ...formData, bookingAcceptance: 'manual' })}
                          className="p-4 rounded-xl border-2 text-left transition-colors flex items-center gap-3"
                          style={{
                            borderColor: formData.bookingAcceptance === 'manual' ? currentQuest.color : '#e5e7eb',
                            backgroundColor: formData.bookingAcceptance === 'manual' ? currentQuest.colorLight : '#fff',
                          }}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.bookingAcceptance === 'manual' ? 'border-orange-500' : 'border-gray-300'}`}>
                            {formData.bookingAcceptance === 'manual' && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm">Manual Review</div>
                            <div className="text-[11px] text-gray-500">You approve each request</div>
                          </div>
                        </motion.button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Minimum Notice Period</label>
                      <select
                        value={formData.minimumNotice}
                        onChange={(e) => setFormData({ ...formData, minimumNotice: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                      >
                        <option value="none">No notice required</option>
                        <option value="1h">1 Hour</option>
                        <option value="2h">2 Hours</option>
                        <option value="12h">12 Hours</option>
                        <option value="24h">24 Hours</option>
                        <option value="48h">48 Hours</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Cancellation Policy</label>
                      <textarea
                        value={formData.cancellationPolicy}
                        onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                        className="w-full h-20 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                        placeholder="e.g., Free cancellation up to 24 hours before the appointment."
                      />
                    </div>
                  </div>
                )}

                {/* ─── Service Step: Appointment Structure ─── */}
                {currentQuest.id === 'appointment_struct' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Buffer Time Between Appointments</label>
                      <p className="text-xs text-gray-500 mb-2">Time needed to clean up or travel to your next client.</p>
                      <select
                        value={formData.bufferTime}
                        onChange={(e) => setFormData({ ...formData, bufferTime: e.target.value })}
                        className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                      >
                        <option value="none">No buffer time</option>
                        <option value="5m">5 Minutes</option>
                        <option value="15m">15 Minutes</option>
                        <option value="30m">30 Minutes</option>
                        <option value="1h">1 Hour</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Max Daily Bookings (Optional)</label>
                      <Input
                        type="number"
                        min="1"
                        value={formData.maxDailyBookings}
                        onChange={(e) => setFormData({ ...formData, maxDailyBookings: e.target.value })}
                        placeholder="e.g., 5"
                        className="h-11 rounded-xl border-gray-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                )}

                {/* ─── Service Step: Service Zones ─── */}
                {currentQuest.id === 'service_zones' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Where do you provide services?</label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { id: 'in_store', label: 'At my business location', desc: 'Customers come to you' },
                          { id: 'mobile', label: 'At customer location (Mobile)', desc: 'You travel to the customer' },
                          { id: 'virtual', label: 'Online / Virtual', desc: 'Services provided remotely via video/call' }
                        ].map((model) => (
                          <motion.button
                            key={model.id}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setFormData({ ...formData, serviceFulfillmentModel: model.id as any })}
                            className="p-4 rounded-xl border-2 text-left transition-colors flex items-center gap-3"
                            style={{
                              borderColor: formData.serviceFulfillmentModel === model.id ? currentQuest.color : '#e5e7eb',
                              backgroundColor: formData.serviceFulfillmentModel === model.id ? currentQuest.colorLight : '#fff',
                            }}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${formData.serviceFulfillmentModel === model.id ? 'border-orange-500' : 'border-gray-300'}`}>
                              {formData.serviceFulfillmentModel === model.id && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900 text-sm">{model.label}</div>
                              <div className="text-[11px] text-gray-500">{model.desc}</div>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {formData.serviceFulfillmentModel === 'mobile' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="overflow-hidden pt-2"
                      >
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">Travel Radius (Miles)</label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.travelRadius}
                          onChange={(e) => setFormData({ ...formData, travelRadius: e.target.value })}
                          placeholder="e.g., 10"
                          className="h-11 rounded-xl border-gray-200 bg-white text-sm focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-0"
                        />
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ─── Step 8: Delivery & Pickup ─── */}
                {currentQuest.id === 'fulfillment' && (
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'pickup', label: 'Click & Collect', desc: 'Customers pick up in-store' },
                      { id: 'local_delivery', label: 'Local Delivery', desc: 'You deliver to nearby areas' },
                      { id: 'uk_shipping', label: 'National Shipping', desc: 'You post items UK-wide' }
                    ].map(mode => {
                      const isSelected = formData.sellingModes?.includes(mode.id);
                      return (
                        <motion.button
                          key={mode.id}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => {
                            const newModes = isSelected 
                              ? formData.sellingModes.filter(m => m !== mode.id)
                              : [...formData.sellingModes, mode.id];
                            // Ensure at least one is selected, or let it be empty?
                            setFormData({ ...formData, sellingModes: newModes });
                          }}
                          className={`flex items-center p-4 rounded-xl border-2 transition-colors outline-none ${isSelected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'}`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 ${isSelected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
                            {isSelected && <Check className="w-4 h-4 text-white" strokeWidth={3} />}
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-gray-900 text-sm sm:text-base">{mode.label}</div>
                            <div className="text-xs text-gray-500">{mode.desc}</div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ─── Navigation ──────────────────────────────── */}
        <div className="fixed bottom-4 left-4 right-4 p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-gray-200 shadow-2xl z-55 sm:static sm:bg-transparent sm:border-none sm:shadow-none sm:p-0 sm:mt-8">
          {submitError && !isGoogleOnboarding && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-3 max-w-2xl mx-auto"
            >
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{submitError}</p>
            </motion.div>
          )}
          <div className="max-w-2xl mx-auto flex items-center justify-between w-full">
            <button
              onClick={isGoogleOnboarding ? handleGoogleBack : handleBack}
              aria-label="Go back"
              className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all outline-none text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Skip button for optional steps */}
            {!isGoogleOnboarding && ['hours', 'booking_prefs', 'appointment_struct', 'service_zones', 'fulfillment'].includes(currentQuest.id) && (
              <button
                onClick={() => {
                  const next = new Set(completedSteps);
                  next.add(currentStep);
                  setCompletedSteps(next);
                  setParticleTrigger((p) => p + 1);
                  setTimeout(() => setCurrentStep((c) => c + 1), 300);
                }}
                className="flex items-center gap-1 text-sm font-semibold px-4 py-2.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
              >
                Skip
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            <motion.button
              whileHover={isSubmitting ? {} : { scale: 1.03 }}
              whileTap={isSubmitting ? {} : { scale: 0.97 }}
              onClick={isGoogleOnboarding 
                ? (googleStep === 'fail_safe_form' ? handleGoogleFailSafeSubmit : handleGoogleCompleteClaim) 
                : handleNext}
              disabled={
                isSubmitting || 
                (isGoogleOnboarding && googleStep === 'branch_select') ||
                (!isGoogleOnboarding && currentQuest.id === 'business_type' && !formData.businessOperation)
              }
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-white font-bold text-base transition-all outline-none disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              style={{
                backgroundColor: isGoogleOnboarding ? '#ea580c' : currentQuest.color,
                boxShadow: isSubmitting ? 'none' : `0 8px 24px -4px ${isGoogleOnboarding ? '#ea580c' : currentQuest.color}44`,
              }}
            >
              {isSubmitting ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  />
                  {isGoogleOnboarding ? 'Claiming...' : 'Registering...'}
                </>
              ) : (
                <>
                  {isGoogleOnboarding 
                    ? (googleStep === 'review_claim' ? 'Claim Business' : 'Continue')
                    : (currentStep === activeQuests.length - 1 ? 'Complete Setup' : 'Continue')}
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── Proximity Verification Modal ─────────────────── */}
      <AnimatePresence>
        {showProximityModal && proximityResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Glassmorphic backdrop with warm brand tint overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleModalContinue}
              className="absolute inset-0 backdrop-blur-md bg-orange-950/25"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 180 }}
              className="bg-white rounded-3xl w-full max-w-lg max-h-[85dvh] overflow-y-auto shadow-2xl relative z-10 border border-gray-100 flex flex-col"
            >
              {/* Top decorative gradient bar */}
              <div
                className={`h-2.5 bg-gradient-to-r ${proximityResult.status === 'active'
                    ? 'from-yellow-400 via-amber-500 to-orange-500 shadow-amber-500/30'
                    : 'from-orange-600 via-red-500 to-red-600 shadow-red-500/30'
                  }`}
              />

              <div className="p-5 sm:p-8 flex-1 flex flex-col items-center text-center">
                {/* Pulsing Icon */}
                <div className="relative mb-4">
                  <div
                    className={`w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white shadow-xl ${proximityResult.status === 'active'
                        ? 'from-yellow-400 via-amber-500 to-orange-500 shadow-amber-500/30'
                        : 'from-orange-650 via-red-500 to-red-600 shadow-red-500/30'
                      }`}
                  >
                    {proximityResult.status === 'active' ? (
                      <Building2 className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Globe className="w-8 h-8 animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Title & Subtitle */}
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-1 tracking-tight">
                  {proximityResult.status === 'active' ? 'Active Local Mall Found!' : 'Area Not Fully Active Yet'}
                </h3>
                <p className="text-gray-500 text-xs sm:text-sm px-2 mb-4">
                  {proximityResult.message}
                </p>

                {/* Verified Badge Details */}
                <div className="w-full bg-gray-50 rounded-2xl p-4 sm:p-6 mb-4 text-left border border-gray-100">
                  <h4 className="font-extrabold text-xs text-gray-400 uppercase tracking-widest mb-3">
                    Your positioning details:
                  </h4>
                  <ul className="space-y-3.5">
                    {proximityResult.status === 'active' ? (
                      <>
                        <li className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            Linked to {proximityResult.localMallName}
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            Active in the {proximityResult.resolvedArea} Borough network
                          </span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            Early access waitlist registration enabled
                          </span>
                        </li>
                        <li className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-orange-600" strokeWidth={3} />
                          </div>
                          <span className="text-sm font-semibold text-gray-600">
                            Digital-only store placement allowed in {proximityResult.resolvedArea || 'your region'}
                          </span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>

                {/* Action Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleModalContinue}
                  className={`w-full py-4 bg-gradient-to-r text-white text-base font-extrabold rounded-2xl hover:brightness-105 transition-all shadow-lg flex items-center justify-center gap-2 ${proximityResult.status === 'active'
                      ? 'from-yellow-400 via-amber-500 to-orange-500 shadow-amber-500/25'
                      : 'from-orange-600 via-red-500 to-red-650 shadow-red-500/25'
                    }`}
                >
                  Continue Setup
                  <ChevronRight className="w-5 h-5" />
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ImageCropModal
        open={cropModalOpen}
        imageSrc={cropModalSrc}
        aspect={cropModalAspect}
        title={cropModalTitle}
        onCancel={() => setCropModalOpen(false)}
        onApply={(dataUrl) => {
          if (cropModalTarget === 'logo') {
            setFormData((prev: any) => ({ ...prev, logo: dataUrl }));
          } else {
            setCoverImage(dataUrl);
          }
          setCropModalOpen(false);
        }}
        onSkip={() => {
          if (cropModalTarget === 'logo') {
            setFormData((prev: any) => ({ ...prev, logo: cropModalSrc }));
          } else {
            setCoverImage(cropModalSrc);
          }
          setCropModalOpen(false);
        }}
      />
      <HighStreetActivationModal open={showLearnMoreModal} onClose={() => setShowLearnMoreModal(false)} />
      <PlatformPaymentModal
        isOpen={showPlatformPaymentModal}
        onClose={() => {
          setShowPlatformPaymentModal(false);
          const onboardingState = localStorage.getItem('businessOnboardingState');
          if (onboardingState !== 'plan_selection') {
            localStorage.removeItem('pendingPlatformPurchase');
            setShowWelcomeChecklistPage(true);
          }
        }}
        onSuccess={() => {
          setShowPlatformPaymentModal(false);
          if (currentUser?.businessProfile?.id) {
            localStorage.removeItem('businessOnboardingState');
            localStorage.removeItem('onboardingPaymentSuccess');
            performSSORedirect();
            return;
          }
          const onboardingState = localStorage.getItem('businessOnboardingState');
          if (onboardingState === 'plan_selection' || onboardingState === 'assessment' || localStorage.getItem('onboardingPaymentSuccess') === 'true') {
            localStorage.setItem('businessOnboardingState', 'assessment');
            setShowChoosePlan(false);
            setShowInitialAssessment(true);
          } else {
            setShowWelcomeChecklistPage(true);
          }
        }}
      />
    </div>
  );
}

export default function BusinessOnboarding() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <BusinessOnboardingInner />
    </Suspense>
  );
}

// ============================================================================
// Internal Component: BuildingStorefrontPage (Immersive Loading)
// ============================================================================

const BUILDING_STEPS = [
  "Syncing Storefront",
  "Mapping Local Mall Placement",
  "Generating QR Links",
  "Configuring Rewards System",
  "Initializing Loyalty Engine",
  "Connecting to Borough",
  "Verifying High Street Connection",
  "Setting up Gamification"
];

function BuildingStorefrontPage({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(72);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p < 95) return p + 0.5;
        clearInterval(interval);
        return 100; // Finish the rest to 100
      });
    }, 100); 
    // 23 / 0.5 = 46 ticks. 46 * 100ms = 4.6 seconds.
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(t);
    }
  }, [progress, onComplete]);

  return (
    <div className="bg-orange-50/30 text-gray-900 min-h-screen flex flex-col font-sans">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress-shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
        }
        .animate-shimmer {
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%);
            background-size: 200% 100%;
            animation: progress-shimmer 2s infinite linear;
        }
        .progress-pulse {
            animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse-ring {
            0%, 100% { opacity: 1; }
            50% { opacity: .5; }
        }
        .loading-ring {
            border: 3px solid rgba(234, 88, 12, 0.1);
            border-top: 3px solid #ea580c;
            border-radius: 50%;
            width: 80px;
            height: 80px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
      `}} />

      {/* Main Content Canvas */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 pt-24 pb-12 max-w-[640px] mx-auto w-full">
        {/* Central Animation State */}
        <div className="relative flex flex-col items-center mb-6">
          <div className="loading-ring mb-4"></div>
          {/* Decorative pulses */}
          <div className="absolute -top-4 w-24 h-24 rounded-full border border-orange-600/10 progress-pulse"></div>
          <div className="absolute -top-8 w-32 h-32 rounded-full border border-orange-600/5 progress-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>

        {/* Typography Cluster */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            Building Your Storefront...
          </h1>
          <p className="text-base text-gray-500">
            We're importing your images, reviews, and details from Google.
          </p>
        </div>

        {/* Progress List */}
        <div className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4">
            <div className="flex flex-col gap-4">
              {/* Item 1: Complete */}
              <div className="flex items-center gap-4 transition-all duration-500 opacity-100">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                  <CheckCircle2 className="w-[16px] h-[16px] text-orange-800" />
                </div>
                <span className="text-sm text-gray-900">Business name imported</span>
              </div>
              {/* Item 2: Complete */}
              <div className="flex items-center gap-4 transition-all duration-500 opacity-100">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                  <CheckCircle2 className="w-[16px] h-[16px] text-orange-800" />
                </div>
                <span className="text-sm text-gray-900">12 images synced</span>
              </div>
              {/* Item 3: Active */}
              <div className="flex items-center gap-4 relative">
                <div className="w-6 h-6 flex items-center justify-center">
                  <div className="w-2 h-2 bg-orange-600 rounded-full animate-ping absolute"></div>
                  <div className="w-2 h-2 bg-orange-600 rounded-full relative"></div>
                </div>
                <span className="text-sm font-semibold text-orange-600">Contact details verified</span>
              </div>
              {/* Item 4: Pending */}
              <div className="flex items-center gap-4 opacity-40">
                <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-gray-200 rounded-full"></div>
                </div>
                <span className="text-sm text-gray-500">Opening hours set</span>
              </div>
            </div>
          </div>
          {/* Inline Modern Progress Bar */}
          <div className="bg-gray-100 h-1.5 w-full relative">
            <div className="absolute left-0 top-0 h-full bg-orange-600 transition-all duration-100 ease-linear overflow-hidden" style={{ width: `${progress}%` }}>
              <div className="w-full h-full animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Visual Context Card */}
        <div className="mt-6 w-full">
          <div className="relative h-32 rounded-xl overflow-hidden border border-gray-200 bg-gradient-to-tr from-amber-500/10 via-orange-500/10 to-transparent flex items-center justify-center">
            <Building2 className="w-12 h-12 text-orange-200/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-orange-50/30 via-transparent to-transparent"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-lg">
                <CloudDownload className="w-[20px] h-[20px] text-orange-600" />
                <span className="text-xs font-medium text-gray-900">Syncing assets...</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Operational Message */}
      <div className="fixed bottom-8 w-full text-center px-4">
        <p className="text-xs text-gray-500 italic opacity-60">
          This usually takes less than 30 seconds...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Internal Component: WelcomeChecklistPage (Final Destination)
// ============================================================================

function WelcomeChecklistPage({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    // Micro-interaction for celebration effect
    const container = document.getElementById('welcome-checklist-main');
    if (!container) return;
    const colors = ['#a23a00', '#8f4c30', '#005f9e'];
    
    for (let i = 0; i < 15; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'absolute w-2 h-2 rounded-full opacity-0 pointer-events-none';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = (Math.random() * 40) + '%';
        
        container.appendChild(confetti);
        
        confetti.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(${Math.random() * 200 + 100}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: Math.random() * 2000 + 1000,
            delay: Math.random() * 500,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            iterations: 1
        });
    }
  }, []);

  useEffect(() => {
    // Ensure we set mock cookies so the dashboard auth redirects don't kick them out
    if (!Cookies.get('access')) {
      Cookies.set('access', 'mock_access_token', { expires: 1 / 72 }); // 20 minutes
      Cookies.set('refresh', 'mock_refresh_token', { expires: 7 });
      Cookies.set('userId', 'mock_user_id', { expires: 7 });
      Cookies.set('userRole', 'owner', { expires: 7 });
      localStorage.setItem('user-name', 'Merchant Onboarding');
      
      // Also load auth into Redux store immediately
      dispatch(loadAuthFromCookies());
    }
  }, [dispatch]);

  return (
    <div className="bg-[#fff8f6] text-[#261812] font-sans min-h-screen relative overflow-x-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        .celebration-sparkle {
            position: absolute;
            pointer-events: none;
            animation: sparkle-float 3s ease-in-out infinite;
        }
        @keyframes sparkle-float {
            0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
            50% { transform: translateY(-20px) scale(1.2); opacity: 1; }
        }
        .gradient-mesh {
            background-color: #fff8f6;
            background-image: 
                radial-gradient(at 0% 0%, rgba(255, 169, 135, 0.15) 0px, transparent 50%),
                radial-gradient(at 100% 0%, rgba(162, 58, 0, 0.05) 0px, transparent 50%);
        }
      `}} />
      <div className="absolute inset-0 gradient-mesh -z-10"></div>
      
      {/* Top Navigation Anchor */}
      <header className="fixed top-0 w-full z-50 bg-[#fff8f6]/80 backdrop-blur-md border-b border-[#e2bfb0] h-16 flex justify-between items-center px-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-orange-600" style={{fontVariationSettings: "'FILL' 1"}} />
          <span className="font-bold text-lg text-orange-600 tracking-tight">MCOMMALL</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              localStorage.removeItem('businessOnboardingState');
              localStorage.removeItem('businessOnboarding');
              localStorage.removeItem('businessOnboardingStep');
              localStorage.removeItem('businessOnboardingCompleted');
              localStorage.removeItem('auth_token');
              localStorage.removeItem('business_user');
              localStorage.removeItem('pendingPlatformPurchase');
              localStorage.removeItem('onboardingPaymentSuccess');
              localStorage.removeItem('firstDashboardLogin');
              clearSharedAuthCookies();
              router.push('/login');
            }}
            className="text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors p-2 sm:px-3 sm:py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-sm font-medium text-gray-500 hover:bg-orange-50 transition-colors p-2 sm:px-3 sm:py-2 rounded-lg flex items-center gap-1"
            aria-label="Save & Exit"
          >
            <span className="hidden sm:inline">Save & Exit</span>
            <X className="w-5 h-5 sm:hidden" />
          </button>
        </div>
      </header>

      <main id="welcome-checklist-main" className="pt-24 pb-32 px-4 md:max-w-xl md:mx-auto relative">
        {/* Celebration Hero */}
        <section className="relative text-center mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="relative inline-block mb-4"
          >
            <div className="w-24 h-24 bg-[#ff6900] rounded-full flex items-center justify-center mx-auto shadow-lg relative z-10">
              <Trophy className="w-12 h-12 text-white" style={{fontVariationSettings: "'FILL' 1"}} />
            </div>
            {/* Animated Sparkles */}
            <Sparkles className="w-6 h-6 text-[#97481e] absolute -top-2 -right-2 celebration-sparkle" />
            <Sparkles className="w-8 h-8 text-[#00629f] absolute bottom-0 -left-4 celebration-sparkle" style={{animationDelay: '1s'}} />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-2"
          >
            Your Business Is Now Live On MCOMMALL
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-[#5a4136] text-sm px-4"
          >
            Congratulations! Your shop is now visible to the local community. It's time to build your operational velocity.
          </motion.p>
        </section>

        {/* Primary Action Cluster */}
        <section className="space-y-2 mb-8">
          <button onClick={onComplete} className="w-full bg-[#a14000] hover:bg-[#8f3800] text-white h-14 rounded-xl font-bold text-base shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            GO TO DASHBOARD
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => router.push('/dashboard/store')}
              className="bg-white border border-[#e2bfb0] text-[#261812] h-12 rounded-xl font-bold text-xs hover:bg-[#fff1ec] transition-colors flex items-center justify-center gap-2"
            >
              <Store className="w-5 h-5" />
              VIEW STOREFRONT
            </button>
            <button 
              onClick={() => {
                navigator.clipboard?.writeText(window.location.origin + '/store');
                alert('Store link copied to clipboard!');
              }}
              className="bg-white border border-[#e2bfb0] text-[#261812] h-12 rounded-xl font-bold text-xs hover:bg-[#fff1ec] transition-colors flex items-center justify-center gap-2"
            >
              <Share2 className="w-5 h-5" />
              SHARE
            </button>
          </div>
        </section>

        {/* Welcome Checklist Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-bold text-lg text-[#261812]">Welcome Checklist</h2>
            <span className="text-[#a14000] text-xs font-bold">0/6 COMPLETE</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {/* Item: Products */}
            <div 
              onClick={() => router.push('/dashboard/store/products/add-product')}
              className="bg-white p-4 rounded-xl border border-[#e2bfb0] shadow-sm flex flex-col gap-2 group hover:border-[#a14000] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#fff1ec] rounded-lg flex items-center justify-center text-[#a14000]">
                  <Package className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-[#261812]">Add first product</h3>
                  <p className="text-[#5a4136] text-sm leading-tight">Populate your inventory for customers to browse and buy.</p>
                </div>
              </div>
              <button className="w-full bg-[#ff9969] text-[#773005] h-10 rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all uppercase">
                ADD PRODUCT
              </button>
            </div>

            {/* Item: Services */}
            <div 
              onClick={() => router.push('/dashboard/services/add-service?fromOnboarding=true')}
              className="bg-white p-4 rounded-xl border border-[#e2bfb0] shadow-sm flex flex-col gap-2 group hover:border-[#a14000] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#fff1ec] rounded-lg flex items-center justify-center text-[#a14000]">
                  <Calendar className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-[#261812]">Add first service</h3>
                  <p className="text-[#5a4136] text-sm leading-tight">Set up booking slots and service descriptions.</p>
                </div>
              </div>
              <button className="w-full bg-[#ff9969] text-[#773005] h-10 rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all uppercase">
                ADD SERVICE
              </button>
            </div>

            {/* Item: Promotions */}
            <div 
              onClick={() => router.push('/dashboard/promotions/new')}
              className="bg-white p-4 rounded-xl border border-[#e2bfb0] shadow-sm flex flex-col gap-2 group hover:border-[#a14000] transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#fff1ec] rounded-lg flex items-center justify-center text-[#a14000]">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-[#261812]">Create first promotion</h3>
                  <p className="text-[#5a4136] text-sm leading-tight">Launch a 'Grand Opening' discount to drive traffic.</p>
                </div>
              </div>
              <button className="w-full bg-[#ff9969] text-[#773005] h-10 rounded-lg text-xs font-bold hover:bg-opacity-90 transition-all uppercase">
                CREATE PROMOTION
              </button>
            </div>

            {/* Secondary items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              <div 
                onClick={() => router.push('/dashboard/loyalty')}
                className="bg-[#ffffff] border border-[#e2bfb0] p-4 rounded-xl flex flex-col items-center text-center gap-2 hover:border-[#a14000] cursor-pointer transition-colors"
              >
                <Award className="w-6 h-6 text-[#a14000]" />
                <p className="text-xs text-[#261812] font-bold">Enable rewards</p>
                <span className="text-[#a14000] text-xs font-bold">ACTIVATE</span>
              </div>
              <div 
                onClick={() => router.push('/dashboard')}
                className="bg-[#ffffff] border border-[#e2bfb0] p-4 rounded-xl flex flex-col items-center text-center gap-2 hover:border-[#a14000] cursor-pointer transition-colors"
              >
                <Gamepad2 className="w-6 h-6 text-[#a14000]" />
                <p className="text-xs text-[#261812] font-bold">Launch gamification</p>
                <span className="text-[#a14000] text-xs font-bold">SET UP</span>
              </div>
              <div 
                onClick={() => router.push('/dashboard')}
                className="bg-[#ffffff] border border-[#e2bfb0] p-4 rounded-xl flex flex-col items-center text-center gap-2 hover:border-[#a14000] cursor-pointer transition-colors"
              >
                <UserPlus className="w-6 h-6 text-[#a14000]" />
                <p className="text-xs text-[#261812] font-bold">Invite customers</p>
                <span className="text-[#a14000] text-xs font-bold">SEND INVITE</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer Identity */}
        <section className="mt-6 text-center pt-6 border-t border-[#e2bfb0] opacity-70">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Landmark className="w-4 h-4 text-[#a14000]/60" />
            <span className="font-bold text-[10px] text-[#5a4136] tracking-widest uppercase">Official High Street Merchant</span>
          </div>
          <p className="text-[10px] text-[#5a4136]">Powered by MCOMMALL Urban Connectivity Platform</p>
        </section>
      </main>
    </div>
  );
}
