import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ===================== TYPES =====================

export interface BusinessUser {
  id: number; name: string; email: string; phone: string;
  membership: string; platformAccess: string[]; status: 'Active' | 'Suspended' | 'Pending' | 'Verified';
  revenue: string; source: string; joined: string; googleVerified: boolean;
}

export interface CustomerUser {
  id: number; name: string; email: string; phone: string;
  loyaltyPoints: number; platformUsage: string[]; membershipStatus: string; status: 'Active' | 'Suspended';
}

export interface AgentUser {
  id: number; name: string; email: string; phone: string;
  permissions: string[]; status: 'Active' | 'Deactivated';
}

export interface ConsultantUser {
  id: number; name: string; email: string; phone: string; specialisation: string; status: 'Active' | 'Inactive';
}

export interface AccountManager {
  id: number; name: string; email: string; phone: string; assignedBusinesses: number; status: 'Active' | 'Inactive';
}

export interface MembershipPlan {
  id: string; name: string; description: string; price: number; billingCycle: 'Monthly' | 'Quarterly' | 'Yearly';
  platformAccess: string[]; usageLimits: Record<string, number>; permissions: string[]; archived: boolean;
}

export interface Package {
  id: number; name: string; platform: string; description: string; price: number;
  billingCycle: 'Monthly' | 'Quarterly' | 'Yearly'; features: string[]; usageLimits: Record<string, number>;
  accessRights: string[]; archived: boolean;
}

export interface Subscription {
  id: number; businessName: string; type: 'Membership' | 'Package'; itemName: string;
  status: 'Active' | 'Expired' | 'Cancelled' | 'Pending' | 'Suspended';
  startDate: string; endDate: string; amount: number; billingCycle: string;
}

export interface Platform {
  id: string; name: string; description: string; status: 'Enabled' | 'Disabled' | 'Maintenance' | 'Restricted';
  icon: string; launchDate: string; totalUsers: number; visible: boolean;
}

export interface PermissionRole {
  role: string; permissions: { create: boolean; read: boolean; update: boolean; delete: boolean; approve: boolean; launch: boolean; manage: boolean; configure: boolean; };
}

export interface Payment {
  id: number; businessName: string; amount: number; currency: string; method: string;
  status: 'Completed' | 'Pending' | 'Failed' | 'Refunded'; date: string; invoice: string; type: 'Membership' | 'Package' | 'One-time';
}

export interface Notification {
  id: number; title: string; message: string; audience: ('Businesses' | 'Customers' | 'Agents' | 'Consultants' | 'Account Managers')[];
  scheduledDate: string; status: 'Sent' | 'Scheduled' | 'Draft'; sentCount: number; createdAt: string;
}

export interface SupportTicket {
  id: number; subject: string; message: string; from: string; fromType: string;
  status: 'Open' | 'Resolved' | 'Escalated'; priority: 'Low' | 'Medium' | 'High';
  assignedTo: string; createdAt: string; updatedAt: string;
}

export interface AuditLog {
  id: number; action: string; adminName: string; targetType: string; targetName: string;
  details: string; timestamp: string; category: string;
}

export interface SystemSettings {
  brandName: string; supportEmail: string; currency: string;
  sessionTimeout: number; maxLoginAttempts: number;
  emailEnabled: boolean; smsEnabled: boolean; paymentGateway: string;
  maintenanceMode: boolean; allowRegistration: boolean;
}

export interface AuthConfig {
  loginEnabled: boolean; registrationEnabled: boolean; ssoEnabled: boolean;
  passwordMinLength: number; passwordRequireSpecial: boolean; passwordRequireNumber: boolean;
  sessionDuration: number; maxSessionsPerUser: number;
}

export interface RegistrationFlow {
  businessFields: string[]; customerFields: string[];
  requireBusinessVerification: boolean; requireEmailVerification: boolean;
  autoApproveBusinesses: boolean; autoApproveCustomers: boolean;
}

export interface BusinessProfileConfig {
  fields: string[]; storefrontEnabled: boolean; googleFieldsEnabled: boolean;
  locationFields: string[]; mediaFields: string[];
}

export interface PlatformLaunchRule {
  id: number; platformId: string; requiredMembership: string; requiredPackage: string;
  requiredPermissions: string[]; launchConditions: string; redirectRule: string; accessRule: string;
}

export interface Integration {
  id: number; name: string; type: string; status: 'Connected' | 'Disconnected' | 'Error';
  lastSync: string; connectedDate: string;
}

export interface ApiKey {
  id: number; name: string; key: string; permissions: string[];
  status: 'Active' | 'Revoked'; lastUsed: string; createdAt: string;
}

export interface RevenueRecord {
  date: string; amount: number; type: string; source: string;
}

// ===================== CONTEXT TYPE =====================

interface AdminDataContextType {
  businesses: BusinessUser[]; customers: CustomerUser[]; agents: AgentUser[];
  consultants: ConsultantUser[]; accountManagers: AccountManager[];
  membershipPlans: MembershipPlan[]; packages: Package[];
  subscriptions: Subscription[]; platforms: Platform[];
  permissionRoles: PermissionRole[]; payments: Payment[];
  notifications: Notification[]; supportTickets: SupportTicket[];
  auditLogs: AuditLog[]; settings: SystemSettings;
  authConfig: AuthConfig; registrationFlow: RegistrationFlow;
  businessProfileConfig: BusinessProfileConfig; launchRules: PlatformLaunchRule[];
  integrations: Integration[]; apiKeys: ApiKey[]; revenueRecords: RevenueRecord[];
  addBusiness: (b: Omit<BusinessUser, 'id'>) => void; updateBusiness: (id: number, u: Partial<BusinessUser>) => void; deleteBusiness: (id: number) => void;
  addCustomer: (c: Omit<CustomerUser, 'id'>) => void; updateCustomer: (id: number, u: Partial<CustomerUser>) => void; deleteCustomer: (id: number) => void;
  addAgent: (a: Omit<AgentUser, 'id'>) => void; updateAgent: (id: number, u: Partial<AgentUser>) => void; deleteAgent: (id: number) => void;
  addConsultant: (c: Omit<ConsultantUser, 'id'>) => void; updateConsultant: (id: number, u: Partial<ConsultantUser>) => void; deleteConsultant: (id: number) => void;
  addAccountManager: (a: Omit<AccountManager, 'id'>) => void; updateAccountManager: (id: number, u: Partial<AccountManager>) => void; deleteAccountManager: (id: number) => void;
  addMembershipPlan: (m: Omit<MembershipPlan, 'id'>) => void; updateMembershipPlan: (id: string, u: Partial<MembershipPlan>) => void; deleteMembershipPlan: (id: string) => void;
  addPackage: (p: Omit<Package, 'id'>) => void; updatePackage: (id: number, u: Partial<Package>) => void; deletePackage: (id: number) => void;
  addSubscription: (s: Omit<Subscription, 'id'>) => void; updateSubscription: (id: number, u: Partial<Subscription>) => void;
  updatePlatform: (id: string, u: Partial<Platform>) => void;
  updatePermissionRole: (role: string, u: Partial<PermissionRole['permissions']>) => void;
  addPayment: (p: Omit<Payment, 'id'>) => void; updatePayment: (id: number, u: Partial<Payment>) => void;
  addNotification: (n: Omit<Notification, 'id'>) => void; updateNotification: (id: number, u: Partial<Notification>) => void; deleteNotification: (id: number) => void;
  addSupportTicket: (t: Omit<SupportTicket, 'id'>) => void; updateSupportTicket: (id: number, u: Partial<SupportTicket>) => void;
  addAuditLog: (l: Omit<AuditLog, 'id'>) => void; clearAuditLogs: () => void;
  updateSettings: (s: Partial<SystemSettings>) => void;
  updateAuthConfig: (a: Partial<AuthConfig>) => void;
  updateRegistrationFlow: (r: Partial<RegistrationFlow>) => void;
  updateBusinessProfileConfig: (b: Partial<BusinessProfileConfig>) => void;
  addLaunchRule: (r: Omit<PlatformLaunchRule, 'id'>) => void; updateLaunchRule: (id: number, u: Partial<PlatformLaunchRule>) => void; deleteLaunchRule: (id: number) => void;
  addIntegration: (i: Omit<Integration, 'id'>) => void; updateIntegration: (id: number, u: Partial<Integration>) => void;
  addApiKey: (a: Omit<ApiKey, 'id'>) => void; updateApiKey: (id: number, u: Partial<ApiKey>) => void;
  addRevenueRecord: (r: RevenueRecord) => void;
}

// ===================== DEFAULTS =====================

const DEFAULT_BUSINESSES: BusinessUser[] = [
  { id: 1, name: "Global Retailers Ltd", email: "contact@globalretailers.com", phone: "+44 20 7123 4567", membership: "Gold Pro+", platformAccess: ["Loyalty", "Mall", "Audit"], status: "Active", revenue: "£124k", source: "GBS Loyalty", joined: "2026-03-12", googleVerified: true },
  { id: 2, name: "Eco Market", email: "info@ecomarket.co.uk", phone: "+44 20 7234 5678", membership: "Silver Normal", platformAccess: ["Mall"], status: "Active", revenue: "£12k", source: "Mcom Mall", joined: "2026-03-15", googleVerified: false },
  { id: 3, name: "Fashion Hub", email: "hello@fashionhub.com", phone: "+44 20 7345 6789", membership: "Gold Pro", platformAccess: ["Rewards", "Mall"], status: "Verified", revenue: "£45k", source: "Mcom Rewards", joined: "2026-03-18", googleVerified: true },
  { id: 4, name: "Tech Solutions", email: "support@techsolutions.io", phone: "+44 20 7456 7890", membership: "Platinum Normal", platformAccess: ["Loyalty", "Audit", "Expo"], status: "Active", revenue: "£890k", source: "GBS Audit", joined: "2026-03-20", googleVerified: true },
  { id: 5, name: "Local Deli", email: "orders@localdeli.co.uk", phone: "+44 20 7567 8901", membership: "Bronze Normal", platformAccess: ["Loyalty"], status: "Pending", revenue: "£2.5k", source: "GBS Loyalty", joined: "2026-03-22", googleVerified: false },
  { id: 6, name: "Urban Outfitters", email: "info@urbanoutfitters.uk", phone: "+44 20 7678 9012", membership: "Gold Pro+", platformAccess: ["Rewards", "Mall", "Loyalty"], status: "Active", revenue: "£320k", source: "Mcomq Link", joined: "2026-03-24", googleVerified: true },
];

const DEFAULT_CUSTOMERS: CustomerUser[] = [
  { id: 1, name: "Alice Johnson", email: "alice@email.com", phone: "+44 7700 100001", loyaltyPoints: 2450, platformUsage: ["Rewards", "Mall"], membershipStatus: "Gold Loyalty", status: "Active" },
  { id: 2, name: "Bob Williams", email: "bob@email.com", phone: "+44 7700 100002", loyaltyPoints: 820, platformUsage: ["Mall"], membershipStatus: "None", status: "Active" },
  { id: 3, name: "Carol Davis", email: "carol@email.com", phone: "+44 7700 100003", loyaltyPoints: 5100, platformUsage: ["Rewards", "Spin", "Mall"], membershipStatus: "Platinum Loyalty", status: "Active" },
];

const DEFAULT_AGENTS: AgentUser[] = [
  { id: 1, name: "David Brown", email: "david@mcomsolutions.co.uk", phone: "+44 7700 200001", permissions: ["View Businesses", "Edit Businesses"], status: "Active" },
  { id: 2, name: "Eve Wilson", email: "eve@mcomsolutions.co.uk", phone: "+44 7700 200002", permissions: ["View Customers", "Edit Customers", "Support Access"], status: "Active" },
];

const DEFAULT_CONSULTANTS: ConsultantUser[] = [
  { id: 1, name: "Frank Taylor", email: "frank@consultancy.com", phone: "+44 7700 300001", specialisation: "Digital Transformation", status: "Active" },
];

const DEFAULT_ACCOUNT_MANAGERS: AccountManager[] = [
  { id: 1, name: "Grace Anderson", email: "grace@mcomsolutions.co.uk", phone: "+44 7700 400001", assignedBusinesses: 12, status: "Active" },
  { id: 2, name: "Henry Clark", email: "henry@mcomsolutions.co.uk", phone: "+44 7700 400002", assignedBusinesses: 8, status: "Active" },
];

const DEFAULT_MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: 'bronze', name: 'Bronze', description: 'Perfect for local brands and new startups.', price: 10, billingCycle: 'Monthly', platformAccess: ['Loyalty'], usageLimits: { rewards: 100, campaigns: 1, stores: 1, spins: 0, audits: 0, expos: 0 }, permissions: ['Basic Dashboard'], archived: false },
  { id: 'silver', name: 'Silver', description: 'Advanced tools for growing teams.', price: 75, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall'], usageLimits: { rewards: 500, campaigns: 5, stores: 3, spins: 0, audits: 0, expos: 0 }, permissions: ['Standard Dashboard', 'Campaign Access'], archived: false },
  { id: 'gold', name: 'Gold', description: 'Scale your operations with priority access.', price: 350, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards'], usageLimits: { rewards: 2000, campaigns: 20, stores: 10, spins: 100, audits: 5, expos: 0 }, permissions: ['Full Dashboard', 'API Access', 'Priority Support'], archived: false },
  { id: 'platinum', name: 'Platinum', description: 'Tailored solutions for market leaders.', price: 1200, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards', 'Audit', 'Expo'], usageLimits: { rewards: 10000, campaigns: 100, stores: 50, spins: 500, audits: 50, expos: 10 }, permissions: ['Full Dashboard', 'API Access', 'Dedicated AM', 'Executive Reports'], archived: false },
];

const DEFAULT_PACKAGES: Package[] = [
  { id: 1, name: 'Loyalty Starter', platform: 'MCOM Rewards', description: 'Basic loyalty tools.', price: 29, billingCycle: 'Monthly', features: ['Points Management', 'Basic Rewards', 'Member Dashboard'], usageLimits: { members: 500, rewards: 3 }, accessRights: ['View Analytics'], archived: false },
  { id: 2, name: 'Loyalty Pro', platform: 'MCOM Rewards', description: 'Advanced loyalty suite.', price: 99, billingCycle: 'Monthly', features: ['Points Management', 'Advanced Rewards', 'Member Dashboard', 'Campaign Builder', 'Analytics Suite'], usageLimits: { members: 5000, rewards: 20 }, accessRights: ['View Analytics', 'Export Data'], archived: false },
  { id: 3, name: 'Mall Basic', platform: 'MCOM Mall', description: 'Get your store online.', price: 49, billingCycle: 'Monthly', features: ['Storefront', 'Product Listings', 'Order Management'], usageLimits: { products: 100, orders: 500 }, accessRights: ['Store Admin'], archived: false },
  { id: 4, name: 'Mall Enterprise', platform: 'MCOM Mall', description: 'Full marketplace power.', price: 199, billingCycle: 'Monthly', features: ['Storefront', 'Product Listings', 'Order Management', 'Marketing Tools', 'Analytics Dashboard', 'Multi-location'], usageLimits: { products: 5000, orders: 10000 }, accessRights: ['Store Admin', 'Marketing Admin', 'Analytics'], archived: false },
  { id: 5, name: 'Spin Basic', platform: 'MCOM Spin', description: 'Engage customers with spins.', price: 19, billingCycle: 'Monthly', features: ['Spin Wheel', 'Basic Prizes', 'Participation Tracking'], usageLimits: { spins: 1000, prizes: 5 }, accessRights: ['Spin Admin'], archived: false },
  { id: 6, name: 'Audit Basic', platform: 'GBS Audit', description: 'Essential audit tools.', price: 79, billingCycle: 'Monthly', features: ['Audit Templates', 'Scheduling', 'Basic Reports'], usageLimits: { audits: 10, templates: 5 }, accessRights: ['Audit Access'], archived: false },
  { id: 7, name: 'Expo Basic', platform: 'GBS Expo', description: 'Showcase your business.', price: 39, billingCycle: 'Monthly', features: ['Expo Booth', 'Visitor Stats', 'Media Gallery'], usageLimits: { booth: 1, media: 20 }, accessRights: ['Expo Admin'], archived: false },
];

const DEFAULT_SUBSCRIPTIONS: Subscription[] = [
  { id: 1, businessName: "Global Retailers Ltd", type: 'Membership', itemName: 'Gold Pro+', status: 'Active', startDate: '2026-01-01', endDate: '2026-12-31', amount: 900, billingCycle: 'Monthly' },
  { id: 2, businessName: "Eco Market", type: 'Membership', itemName: 'Silver Normal', status: 'Active', startDate: '2026-02-01', endDate: '2026-07-31', amount: 75, billingCycle: 'Monthly' },
  { id: 3, businessName: "Fashion Hub", type: 'Package', itemName: 'Loyalty Pro', status: 'Active', startDate: '2026-03-01', endDate: '2026-08-31', amount: 99, billingCycle: 'Monthly' },
  { id: 4, businessName: "Tech Solutions", type: 'Membership', itemName: 'Platinum Normal', status: 'Active', startDate: '2026-01-15', endDate: '2027-01-15', amount: 1200, billingCycle: 'Monthly' },
  { id: 5, businessName: "Local Deli", type: 'Membership', itemName: 'Bronze Normal', status: 'Pending', startDate: '2026-04-01', endDate: '2026-09-30', amount: 10, billingCycle: 'Monthly' },
  { id: 6, businessName: "Urban Outfitters", type: 'Package', itemName: 'Mall Enterprise', status: 'Active', startDate: '2026-02-15', endDate: '2027-02-15', amount: 199, billingCycle: 'Monthly' },
];

const DEFAULT_PLATFORMS: Platform[] = [
  { id: 'rewards', name: 'MCOM Rewards', description: 'Loyalty and rewards platform', status: 'Enabled', icon: 'Star', launchDate: '2025-06-01', totalUsers: 1240, visible: true },
  { id: 'spin', name: 'MCOM Spin', description: 'Spin-to-win engagement', status: 'Enabled', icon: 'Zap', launchDate: '2025-08-15', totalUsers: 890, visible: true },
  { id: 'mall', name: 'MCOM Mall', description: 'E-commerce marketplace', status: 'Enabled', icon: 'ShoppingBag', launchDate: '2025-03-01', totalUsers: 2100, visible: true },
  { id: 'audit', name: 'GBS Audit', description: 'Audit and compliance', status: 'Enabled', icon: 'ClipboardCheck', launchDate: '2025-04-01', totalUsers: 450, visible: true },
  { id: 'expo', name: 'GBS Expo', description: 'Virtual exhibitions', status: 'Enabled', icon: 'Presentation', launchDate: '2025-09-01', totalUsers: 320, visible: true },
  { id: 'loyalty', name: '24/7 GBS Loyalty', description: 'Cross-platform loyalty engine', status: 'Enabled', icon: 'Heart', launchDate: '2025-01-01', totalUsers: 3100, visible: true },
];

const DEFAULT_PERMISSION_ROLES: PermissionRole[] = [
  { role: 'Super Admin', permissions: { create: true, read: true, update: true, delete: true, approve: true, launch: true, manage: true, configure: true } },
  { role: 'Admin', permissions: { create: true, read: true, update: true, delete: true, approve: true, launch: false, manage: true, configure: false } },
  { role: 'Finance Admin', permissions: { create: false, read: true, update: true, delete: false, approve: true, launch: false, manage: false, configure: false } },
  { role: 'Support Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: false, configure: false } },
  { role: 'Membership Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: true, configure: true } },
  { role: 'Platform Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: true, manage: true, configure: true } },
  { role: 'Developer', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: false, configure: false } },
];

const DEFAULT_PAYMENTS: Payment[] = [
  { id: 1, businessName: "Global Retailers Ltd", amount: 900, currency: 'GBP', method: 'Stripe', status: 'Completed', date: '2026-04-01', invoice: 'INV-001', type: 'Membership' },
  { id: 2, businessName: "Fashion Hub", amount: 99, currency: 'GBP', method: 'PayPal', status: 'Completed', date: '2026-04-02', invoice: 'INV-002', type: 'Package' },
  { id: 3, businessName: "Eco Market", amount: 75, currency: 'GBP', method: 'Stripe', status: 'Pending', date: '2026-04-03', invoice: 'INV-003', type: 'Membership' },
  { id: 4, businessName: "Local Deli", amount: 10, currency: 'GBP', method: 'Bank Transfer', status: 'Failed', date: '2026-04-05', invoice: 'INV-004', type: 'Membership' },
];

const DEFAULT_NOTIFICATIONS: Notification[] = [
  { id: 1, title: 'Welcome to MCOM', message: 'Welcome to the MCOM ecosystem!', audience: ['Businesses'], scheduledDate: '2026-04-01', status: 'Sent', sentCount: 150, createdAt: '2026-03-30' },
  { id: 2, title: 'Platform Maintenance', message: 'Scheduled maintenance on April 10th.', audience: ['Businesses', 'Customers'], scheduledDate: '2026-04-10', status: 'Scheduled', sentCount: 0, createdAt: '2026-04-05' },
  { id: 3, title: 'New Features Available', message: 'Check out our new analytics features!', audience: ['Businesses', 'Agents', 'Consultants'], scheduledDate: '2026-04-07', status: 'Draft', sentCount: 0, createdAt: '2026-04-06' },
];

const DEFAULT_SUPPORT_TICKETS: SupportTicket[] = [
  { id: 1, subject: 'Cannot access dashboard', message: 'Getting 403 error on login', from: 'John Doe', fromType: 'Business', status: 'Open', priority: 'High', assignedTo: 'Adam Smith', createdAt: '2026-04-01T10:00:00', updatedAt: '2026-04-01T10:00:00' },
  { id: 2, subject: 'Billing inquiry', message: 'Double charged for March subscription', from: 'Jane Smith', fromType: 'Business', status: 'Open', priority: 'Medium', assignedTo: 'Grace Anderson', createdAt: '2026-04-02T14:30:00', updatedAt: '2026-04-02T14:30:00' },
  { id: 3, subject: 'Feature request', message: 'Would love to see bulk export option', from: 'Bob Williams', fromType: 'Customer', status: 'Resolved', priority: 'Low', assignedTo: 'David Brown', createdAt: '2026-03-28T09:00:00', updatedAt: '2026-04-01T11:00:00' },
];

const DEFAULT_AUDIT_LOGS: AuditLog[] = [
  { id: 1, action: 'Admin Login', adminName: 'Adam Smith', targetType: 'System', targetName: 'Admin Panel', details: 'Successful login from IP 192.168.1.1', timestamp: '2026-04-06T08:00:00', category: 'Authentication' },
  { id: 2, action: 'Business Created', adminName: 'Adam Smith', targetType: 'Business', targetName: 'NewCo Ltd', details: 'Created business with Gold membership', timestamp: '2026-04-06T09:30:00', category: 'Business' },
  { id: 3, action: 'Platform Disabled', adminName: 'Adam Smith', targetType: 'Platform', targetName: 'MCOM Spin', details: 'Disabled platform for maintenance', timestamp: '2026-04-05T22:00:00', category: 'Platform' },
  { id: 4, action: 'Payment Refunded', adminName: 'Grace Anderson', targetType: 'Payment', targetName: 'INV-004', details: 'Refunded £10 to Local Deli', timestamp: '2026-04-05T16:00:00', category: 'Finance' },
];

const DEFAULT_SETTINGS: SystemSettings = {
  brandName: 'MCOMSolutions', supportEmail: 'support@mcomsolutions.co.uk', currency: 'GBP',
  sessionTimeout: 60, maxLoginAttempts: 5,
  emailEnabled: true, smsEnabled: false, paymentGateway: 'Stripe',
  maintenanceMode: false, allowRegistration: true,
};

const DEFAULT_AUTH_CONFIG: AuthConfig = {
  loginEnabled: true, registrationEnabled: true, ssoEnabled: false,
  passwordMinLength: 8, passwordRequireSpecial: true, passwordRequireNumber: true,
  sessionDuration: 24, maxSessionsPerUser: 3,
};

const DEFAULT_REGISTRATION_FLOW: RegistrationFlow = {
  businessFields: ['Business Name', 'Email', 'Phone', 'Address', 'Registration Number', 'VAT Number'],
  customerFields: ['Full Name', 'Email', 'Phone', 'Date of Birth', 'Postcode'],
  requireBusinessVerification: true, requireEmailVerification: true,
  autoApproveBusinesses: false, autoApproveCustomers: true,
};

const DEFAULT_BUSINESS_PROFILE_CONFIG: BusinessProfileConfig = {
  fields: ['Business Name', 'Description', 'Logo', 'Cover Image', 'Contact Email', 'Phone', 'Website', 'Address', 'Social Links'],
  storefrontEnabled: true, googleFieldsEnabled: true,
  locationFields: ['Address', 'City', 'Postcode', 'Latitude', 'Longitude', 'Service Area'],
  mediaFields: ['Logo', 'Cover Image', 'Gallery Images', 'Videos'],
};

const DEFAULT_LAUNCH_RULES: PlatformLaunchRule[] = [
  { id: 1, platformId: 'rewards', requiredMembership: 'Bronze', requiredPackage: 'Loyalty Starter', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified', redirectRule: '/platform/rewards', accessRule: 'Membership + Package required' },
  { id: 2, platformId: 'mall', requiredMembership: 'Silver', requiredPackage: 'Mall Basic', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified + Google verified', redirectRule: '/platform/mall', accessRule: 'Membership + Package required' },
  { id: 3, platformId: 'spin', requiredMembership: 'Gold', requiredPackage: 'Spin Basic', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be active', redirectRule: '/platform/spin', accessRule: 'Membership required' },
];

const DEFAULT_INTEGRATIONS: Integration[] = [
  { id: 1, name: 'Google Business Profile', type: 'External', status: 'Connected', lastSync: '2026-04-06T07:00:00', connectedDate: '2025-12-01' },
  { id: 2, name: 'Stripe Payments', type: 'Payment', status: 'Connected', lastSync: '2026-04-06T08:00:00', connectedDate: '2025-11-15' },
  { id: 3, name: 'Twilio SMS', type: 'Communication', status: 'Disconnected', lastSync: '2026-03-01T00:00:00', connectedDate: '2026-01-10' },
  { id: 4, name: 'Mailchimp', type: 'Marketing', status: 'Error', lastSync: '2026-04-05T12:00:00', connectedDate: '2026-02-20' },
];

const DEFAULT_API_KEYS: ApiKey[] = [
  { id: 1, name: 'Production API', key: 'mcom_prod_a1b2c3d4e5f6', permissions: ['Read', 'Write'], status: 'Active', lastUsed: '2026-04-06T09:00:00', createdAt: '2026-01-01' },
  { id: 2, name: 'Development API', key: 'mcom_dev_6f5e4d3c2b1a', permissions: ['Read', 'Write', 'Admin'], status: 'Active', lastUsed: '2026-04-05T16:00:00', createdAt: '2026-01-15' },
  { id: 3, name: 'Partner Integration', key: 'mcom_partner_xyz789', permissions: ['Read'], status: 'Revoked', lastUsed: '2026-03-20T10:00:00', createdAt: '2026-02-01' },
];

const DEFAULT_REVENUE_RECORDS: RevenueRecord[] = [
  { date: '2026-04-01', amount: 12800, type: 'Membership', source: 'Monthly billing' },
  { date: '2026-04-02', amount: 4500, type: 'Package', source: 'Package subscriptions' },
  { date: '2026-04-03', amount: 3200, type: 'One-time', source: 'Setup fees' },
  { date: '2026-04-04', amount: 8900, type: 'Membership', source: 'Monthly billing' },
  { date: '2026-04-05', amount: 2100, type: 'Package', source: 'Package subscriptions' },
  { date: '2026-04-06', amount: 15000, type: 'Membership', source: 'Annual renewals' },
];

// ===================== CONTEXT =====================

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

function loadFromLocalStorage<T>(key: string, defaults: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaults;
  } catch {
    return defaults;
  }
}

export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [businesses, setBusinesses] = useState<BusinessUser[]>(() => loadFromLocalStorage('admin_businesses', DEFAULT_BUSINESSES));
  const [customers, setCustomers] = useState<CustomerUser[]>(() => loadFromLocalStorage('admin_customers', DEFAULT_CUSTOMERS));
  const [agents, setAgents] = useState<AgentUser[]>(() => loadFromLocalStorage('admin_agents', DEFAULT_AGENTS));
  const [consultants, setConsultants] = useState<ConsultantUser[]>(() => loadFromLocalStorage('admin_consultants', DEFAULT_CONSULTANTS));
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>(() => loadFromLocalStorage('admin_account_managers', DEFAULT_ACCOUNT_MANAGERS));
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>(() => loadFromLocalStorage('admin_membership_plans', DEFAULT_MEMBERSHIP_PLANS));
  const [packages, setPackages] = useState<Package[]>(() => loadFromLocalStorage('admin_packages_data', DEFAULT_PACKAGES));
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => loadFromLocalStorage('admin_subscriptions', DEFAULT_SUBSCRIPTIONS));
  const [platforms, setPlatforms] = useState<Platform[]>(() => loadFromLocalStorage('admin_platforms', DEFAULT_PLATFORMS));
  const [permissionRoles, setPermissionRoles] = useState<PermissionRole[]>(() => loadFromLocalStorage('admin_permissions', DEFAULT_PERMISSION_ROLES));
  const [payments, setPayments] = useState<Payment[]>(() => loadFromLocalStorage('admin_payments', DEFAULT_PAYMENTS));
  const [notifications, setNotifications] = useState<Notification[]>(() => loadFromLocalStorage('admin_notifications', DEFAULT_NOTIFICATIONS));
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => loadFromLocalStorage('admin_support_tickets', DEFAULT_SUPPORT_TICKETS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadFromLocalStorage('admin_audit_logs', DEFAULT_AUDIT_LOGS));
  const [settings, setSettings] = useState<SystemSettings>(() => loadFromLocalStorage('admin_settings', DEFAULT_SETTINGS));
  const [authConfig, setAuthConfig] = useState<AuthConfig>(() => loadFromLocalStorage('admin_auth_config', DEFAULT_AUTH_CONFIG));
  const [registrationFlow, setRegistrationFlow] = useState<RegistrationFlow>(() => loadFromLocalStorage('admin_registration_flow', DEFAULT_REGISTRATION_FLOW));
  const [businessProfileConfig, setBusinessProfileConfig] = useState<BusinessProfileConfig>(() => loadFromLocalStorage('admin_business_profile_config', DEFAULT_BUSINESS_PROFILE_CONFIG));
  const [launchRules, setLaunchRules] = useState<PlatformLaunchRule[]>(() => loadFromLocalStorage('admin_launch_rules', DEFAULT_LAUNCH_RULES));
  const [integrations, setIntegrations] = useState<Integration[]>(() => loadFromLocalStorage('admin_integrations', DEFAULT_INTEGRATIONS));
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => loadFromLocalStorage('admin_api_keys', DEFAULT_API_KEYS));
  const [revenueRecords, setRevenueRecords] = useState<RevenueRecord[]>(() => loadFromLocalStorage('admin_revenue_records', DEFAULT_REVENUE_RECORDS));

  useEffect(() => { localStorage.setItem('admin_businesses', JSON.stringify(businesses)); }, [businesses]);
  useEffect(() => { localStorage.setItem('admin_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('admin_agents', JSON.stringify(agents)); }, [agents]);
  useEffect(() => { localStorage.setItem('admin_consultants', JSON.stringify(consultants)); }, [consultants]);
  useEffect(() => { localStorage.setItem('admin_account_managers', JSON.stringify(accountManagers)); }, [accountManagers]);
  useEffect(() => { localStorage.setItem('admin_membership_plans', JSON.stringify(membershipPlans)); }, [membershipPlans]);
  useEffect(() => { localStorage.setItem('admin_packages_data', JSON.stringify(packages)); }, [packages]);
  useEffect(() => { localStorage.setItem('admin_subscriptions', JSON.stringify(subscriptions)); }, [subscriptions]);
  useEffect(() => { localStorage.setItem('admin_platforms', JSON.stringify(platforms)); }, [platforms]);
  useEffect(() => { localStorage.setItem('admin_permissions', JSON.stringify(permissionRoles)); }, [permissionRoles]);
  useEffect(() => { localStorage.setItem('admin_payments', JSON.stringify(payments)); }, [payments]);
  useEffect(() => { localStorage.setItem('admin_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('admin_support_tickets', JSON.stringify(supportTickets)); }, [supportTickets]);
  useEffect(() => { localStorage.setItem('admin_audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem('admin_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('admin_auth_config', JSON.stringify(authConfig)); }, [authConfig]);
  useEffect(() => { localStorage.setItem('admin_registration_flow', JSON.stringify(registrationFlow)); }, [registrationFlow]);
  useEffect(() => { localStorage.setItem('admin_business_profile_config', JSON.stringify(businessProfileConfig)); }, [businessProfileConfig]);
  useEffect(() => { localStorage.setItem('admin_launch_rules', JSON.stringify(launchRules)); }, [launchRules]);
  useEffect(() => { localStorage.setItem('admin_integrations', JSON.stringify(integrations)); }, [integrations]);
  useEffect(() => { localStorage.setItem('admin_api_keys', JSON.stringify(apiKeys)); }, [apiKeys]);
  useEffect(() => { localStorage.setItem('admin_revenue_records', JSON.stringify(revenueRecords)); }, [revenueRecords]);

  const genId = () => Date.now() + Math.floor(Math.random() * 1000);

  const withAudit = useCallback((action: string, targetType: string, targetName: string, details: string, adminName = 'Adam Smith') => {
    setAuditLogs(prev => [{ id: genId(), action, adminName, targetType, targetName, details, timestamp: new Date().toISOString(), category: targetType }, ...prev]);
  }, []);

  return (
    <AdminDataContext.Provider value={{
      businesses, customers, agents, consultants, accountManagers,
      membershipPlans, packages, subscriptions, platforms, permissionRoles,
      payments, notifications, supportTickets, auditLogs, settings,
      authConfig, registrationFlow, businessProfileConfig, launchRules,
      integrations, apiKeys, revenueRecords,

      addBusiness: useCallback((b) => { const id = genId(); setBusinesses(p => [{ ...b, id }, ...p]); withAudit('Business Created', 'Business', b.name, `Created business account`); }, [withAudit]),
      updateBusiness: useCallback((id, u) => { setBusinesses(p => p.map(b => b.id === id ? { ...b, ...u } : b)); withAudit('Business Updated', 'Business', id.toString(), `Updated business fields`); }, [withAudit]),
      deleteBusiness: useCallback((id) => { setBusinesses(p => p.filter(b => b.id !== id)); withAudit('Business Deleted', 'Business', id.toString(), `Deleted business permanently`); }, [withAudit]),

      addCustomer: useCallback((c) => { const id = genId(); setCustomers(p => [{ ...c, id }, ...p]); withAudit('Customer Created', 'Customer', c.name, `Created customer profile`); }, [withAudit]),
      updateCustomer: useCallback((id, u) => setCustomers(p => p.map(c => c.id === id ? { ...c, ...u } : c)), []),
      deleteCustomer: useCallback((id) => setCustomers(p => p.filter(c => c.id !== id)), []),

      addAgent: useCallback((a) => { const id = genId(); setAgents(p => [{ ...a, id }, ...p]); withAudit('Agent Created', 'Agent', a.name, `Created agent account`); }, [withAudit]),
      updateAgent: useCallback((id, u) => setAgents(p => p.map(a => a.id === id ? { ...a, ...u } : a)), []),
      deleteAgent: useCallback((id) => setAgents(p => p.filter(a => a.id !== id)), []),

      addConsultant: useCallback((c) => { const id = genId(); setConsultants(p => [{ ...c, id }, ...p]); withAudit('Consultant Created', 'Consultant', c.name, `Created consultant profile`); }, [withAudit]),
      updateConsultant: useCallback((id, u) => setConsultants(p => p.map(c => c.id === id ? { ...c, ...u } : c)), []),
      deleteConsultant: useCallback((id) => setConsultants(p => p.filter(c => c.id !== id)), []),

      addAccountManager: useCallback((a) => { const id = genId(); setAccountManagers(p => [{ ...a, id }, ...p]); withAudit('Account Manager Created', 'Account Manager', a.name, `Created account manager`); }, [withAudit]),
      updateAccountManager: useCallback((id, u) => setAccountManagers(p => p.map(a => a.id === id ? { ...a, ...u } : a)), []),
      deleteAccountManager: useCallback((id) => setAccountManagers(p => p.filter(a => a.id !== id)), []),

      addMembershipPlan: useCallback((m) => { const id = m.name.toLowerCase().replace(/\s+/g, '-'); setMembershipPlans(p => [{ ...m, id }, ...p]); withAudit('Membership Created', 'Membership', m.name, `Created ${m.name} membership`); }, [withAudit]),
      updateMembershipPlan: useCallback((id, u) => setMembershipPlans(p => p.map(m => m.id === id ? { ...m, ...u } : m)), []),
      deleteMembershipPlan: useCallback((id) => { setMembershipPlans(p => p.filter(m => m.id !== id)); withAudit('Membership Deleted', 'Membership', id, `Deleted membership plan`); }, [withAudit]),

      addPackage: useCallback((p) => { const id = genId(); setPackages(prev => [{ ...p, id }, ...prev]); withAudit('Package Created', 'Package', p.name, `Created ${p.name} package`); }, [withAudit]),
      updatePackage: useCallback((id, u) => setPackages(p => p.map(pkg => pkg.id === id ? { ...pkg, ...u } : pkg)), []),
      deletePackage: useCallback((id) => { setPackages(p => p.filter(pkg => pkg.id !== id)); withAudit('Package Deleted', 'Package', id.toString(), `Deleted package`); }, [withAudit]),

      addSubscription: useCallback((s) => { setSubscriptions(p => [{ ...s, id: genId() }, ...p]); withAudit('Subscription Created', 'Subscription', s.businessName, `Created ${s.type} subscription`); }, [withAudit]),
      updateSubscription: useCallback((id, u) => setSubscriptions(p => p.map(s => s.id === id ? { ...s, ...u } : s)), []),

      updatePlatform: useCallback((id, u) => { setPlatforms(p => p.map(pl => pl.id === id ? { ...pl, ...u } : pl)); withAudit('Platform Updated', 'Platform', id, `Updated platform settings`); }, [withAudit]),

      updatePermissionRole: useCallback((role, u) => setPermissionRoles(p => p.map(r => r.role === role ? { ...r, permissions: { ...r.permissions, ...u } } : r)), []),

      addPayment: useCallback((p) => { setPayments(prev => [{ ...p, id: genId() }, ...prev]); withAudit('Payment Recorded', 'Payment', p.businessName, `Payment of £${p.amount}`); }, [withAudit]),
      updatePayment: useCallback((id, u) => setPayments(p => p.map(pay => pay.id === id ? { ...pay, ...u } : pay)), []),

      addNotification: useCallback((n) => { setNotifications(p => [{ ...n, id: genId() }, ...p]); }, []),
      updateNotification: useCallback((id, u) => setNotifications(p => p.map(n => n.id === id ? { ...n, ...u } : n)), []),
      deleteNotification: useCallback((id) => setNotifications(p => p.filter(n => n.id !== id)), []),

      addSupportTicket: useCallback((t) => { setSupportTickets(p => [{ ...t, id: genId() }, ...p]); }, []),
      updateSupportTicket: useCallback((id, u) => setSupportTickets(p => p.map(t => t.id === id ? { ...t, ...u } : t)), []),

      addAuditLog: useCallback((l) => setAuditLogs(p => [{ ...l, id: genId() }, ...p]), []),
      clearAuditLogs: useCallback(() => setAuditLogs([]), []),

      updateSettings: useCallback((s) => setSettings(p => ({ ...p, ...s })), []),
      updateAuthConfig: useCallback((a) => setAuthConfig(p => ({ ...p, ...a })), []),
      updateRegistrationFlow: useCallback((r) => setRegistrationFlow(p => ({ ...p, ...r })), []),
      updateBusinessProfileConfig: useCallback((b) => setBusinessProfileConfig(p => ({ ...p, ...b })), []),

      addLaunchRule: useCallback((r) => { setLaunchRules(p => [{ ...r, id: genId() }, ...p]); withAudit('Launch Rule Created', 'Launch Rule', r.platformId, `Created launch rule for ${r.platformId}`); }, [withAudit]),
      updateLaunchRule: useCallback((id, u) => setLaunchRules(p => p.map(r => r.id === id ? { ...r, ...u } : r)), []),
      deleteLaunchRule: useCallback((id) => { setLaunchRules(p => p.filter(r => r.id !== id)); withAudit('Launch Rule Deleted', 'Launch Rule', id.toString(), `Deleted launch rule`); }, [withAudit]),

      addIntegration: useCallback((i) => { setIntegrations(p => [{ ...i, id: genId() }, ...p]); withAudit('Integration Added', 'Integration', i.name, `Added ${i.name} integration`); }, [withAudit]),
      updateIntegration: useCallback((id, u) => setIntegrations(p => p.map(i => i.id === id ? { ...i, ...u } : i)), []),

      addApiKey: useCallback((a) => { setApiKeys(p => [{ ...a, id: genId() }, ...p]); withAudit('API Key Created', 'API Key', a.name, `Generated new API key`); }, [withAudit]),
      updateApiKey: useCallback((id, u) => setApiKeys(p => p.map(k => k.id === id ? { ...k, ...u } : k)), []),

      addRevenueRecord: useCallback((r) => setRevenueRecords(p => [...p, r]), []),
    }}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (context === undefined) throw new Error('useAdminData must be used within an AdminDataProvider');
  return context;
}
