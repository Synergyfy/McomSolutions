import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Gift,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAccessCodes, useAccessPlans, useAccessPurchases, useRedeemAccessCode } from '../services/access/hooks'
import type { BusinessAccessCode, BusinessAccessPlan } from '../services/access'
import AccessPassPaymentModal from './payment/AccessPassPaymentModal'
import { useAccessPaypalCapture } from '../services/payment/hooks'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  EXPIRED: 'bg-gray-100 text-gray-600 border-gray-200',
  UNUSED: 'bg-blue-50 text-blue-700 border-blue-200',
  REDEEMED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PENDING_PAYMENT: 'bg-amber-50 text-amber-700 border-amber-200',
  REVOKED: 'bg-red-50 text-red-700 border-red-200',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        statusStyles[status] || 'bg-gray-100 text-gray-600 border-gray-200',
      )}
    >
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  )
}

export default function DashboardAccessPasses() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedPlan, setSelectedPlan] = useState<BusinessAccessPlan | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [paypalProcessing, setPaypalProcessing] = useState(false)
  const paypalHandled = useRef(false)

  const { data: plansRes, isLoading: plansLoading } = useAccessPlans()
  const {
    data: purchasesRes,
    refetch: refetchPurchases,
  } = useAccessPurchases()
  const { data: codesRes, refetch: refetchCodes } = useAccessCodes()
  const redeemCode = useRedeemAccessCode()
  const capturePaypal = useAccessPaypalCapture()

  const plans = plansRes?.data ?? []
  const purchases = purchasesRes?.data ?? []
  const codes = codesRes?.data ?? []

  const activePurchases = useMemo(() => {
    const now = Date.now()
    return purchases.filter(
      (purchase) =>
        purchase.status?.toUpperCase() === 'ACTIVE' &&
        new Date(purchase.expiresAt).getTime() > now,
    )
  }, [purchases])

  const pendingPurchases = useMemo(
    () => purchases.filter((purchase) => purchase.status?.toUpperCase() === 'PENDING_ACTIVATION'),
    [purchases],
  )

  const refresh = () => {
    refetchPurchases()
    refetchCodes()
  }

  useEffect(() => {
    const token = searchParams.get('token')
    const paypalState = searchParams.get('paypal')

    if (paypalState === 'cancelled') {
      setCodeError('PayPal payment was cancelled.')
      setSearchParams({}, { replace: true })
      return
    }

    if (token && paypalState === 'access' && !paypalHandled.current) {
      paypalHandled.current = true
      setPaypalProcessing(true)
      setCodeError(null)
      capturePaypal
        .mutateAsync(token)
        .then((result: any) => {
          if (result?.type === 'access_code') {
            setNotice(
              result.emailSent && result.recipientEmail
                ? `Payment successful. The access pass code was emailed to ${result.recipientEmail}.`
                : `Payment successful. Your code is ${result.code}.`,
            )
          } else if (result?.pendingActivation) {
            setNotice(
              'Payment successful. Your access pass is paid and pending — it starts when your membership ends.',
            )
          } else {
            setNotice('Payment successful. Your access pass is now active.')
          }
          refresh()
        })
        .catch((err: any) => {
          const raw = err?.response?.data?.message
          setCodeError(Array.isArray(raw) ? raw.join(', ') : raw || 'PayPal payment could not be confirmed.')
        })
        .finally(() => {
          setPaypalProcessing(false)
          setSearchParams({}, { replace: true })
        })
    }
  }, [searchParams, capturePaypal, setSearchParams])

  const handleRedeem = async (value?: string) => {
    const normalised = (value ?? code).trim().toUpperCase()
    setCodeError(null)
    setNotice(null)
    if (normalised.length < 4) {
      setCodeError('Enter a valid access pass code.')
      return
    }
    try {
      const result: any = await redeemCode.mutateAsync(normalised)
      setNotice(
        result?.pendingActivation
          ? `Access pass saved: ${result?.planName || 'your pass'} is pending and starts when your membership ends.`
          : `Access pass activated: ${result?.planName || 'your pass'} is now active.`,
      )
      setCode('')
      refresh()
    } catch (err: any) {
      const raw = err?.response?.data?.message
      setCodeError(Array.isArray(raw) ? raw.join(', ') : raw || 'This code could not be redeemed.')
    }
  }

  const copyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(value)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      setCodeError('Could not copy the code. Please copy it manually.')
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="mb-1 text-3xl font-bold text-gray-900">Access Passes</h2>
          <p className="text-gray-500">
            Buy a pass for your business, gift one by email, or buy a code to redeem later.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          One-off payment · No auto-renewal
        </div>
      </div>

      {paypalProcessing && (
        <div className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-semibold text-blue-800">
          <Loader2 className="h-4 w-4 animate-spin" />
          Confirming your PayPal payment…
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {codeError && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{codeError}</span>
        </div>
      )}

      {/* Pending passes (paid, waiting for the membership to end) */}
      {pendingPurchases.length > 0 && (
        <div className="space-y-3">
          {pendingPurchases.map((purchase) => (
            <div
              key={purchase.id}
              className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 sm:p-6"
            >
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-extrabold text-amber-950">
                    Pending activation: {purchase.accessPlanName}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                    This pass is paid and reserved. It starts automatically when your current membership
                    ends, so you keep your membership access until then.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active passes */}
      {activePurchases.length > 0 && (
        <div className="space-y-3">
          {activePurchases.map((purchase) => (
            <div
              key={purchase.id}
              className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-white shadow-sm"
            >
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Active access pass
                    </div>
                    <h3 className="mt-2 text-2xl font-black">{purchase.accessPlanName}</h3>
                    <p className="mt-1 text-sm text-emerald-50/90">
                      Active until {formatDate(purchase.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                      <p className="text-2xl font-black">{purchase.durationDays}</p>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-50/80">Days</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-50/80">Started</p>
                      <p className="text-sm font-bold">{formatDate(purchase.startsAt)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Redeem code */}
        <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm lg:col-span-1">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-black text-gray-900">Redeem a code</h3>
          </div>
          <p className="mb-4 text-xs text-gray-500">
            Enter a gift or access code. Your pass starts the moment you redeem it.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleRedeem()
            }}
            className="space-y-3"
          >
            <input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase())
                setCodeError(null)
                setNotice(null)
              }}
              placeholder="MCOM-XXXX-XXXX"
              maxLength={32}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-mono text-lg font-bold uppercase tracking-widest focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              type="submit"
              disabled={redeemCode.isPending || code.trim().length < 4}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {redeemCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
              Redeem code
            </button>
          </form>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-800">
            Gift codes are locked to the recipient email they were sent to. Transferable codes can be redeemed by any business.
          </div>
        </div>

        {/* Plans */}
        <div className="space-y-4 lg:col-span-2">
          <div>
            <h3 className="text-lg font-black text-gray-900">Available access passes</h3>
            <p className="text-xs text-gray-500">
              Each pass bundles access across one or more ecosystem platforms for a fixed period.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center rounded-[2rem] border border-gray-200 bg-white p-10">
              <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-[2rem] border border-gray-200 bg-white p-10 text-center">
              <Sparkles className="mx-auto mb-2 h-10 w-10 text-gray-300" />
              <p className="text-sm font-bold text-gray-700">No access passes available right now</p>
              <p className="mt-1 text-xs text-gray-500">Check back later or ask an admin for a code.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col justify-between rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-orange-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {plan.badge && (
                          <span className="mb-1 inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                            {plan.badge}
                          </span>
                        )}
                        <h4 className="text-base font-black text-gray-900">{plan.name}</h4>
                        <p className="mt-1 line-clamp-2 min-h-[32px] text-xs text-gray-500">
                          {plan.description || 'Dashboard access pass'}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                        <CalendarDays className="h-3 w-3" />
                        {plan.durationDays}d
                      </span>
                    </div>

                    <ul className="mt-3 space-y-1.5">
                      {(plan.features || []).slice(0, 3).map((feature, index) => (
                        <li key={`${feature}-${index}`} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          {feature}
                        </li>
                      ))}
                      {!plan.features?.length && (
                        <li className="text-xs italic text-gray-400">No features listed.</li>
                      )}
                    </ul>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(plan.appBundles ?? []).map((bundle, index) => (
                        <span
                          key={`${bundle.platform}-${index}`}
                          className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-brand-blue"
                        >
                          {bundle.platform}
                          {bundle.durationDays ? ` · ${bundle.durationDays}d` : ''}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div>
                      <p className="text-2xl font-black text-gray-900">£{Number(plan.price).toFixed(2)}</p>
                      <p className="text-[10px] text-gray-500">one-off</p>
                    </div>
                    <button
                      onClick={() => setSelectedPlan(plan)}
                      className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
                    >
                      <CreditCard className="h-4 w-4" />
                      Buy pass
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Codes */}
      <div className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-black text-gray-900">
              <Ticket className="h-5 w-5 text-orange-600" /> My access codes
            </h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Codes you bought or received. Codes only start a pass when redeemed.
            </p>
          </div>
        </div>

        {codes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-8 text-center">
            <KeyRound className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            <p className="text-sm font-bold text-gray-700">No access codes yet</p>
            <p className="mt-1 text-xs text-gray-500">Buy a code above and it will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {codes.map((entry) => (
              <div key={entry.id}>
                <CodeRow
                  entry={entry}
                  copied={copied === entry.code}
                  onCopy={() => copyCode(entry.code)}
                  onRedeem={entry.status === 'UNUSED' ? () => handleRedeem(entry.code) : undefined}
                  redeeming={redeemCode.isPending}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPlan && (
        <AccessPassPaymentModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => refresh()}
        />
      )}
    </div>
  )
}

function CodeRow({
  entry,
  copied,
  onCopy,
  onRedeem,
  redeeming,
}: {
  entry: BusinessAccessCode
  copied: boolean
  onCopy: () => void
  onRedeem?: () => void
  redeeming: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 font-mono text-sm font-black tracking-wider text-gray-900 hover:text-orange-600"
          >
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
            {entry.code}
          </button>
          <StatusBadge status={entry.status} />
          {entry.mode === 'GIFT' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600">
              <Lock className="h-2.5 w-2.5" /> Email locked
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-500">
          <span>{entry.planName}</span>
          <span>£{Number(entry.amount).toFixed(2)}</span>
          {entry.recipientEmail && (
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3 w-3" /> {entry.recipientEmail}
            </span>
          )}
          <span>Purchased {formatDate(entry.purchasedAt || entry.createdAt)}</span>
          {entry.redeemedAt && <span>Redeemed {formatDate(entry.redeemedAt)}</span>}
        </div>
      </div>
      {onRedeem && (
        <button
          onClick={onRedeem}
          disabled={redeeming}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
        >
          {redeeming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
          Redeem now
        </button>
      )}
    </div>
  )
}
