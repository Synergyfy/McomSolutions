import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Check, XCircle } from 'lucide-react';
import { apiClient } from '../services/api';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const paymentIntentId = searchParams.get('payment_intent');
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
    const platform = searchParams.get('platform');

    if (!paymentIntentId && !platform) {
      // No payment intent — might be a direct visit
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2000);
      return;
    }

    if (platform && paymentIntentId) {
      // Platform purchase — confirm with backend
      const pending = localStorage.getItem('pendingPlatformPurchase');
      if (pending) {
        const purchase = JSON.parse(pending);
        apiClient.post('/payment/platform/stripe/confirm', {
          platform: purchase.platform,
          externalPlanId: purchase.externalPlanId,
          billingCycle: purchase.billingCycle,
          paymentIntentId,
        }).then(() => {
          localStorage.removeItem('pendingPlatformPurchase');
          localStorage.removeItem('stripeClientSecret');
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
        }).catch((err) => {
          console.error('Payment confirm error:', err);
          setStatus('error');
          setErrorMessage(err.response?.data?.message || 'Payment confirmation failed.');
        });
      } else {
        setStatus('success');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } else {
      setStatus('success');
      setTimeout(() => navigate('/dashboard'), 2000);
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="bg-white border border-gray-100 rounded-[3rem] p-14 shadow-sm max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Confirming Payment</h2>
            <p className="text-gray-500 font-medium">Please wait while we verify your transaction...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-600 stroke-[3]" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Payment Confirmed!</h2>
            <p className="text-gray-500 font-medium mb-6">Your plan has been activated.</p>
            <div className="flex items-center justify-center gap-2 text-orange-500 text-sm font-bold">
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
              onClick={() => navigate('/dashboard')}
              className="px-8 py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
