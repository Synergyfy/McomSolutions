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

export interface ServiceConnector {
  readonly platform: string

  createPlan(input: CreateExternalPlanInput): Promise<ExternalPlan>
  getPlans(): Promise<ExternalPlan[]>
  getPlanById(id: string): Promise<ExternalPlan>
  updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan>
  deletePlan(id: string): Promise<void>
}
