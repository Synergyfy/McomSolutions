import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, XCircle } from 'lucide-react';
import { usePaypalCapture } from '../services/payment/hooks';
import { apiClient } from '../services/api';

export default function PayPalReturnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const { mutateAsync: capturePaypal } = usePaypalCapture();

  useEffect(() => {
    const orderId = searchParams.get('token'); // PayPal sends `token` as the order ID
    const plan = searchParams.get('plan') || 'Bronze';
    const platform = searchParams.get('platform'); // If present, it's a platform purchase

    if (!orderId) {
      setStatus('error');
      setErrorMessage('No PayPal order ID found. Please try again.');
      return;
    }

    const capture = async () => {
      try {
        let result: any;

        if (platform) {
          // Platform purchase — use platform capture endpoint
          const res = await apiClient.post('/payment/platform/paypal/capture', { orderId });
          result = res.data;
        } else {
          // Legacy membership purchase
          result = await capturePaypal(orderId);
        }

        // Update localStorage with new membership
        const userRaw = localStorage.getItem('business_user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          const updatedUser = {
            ...user,
            businessProfile: {
              ...user.businessProfile,
              membershipLevel: result.membershipLevel || plan,
              membershipTier: result.membershipTier || 'Normal',
              membershipStatus: result.membershipStatus || 'active',
            },
          };
          localStorage.setItem('business_user', JSON.stringify(updatedUser));
          document.cookie = `packageInfo=${encodeURIComponent(JSON.stringify({ planType: result.membershipLevel || plan }))}; path=/; max-age=604800`;
        }

        // Clean up pending purchase
        localStorage.removeItem('pendingPlatformPurchase');

        setStatus('success');
        
        const onboarding = searchParams.get('onboarding') === 'true';
        const source = searchParams.get('source') || '';
        const redirect = searchParams.get('redirect') || '';

        if (onboarding) {
          localStorage.setItem('onboardingPaymentSuccess', 'true');
          
          // Check if user already has a business profile
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

          if (!hasBusinessProfile) {
            localStorage.setItem('businessOnboardingState', 'assessment');
          } else {
            localStorage.removeItem('businessOnboardingState');
          }
          setTimeout(() => navigate(`/getstarted/business?source=${encodeURIComponent(source)}&redirect=${encodeURIComponent(redirect)}`), 2500);
        } else {
          setTimeout(() => navigate('/dashboard'), 2500);
        }
      } catch (err: any) {
        console.error('PayPal capture error:', err);
        setStatus('error');
        setErrorMessage(err.response?.data?.message || 'Payment capture failed. Please contact support.');
      }
    };

    capture();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 pt-32 pb-24">
      <div className="bg-white border border-gray-100 rounded-[3rem] p-14 shadow-sm max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-brand-blue animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Verifying Payment</h2>
            <p className="text-gray-500 font-medium">Please wait while we confirm your PayPal transaction...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Confirmed!</h2>
            <p className="text-gray-500 font-medium mb-6">Your MCOM membership has been activated across the ecosystem.</p>
            <div className="flex items-center justify-center gap-2 text-brand-blue text-sm font-bold">
              <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Dashboard...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-500 font-medium mb-6">{errorMessage}</p>
            <button
              onClick={() => navigate('/pricing')}
              className="px-8 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:bg-blue-600 transition-all"
            >
              Back to Pricing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
