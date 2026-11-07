export interface EcosystemStats {
  totalBusinesses: number
  totalCustomers: number
  totalAgents: number
  totalConsultants: number
  totalAccountManagers: number
  totalPlatformUsers: number
}

export interface MembershipStats {
  active: number
  expired: number
  pending: number
  cancelled: number
}

export interface RevenueStats {
  todayRevenue: number
  monthlyRevenue: number
  totalCompleted: number
  recurringRevenue: number
}

export interface PlatformStat {
  id: string
  name: string
  totalUsers: number
}

export interface DashboardStats {
  ecosystemStats: EcosystemStats
  membershipStats: MembershipStats
  revenueStats: RevenueStats
  platforms: PlatformStat[]
}

export interface BusinessUser {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  membership: string
  platformAccess: string[]
  status: string
  revenue: string
  source: string
  joined: string
  googleVerified: boolean
}

export interface CustomerUser {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  loyaltyPoints: number
  platformUsage: string[]
  membershipStatus: string
  status: string
}

export interface AgentUser {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  permissions: string[]
  status: string
}

export interface ConsultantUser {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  specialisation: string
  status: string
}

export interface AccountManager {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  assignedBusinesses: number
  status: string
}

export interface IncludedAppPlan {
  platform: string
  clientId?: string
  planId: string
  planName: string
  standalonePrice?: number
  quotas?: Record<string, any>
}

export interface TierEntitlementResource {
  id?: string
  resourceKey: string
  name: string
  description?: string
  badge?: string
  standard: number | string
  pro: number | string
  proPlus: number | string
  usedOn?: string[]
}

export type TierName = 'Standard' | 'Pro' | 'Pro+'
export type PaymentPlanName = 'full' | 'monthly' | 'quarterly' | 'halfYearly'
export type PriceModeName = 'manual' | 'auto'

/** Allowed splits per tier (mirrors backend ALLOWED_SPLITS). */
export const TIER_SPLITS: Record<TierName, { paymentPlan: PaymentPlanName; installments: number; sliceDays: number | 'duration'; label: string }[]> = {
  Standard: [
    { paymentPlan: 'full', installments: 1, sliceDays: 'duration', label: 'Pay in full' },
    { paymentPlan: 'monthly', installments: 3, sliceDays: 30, label: 'Monthly' },
  ],
  Pro: [
    { paymentPlan: 'full', installments: 1, sliceDays: 'duration', label: 'Pay in full' },
    { paymentPlan: 'quarterly', installments: 2, sliceDays: 90, label: 'Quarterly' },
    { paymentPlan: 'monthly', installments: 6, sliceDays: 30, label: 'Monthly' },
  ],
  'Pro+': [
    { paymentPlan: 'full', installments: 1, sliceDays: 'duration', label: 'Pay in full' },
    { paymentPlan: 'halfYearly', installments: 2, sliceDays: 180, label: 'Every 6 months' },
    { paymentPlan: 'quarterly', installments: 4, sliceDays: 91, label: 'Quarterly' },
    { paymentPlan: 'monthly', installments: 12, sliceDays: 30, label: 'Monthly' },
  ],
}

export interface TierPaymentOptionInput {
  paymentPlan: PaymentPlanName
  mode: PriceModeName
  manualPrice?: number
  surchargePct?: number
  isActive?: boolean
}

export interface TierEntitlementInput {
  resourceKey: string
  quotaValue: string
}

export interface PlanTierInput {
  tier: TierName
  fullPrice: number
  durationDays?: number
  features?: string[]
  entitlements?: TierEntitlementInput[]
  paymentOptions?: TierPaymentOptionInput[]
}

export interface PlanTierPaymentOption {
  paymentPlan: PaymentPlanName
  installments: number
  mode: PriceModeName
  perChargePrice: number
  totalPrice: number
  sliceDays: number
}

export interface PlanTierDetail {
  tier: TierName
  durationDays: number
  fullPrice: number
  features: string[]
  entitlements: { resourceKey: string; quotaValue: string }[]
  paymentOptions: PlanTierPaymentOption[]
}

export interface PlanAppBundle {
  platform: string
  externalPlanId?: string | null
  packageName: string
}

export interface MembershipPlan {
  id: string
  name: string
  description: string
  price: number
  billingCycle: string
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  platformAccess: string[]
  usageLimits: Record<string, number>
  permissions: string[]
  freeDelegatedTasks?: number
  unlimitedFreeDelegatedTasks?: boolean
  includedApps?: IncludedAppPlan[]
  tierPrices?: Record<string, number>
  tierFeatures?: Record<string, string[]>
  tierEntitlements?: TierEntitlementResource[]
  tierDurations?: Record<string, number>
  tiers?: PlanTierDetail[]
  appBundles?: PlanAppBundle[]
  whoItIsFor?: string
  badge?: string
  color?: string
  features?: string[]
  archived: boolean
  createdAt?: string
}

export interface AccessPlanAppBundle {
  id?: string
  platform: string
  externalPlanId?: string | null
  packageName: string
  durationDays?: number | null
  variantTier?: string | null
  limits?: Record<string, any> | null
}

export interface AccessPlan {
  id: string
  name: string
  description: string
  price: number
  durationDays: number
  platformAccess: string[]
  features: string[]
  freeDelegatedTasks?: number
  unlimitedFreeDelegatedTasks?: boolean
  whoItIsFor?: string | null
  badge?: string | null
  color?: string | null
  archived: boolean
  appBundles?: AccessPlanAppBundle[]
  createdAt?: string
}

// PackageTemplate — REMOVED (memberships-only model). Standalone plans live
// on console-registered external platforms (external plans API).

export interface Subscription {
  id: string
  businessId?: string
  businessName: string
  type: string
  itemName: string
  status: string
  startDate: string
  endDate: string
  amount: number
  billingCycle: string
  createdAt?: string
}

export interface Platform {
  id: string
  name: string
  description: string
  status: string
  totalUsers: number
  visible: boolean
  icon?: string
  launchDate?: string
  createdAt?: string
}

export interface LaunchRule {
  id: string
  platformId: string
  requiredMembership: string
  requiredPackage: string
  requiredPermissions: string[]
  launchConditions: string
  redirectRule: string
  accessRule: string
}

export interface PlatformsResponse {
  platforms: Platform[]
  launchRules: LaunchRule[]
}

export interface PermissionRole {
  role: string
  permissions: Record<string, boolean>
}

export interface Payment {
  id: string
  businessId?: string
  businessName: string
  amount: number
  currency: string
  method: string
  status: string
  invoice: string
  type: string
  date?: string
  createdAt?: string
}

export interface RevenueRecord {
  id: string
  date: string
  amount: number
  type: string
  source: string
  createdAt?: string
}

export interface BroadcastNotification {
  id: string
  title: string
  message: string
  audience: string[]
  scheduledDate?: string
  status: string
  sentCount: number
  createdAt?: string
}

export interface SupportTicket {
  id: string
  subject: string
  message: string
  from: string
  fromType?: string
  status: string
  priority: string
  assignedTo: string
  createdAt: string
  updatedAt: string
}

export interface AuditLog {
  id: string
  action: string
  adminName: string
  targetType: string
  targetName: string
  details: string
  timestamp: string
  category: string
}

export interface SystemSettings {
  brandName: string
  supportEmail: string
  currency: string
  sessionTimeout: number
  maxLoginAttempts: number
  emailEnabled: boolean
  smsEnabled: boolean
  paymentGateway: string
  maintenanceMode: boolean
  allowRegistration: boolean
  authConfig?: Record<string, any>
  registrationFlow?: Record<string, any>
  businessProfileConfig?: Record<string, any>
}

export interface Borough {
  id: string
  name: string
  cityId?: string | null
  city?: City | null
  populationActivity: string
  businessCount: number
  affiliateCount?: number
  activeCampaigns: number
  rewardsParticipation: string
  healthScore: number
  manager: string
  area: string
  region: string
  engagement: string
  health: string
  activity: string
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
  _count?: { highStreets?: number; localMalls?: number }
}

export interface City {
  id: string
  name: string
  region?: string | null
  country: string
  businessCount: number
  affiliateCount?: number
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
  createdAt?: string
  updatedAt?: string
  _count?: { boroughs?: number; highStreets?: number; localMalls?: number }
}

export interface HighStreet {
  id: string
  name: string
  borough: string
  cityId?: string | null
  boroughId?: string | null
  status: string
  businessCount: number
  affiliateCount?: number
  lat?: number
  lng?: number
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
}

export interface LocalMall {
  id: string
  name: string
  postcodes: string[]
  borough: string
  cityId?: string | null
  boroughId?: string | null
  highStreetId?: string | null
  primaryHighStreet: string
  additionalHighStreets: string[]
  status: string
  businesses?: number
  affiliateCount?: number
  customers?: number
  description: string
  longDescription: string
  slug: string
  primaryColour: string
  secondaryColour: string
  welcomeMessage: string
  tagline: string
  radiusCoverage: string
  allowBusinessesOutsidePostcode: boolean
  allowVirtualBusinesses: boolean
  allowHomeBusinesses: boolean
  requireVerification: boolean
  requireAuditCompletion: boolean
  requireMembershipApproval: boolean
  leadConsultant?: string
  assignedAccountManagers?: string[]
  assignedAgents?: string[]
  supportTeam?: string[]
  categoryPriorities?: Record<string, any>
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
}

/** Business or affiliate row shown in the per-entity assignment tables. */
export interface AssignedBusiness {
  id: string
  userType?: 'BUSINESS' | 'AGENT' | 'CONSULTANT' | 'ACCOUNT_MANAGER'
  businessName: string
  businessType?: string
  email: string
  phone?: string
  address?: string | null
  postcode?: string | null
  industry?: string | null
  category?: string | null
  subCategory?: string | null
  membershipLevel?: string
  membershipStatus?: string
  createdAt: string
  user?: {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
  } | null
}

// ─── Input DTOs (matching backend Create*Dto shapes) ──
export interface CreateBusinessInput {
  name: string
  email: string
  phone?: string
  membership?: string
  platformAccess?: string[]
  status?: string
  revenue?: string
  source?: string
  googleVerified?: boolean
}

export interface CreateCustomerInput {
  name: string
  email: string
  phone?: string
  loyaltyPoints?: number
  platformUsage?: string[]
  membershipStatus?: string
  status?: string
}

export interface CreateAgentInput {
  name: string
  email: string
  phone?: string
  permissions?: string[]
  status?: string
}

export interface CreateConsultantInput {
  name: string
  email: string
  phone?: string
  specialisation?: string
  status?: string
}

export interface CreateAccountManagerInput {
  name: string
  email: string
  phone?: string
  assignedBusinesses?: number
  status?: string
}

export interface CreateSubscriptionInput {
  businessName: string
  type: string
  itemName: string
  status?: string
  startDate: string
  endDate: string
  amount: number
  billingCycle: string
}

export interface CreateLaunchRuleInput {
  platformId: string
  requiredMembership: string
  requiredPackage: string
  requiredPermissions: string[]
  launchConditions: string
  redirectRule: string
  accessRule: string
}

export interface RecordPaymentInput {
  businessName: string
  amount: number
  currency?: string
  method: string
  status: string
  invoice: string
  type: string
}

export interface CreatePlanInput {
  name: string
  description: string
  price: number
  billingCycle: string
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  platformAccess: string[]
  usageLimits: Record<string, number>
  permissions: string[]
  freeDelegatedTasks?: number
  unlimitedFreeDelegatedTasks?: boolean
  includedApps?: IncludedAppPlan[]
  tierPrices?: Record<string, number>
  tierFeatures?: Record<string, string[]>
  tierEntitlements?: TierEntitlementResource[]
  tierDurations?: Record<string, number>
  tiers?: PlanTierInput[]
  whoItIsFor?: string
  badge?: string
  color?: string
  features?: string[]
}

export interface AccessIncludedAppPlan {
  platform: string
  clientId?: string
  planId: string
  externalPlanId?: string
  planName: string
  durationDays?: number
  standalonePrice?: number
  variantTier?: TierName
  limits?: Record<string, any>
}

export interface CreateAccessPlanInput {
  name: string
  description: string
  price: number
  /** Derived server-side from the bundled platform access pass plans. */
  durationDays?: number
  whoItIsFor?: string
  badge?: string
  color?: string
  features?: string[]
  freeDelegatedTasks?: number
  unlimitedFreeDelegatedTasks?: boolean
  includedApps: AccessIncludedAppPlan[]
}

export interface UpdateAccessPlanInput extends Partial<CreateAccessPlanInput> {
  archived?: boolean
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
  archived?: boolean
}

// CreatePackageInput — REMOVED (memberships-only model).

export interface CreateNotificationInput {
  title: string
  message: string
  audience: string[]
  scheduledDate?: string
  status?: string
}

export interface UpdateTicketInput {
  status?: string
  priority?: string
  assignedTo?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
}

// ─── External Plan (MCOM Mall / other services) ──────────────────────────
export interface PlanQuotas {
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

export interface PlanFeatureFlags {
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

export interface PlanConfiguration {
  quotas?: PlanQuotas
  featureFlags?: PlanFeatureFlags
}

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

export interface PlatformInfo {
  name: string
  clientId: string | null
  platformSlug?: string | null
  isNamed: boolean
  hasBillingApi: boolean
  billingApiUrl?: string | null
  /** Optional override for the plan schema endpoint (else derived from billingApiUrl). */
  planSchemaEndpoint?: string | null
}

export interface ExternalPlanVariant {
  id?: string
  tier: 'STANDARD' | 'PRO' | 'PRO_PLUS' | 'Standard' | 'Pro' | 'Pro+'
  tierLevel?: {
    name: string
    durationDays?: number | null
    isCalendarYear?: boolean
  }
  price?: number
  features?: string[]
  configuration?: PlanConfiguration
  isActive?: boolean
  stripePriceId?: string
  paypalPlanId?: string
}

export interface CreatePlanVariantInput {
  tier: 'STANDARD' | 'PRO' | 'PRO_PLUS' | 'Standard' | 'Pro' | 'Pro+'
  price: number
  features?: string[]
  configuration?: PlanConfiguration
  stripePriceId?: string
  paypalPlanId?: string
}

export interface ExternalPlan {
  id: string
  name: string
  slug?: string
  description?: string
  variants?: ExternalPlanVariant[]
  tierPrices?: Record<string, number>
  tierFeatures?: Record<string, string[]>
  tierEntitlements?: TierEntitlementResource[]
  tierDurations?: Record<string, number>
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  features?: string[]
  configuration?: PlanConfiguration
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

export interface AccessPassPlatform {
  name: string
  clientId: string
  platformSlug: string | null
  endpoint: string
}

export interface AccessPassCataloguePlan {
  id: string
  name: string
  slug?: string | null
  description?: string | null
  price?: number | null
  currency?: string | null
  durationDays?: number | null
  features?: string[]
  configuration?: PlanConfiguration & { disabledNavIds?: string[]; [key: string]: any }
  isActive?: boolean
  purchaseEnabled?: boolean
  codeRedemptionEnabled?: boolean
  [key: string]: any
}

export interface AccessPassCatalogueResponse {
  success: boolean
  platform: Pick<AccessPassPlatform, 'name' | 'clientId' | 'platformSlug'>
  data: AccessPassCataloguePlan[]
}

export interface CreateExternalPlanInput {
  name: string
  platform: string
  slug?: string
  description?: string
  variants?: CreatePlanVariantInput[]
  monthlyPrice?: number
  quarterlyPrice?: number
  annualPrice?: number
  features?: string[]
  configuration?: PlanConfiguration
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

export interface Campaign {
  id: string
  name: string
  description?: string
  locationType: 'high_street' | 'borough' | 'local_mall'
  locationId?: string
  locationName?: string
  status: 'active' | 'paused' | 'completed' | 'draft'
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export interface CreateCampaignInput {
  name: string
  description?: string
  locationType: 'high_street' | 'borough' | 'local_mall'
  locationId?: string
  locationName?: string
  status?: 'active' | 'paused' | 'completed' | 'draft'
  startDate?: string
  endDate?: string
}

// ─── Mcom Console (dynamic app registry) ───────────────────────────────
export const CONSOLE_ALLOWED_SCOPES = ['profile', 'email', 'business', 'membership', 'packages'] as const

export interface SsoClientListItem {
  id: string
  clientId: string
  name: string
  description?: string | null
  appUrl?: string | null
  billingApiUrl?: string | null
  serviceBaseUrl?: string | null
  logoUrl?: string | null
  redirectUris?: string[]
  platformSlug: string | null
  isActive: boolean
  isSystemApp: boolean
  allowWhitelabel?: boolean
  serviceScopes: string[]
  createdAt: string
  updatedAt: string
}

export interface SsoClientDetail extends SsoClientListItem {
  description: string | null
  appUrl: string | null
  billingApiUrl: string | null
  planSchemaEndpoint: string | null
  accessPassPlansEndpoint: string | null
  redirectUris: string[]
  corsOrigins: string[]
  scopes: string[]
  webhookUrl: string | null
  logoUrl: string | null
  clientSecret: string
  apiKey: string
  hmacSecret: string | null
  webhookSecret: string | null
  webhookFailCount: number
  lastWebhookAt: string | null
  feePercent?: number | null
  feeFixedMinor?: number | null
  serviceEnabled: boolean
  serviceBaseUrl: string | null
  serviceScopes: string[]
  allowedAudiences: string[]
  allowedCallers: string[]
}

export interface RegisterAppInput {
  name: string
  clientId: string
  platformSlug?: string
  description?: string
  appUrl?: string
  billingApiUrl?: string
  planSchemaEndpoint?: string
  accessPassPlansEndpoint?: string
  redirectUris: string[]
  corsOrigins: string[]
  scopes: string[]
  webhookUrl?: string
  feePercent?: number
  feeFixedMinor?: number
  serviceEnabled?: boolean
  serviceBaseUrl?: string
  serviceScopes?: string[]
  allowedAudiences?: string[]
  allowedCallers?: string[]
  allowWhitelabel?: boolean
}

export type UpdateAppInput = Partial<Omit<RegisterAppInput, 'clientId'>>

export interface PlainSecrets {
  clientSecret: string
  apiKey: string
  hmacSecret: string
  webhookSecret: string
}

export interface RegisterAppResult {
  client: SsoClientDetail
  plainSecrets: PlainSecrets
}

export interface AppHealthResult {
  reachable: boolean
  latencyMs: number
}

export interface ServicePolicyApp {
  clientId: string
  name: string
  serviceEnabled: boolean
  isActive: boolean
  allowedAudiences: string[]
  allowedCallers: string[]
}

export interface ServicePolicyResponse {
  apps: ServicePolicyApp[]
}

// ─── White-label access (business-only) ────────────────────────────────
export interface WhitelabelPlatform {
  clientId: string
  name: string
  platformSlug: string | null
  description?: string | null
  appUrl?: string | null
  logoUrl?: string | null
}

export interface BusinessWhitelabelAccess {
  business: { id: string; name: string }
  platforms: WhitelabelPlatform[]
  grantedClientIds: string[]
}

export interface SetServicePolicyInput {
  apps: {
    clientId: string
    allowedAudiences: string[]
    allowedCallers: string[]
  }[]
}

export interface ConsoleAuditLog {
  id: string
  adminId: string
  clientId: string
  action: string
  changes: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface ConsoleAuditQuery {
  page?: number
  limit?: number
  clientId?: string
  action?: string
}

// ─── Sector, Category, SubCategory Catalog ───────────────────
export interface AdminSubCategory {
  id: string
  categoryId: string
  name: string
  slug: string
  sortOrder: number
  imageUrl?: string | null
  businessCount?: number
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
  createdAt?: string
  updatedAt?: string
  category?: {
    id: string
    name: string
    slug: string
    sector?: { id: string; name: string; slug: string }
  }
}

export interface AdminCategory {
  id: string
  sectorId: string
  name: string
  slug: string
  sortOrder: number
  imageUrl?: string | null
  businessCount?: number
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
  createdAt?: string
  updatedAt?: string
  subCategories?: AdminSubCategory[]
  sector?: { id: string; name: string; slug: string }
  _count?: { subCategories: number }
}

export interface AdminSector {
  id: string
  name: string
  slug: string
  sortOrder: number
  imageUrl?: string | null
  businessCount?: number
  lastItemCreatedAt?: string | null
  aggregatedAt?: string | null
  createdAt?: string
  updatedAt?: string
  categories?: AdminCategory[]
  _count?: { categories: number }
}

export interface CatalogStats {
  totalSectors: number
  totalCategories: number
  totalSubcategories: number
}

export interface CatalogTreeData {
  sectors: (AdminSector & {
    categories: (AdminCategory & {
      subCategories: AdminSubCategory[]
    })[]
  })[]
  stats: CatalogStats
}

export interface CreateSectorInput {
  name: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

export interface UpdateSectorInput {
  name?: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

export interface CreateCategoryInput {
  sectorId: string
  name: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

export interface UpdateCategoryInput {
  sectorId?: string
  name?: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

export interface CreateSubCategoryInput {
  categoryId: string
  name: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

export interface UpdateSubCategoryInput {
  categoryId?: string
  name?: string
  slug?: string
  sortOrder?: number
  imageUrl?: string | null
}

// ─── Coupons ─────────────────────────────────────────────
export type CouponDiscountType = 'PERCENTAGE' | 'FIXED'
export type CouponSource = 'ADMIN' | 'TASK_REWARD'
export type CouponRedemptionStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED'
export type CouponStatus = 'active' | 'scheduled' | 'expired' | 'exhausted' | 'inactive'

export interface AdminCouponPlan {
  id: string
  name: string
  archived?: boolean
}

export interface AdminCouponUser {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  businessProfile?: { id: string; businessName: string } | null
}

export interface AdminCoupon {
  id: string
  code: string
  description: string | null
  discountType: CouponDiscountType
  discountValue: number
  appliesToAllMemberships: boolean
  membershipPlanIds: string[]
  membershipPlans: AdminCouponPlan[]
  appliesToAllAccess: boolean
  accessPlanIds: string[]
  accessPlans: AdminCouponPlan[]
  validFrom: string
  expiresAt: string | null
  isActive: boolean
  source: CouponSource
  sourceApp?: string | null
  externalRef?: string | null
  lockedToUserId: string | null
  lockedToUser: AdminCouponUser | null
  status: CouponStatus
  timesRedeemed: number
  maxUses: number | null
  maxUsesPerUser: number | null
  createdAt?: string
}

export interface AdminCouponInput {
  code: string
  description?: string
  discountType: CouponDiscountType
  discountValue: number
  appliesToAllMemberships: boolean
  membershipPlanIds?: string[]
  appliesToAllAccess: boolean
  accessPlanIds?: string[]
  maxUses?: number | null
  maxUsesPerUser?: number | null
  validFrom?: string
  expiresAt?: string | null
  isActive?: boolean
  lockedToUserId?: string | null
}

export interface AdminCouponQuery {
  page?: number
  limit?: number
  search?: string
  status?: CouponStatus
  source?: CouponSource
  sourceApp?: string
  discountType?: CouponDiscountType
  planId?: string
  accessPlanId?: string
}

export interface AdminCouponRedemption {
  id: string
  couponId: string
  couponCode: string
  source: CouponSource
  sourceApp?: string | null
  discountType: CouponDiscountType
  discountValue: number
  user: { id: string; email: string; name: string; businessName: string | null } | null
  business: { id: string; businessName: string } | null
  plan: { id: string; name: string } | null
  planName: string | null
  productType?: 'MEMBERSHIP' | 'ACCESS'
  accessPlan?: { id: string; name: string } | null
  accessPlanName?: string | null
  provider: string | null
  providerPaymentId: string | null
  originalAmount: number
  discountAmount: number
  finalAmount: number
  status: CouponRedemptionStatus
  reservedUntil: string | null
  redeemedAt: string | null
  createdAt: string
}

export interface AdminCouponRedemptionQuery {
  page?: number
  limit?: number
  search?: string
  status?: CouponRedemptionStatus
  couponId?: string
  planId?: string
  accessPlanId?: string
  businessId?: string
  source?: CouponSource
  from?: string
  to?: string
}

export interface AdminCouponStats {
  totalCoupons: number
  activeCoupons: number
  scheduledCoupons: number
  expiredCoupons: number
  totalRedemptions: number
  totalDiscountGiven: number
  redemptionsThisMonth: number
  discountThisMonth: number
}

// ─── Partner integrations ────────────────────────────────
export interface PartnerAccessCode {
  id: string
  code: string
  accessPlanId: string
  planName: string
  status: 'PENDING_PAYMENT' | 'UNUSED' | 'REDEEMED' | 'REVOKED'
  sourceApp?: string | null
  externalRef?: string | null
  recipientEmail?: string | null
  mode?: string
  redeemedAt?: string | null
  createdAt: string
}

export interface PartnerAccessCodeQuery {
  sourceApp?: string
  status?: string
  page?: number
  limit?: number
}

export interface CouponUserLookup {
  id: string
  email: string
  name: string
  role: string
  businessName: string | null
}

export interface CouponQuote {
  planId: string
  planName: string
  tier: string
  paymentPlan: string
  installments: number
  sliceDays: number
  originalAmount: number
  discountAmount: number
  finalAmount: number
  currency: 'GBP'
  coupon: {
    id: string
    code: string
    discountType: CouponDiscountType
    discountValue: number
    appliesToAllMemberships: boolean
    membershipPlanIds: string[]
    expiresAt: string | null
    lockedToUserId: string | null
    source: CouponSource
  } | null
}

// ─── Affiliate collaboration (delegated tasks + reports) ─────────────────
export type AdminAffiliateTaskStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'PENDING_BUSINESS_APPROVAL'
  | 'REVISION_REQUESTED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'CANCELLED'

export interface AdminAffiliateTask {
  id: string
  businessId: string
  source: 'PROGRAMME' | 'MANUAL'
  taskDefinitionId: string | null
  title: string
  description: string
  platforms: string[]
  status: AdminAffiliateTaskStatus
  category?: 'INTERNAL' | 'EXTERNAL'
  projectId?: string | null
  project?: { id: string; title: string; status: string } | null
  requiredSkills?: string[]
  deliverables?: string | null
  materials?: string | null
  requiresBusinessApproval?: boolean
  amReviewedAt?: string | null
  amReviewNotes?: string | null
  compensationModel?: string
  compensationAmount?: number | null
  compensationPence?: number | null
  compensationCurrency?: string
  billableToBusiness?: boolean
  businessChargeAmount?: number | null
  businessChargeStatus?: string
  paymentStatus?: string
  paidAt?: string | null
  freeDelegation?: boolean | null
  delegationQuotaSource?: string | null
  delegationQuotaLimit?: number | null
  delegationQuotaUsed?: number | null
  delegationQuotaUnlimited?: boolean | null
  delegationQuotaPeriodStart?: string | null
  followUpRequired?: boolean
  followUpNotes?: string | null
  assigneeId: string | null
  assignee?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    role: string
  } | null
  declineReason?: string | null
  business?: { id: string; businessName: string; email: string; userId?: string }
  taskDefinition?: { id: string; title: string } | null
  settlement?: AdminAffiliateSettlement | null
  dueAt: string | null
  submissionData: Record<string, unknown> | null
  revisionCount: number
  completedAt: string | null
  lastSyncError: string | null
  attachments?: Array<{
    id: string
    url: string
    fileName: string | null
    mimeType: string | null
    kind: string
  }>
  reviews?: Array<{
    id: string
    round: number
    decision: 'APPROVED' | 'CHANGES_REQUESTED'
    notes: string | null
    reviewedAt: string
    acknowledgedAt: string | null
  }>
  createdAt: string
  updatedAt: string
}

export interface AdminAffiliateTaskQuery {
  page?: number
  limit?: number
  status?: string
  source?: string
  platform?: string
  search?: string
  assigneeId?: string
  unassigned?: string
}

export type AdminAffiliateSettlementStatus =
  | 'NOT_REQUIRED'
  | 'PENDING_HOLD'
  | 'HELD'
  | 'SETTLING'
  | 'SETTLED'
  | 'RELEASED'
  | 'FAILED'

export type AdminAffiliateSettlementFunding = 'BUSINESS_WALLET' | 'PLATFORM'

export interface AdminAffiliateSettlement {
  id: string
  taskId: string
  businessId: string
  businessUserId: string
  affiliateUserId: string | null
  affiliateEmail: string | null
  currency: string
  fxBase: string
  fxQuote: string
  fxRate: string | number
  businessChargeAmount: string | number | null
  businessChargeCredits: string | number | null
  compensationAmount: string | number | null
  compensationPence: number | null
  compensationCredits: string | number | null
  platformFeePercent: string | number
  platformFeeCredits: string | number
  platformMarginCredits: string | number
  affiliatePayoutCredits: string | number
  fundingSource: AdminAffiliateSettlementFunding
  status: AdminAffiliateSettlementStatus
  holdId: string | null
  holdExpiresAt: string | null
  businessTransactionId: string | null
  affiliateTransactionId: string | null
  settlementReference: string | null
  failureReason: string | null
  heldAt: string | null
  settledAt: string | null
  releasedAt: string | null
  createdAt: string
  updatedAt: string
  task?: {
    id: string
    title: string
    status: string
    business?: { id: string; businessName: string; email: string }
    assignee?: {
      id: string
      email: string
      firstName: string | null
      lastName: string | null
      role: string
    } | null
  }
}

export interface AdminAffiliateSettlementQuery {
  page?: number
  limit?: number
  status?: AdminAffiliateSettlementStatus | ''
  fundingSource?: AdminAffiliateSettlementFunding | ''
  businessId?: string
  affiliateUserId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
}

export interface AffiliateSettlementSummary {
  held: number
  heldCount: number
  settledGross: number
  settledPayouts: number
  platformFees: number
  platformMargin: number
  platformRetention: number
  settledCount: number
  releasedCount: number
  failedCount: number
  notRequiredCount: number
  currency: string
}

export interface AdminAffiliateReport {
  id: string
  businessId: string
  affiliateUserId: string
  reason: string
  description: string
  status: 'PENDING' | 'VALID' | 'INVALID'
  adminNotes: string | null
  reviewedAt: string | null
  createdAt: string
  business?: { id: string; businessName: string; email: string }
  affiliate?: { id: string; email: string; firstName: string | null; lastName: string | null; role: string }
}

export interface AdminAffiliateReputation {
  userId: string
  role: string
  reputationScore: number
  experienceScore: number
  completedTasksCount: number
  failedTasksCount: number
  ratingAverage: number | null
  ratingCount: number
  events: Array<{
    id: string
    delta: number
    reason: string
    sourceType: string
    sourceId: string | null
    createdAt: string
  }>
  ratings: Array<{
    id: string
    rating: number
    comment: string | null
    createdAt: string
    business?: { businessName: string }
  }>
  reports: Array<{
    id: string
    reason: string
    status: string
    createdAt: string
    business?: { businessName: string }
  }>
}

// ─── Admin full user profile (drill-down) ─────────────────────────────────────

export interface AdminUserAccount {
  id: string
  email: string
  role: string
  firstName: string | null
  lastName: string | null
  name: string
  fullName: string | null
  jobTitle: string | null
  adminRole: string | null
  registrationSource: string | null
  referralCode: string | null
  referredBy: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
  twoFactorEnabled: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  tokenVersion: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Location node returned by Prisma for profiles. */
export interface AdminLocationNode {
  id: string
  name?: string | null
  [key: string]: unknown
}

export interface AdminBusinessProfileDetail {
  id: string
  userId: string
  businessName: string
  businessType: string
  country: string
  phone: string
  email: string
  isOnGoogle: boolean
  googlePlaceId: string | null
  address: string | null
  postcode: string | null
  industry: string | null
  category: string | null
  subCategory: string | null
  description: string | null
  website: string | null
  logoUrl: string | null
  openingHours: string | null
  socialMedia: string | null
  membershipLevel: string
  membershipTier: string
  membershipStatus: string
  membershipPlanName: string | null
  membershipExpiresAt: string | null
  membershipRecurringId: string | null
  stripeCustomerId: string | null
  paypalPayerId: string | null
  hasPaidVerificationFee: boolean
  verificationFeePaidAt: string | null
  trialAccessDays: number
  trialAccessExpiresAt: string | null
  apiKey: string | null
  localMallName: string | null
  localMallId: string | null
  proximityTier: string | null
  cityId: string | null
  city: AdminLocationNode | null
  boroughId: string | null
  borough: AdminLocationNode | null
  highStreetId: string | null
  highStreet: AdminLocationNode | null
  localMall: AdminLocationNode | null
  sectorId: string | null
  sector: AdminLocationNode | null
  categoryId: string | null
  categoryRef: AdminLocationNode | null
  subCategoryId: string | null
  subCategoryRef: AdminLocationNode | null
  locationAssignedAt: string | null
  accountManagerId: string | null
  accountManagerAssignedAt: string | null
  accountManager: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    role: string
  } | null
  acquiredByAffiliateId: string | null
  acquiredByAffiliateExternalId: string | null
  acquiredByAffiliateName: string | null
  acquiredByAffiliateRole: string | null
  onboardedByAffiliateId: string | null
  acquisitionSource: string | null
  acquisitionStatus: string | null
  acquisitionAttributedAt: string | null
  acquisitionVerifiedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  [key: string]: unknown
}

export interface AdminCustomerProfileDetail {
  id: string
  userId: string
  phone: string | null
  postcode: string | null
  loyaltyPoints: number
  platformUsage: string[]
  membershipStatus: string
  status: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  [key: string]: unknown
}

export interface AdminAgentProfileDetail {
  id: string
  userId: string
  phone: string | null
  postcode: string | null
  permissions: string[]
  availabilityStatus: string
  availableFrom: string | null
  reputationScore: number
  experienceScore: number
  completedTasksCount: number
  failedTasksCount: number
  status: string
  city: AdminLocationNode | null
  borough: AdminLocationNode | null
  highStreet: AdminLocationNode | null
  localMall: AdminLocationNode | null
  locationAssignedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  [key: string]: unknown
}

export interface AdminConsultantProfileDetail extends AdminAgentProfileDetail {
  specialisation: string
}

export interface AdminAccountManagerProfileDetail extends AdminAgentProfileDetail {
  assignedBusinesses: number
}

export interface AdminPlanReference {
  id: string
  name?: string
  [key: string]: unknown
}

export interface AdminSubscriptionRecord {
  id: string
  businessId?: string
  businessName?: string
  type?: string
  itemName?: string
  status: string
  startDate?: string
  endDate?: string
  amount?: number
  billingCycle?: string
  scope?: string
  planName?: string
  membershipPlanName?: string | null
  membershipTier?: string | null
  level?: string | null
  platform?: string | null
  provider?: string
  autoRenew?: boolean
  cancelAtPeriodEnd?: boolean
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  nextChargeAt?: string | null
  createdAt?: string
  [key: string]: unknown
}

export interface AdminPlatformPackageRecord {
  id: string
  platform: string
  packageName: string
  status: string
  limits: unknown
  externalPlanId: string | null
  planName: string | null
  planType: string | null
  expiresAt: string | null
  provider: string | null
  autoRenew: boolean
  nextChargeAt: string | null
  amount: number | null
  currency: string
  billingCycle: string | null
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AdminAccessPurchaseRecord {
  id: string
  accessPlanId: string
  accessPlanName: string
  durationDays: number
  amount: number
  currency: string
  status: string
  provider: string | null
  startsAt: string
  expiresAt: string
  createdAt: string
  [key: string]: unknown
}

export interface AdminWhitelabelGrant {
  id: string
  businessId: string
  clientId: string
  grantedBy: string | null
  createdAt: string
  client?: {
    clientId: string
    name: string
    platformSlug: string | null
    appUrl: string | null
  } | null
}

export interface AdminBillingTransactionRecord {
  id: string
  businessId: string
  amount: number
  description: string
  status: string
  platformPackageId: string | null
  provider: string | null
  providerPaymentId: string | null
  metadata: unknown
  createdAt: string
  [key: string]: unknown
}

export interface AdminCouponRedemptionRecord {
  id: string
  couponCode: string
  planName: string | null
  productType: string
  accessPlanName: string | null
  originalAmount: number
  discountAmount: number
  finalAmount: number
  status: string
  redeemedAt: string | null
  createdAt: string
  coupon?: { id: string; code: string; description: string | null } | null
  [key: string]: unknown
}

export interface AdminWalletTransactionRecord {
  id: string
  type: string
  amount: string | number
  balanceBefore: string | number
  balanceAfter: string | number
  currency: string
  platformName: string | null
  platformSlug: string | null
  category: string
  reference: string | null
  description: string | null
  status: string
  createdAt: string
  [key: string]: unknown
}

export interface AdminWalletRecord {
  id: string
  userId: string
  balance: string | number
  currency: string
  status: string
  dailyDebitLimit: string | number | null
  monthlyDebitLimit: string | number | null
  maxBalance: string | number | null
  lastTransactionAt: string | null
  createdAt: string
  updatedAt: string
  transactions: AdminWalletTransactionRecord[]
  topUpRequests: Array<{
    id: string
    amount: string | number
    status: string
    createdAt: string
    [key: string]: unknown
  }>
}

export interface AdminProgrammeTaskStatusRecord {
  id: string
  missionId: string
  status: 'not_started' | 'in_progress' | 'completed' | string
  createdAt: string
  updatedAt: string
}

export interface AdminBusinessProgrammeRecord {
  id: string
  businessId: string | null
  businessName: string
  sector: string
  currentDay: number
  status: string
  agentId: string | null
  agentName: string
  accountManagerId: string | null
  accountManagerName: string
  consultantId: string | null
  consultantName: string
  completedMissions: string[]
  startedAt: string
  extendedBy: number
  phaseId: string | null
  phase: { id: string; name: string; dayStart: number; dayEnd: number; description: string; color: string } | null
  taskStatuses: AdminProgrammeTaskStatusRecord[]
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface AdminTaskAssignmentRecord {
  id: string
  taskId: string
  userId: string
  userType: string
  status: string
  effectiveStatus: string
  assignedAt: string
  deadlineAt: string
  daysRemaining: number
  completedAt: string | null
  rewardGranted: boolean
  rewardPoints: number
  submissionData: unknown
  task: {
    id: string
    title: string
    description: string
    featureKey: string | null
    targetAudience: string
    accessScope: string
    taskSource: string
    submissionType: string
    platform: string
    externalAppName: string | null
    actionUrl: string | null
    actionLabel: string | null
    deadlineDays: number
    rewardPoints: number
    rewardCouponEnabled: boolean
    isActive: boolean
    createdAt: string
  }
  rewardCoupon: {
    id: string
    code: string
    discountType: string
    discountValue: number
    expiresAt: string | null
  } | null
}

export interface AdminAffiliateTaskRecord {
  id: string
  businessId: string
  business?: { id: string; businessName: string }
  title: string
  description: string
  category: string
  status: string
  assigneeId: string | null
  assigneeRole: string | null
  assignee?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  } | null
  dueAt: string | null
  compensationModel: string
  compensationAmount: number | null
  compensationPence: number | null
  billableToBusiness: boolean
  businessChargeAmount: number | null
  paymentStatus: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
  settlement: unknown
  [key: string]: unknown
}

export interface AdminFullUserProfile {
  account: AdminUserAccount
  businessProfile: AdminBusinessProfileDetail | null
  customerProfile: AdminCustomerProfileDetail | null
  agentProfile: AdminAgentProfileDetail | null
  consultantProfile: AdminConsultantProfileDetail | null
  accountManagerProfile: AdminAccountManagerProfileDetail | null
  membership: {
    level: string | null
    tier: string | null
    status: string | null
    planName: string | null
    expiresAt: string | null
    trialAccessDays: number | null
    trialAccessExpiresAt: string | null
    hasPaidVerificationFee: boolean | null
    verificationFeePaidAt: string | null
    ecosystemSubscriptions: AdminSubscriptionRecord[]
    recurringSubscriptions: Array<AdminSubscriptionRecord & { charges?: Array<Record<string, unknown>> }>
    installmentSubscriptions: Array<Record<string, unknown>>
    platformPackages: AdminPlatformPackageRecord[]
    accessPurchases: AdminAccessPurchaseRecord[]
    whitelabelGrants: AdminWhitelabelGrant[]
  }
  financials: {
    totalRevenue: number
    transactions: AdminBillingTransactionRecord[]
    couponRedemptions: AdminCouponRedemptionRecord[]
    wallet: AdminWalletRecord | null
  }
  programme: {
    programmes: AdminBusinessProgrammeRecord[]
    taskAssignments: AdminTaskAssignmentRecord[]
    taskSummary: {
      total: number
      completed: number
      expired: number
      inProgress: number
      pending: number
      outstanding: number
      progress: number
    }
  }
  affiliate: {
    tasks: AdminAffiliateTaskRecord[]
    reputationEvents: Array<{
      id: string
      delta: number
      reason: string
      sourceType: string
      sourceId: string | null
      createdAt: string
    }>
    ratingsReceived: Array<{
      id: string
      rating: number
      comment: string | null
      status: string
      createdAt: string
      business?: { id: string; businessName: string } | null
    }>
    reports: Array<{
      id: string
      reason: string
      description: string
      status: string
      adminNotes: string | null
      createdAt: string
      business?: { id: string; businessName: string } | null
    }>
    reputationScore: number
  }
  support: {
    tickets: Array<{
      id: string
      subject: string
      message: string
      fromName: string
      fromType: string
      status: string
      priority: string
      assignedTo: string | null
      createdAt: string
      updatedAt: string
    }>
    notifications: Array<{
      id: string
      type: string
      title: string
      message: string
      read: boolean
      data: unknown
      createdAt: string
    }>
  }
  meta: { generatedAt: string }
}

// ─── Referral rewards ─────────────────────────────────
export interface AdminReferralReferrer {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  displayName: string
  role: string
  referralCode: string | null
  joinedAt: string
  totalReferrals: number
  creditedCommissions: number
  skippedEvaluations: number
  earnedCredits: number
  earnedGbp: number
  lastActivityAt: string | null
}

export interface AdminReferralReferrersResponse {
  success: boolean
  data: AdminReferralReferrer[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface RoleRewardConfig {
  rewardType: 'PERCENTAGE' | 'FIXED'
  percentage?: number | null
  fixedAmountGbp?: number | null
}

export interface AdminReferralConfig {
  id: string
  version: number
  isCurrent: boolean
  isActive: boolean
  rewardMode: 'SINGLE' | 'PER_ROLE'
  rewardType: 'PERCENTAGE' | 'FIXED'
  percentage: number | null
  fixedAmountGbp: number | null
  roleRewards: Record<string, RoleRewardConfig>
  eligibleRoles: string[]
  qualifyAllMemberships: boolean
  qualifyAllAccessPasses: boolean
  qualifiedMembershipPlanIds: string[]
  qualifiedAccessPlanIds: string[]
  commissionFrequency: 'ONE_TIME' | 'RECURRING'
  note: string | null
  changes: Array<{ field: string; from: unknown; to: unknown }>
  createdByUserId: string
  createdAt: string
}

export interface PublishReferralConfigInput {
  isActive?: boolean
  rewardMode: 'SINGLE' | 'PER_ROLE'
  rewardType: 'PERCENTAGE' | 'FIXED'
  percentage?: number | null
  fixedAmountGbp?: number | null
  roleRewards?: Record<string, RoleRewardConfig>
  eligibleRoles: string[]
  qualifyAllMemberships?: boolean
  qualifyAllAccessPasses?: boolean
  qualifiedMembershipPlanIds?: string[]
  qualifiedAccessPlanIds?: string[]
  commissionFrequency: 'ONE_TIME' | 'RECURRING'
  note?: string
}

export interface AdminReferralCommission {
  id: string
  sourceType: 'MEMBERSHIP' | 'ACCESS_PASS'
  sourceName: string | null
  purchaseAmountGbp: number
  commissionAmountGbp: number
  commissionCredits: number
  status: string
  referredUserId: string
  referredName: string | null
  referredEmail: string | null
  configVersion: number | null
  createdAt: string
}

export interface AdminReferralDetail {
  referrer: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    role: string
    referralCode: string | null
    createdAt: string
  }
  summary: {
    totalReferrals: number
    creditedReferrals: number
    totalEarnedCredits: number
    totalEarnedGbp: number
    creditedCommissionCount: number
    configActive: boolean
    configVersion: number | null
  }
  referredUsers: Array<{
    id: string
    email: string
    displayName: string
    role: string
    joinedAt: string
    earnedCredits: number
    earnedGbp: number
    creditedCount: number
    evaluationCount: number
    lastActivityAt: string | null
  }>
  history: AdminReferralCommission[]
  config: AdminReferralConfig | null
}
