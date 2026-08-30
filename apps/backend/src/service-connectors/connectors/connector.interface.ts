export interface ExternalPlan {
  id: string
  name: string
  description?: string
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  features?: string[]
  configuration?: Record<string, any>
  isActive?: boolean
  isDefault?: boolean
  type?: string
  trialDuration?: number
  seasonId?: string
  stripeMonthlyPriceId?: string
  stripeQuarterlyPriceId?: string
  stripeAnnualPriceId?: string
  paypalMonthlyPlanId?: string
  paypalQuarterlyPlanId?: string
  paypalAnnualPlanId?: string
  created_at?: string
  updated_at?: string
}

export interface CreateExternalPlanInput {
  name: string
  description?: string
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  features?: string[]
  configuration?: {
    quotas?: {
      // MCOM Mall quotas
      maxListings?: number
      allowProductListing?: boolean
      allowServiceListing?: boolean
      maxProducts?: number
      maxServices?: number
      maxGiftCardTemplates?: number
      maxCouponTemplates?: number
      maxLoyaltyPrograms?: number
      maxImagesPerListing?: number
      featuredListingAllowance?: number
      // MCOM Rewards quotas
      maxActiveCampaigns?: number
      maxActiveRewards?: number
      maxRewardsPerCampaign?: number
      monthlyPointsAllowance?: number
      monthlyStampsAllowance?: number
      monthlyRewardBudget?: number
      maxTeamMembers?: number
      maxRewardPoints?: number
    }
    featureFlags?: {
      // MCOM Mall feature flags
      priorityInSearch?: boolean
      advancedAnalytics?: boolean
      dedicatedSupport?: boolean
      allowCustomBranding?: boolean
      allowGroupCreation?: boolean
      // MCOM Rewards feature flags
      canCreateCampaignFromScratch?: boolean
      canEditAdminTemplates?: boolean
      hasAccessToAdvancedAnalytics?: boolean
      hasAccessToCRM?: boolean
      canUpdateReward?: boolean
      canCreateRewardFromScratch?: boolean
    }
  }
  isActive?: boolean
  isDefault?: boolean
  type?: string
  trialDuration?: number
  seasonId?: string
  stripeMonthlyPriceId?: string
  stripeQuarterlyPriceId?: string
  stripeAnnualPriceId?: string
  paypalMonthlyPlanId?: string
  paypalQuarterlyPlanId?: string
  paypalAnnualPlanId?: string
}

export interface UpdateExternalPlanInput extends Partial<CreateExternalPlanInput> {}

/**
 * Schema contract shared with the target services. Each service exposes
 * GET /api/v1/system/plans/schema returning the quotas/feature flags it
 * understands, so MCOM Solutions can render the plan form dynamically.
 */
export interface PlanSchemaField {
  key: string
  label: string
  type: 'number' | 'boolean'
  /** Number-only — enables the "Unlimited" (=-1) toggle in the form. */
  unlimited?: boolean
}

export interface PlanSchema {
  quotas: PlanSchemaField[]
  featureFlags: PlanSchemaField[]
}

export interface ExternalSeason {
  id: string
  name: string
  startDate?: string
  endDate?: string
  isActive?: boolean
  status?: string
  [key: string]: any
}

export interface ServiceConnector {
  readonly platform: string

  createPlan(input: CreateExternalPlanInput): Promise<ExternalPlan>
  getPlans(): Promise<ExternalPlan[]>
  getPlanById(id: string): Promise<ExternalPlan>
  updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan>
  deletePlan(id: string): Promise<void>
  /**
   * Fetch the plan configuration schema from the target service. Returns null
   * when the service has no schema endpoint yet (older apps degrade gracefully
   * to the hardcoded fallback form).
   */
  getPlanSchema(): Promise<PlanSchema | null>
  /**
   * Fetch the available seasons from the target service (if supported).
   */
  getSeasons?(): Promise<ExternalSeason[]>
}

export interface PlatformInfo {
  name: string
  clientId: string | null
  platformSlug?: string | null
  isNamed: boolean
  hasBillingApi: boolean
  billingApiUrl?: string | null
  /** Optional override for the schema endpoint (else derived from billingApiUrl). */
  planSchemaEndpoint?: string | null
}

