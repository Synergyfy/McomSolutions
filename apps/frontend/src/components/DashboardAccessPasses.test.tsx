import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardAccessPasses from './DashboardAccessPasses'

const { plansMock, purchasesMock } = vi.hoisted(() => ({
  plansMock: vi.fn(),
  purchasesMock: vi.fn(),
}))

vi.mock('../services/access/hooks', () => ({
  useAccessPlans: () => ({ data: { data: plansMock() }, isLoading: false }),
  useAccessPurchases: () => ({ data: { data: purchasesMock() }, refetch: vi.fn() }),
  useAccessCodes: () => ({ data: { data: [] }, refetch: vi.fn() }),
  useRedeemAccessCode: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('../services/payment/hooks', () => ({
  useAccessPaypalCapture: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('./payment/AccessPassPaymentModal', () => ({
  default: ({ plan, activeUntil }: any) => (
    <div data-testid="payment-modal">
      {plan.name}|{activeUntil ? new Date(activeUntil).toISOString() : 'none'}
    </div>
  ),
}))

const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()

const plans = [
  { id: 'plan_a', name: 'Ivor Mason', description: 'Rewards pass', price: 19.99, durationDays: 30, features: [], archived: false },
  { id: 'plan_b', name: 'Lunea Landry', description: 'Mall pass', price: 19.99, durationDays: 30, features: [], archived: false },
]

const purchases = [
  {
    id: 'purchase_1',
    accessPlanId: 'plan_a',
    accessPlanName: 'Ivor Mason',
    durationDays: 30,
    amount: 19.99,
    currency: 'GBP',
    status: 'ACTIVE',
    startsAt: new Date(now - 5 * DAY_MS).toISOString(),
    expiresAt: new Date(now + 25 * DAY_MS).toISOString(),
  },
  {
    id: 'purchase_2',
    accessPlanId: 'plan_a',
    accessPlanName: 'Ivor Mason',
    durationDays: 30,
    amount: 19.99,
    currency: 'GBP',
    status: 'ACTIVE',
    startsAt: new Date(now + 25 * DAY_MS).toISOString(),
    expiresAt: new Date(now + 55 * DAY_MS).toISOString(),
  },
  {
    id: 'purchase_3',
    accessPlanId: 'plan_b',
    accessPlanName: 'Lunea Landry',
    durationDays: 30,
    amount: 19.99,
    currency: 'GBP',
    status: 'ACTIVE',
    startsAt: new Date(now - 2 * DAY_MS).toISOString(),
    expiresAt: new Date(now + 28 * DAY_MS).toISOString(),
  },
]

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardAccessPasses />
    </MemoryRouter>,
  )

describe('DashboardAccessPasses renewals', () => {
  beforeEach(() => {
    plansMock.mockReturnValue(plans)
    purchasesMock.mockReturnValue(purchases)
  })

  it('shows one active card per plan with the furthest end date', () => {
    renderPage()

    // Two plans are active, even though there are three active purchases.
    expect(screen.getAllByText('Active access pass')).toHaveLength(2)

    const expected = new Date(now + 55 * DAY_MS).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    expect(screen.getAllByText(`Active until ${expected}`).length).toBeGreaterThan(0)
  })

  it('offers a renew action for plans that are already active', () => {
    renderPage()

    expect(screen.getAllByRole('button', { name: /^renew$/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /renew pass/i })).toHaveLength(2)
    expect(screen.queryAllByRole('button', { name: /buy pass/i })).toHaveLength(0)
  })

  it('tells the payment modal when a plan is being renewed', () => {
    renderPage()

    expect(screen.queryByTestId('payment-modal')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /renew pass/i })[0])

    const furthestExpiry = new Date(now + 55 * DAY_MS).toISOString()
    expect(screen.getByTestId('payment-modal')).toHaveTextContent(
      `Ivor Mason|${furthestExpiry}`,
    )
  })
})
