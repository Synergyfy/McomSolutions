import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, RefreshCw, CreditCard, Lock, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { paymentApi } from '../../services/payment';
import './VerificationPaymentModal.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

function StripeVerificationForm({
  amount,
  trialDays,
  onSuccess,
}: {
  amount: number;
  trialDays: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStripeReady, setIsStripeReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      const returnUrl = `${window.location.origin}/payment/success?verification=true&onboarding=true`;

      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: returnUrl,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'Verification confirmation failed. Please check your card details.');
        setIsProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const confirmRes = await paymentApi.verificationStripeConfirm(paymentIntent.id);
        
        // Update local session storage
        const userRaw = localStorage.getItem('business_user');
        if (userRaw) {
          try {
            const u = JSON.parse(userRaw);
            if (u?.businessProfile) {
              u.businessProfile.hasPaidVerificationFee = true;
              u.businessProfile.trialAccessDays = confirmRes.trialAccessDays || trialDays;
              u.businessProfile.trialAccessExpiresAt = confirmRes.trialAccessExpiresAt;
              localStorage.setItem('business_user', JSON.stringify(u));
            }
          } catch (e) {
            console.warn('Failed to update local user profile:', e);
          }
        }

        onSuccess();
      } else {
        setError('Verification payment status: ' + (paymentIntent?.status || 'pending') + '. Please try again.');
        setIsProcessing(false);
      }
    } catch (err: any) {
      console.error('Stripe verification submission error:', err);
      setError(err?.response?.data?.message || err?.message || 'Verification failed. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="verification-payment-form">
      <div className="verification-payment-element">
        <PaymentElement
          onReady={() => setIsStripeReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
        {!isStripeReady && (
          <div className="verification-payment-loading-inline">
            <RefreshCw className="verification-spin" />
            Loading secure payment form...
          </div>
        )}
      </div>

      {error && (
        <div className="verification-payment-error">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing || !isStripeReady}
        className={`verification-submit-button${isProcessing || !stripe || !isStripeReady ? ' is-disabled' : ''}`}
      >
        {isProcessing ? (
          <>
            <RefreshCw className="verification-spin" />
            Verifying Card & Unlocking Access...
          </>
        ) : (
          <>
            <Lock className="verification-icon" />
            Pay £{amount.toFixed(2)} &amp; Start {trialDays}-Day Trial
          </>
        )}
      </button>
    </form>
  );
}

export default function VerificationPaymentModal({
  open,
  trialDays = 14,
  amount = 1.00,
  onClose,
  onSuccess,
}: {
  open: boolean;
  trialDays?: number;
  amount?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [provider, setProvider] = useState<'stripe' | 'paypal'>('stripe');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setInitError(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const initStripe = async () => {
      setLoading(true);
      setInitError(null);
      try {
        const res = await paymentApi.verificationStripeInitiate();
        if (isMounted) {
          setClientSecret(res.clientSecret);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Failed to initiate verification payment:', err);
          setInitError(err?.response?.data?.message || 'Failed to initialize verification checkout.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initStripe();
    return () => {
      isMounted = false;
    };
  }, [open]);

  const handlePaypalSubmit = async () => {
    setPaypalLoading(true);
    setInitError(null);
    try {
      const returnUrl = `${window.location.origin}/payment/paypal/return?type=verification&onboarding=true`;
      const cancelUrl = `${window.location.origin}/getstarted/business`;
      const res = await paymentApi.verificationPaypalInitiate(returnUrl, cancelUrl);
      if (res?.approvalUrl) {
        window.location.href = res.approvalUrl;
      } else {
        setInitError('Failed to get PayPal approval URL.');
      }
    } catch (err: any) {
      console.error('PayPal initiation failed:', err);
      setInitError(err?.response?.data?.message || 'PayPal payment initialization failed.');
    } finally {
      setPaypalLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="verification-modal-overlay">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        role="dialog"
        aria-modal="true"
        aria-label="Verification payment"
        className="verification-modal-dialog"
      >
        <div className="verification-modal-header">
          <div className="verification-modal-orbit verification-modal-orbit--blue" />
          <div className="verification-modal-orbit verification-modal-orbit--orange" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close verification"
            className="verification-modal-close"
          >
            <X className="verification-icon verification-icon--large" />
          </button>

          <div className="verification-modal-brand">
            <img src="/chs-icon.png" alt="" />
            <div>
              <p className="verification-modal-eyebrow">Business onboarding · Verification</p>
              <h2 className="verification-modal-title">Your details are ready</h2>
              <p className="verification-modal-description">Complete the one-time verification to continue to membership options.</p>
            </div>
          </div>
        </div>

        <div className="verification-modal-body">
          <section className="verification-payment-panel">
                <div className="verification-payment-intro">
                  <h3>Choose a payment method</h3>
                  <p>Your payment is handled securely by our checkout provider.</p>
                </div>

                <div className="verification-provider-list">
                  <button
                    type="button"
                    onClick={() => { setProvider('stripe'); setInitError(null); }}
                    className={`verification-provider-button${provider === 'stripe' ? ' verification-provider-button--stripe-active' : ''}`}
                  >
                    <CreditCard className="verification-icon verification-icon--blue" />
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProvider('paypal'); setInitError(null); }}
                    className={`verification-provider-button${provider === 'paypal' ? ' verification-provider-button--paypal-active' : ''}`}
                  >
                    <span className="verification-paypal-mark">P</span>
                    PayPal
                  </button>
                </div>

                {initError && (
                  <div className="verification-payment-error" role="alert">
                    <span>⚠️</span>
                    <span>{initError}</span>
                  </div>
                )}

                {provider === 'stripe' && (
                  <div className="verification-checkout-area">
                    {loading ? (
                      <div className="verification-checkout-loading">
                        <RefreshCw className="verification-spin verification-spin--large" />
                        Preparing secure card checkout…
                      </div>
                    ) : clientSecret ? (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: 'stripe',
                            variables: {
                              colorPrimary: '#ea580c',
                              borderRadius: '12px',
                              fontFamily: 'Outfit, system-ui, sans-serif',
                            },
                          },
                        }}
                      >
                        <StripeVerificationForm amount={amount} trialDays={trialDays} onSuccess={onSuccess} />
                      </Elements>
                    ) : !initError ? (
                      <div className="verification-checkout-unavailable">
                        Card checkout could not be loaded. Try PayPal or close this window and try again.
                      </div>
                    ) : null}
                  </div>
                )}

                {provider === 'paypal' && (
                  <div className="verification-checkout-area verification-paypal-checkout">
                    <div className="verification-paypal-note">
                      <h4>PayPal checkout</h4>
                      <p>You’ll be redirected to PayPal to approve the one-time £{amount.toFixed(2)} verification fee.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePaypalSubmit}
                      disabled={paypalLoading}
                      className={`verification-paypal-button${paypalLoading ? ' is-disabled' : ''}`}
                    >
                      {paypalLoading ? <><RefreshCw className="verification-spin" /> Connecting to PayPal…</> : <>Pay £{amount.toFixed(2)} with PayPal <ArrowRight className="verification-icon" /></>}
                    </button>
                  </div>
                )}
          </section>
        </div>

        <div className="verification-modal-footer">
          <span><Lock className="verification-icon verification-icon--small verification-icon--blue" />Secure checkout</span>
          <span className="verification-footer-separator">•</span><span>No recurring verification charge</span>
          <span className="verification-footer-separator">•</span>
          <button type="button" onClick={onClose}>Back to programme</button>
        </div>
      </motion.div>
    </div>
  );
}
