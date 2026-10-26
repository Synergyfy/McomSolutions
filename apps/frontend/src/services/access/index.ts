import { apiClient } from '../api'

export type AccessPurchaseMode = 'SELF' | 'GIFT' | 'CODE'

export interface BusinessAccessPlanBundle {
  id?: string
  platform: string
  externalPlanId?: string | null
  packageName: string
  durationDays?: number | null
  variantTier?: string | null
  limits?: Record<string, unknown> | null
}

export interface BusinessAccessPlan {
  id: string
  name: string
  description: string
  price: number
  durationDays: number
  features: string[]
  whoItIsFor?: string | null
  badge?: string | null
  color?: string | null
  archived: boolean
  appBundles?: BusinessAccessPlanBundle[]
  createdAt?: string
}

export interface BusinessAccessPurchase {
  id: string
  accessPlanId: string
  accessPlanName: string
  durationDays: number
  amount: number
  currency: string
  status: string
  provider?: string | null
  startsAt: string
  expiresAt: string
  createdAt?: string
  accessPlan?: BusinessAccessPlan | null
}

export interface BusinessAccessCode {
  id: string
  code: string
  accessPlanId: string
  planName: string
  mode: 'GIFT' | 'CODE' | string
  status: 'PENDING_PAYMENT' | 'UNUSED' | 'REDEEMED' | 'REVOKED' | string
  recipientEmail?: string | null
  amount: number
  currency: string
  purchasedAt?: string | null
  emailSentAt?: string | null
  redeemedAt?: string | null
  purchasedByMe: boolean
  createdAt?: string
}

export interface AccessMembershipConflict {
  hasConflict: boolean
  membership: {
    planName: string | null
    level: string | null
    status: string | null
    expiresAt: string | null
  } | null
  overlappingPlatforms: Array<{
    platform: string
    membershipPlanId: string
    membershipPlanName: string
    accessPassPlanId: string
    accessPassPlanName: string
  }>
  accessPlan: { id: string; name: string } | null
}

export const accessApi = {
  getPlans: async () => {
    const res = await apiClient.get('/access/plans')
    return res.data as { success: boolean; data: BusinessAccessPlan[] }
  },

  getConflict: async (accessPlanId: string) => {
    const res = await apiClient.get('/access/conflict', { params: { accessPlanId } })
    return res.data as { success: boolean; data: AccessMembershipConflict }
  },

  getPurchases: async () => {
    const res = await apiClient.get('/access/purchases')
    return res.data as { success: boolean; data: BusinessAccessPurchase[] }
  },

  getCodes: async () => {
    const res = await apiClient.get('/access/codes')
    return res.data as { success: boolean; data: BusinessAccessCode[] }
  },

  redeemCode: async (code: string) => {
    const res = await apiClient.post('/access/codes/redeem', { code })
    return res.data
  },
}
