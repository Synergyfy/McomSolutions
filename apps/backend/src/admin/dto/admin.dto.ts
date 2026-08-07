import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsDateString,
  IsObject,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

// --- Generic Query DTO ---
export class AdminQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'Acme' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt' })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}

// --- User Profiles DTOs ---
export class CreateBusinessUserDto {
  @ApiProperty({ example: 'Eco Market' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'info@ecomarket.co.uk' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+44 20 7234 5678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Silver Normal' })
  @IsOptional()
  @IsString()
  membership?: string;

  @ApiPropertyOptional({ type: [String], example: ['Mall'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformAccess?: string[];

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '£12k' })
  @IsOptional()
  @IsString()
  revenue?: string;

  @ApiPropertyOptional({ example: 'Mcom Mall' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  googleVerified?: boolean;
}

export class CreateCustomerUserDto {
  @ApiProperty({ example: 'Alice Johnson' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'alice@email.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+44 7700 100001' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsNumber()
  loyaltyPoints?: number;

  @ApiPropertyOptional({ type: [String], example: ['Rewards'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformUsage?: string[];

  @ApiPropertyOptional({ example: 'Bronze' })
  @IsOptional()
  @IsString()
  membershipStatus?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateAgentUserDto {
  @ApiProperty({ example: 'David Brown' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'david@mcomsolutions.co.uk' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+44 7700 200001' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ type: [String], example: ['View Businesses'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateConsultantUserDto {
  @ApiProperty({ example: 'Frank Taylor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'frank@consultancy.com' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+44 7700 300001' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Digital Transformation' })
  @IsOptional()
  @IsString()
  specialisation?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateAccountManagerDto {
  @ApiProperty({ example: 'Grace Anderson' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'grace@mcomsolutions.co.uk' })
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: '+44 7700 400001' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  assignedBusinesses?: number;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;
}

// --- Plan & Package DTOs ---
export class CreateMembershipPlanDto {
  @ApiProperty({ example: 'Gold' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Perfect for established businesses' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 350 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'Monthly' })
  @IsString()
  @IsNotEmpty()
  billingCycle: string;

  @ApiProperty({ type: [String], example: ['Loyalty', 'Mall'] })
  @IsArray()
  @IsString({ each: true })
  platformAccess: string[];

  @ApiProperty({ example: { rewards: 2000, campaigns: 20 } })
  @IsObject()
  usageLimits: Record<string, number>;

  @ApiProperty({ type: [String], example: ['API Access'] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class CreatePackageTemplateDto {
  @ApiProperty({ example: 'Loyalty Pro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'MCOM Rewards' })
  @IsString()
  @IsNotEmpty()
  platform: string;

  @ApiProperty({ example: 'Advanced loyalty suite' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 99 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 'Monthly' })
  @IsString()
  @IsNotEmpty()
  billingCycle: string;

  @ApiProperty({ type: [String], example: ['Campaign Builder'] })
  @IsArray()
  @IsString({ each: true })
  features: string[];

  @ApiProperty({ example: { members: 5000 } })
  @IsObject()
  usageLimits: Record<string, number>;

  @ApiProperty({ type: [String], example: ['Export Data'] })
  @IsArray()
  @IsString({ each: true })
  accessRights: string[];
}

export class CreateSubscriptionDto {
  @ApiPropertyOptional({ example: 'business-id' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiProperty({ example: 'Global Retailers Ltd' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 'Membership' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 'Gold Pro+' })
  @IsString()
  @IsNotEmpty()
  itemName: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-12-31T00:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 900 })
  @IsNumber()
  amount: number;

  @ApiProperty({ example: 'Monthly' })
  @IsString()
  @IsNotEmpty()
  billingCycle: string;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// --- Platform Access Control ---
export class UpdateEcosystemPlatformDto {
  @ApiPropertyOptional({ example: 'Enabled' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  visible?: boolean;

  @ApiPropertyOptional({ example: 'E-commerce marketplace' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreatePlatformLaunchRuleDto {
  @ApiProperty({ example: 'rewards' })
  @IsString()
  @IsNotEmpty()
  platformId: string;

  @ApiProperty({ example: 'Bronze' })
  @IsString()
  @IsNotEmpty()
  requiredMembership: string;

  @ApiProperty({ example: 'Loyalty Starter' })
  @IsString()
  @IsNotEmpty()
  requiredPackage: string;

  @ApiProperty({ type: [String], example: ['Launch Platform'] })
  @IsArray()
  @IsString({ each: true })
  requiredPermissions: string[];

  @ApiProperty({ example: 'Business must be verified' })
  @IsString()
  @IsNotEmpty()
  launchConditions: string;

  @ApiProperty({ example: '/platform/rewards' })
  @IsString()
  @IsNotEmpty()
  redirectRule: string;

  @ApiProperty({ example: 'Membership + Package required' })
  @IsString()
  @IsNotEmpty()
  accessRule: string;
}

// --- Permission Matrix ---
export class UpdatePermissionRoleDto {
  @ApiProperty({ example: { create: true, read: true, update: true, delete: false } })
  @IsObject()
  permissions: Record<string, boolean>;
}

// --- Finance & Billing ---
export class RecordPaymentDto {
  @ApiPropertyOptional({ example: 'business-id' })
  @IsOptional()
  @IsString()
  businessId?: string;

  @ApiProperty({ example: 'Global Retailers Ltd' })
  @IsString()
  @IsNotEmpty()
  businessName: string;

  @ApiProperty({ example: 900 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'Stripe' })
  @IsString()
  @IsNotEmpty()
  method: string;

  @ApiProperty({ example: 'Completed' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ example: 'INV-001' })
  @IsString()
  @IsNotEmpty()
  invoice: string;

  @ApiProperty({ example: 'Membership' })
  @IsString()
  @IsNotEmpty()
  type: string;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ example: 'Refunded' })
  @IsString()
  @IsNotEmpty()
  status: string;
}

// --- Communication ---
export class CreateBroadcastNotificationDto {
  @ApiProperty({ example: 'Welcome to MCOM' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Welcome to the MCOM ecosystem!' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({ type: [String], example: ['Businesses'] })
  @IsArray()
  @IsString({ each: true })
  audience: string[];

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 'Draft' })
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSupportTicketDto {
  @ApiPropertyOptional({ example: 'Resolved' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'High' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ example: 'David Brown' })
  @IsOptional()
  @IsString()
  assignedTo?: string;
}

// --- System Configuration ---
export class UpdateSystemSettingsDto {
  @ApiPropertyOptional({ example: 'MCOMSolutions' })
  @IsOptional()
  @IsString()
  brandName?: string;

  @ApiPropertyOptional({ example: 'support@mcomsolutions.co.uk' })
  @IsOptional()
  @IsString()
  supportEmail?: string;

  @ApiPropertyOptional({ example: 'GBP' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  sessionTimeout?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  maxLoginAttempts?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional({ example: 'Stripe' })
  @IsOptional()
  @IsString()
  paymentGateway?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowRegistration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  authConfig?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  registrationFlow?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  businessProfileConfig?: any;
}

// --- Locality & Regional Management ---
export class CreateBoroughDto {
  @ApiProperty({ example: 'Westminster' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'High' })
  @IsString()
  @IsNotEmpty()
  populationActivity: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  businessCount?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  activeCampaigns?: number;

  @ApiProperty({ example: '88%' })
  @IsString()
  @IsNotEmpty()
  rewardsParticipation: string;

  @ApiProperty({ example: 94 })
  @IsNumber()
  healthScore: number;

  @ApiProperty({ example: 'James Wilson' })
  @IsString()
  @IsNotEmpty()
  manager: string;

  @ApiProperty({ example: 'Central London' })
  @IsString()
  @IsNotEmpty()
  area: string;

  @ApiProperty({ example: 'West End' })
  @IsString()
  @IsNotEmpty()
  region: string;

  @ApiProperty({ example: '94.2%' })
  @IsString()
  @IsNotEmpty()
  engagement: string;

  @ApiProperty({ example: 'A+' })
  @IsString()
  @IsNotEmpty()
  health: string;

  @ApiProperty({ example: 'Active Operational' })
  @IsString()
  @IsNotEmpty()
  activity: string;
}

export class CreateHighStreetDto {
  @ApiProperty({ example: 'Rye Lane' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Southwark' })
  @IsString()
  @IsNotEmpty()
  borough: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  businessCount?: number;
}

export class CreateLocalMallDto {
  @ApiProperty({ example: 'Peckham LocalMall' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: [String], example: ['SE15', 'SE5'] })
  @IsArray()
  @IsString({ each: true })
  postcodes: string[];

  @ApiProperty({ example: 'Southwark' })
  @IsString()
  @IsNotEmpty()
  borough: string;

  @ApiProperty({ example: 'Rye Lane' })
  @IsString()
  @IsNotEmpty()
  primaryHighStreet: string;

  @ApiProperty({ type: [String], example: ['Peckham Road'] })
  @IsArray()
  @IsString({ each: true })
  additionalHighStreets: string[];

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: 'Supporting local businesses' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Peckham LocalMall is the digital town centre...' })
  @IsString()
  @IsNotEmpty()
  longDescription: string;

  @ApiProperty({ example: 'peckham-localmall' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiProperty({ example: '#2563EB' })
  @IsString()
  @IsNotEmpty()
  primaryColour: string;

  @ApiProperty({ example: '#F59E0B' })
  @IsString()
  @IsNotEmpty()
  secondaryColour: string;

  @ApiProperty({ example: 'Welcome to Peckham LocalMall' })
  @IsString()
  @IsNotEmpty()
  welcomeMessage: string;

  @ApiProperty({ example: 'Supporting Local Businesses Together' })
  @IsString()
  @IsNotEmpty()
  tagline: string;

  @ApiProperty({ example: '2.5 miles' })
  @IsString()
  @IsNotEmpty()
  radiusCoverage: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowBusinessesOutsidePostcode?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowVirtualBusinesses?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowHomeBusinesses?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireVerification?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireAuditCompletion?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireMembershipApproval?: boolean;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  leadConsultant?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedAccountManagers?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedAgents?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportTeam?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  categoryPriorities?: any;
}

export class UpdateMembershipPlanDto {
  @ApiPropertyOptional({ example: 'Gold' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Perfect for established businesses' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 350 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 'Monthly' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional({ type: [String], example: ['Loyalty', 'Mall'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platformAccess?: string[];

  @ApiPropertyOptional({ example: { rewards: 2000 } })
  @IsOptional()
  @IsObject()
  usageLimits?: Record<string, any>;

  @ApiPropertyOptional({ type: [String], example: ['Full Dashboard'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class UpdatePackageTemplateDto {
  @ApiPropertyOptional({ example: 'Loyalty Pro' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'MCOM Rewards' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: 'Advanced loyalty suite' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 99 })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({ example: 'Monthly' })
  @IsOptional()
  @IsString()
  billingCycle?: string;

  @ApiPropertyOptional({ type: [String], example: ['Campaign Builder'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: { members: 5000 } })
  @IsOptional()
  @IsObject()
  usageLimits?: Record<string, any>;

  @ApiPropertyOptional({ type: [String], example: ['Export Data'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessRights?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class UpdateBoroughDto {
  @ApiPropertyOptional({ example: 'Westminster' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'High' })
  @IsOptional()
  @IsString()
  populationActivity?: string;

  @ApiPropertyOptional({ example: 452 })
  @IsOptional()
  @IsNumber()
  businessCount?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsNumber()
  activeCampaigns?: number;

  @ApiPropertyOptional({ example: '88%' })
  @IsOptional()
  @IsString()
  rewardsParticipation?: string;

  @ApiPropertyOptional({ example: 94 })
  @IsOptional()
  @IsNumber()
  healthScore?: number;

  @ApiPropertyOptional({ example: 'James Wilson' })
  @IsOptional()
  @IsString()
  manager?: string;

  @ApiPropertyOptional({ example: 'Central London' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: 'West End' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: '94.2%' })
  @IsOptional()
  @IsString()
  engagement?: string;

  @ApiPropertyOptional({ example: 'A+' })
  @IsOptional()
  @IsString()
  health?: string;

  @ApiPropertyOptional({ example: 'Active Operational' })
  @IsOptional()
  @IsString()
  activity?: string;
}

export class UpdateHighStreetDto {
  @ApiPropertyOptional({ example: 'Rye Lane' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Southwark' })
  @IsOptional()
  @IsString()
  borough?: string;

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 156 })
  @IsOptional()
  @IsNumber()
  businessCount?: number;
}

export class UpdateLocalMallDto {
  @ApiPropertyOptional({ example: 'Peckham LocalMall' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ type: [String], example: ['SE15', 'SE5'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  postcodes?: string[];

  @ApiPropertyOptional({ example: 'Southwark' })
  @IsOptional()
  @IsString()
  borough?: string;

  @ApiPropertyOptional({ example: 'Rye Lane' })
  @IsOptional()
  @IsString()
  primaryHighStreet?: string;

  @ApiPropertyOptional({ type: [String], example: ['Peckham Road'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalHighStreets?: string[];

  @ApiPropertyOptional({ example: 'Active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 'Supporting local businesses' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Peckham LocalMall is the digital town centre...' })
  @IsOptional()
  @IsString()
  longDescription?: string;

  @ApiPropertyOptional({ example: 'peckham-localmall' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '#2563EB' })
  @IsOptional()
  @IsString()
  primaryColour?: string;

  @ApiPropertyOptional({ example: '#F59E0B' })
  @IsOptional()
  @IsString()
  secondaryColour?: string;

  @ApiPropertyOptional({ example: 'Welcome to Peckham LocalMall' })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiPropertyOptional({ example: 'Supporting Local Businesses Together' })
  @IsOptional()
  @IsString()
  tagline?: string;

  @ApiPropertyOptional({ example: '2.5 miles' })
  @IsOptional()
  @IsString()
  radiusCoverage?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  allowBusinessesOutsidePostcode?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowVirtualBusinesses?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allowHomeBusinesses?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireVerification?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  requireAuditCompletion?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requireMembershipApproval?: boolean;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  leadConsultant?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedAccountManagers?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedAgents?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportTeam?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  categoryPriorities?: any;
}

export class UpdatePlatformLaunchRuleDto {
  @ApiPropertyOptional({ example: 'rewards' })
  @IsOptional()
  @IsString()
  platformId?: string;

  @ApiPropertyOptional({ example: 'Bronze' })
  @IsOptional()
  @IsString()
  requiredMembership?: string;

  @ApiPropertyOptional({ example: 'Loyalty Starter' })
  @IsOptional()
  @IsString()
  requiredPackage?: string;

  @ApiPropertyOptional({ type: [String], example: ['Launch Platform'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredPermissions?: string[];

  @ApiPropertyOptional({ example: 'Business must be verified' })
  @IsOptional()
  @IsString()
  launchConditions?: string;

  @ApiPropertyOptional({ example: '/platform/rewards' })
  @IsOptional()
  @IsString()
  redirectRule?: string;

  @ApiPropertyOptional({ example: 'Membership + Package required' })
  @IsOptional()
  @IsString()
  accessRule?: string;
}

export class UpdateBroadcastNotificationDto {
  @ApiPropertyOptional({ example: 'Welcome to MCOM' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Welcome to the MCOM ecosystem!' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ type: [String], example: ['Businesses'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  audience?: string[];

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ example: 'Draft' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  sentCount?: number;
}

export class ClearAuditLogsDto {
  @ApiProperty({ example: 'CONFIRM' })
  @IsString()
  @IsNotEmpty()
  confirm: string;
}
