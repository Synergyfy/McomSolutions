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

export interface MembershipPlan {
  id: string
  name: string
  description: string
  price: number
  billingCycle: string
  platformAccess: string[]
  usageLimits: Record<string, number>
  permissions: string[]
  archived: boolean
  createdAt?: string
}

export interface PackageTemplate {
  id: string
  name: string
  platform: string
  description: string
  price: number
  billingCycle: string
  features: string[]
  usageLimits: Record<string, number>
  accessRights: string[]
  archived: boolean
  createdAt?: string
}

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
  populationActivity: string
  businessCount: number
  activeCampaigns: number
  rewardsParticipation: string
  healthScore: number
  manager: string
  area: string
  region: string
  engagement: string
  health: string
  activity: string
}

export interface HighStreet {
  id: string
  name: string
  borough: string
  status: string
  businessCount: number
}

export interface LocalMall {
  id: string
  name: string
  postcodes: string[]
  borough: string
  primaryHighStreet: string
  additionalHighStreets: string[]
  status: string
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
  platformAccess: string[]
  usageLimits: Record<string, number>
  permissions: string[]
}

export interface UpdatePlanInput extends Partial<CreatePlanInput> {
  archived?: boolean
}

export interface CreatePackageInput {
  name: string
  platform: string
  description: string
  price: number
  billingCycle: string
  features: string[]
  usageLimits: Record<string, number>
  accessRights: string[]
}

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

export interface ExternalPlan {
  id: string
  name: string
  description?: string
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

export interface CreateExternalPlanInput {
  name: string
  platform: string
  description?: string
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
