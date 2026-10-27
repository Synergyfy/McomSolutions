import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion } from 'motion/react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Wallet,
  X,
} from 'lucide-react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { cn } from '../../lib/utils'
import type { BusinessAccessPlan } from '../../services/access'
import { useAccessConflict } from '../../services/access/hooks'
import {
  useAccessPaypalInitiate,
  useAccessStripeConfirm,
  useAccessStripeInitiate,
  useAccessWalletPurchase,
} from '../../services/payment/hooks'
import { useMyWallet } from '../../services/wallet/hooks'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')

type PurchaseMode = 'SELF' | 'GIFT' | 'CODE'
type Provider = 'stripe' | 'paypal' | 'wallet'

interface AccessCodePaymentResult {
  success: boolean
  type: 'access_code'
  mode: string
  code: string
  planName: string
  recipientEmail?: string | null
  amount: number
  currency: string
  emailSent: boolean
  status: string
}

interface AccessPassPaymentModalProps {
  plan: BusinessAccessPlan
  /** ISO date / timestamp the plan is already active until, when renewing. */
  activeUntil?: string | number | null
  onClose: () => void
  onSuccess: (result: AccessCodePaymentResult | Record<string, unknown>) => void
}

const DAY_MS = 24 * 60 * 60 * 1000

const formatDate = (value?: string | number | Date | null) => {
  if (value === null || value === undefined) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const newIdempotencyKey = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `access-${Date.now()}-${Math.random().toString(36).slice(2)}`

const paymentErrorMessage = (err: any, fallback: string) => {
  const raw = err?.response?.data?.message
  if (Array.isArray(raw)) return raw.join(', ')
  if (raw) return String(raw)
  if (err?.code === 'ERR_NETWORK' || String(err?.message).toLowerCase() === 'network error') {
    return 'Could not reach the payment server. Check your connection and try again.'
  }
  return err?.message || fallback
}

export default function AccessPassPaymentModal({
  plan,
  activeUntil,
  onClose,
  onSuccess,
}: AccessPassPaymentModalProps) {
  const [mode, setMode] = useState<PurchaseMode>('SELF')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [provider, setProvider] = useState<Provider>('stripe')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AccessCodePaymentResult | Record<string, unknown> | null>(null)
  const [copied, setCopied] = useState(false)
  const [usePassInstead, setUsePassInstead] = useState(false)
  const idempotencyKey = useRef(newIdempotencyKey())

  const stripeInitiate = useAccessStripeInitiate()
  const paypalInitiate = useAccessPaypalInitiate()
  const walletPurchase = useAccessWalletPurchase()
  const { data: wallet } = useMyWallet()
  const { data: conflictRes, isLoading: conflictLoading } = useAccessConflict(
    mode === 'SELF' ? plan.id : null,
  )
  const conflict = conflictRes?.data
  const hasMembershipConflict = mode === 'SELF' && !!conflict?.hasConflict
  const entitlementChoice = hasMembershipConflict
    ? usePassInstead
      ? ('access_pass' as const)
      : ('membership' as const)
    : undefined

  const amountText = `£${Number(plan.price).toFixed(2)}`
  const renewalActiveUntil =
    activeUntil !== null && activeUntil !== undefined ? new Date(activeUntil) : null
  const isRenewal =
    mode === 'SELF' &&
    !!renewalActiveUntil &&
    !Number.isNaN(renewalActiveUntil.getTime()) &&
    renewalActiveUntil.getTime() > Date.now()
  const renewalEndsAt = isRenewal
    ? new Date(renewalActiveUntil!.getTime() + plan.durationDays * DAY_MS)
    : null
  const resultRecord = result as Record<string, any> | null
  const resultRenewal = Boolean(resultRecord?.renewal)
  const resultExpiresAt = resultRecord?.expiresAt ?? null
  const busy = stripeInitiate.isPending || paypalInitiate.isPending || walletPurchase.isPending
  const codeResult = result && (result as AccessCodePaymentResult).type === 'access_code'
    ? (result as AccessCodePaymentResult)
    : null
  const pendingActivation = Boolean(result && (result as any).pendingActivation)

  useEffect(() => {
    setMode('SELF')
    setRecipientEmail('')
    setProvider('stripe')
    setClientSecret(null)
    setError(null)
    setResult(null)
    setCopied(false)
    setUsePassInstead(false)
    idempotencyKey.current = newIdempotencyKey()
  }, [plan.id])

  useEffect(() => {
    if (mode !== 'SELF') setUsePassInstead(false)
  }, [mode])

  const resetPayment = (nextMode: PurchaseMode) => {
    setMode(nextMode)
    setClientSecret(null)
    setError(null)
    setResult(null)
    idempotencyKey.current = newIdempotencyKey()
  }

  const validate = () => {
    if (mode === 'GIFT' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())) {
      setError('Enter a valid recipient email address.')
      return false
    }
    return true
  }

  const finish = (value: AccessCodePaymentResult | Record<string, unknown>) => {
    setResult(value)
    onSuccess(value)
  }

  const startPayment = async () => {
    setError(null)
    if (!validate()) return

    try {
      if (provider === 'stripe') {
        const response = await stripeInitiate.mutateAsync({
          accessPlanId: plan.id,
          purchaseMode: mode,
          recipientEmail: mode === 'GIFT' ? recipientEmail.trim() : undefined,
          entitlementChoice,
        })
        if (!response?.clientSecret) {
          throw new Error('Stripe did not return a payment intent.')
        }
        setClientSecret(response.clientSecret)
        return
      }

      if (provider === 'paypal') {
        const origin = window.location.origin
        const response = await paypalInitiate.mutateAsync({
          accessPlanId: plan.id,
          purchaseMode: mode,
          recipientEmail: mode === 'GIFT' ? recipientEmail.trim() : undefined,
          entitlementChoice,
          returnUrl: `${origin}/dashboard/access-passes?paypal=access`,
          cancelUrl: `${origin}/dashboard/access-passes?paypal=cancelled`,
        })
        if (!response?.approvalUrl) {
          throw new Error('PayPal did not return an approval link.')
        }
        window.location.href = response.approvalUrl
        return
      }

      const response = await walletPurchase.mutateAsync({
        data: {
          accessPlanId: plan.id,
          purchaseMode: mode,
          recipientEmail: mode === 'GIFT' ? recipientEmail.trim() : undefined,
          entitlementChoice,
        },
        idempotencyKey: idempotencyKey.current,
      })
      finish(response)
    } catch (err: any) {
      setError(paymentErrorMessage(err, 'Payment could not be started.'))
    }
  }

  const copyCode = async () => {
    if (!codeResult) return
    try {
      await navigator.clipboard.writeText(codeResult.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setError('Could not copy the code. Please copy it manually.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-gray-100 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-orange-600 to-amber-600 p-6 text-white">
          <div>
            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              {plan.durationDays} days access
            </span>
            <h2 className="mt-2 text-2xl font-black">{plan.name}</h2>
            <p className="mt-0.5 text-sm text-white/80">One-off payment · No auto-renewal</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-1.5 hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {codeResult ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Payment successful</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {codeResult.emailSent && codeResult.recipientEmail
                    ? `Your access pass code was emailed to ${codeResult.recipientEmail}.`
                    : 'Your access pass code is ready. Share or redeem it whenever you like.'}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Access pass code</p>
                <p className="mt-1 font-mono text-2xl font-black tracking-[0.12em] text-gray-900">
                  {codeResult.code}
                </p>
              </div>
              <button
                onClick={copyCode}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy code'}
              </button>
              <p className="text-xs text-gray-500">
                The pass does not start until the code is redeemed on this page.
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm font-bold text-gray-700"
              >
                Done
              </button>
            </div>
          ) : result ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">
                  {pendingActivation
                    ? 'Access pass saved'
                    : resultRenewal
                      ? 'Access pass renewed'
                      : 'Access pass activated'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {pendingActivation
                    ? `Your ${plan.name} pass is paid and reserved. It will start automatically when your membership ends.`
                    : resultRenewal && resultExpiresAt
                      ? `Your ${plan.name} pass has been extended — you're now covered until ${formatDate(resultExpiresAt)}.`
                      : `Your business now has the ${plan.name} access pass for ${plan.durationDays} days.`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
              >
                Back to access passes
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Total</p>
                    <p className="text-sm font-extrabold text-gray-900">{plan.name}</p>
                  </div>
                  <p className="text-2xl font-black text-gray-900">{amountText}</p>
                </div>
              </div>

              {isRenewal && (
                <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-sm font-extrabold text-emerald-950">
                      Renewing your {plan.name} pass
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                      You're already covered until {formatDate(renewalActiveUntil)}. This adds{' '}
                      {plan.durationDays} days, so your pass will run until{' '}
                      {formatDate(renewalEndsAt)}.
                    </p>
                  </div>
                </div>
              )}

              {hasMembershipConflict && conflict?.membership && (
                <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-extrabold text-amber-950">
                        You already have an active {conflict.membership.planName} membership
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                        This pass includes{' '}
                        {conflict.overlappingPlatforms.map((o) => o.platform).join(', ')}, which your
                        membership already covers.
                      </p>
                      {conflict.membership.expiresAt && (
                        <p className="mt-1 text-[11px] font-semibold text-amber-900/70">
                          Membership active until{' '}
                          {new Date(conflict.membership.expiresAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-white/70 p-3">
                    <input
                      type="checkbox"
                      checked={usePassInstead}
                      disabled={Boolean(clientSecret)}
                      onChange={(e) => setUsePassInstead(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                    />
                    <span className="text-xs font-bold text-amber-950">
                      Use this access pass instead — stop my membership now
                    </span>
                  </label>

                  <p className="text-[11px] leading-relaxed text-amber-900/80">
                    {usePassInstead
                      ? 'Your membership will stop immediately and this pass becomes active now. Any other platform access included in your membership will also end. Unused membership time is not refunded.'
                      : 'Your membership stays active. This pass is paid and kept pending as a whole, then starts automatically when your membership ends.'}
                  </p>
                  {Boolean(clientSecret) && (
                    <p className="text-[11px] font-semibold text-amber-900/70">
                      This choice is locked for the current card payment. Switch payment method to change it.
                    </p>
                  )}
                </div>
              )}

              {mode === 'SELF' && conflictLoading && (
                <p className="text-[11px] font-semibold text-gray-400">
                  Checking your membership for overlapping access…
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Who is this pass for?</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      { id: 'SELF', label: 'My business', icon: ShieldCheck },
                      { id: 'GIFT', label: 'Gift by email', icon: Mail },
                      { id: 'CODE', label: 'Buy a code', icon: KeyRound },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => resetPayment(option.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs transition-all',
                        mode === option.id
                          ? 'border-orange-500 bg-orange-50 font-bold text-orange-700 ring-2 ring-orange-500/20'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      <option.icon className="h-5 w-5" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {mode === 'GIFT' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Recipient email
                  </label>
                  <input
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="w-full rounded-xl border border-gray-300 px-3.5 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    The code is emailed to this address and locked to it. They redeem it on this page when ready.
                  </p>
                </div>
              )}

              {mode === 'CODE' && (
                <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                  <Ticket className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    We will generate a transferable code. It will not activate until someone redeems it on this page.
                  </span>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Payment method</p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'stripe', label: 'Card', icon: CreditCard },
                      { id: 'paypal', label: 'PayPal', icon: ExternalLink },
                      { id: 'wallet', label: 'Wallet', icon: Wallet },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setProvider(option.id)
                        setClientSecret(null)
                        setError(null)
                      }}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs transition-all',
                        provider === option.id
                          ? 'border-orange-500 bg-orange-50 font-bold text-orange-700 ring-2 ring-orange-500/20'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      )}
                    >
                      <option.icon className="h-5 w-5" />
                      {option.label}
                    </button>
                  ))}
                </div>
                {provider === 'wallet' && (
                  <p className="mt-2 text-[11px] text-gray-500">
                    Wallet balance: {wallet?.currency || 'MCOM'} {Number(wallet?.availableBalance ?? wallet?.balance ?? 0).toFixed(2)}
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {clientSecret && provider === 'stripe' ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripeAccessPassForm
                    plan={plan}
                    amountText={amountText}
                    onSuccess={(value) => finish(value)}
                    onError={(message) => setError(message)}
                  />
                </Elements>
              ) : (
                <button
                  onClick={startPayment}
                  disabled={busy || (mode === 'SELF' && conflictLoading)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : provider === 'paypal' ? (
                    <ExternalLink className="h-5 w-5" />
                  ) : provider === 'wallet' ? (
                    <Wallet className="h-5 w-5" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  )}
                  {provider === 'paypal'
                    ? `Continue with PayPal (${amountText})`
                    : provider === 'wallet'
                      ? `Pay with MCOM Wallet (${amountText})`
                      : `Continue to card payment (${amountText})`}
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function StripeAccessPassForm({
  plan,
  amountText,
  onSuccess,
  onError,
}: {
  plan: BusinessAccessPlan
  amountText: string
  onSuccess: (value: Record<string, unknown>) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const confirmPayment = useAccessStripeConfirm()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!stripe || !elements) return
    setSubmitting(true)
    onError('')
    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })
      if (stripeError) {
        onError(stripeError.message || 'Card payment failed.')
        return
      }
      if (paymentIntent?.status !== 'succeeded') {
        onError(`Payment is not complete (${paymentIntent?.status || 'unknown'}).`)
        return
      }
      const result = await confirmPayment.mutateAsync({
        accessPlanId: plan.id,
        paymentIntentId: paymentIntent.id,
      })
      onSuccess(result)
    } catch (err: any) {
      onError(paymentErrorMessage(err, 'Payment failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || confirmPayment.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
        <span className="font-medium text-gray-600">Total to pay today</span>
        <span className="font-bold text-gray-900">{amountText}</span>
      </div>
      <div className="min-h-[160px] py-1">
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={busy || !stripe || !elements}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3.5 font-bold text-white shadow-md hover:bg-orange-700 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
        {busy ? 'Processing…' : `Pay ${amountText}`}
      </button>
      <p className="text-center text-[11px] text-gray-400">Secured by MCOM Payment Hub & Stripe</p>
    </form>
  )
}
