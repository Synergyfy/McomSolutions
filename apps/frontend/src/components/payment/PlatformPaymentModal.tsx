import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, RefreshCw, CreditCard, CheckCircle2, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient } from '../../services/api';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function PaymentForm({
  clientSecret,
  onSuccess,
  onError,
  onCancel,
  planName,
  amount,
}: {
  clientSecret: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  onCancel: () => void;
  planName: string;
  amount?: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    const pending = localStorage.getItem('pendingPlatformPurchase');
    let returnUrl = window.location.origin + '/payment/success';
    if (pending) {
      try {
        const purchase = JSON.parse(pending);
        returnUrl += `?platform=${encodeURIComponent(purchase.platform)}&onboarding=true&source=${encodeURIComponent(purchase.source || '')}&redirect=${encodeURIComponent(purchase.redirect || '')}`;
      } catch (err) {
        console.error('Error parsing pending platform purchase for return URL:', err);
      }
    }

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setIsProcessing(false);
    } else {
      const pending = localStorage.getItem('pendingPlatformPurchase');
      if (pending && paymentIntent?.id) {
        try {
          const purchase = JSON.parse(pending);
          await apiClient.post('/payment/platform/stripe/confirm', {
            platform: purchase.platform,
            externalPlanId: purchase.externalPlanId,
            billingCycle: purchase.billingCycle,
            paymentIntentId: paymentIntent.id,
          });
          onSuccess();
        } catch (confirmErr: any) {
          console.error('Failed to confirm payment with backend:', confirmErr);
          setError(confirmErr?.response?.data?.message || 'Payment confirmed by bank, but failed to activate subscription. Please contact support.');
          setIsProcessing(false);
        }
      } else {
        onSuccess();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-orange-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Complete Payment</h2>
        <p className="text-sm text-gray-500 mt-1">
          {planName}{amount ? ` — £${amount}` : ''}
        </p>
      </div>

      <div className="relative min-h-[250px] flex flex-col justify-center">
        {!isStripeReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 py-8">
            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-4" />
            <p className="text-gray-500 font-medium text-sm">Loading secure payment form...</p>
          </div>
        )}
        <PaymentElement onReady={() => setIsStripeReady(true)} />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 py-3 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> Processing...
            </>
          ) : (
            'Pay Now'
          )}
        </button>
      </div>
    </form>
  );
}

export default function PlatformPaymentModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [planName, setPlanName] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsPaymentSuccess(false);

    const pending = localStorage.getItem('pendingPlatformPurchase');
    if (!pending) {
      onClose();
      return;
    }

    const purchase = JSON.parse(pending);
    setPlanName(purchase.planName || 'Platform Plan');
    setProvider(purchase.provider || 'stripe');

    const initiatePayment = async () => {
      try {
        const paymentData = {
          platform: purchase.platform,
          externalPlanId: purchase.externalPlanId,
          billingCycle: purchase.billingCycle,
          returnUrl: `${window.location.origin}/payment/success?platform=${encodeURIComponent(purchase.platform)}`,
          cancelUrl: `${window.location.origin}/getstarted/business?source=${purchase.source || ''}`,
        };

        if (purchase.provider === 'paypal') {
          // PayPal — redirect to approval URL
          const res = await apiClient.post('/payment/platform/paypal/initiate', paymentData);
          const data = res.data;
          if (data?.approvalUrl) {
            window.location.href = data.approvalUrl;
            return;
          }
        } else {
          // Stripe — show Elements card form
          const res = await apiClient.post('/payment/platform/stripe/initiate', paymentData);
          const data = res.data;
          if (data?.clientSecret) {
            setClientSecret(data.clientSecret);
            if (data.plan?.monthlyPrice) {
              const price = purchase.billingCycle === 'annual' ? data.plan.annualPrice : data.plan.quarterlyPrice;
              setAmount(price || data.plan.monthlyPrice);
            }
          }
        }
      } catch (err: any) {
        console.error('Payment initiation error:', err);
        setPaymentError(err?.response?.data?.message || 'Failed to initiate payment');
      } finally {
        setIsLoading(false);
      }
    };

    initiatePayment();
  }, [isOpen, onClose]);

  const handleSuccess = () => {
    localStorage.setItem('onboardingPaymentSuccess', 'true');
    localStorage.removeItem('pendingPlatformPurchase');
    localStorage.removeItem('stripeClientSecret');
    setIsPaymentSuccess(true);
  };

  const handleNext = () => {
    onSuccess();
  };

  const handleClose = () => {
    if (isPaymentSuccess) {
      handleNext();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 relative max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>

          <div className="overflow-y-auto flex-1 pr-1 pt-2 space-y-4">

          {isPaymentSuccess ? (
            <div className="text-center py-8">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </motion.div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-sm text-gray-500 mb-8 max-w-xs mx-auto">
                Your package has been activated. Let's configure your onboarding profile next.
              </p>
              <button
                onClick={handleNext}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 duration-100 flex items-center justify-center gap-2"
              >
                Continue to Assessment <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-4" />
                  <p className="text-gray-500 font-medium">Preparing payment...</p>
                </div>
              )}

              {paymentError && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Payment Error</h3>
                  <p className="text-sm text-gray-500 mb-6">{paymentError}</p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all"
                  >
                    Close
                  </button>
                </div>
              )}

              {!isLoading && !paymentError && clientSecret && (
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'stripe',
                      variables: {
                        colorPrimary: '#f97316',
                        borderRadius: '12px',
                      },
                    },
                  }}
                >
                  <PaymentForm
                    clientSecret={clientSecret}
                    onSuccess={handleSuccess}
                    onError={(msg) => setPaymentError(msg)}
                    onCancel={handleClose}
                    planName={planName}
                    amount={amount}
                  />
                </Elements>
              )}
            </>
          )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
