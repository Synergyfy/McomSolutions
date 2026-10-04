import {
  PrismaClient,
  Role,
  SupportAgentRole,
  TaskAssignmentStatus,
  TaskAudience,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Phase 5: seed safety.
 * - Refuses to run against production unless ALLOW_SEED_PROD=true (never wipe prod).
 * - Reference data uses upserts (re-seed twice → same row counts).
 * - Demo content uses skip-if-present (first run seeds, later runs preserve edits).
 */
function assertSeedAllowed() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED_PROD !== 'true') {
    throw new Error(
      'Refusing to seed in production. Set ALLOW_SEED_PROD=true to override (destructive sections are idempotent, but demo data is for non-prod).',
    );
  }
}

async function seedIfEmpty<T>(
  model: { count: (args?: unknown) => Promise<number>; createMany: (args: { data: T[] }) => Promise<unknown> },
  label: string,
  data: T[],
) {
  const existing = await model.count();
  if (existing > 0) {
    console.log(`Skipping ${label} (table already has ${existing} rows)...`);
    return;
  }
  await model.createMany({ data });
}

async function main() {
  assertSeedAllowed();
  console.log('Starting seed...');

  const salt = await bcrypt.genSalt(12);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);
  const userPasswordHash = await bcrypt.hash('password123', salt);

  // 1. Seed Core Users
  console.log('Seeding users...');
  
  // Super Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mcomsolutions.co.uk' },
    update: {},
    create: {
      email: 'admin@mcomsolutions.co.uk',
      password: adminPasswordHash,
      role: Role.ADMIN,
      adminRole: 'Super Admin',
      firstName: 'Adam',
      lastName: 'Smith',
      jobTitle: 'System Administrator',
    },
  });

  // Business Users
  const bizUser1 = await prisma.user.upsert({
    where: { email: 'contact@globalretailers.com' },
    update: {},
    create: {
      email: 'contact@globalretailers.com',
      password: userPasswordHash,
      role: Role.BUSINESS,
      firstName: 'George',
      lastName: 'Retailer',
      businessProfile: {
        create: {
          businessName: 'Global Retailers Ltd',
          businessType: 'retail',
          country: 'United Kingdom',
          phone: '+44 20 7123 4567',
          email: 'contact@globalretailers.com',
          isOnGoogle: true,
          membershipLevel: 'Gold',
          membershipTier: 'ProPlus',
          membershipStatus: 'active',
          localMallName: 'Peckham LocalMall',
          localMallId: 'mall-1',
          proximityTier: 'national',
        },
      },
    },
  });

  const bizUser2 = await prisma.user.upsert({
    where: { email: 'info@ecomarket.co.uk' },
    update: {},
    create: {
      email: 'info@ecomarket.co.uk',
      password: userPasswordHash,
      role: Role.BUSINESS,
      firstName: 'Elena',
      lastName: 'Green',
      businessProfile: {
        create: {
          businessName: 'Eco Market',
          businessType: 'retail',
          country: 'United Kingdom',
          phone: '+44 20 7234 5678',
          email: 'info@ecomarket.co.uk',
          isOnGoogle: false,
          membershipLevel: 'Silver',
          membershipTier: 'Normal',
          membershipStatus: 'active',
          localMallName: 'Peckham LocalMall',
          localMallId: 'mall-1',
          proximityTier: 'high_street',
        },
      },
    },
  });

  // Customer Users
  const customerUser1 = await prisma.user.upsert({
    where: { email: 'alice@email.com' },
    update: {},
    create: {
      email: 'alice@email.com',
      password: userPasswordHash,
      role: Role.CUSTOMER,
      firstName: 'Alice',
      lastName: 'Johnson',
      customerProfile: {
        create: {
          loyaltyPoints: 2450,
          platformUsage: ['Rewards', 'Mall'],
          membershipStatus: 'Gold Loyalty',
          status: 'Active',
        },
      },
    },
  });

  // Agents
  const agentUser1 = await prisma.user.upsert({
    where: { email: 'david@mcomsolutions.co.uk' },
    update: {},
    create: {
      email: 'david@mcomsolutions.co.uk',
      password: userPasswordHash,
      role: Role.AGENT,
      firstName: 'David',
      lastName: 'Brown',
      agentProfile: {
        create: {
          permissions: ['View Businesses', 'Edit Businesses'],
          status: 'Active',
        },
      },
    },
  });

  // Consultants
  const consultantUser1 = await prisma.user.upsert({
    where: { email: 'frank@consultancy.com' },
    update: {},
    create: {
      email: 'frank@consultancy.com',
      password: userPasswordHash,
      role: Role.CONSULTANT,
      firstName: 'Frank',
      lastName: 'Taylor',
      consultantProfile: {
        create: {
          specialisation: 'Digital Transformation',
          status: 'Active',
        },
      },
    },
  });

  // Account Managers
  const managerUser1 = await prisma.user.upsert({
    where: { email: 'grace@mcomsolutions.co.uk' },
    update: {},
    create: {
      email: 'grace@mcomsolutions.co.uk',
      password: userPasswordHash,
      role: Role.ACCOUNT_MANAGER,
      firstName: 'Grace',
      lastName: 'Anderson',
      accountManagerProfile: {
        create: {
          assignedBusinesses: 12,
          status: 'Active',
        },
      },
    },
  });

  // 2. Seed Membership Plans
  console.log('Seeding membership plans...');
  const plans = [
    {
      id: 'bronze',
      name: 'Bronze',
      description: 'Perfect for local brands and new startups.',
      price: 10,
      monthlyPrice: 10,
      quarterlyPrice: 27,
      annualPrice: 96,
      billingCycle: 'Monthly',
      platformAccess: ['Loyalty', 'Mall'],
      usageLimits: { rewards: 100 },
      permissions: ['Basic Dashboard'],
      features: ['Basic Dashboard', 'Local Directory Listing', 'Ecosystem Access'],
      whoItIsFor: 'New businesses',
      badge: '',
      color: 'border-amber-600/20 text-amber-600 bg-amber-50',
      includedApps: [
        { platform: 'MCOM Solutions', planName: 'MCOM Business Starter', planId: 'mcom-sol-starter', standalonePrice: 29 },
        { platform: 'MCOM Mall', planName: 'Mall Starter', planId: 'mall-starter', standalonePrice: 40 },
      ],
    },
    {
      id: 'silver',
      name: 'Silver',
      description: 'Advanced tools for growing teams.',
      price: 75,
      monthlyPrice: 75,
      quarterlyPrice: 202,
      annualPrice: 720,
      billingCycle: 'Monthly',
      platformAccess: ['Loyalty', 'Mall', 'Rewards'],
      usageLimits: { rewards: 500 },
      permissions: ['Standard Dashboard'],
      features: ['Standard Dashboard', 'Campaign Priority', 'Multi-Territory'],
      whoItIsFor: 'Growing businesses',
      badge: '',
      color: 'border-slate-400/20 text-slate-500 bg-slate-50',
      includedApps: [
        { platform: 'MCOM Solutions', planName: 'MCOM Business Growth', planId: 'mcom-sol-growth', standalonePrice: 79 },
        { platform: 'MCOM Mall', planName: 'Mall Standard', planId: 'mall-std', standalonePrice: 99 },
        { platform: 'MCOM Rewards', planName: 'Loyalty Starter', planId: 'pkg-1', standalonePrice: 29 },
      ],
    },
    {
      id: 'gold',
      name: 'Gold',
      description: 'Scale your operations with priority access.',
      price: 350,
      monthlyPrice: 350,
      quarterlyPrice: 945,
      annualPrice: 3360,
      billingCycle: 'Monthly',
      platformAccess: ['Loyalty', 'Mall', 'Rewards', 'Spin'],
      usageLimits: { rewards: 2000 },
      permissions: ['Full Dashboard'],
      features: ['Full Dashboard', 'Cross-Platform Priority', 'AI Business Copilot'],
      whoItIsFor: 'Scaling businesses',
      badge: 'MOST POPULAR',
      color: 'border-yellow-500/30 text-yellow-600 bg-yellow-50',
      includedApps: [
        { platform: 'MCOM Solutions', planName: 'MCOM Business Growth', planId: 'mcom-sol-growth', standalonePrice: 79 },
        { platform: 'MCOM Mall', planName: 'Mall Standard', planId: 'mall-std', standalonePrice: 99 },
        { platform: 'MCOM Rewards', planName: 'Loyalty Pro', planId: 'pkg-2', standalonePrice: 99 },
        { platform: 'MCOM Spin', planName: 'Spin Standard', planId: 'spin-std', standalonePrice: 49 },
      ],
    },
    {
      id: 'platinum',
      name: 'Platinum',
      description: 'Tailored solutions for market leaders.',
      price: 1200,
      monthlyPrice: 1200,
      quarterlyPrice: 3240,
      annualPrice: 11520,
      billingCycle: 'Monthly',
      platformAccess: ['Loyalty', 'Mall', 'Rewards', 'Audit', 'Expo'],
      usageLimits: { rewards: 10000 },
      permissions: ['Full Dashboard', 'API Access'],
      features: ['Full Dashboard', 'API Access', 'Dedicated Account Manager', 'Enterprise Quotas'],
      whoItIsFor: 'Established businesses',
      badge: '',
      color: 'border-blue-600/20 text-blue-700 bg-blue-50',
      includedApps: [
        { platform: 'MCOM Solutions', planName: 'MCOM Enterprise Suite', planId: 'mcom-sol-ent', standalonePrice: 299 },
        { platform: 'MCOM Mall', planName: 'Mall Enterprise', planId: 'mall-ent', standalonePrice: 299 },
        { platform: 'MCOM Rewards', planName: 'Loyalty Enterprise', planId: 'rewards-ent', standalonePrice: 199 },
        { platform: 'GBS Audit', planName: 'Audit Standard', planId: 'audit-std', standalonePrice: 249 },
        { platform: 'GBS Expo', planName: 'Expo Standard', planId: 'expo-std', standalonePrice: 149 },
      ],
    },
  ];
  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        monthlyPrice: plan.monthlyPrice,
        quarterlyPrice: plan.quarterlyPrice,
        annualPrice: plan.annualPrice,
        billingCycle: plan.billingCycle,
        features: plan.features,
        includedApps: plan.includedApps,
        whoItIsFor: plan.whoItIsFor,
        badge: plan.badge,
        color: plan.color,
      },
      create: plan,
    });
  }

  // 3. Seed Package Templates (including MCOM Solutions Standalone Packages)
  console.log('Seeding packages templates...');
  const packages = [
    { id: 'mcom-sol-starter', name: 'MCOM Business Starter', platform: 'MCOM Solutions', description: 'Core business dashboard and local directory listing.', price: 29, monthlyPrice: 29, quarterlyPrice: 78, annualPrice: 278, billingCycle: 'Monthly', features: ['Core Business Dashboard', 'Local Directory Listing', 'Basic Analytics'], usageLimits: { campaigns: 5, locations: 1 }, accessRights: ['Store Admin'] },
    { id: 'mcom-sol-growth', name: 'MCOM Business Growth', platform: 'MCOM Solutions', description: 'Advanced analytics, territory growth, and lead hub.', price: 79, monthlyPrice: 79, quarterlyPrice: 213, annualPrice: 758, billingCycle: 'Monthly', features: ['Advanced Analytics', 'Multi-Territory High Street', 'Lead Generation Hub'], usageLimits: { campaigns: 20, locations: 5 }, accessRights: ['Store Admin', 'Marketing Admin'] },
    { id: 'mcom-sol-ent', name: 'MCOM Enterprise Suite', platform: 'MCOM Solutions', description: 'Full AI business suite and unlimited high street territories.', price: 299, monthlyPrice: 299, quarterlyPrice: 807, annualPrice: 2870, billingCycle: 'Monthly', features: ['Full AI Business Copilot', 'Unlimited Territory Coverage', 'Custom API Access'], usageLimits: { campaigns: 100, locations: 25 }, accessRights: ['Store Admin', 'Marketing Admin', 'Analytics', 'Export Data'] },
    { id: 'pkg-1', name: 'Loyalty Starter', platform: 'MCOM Rewards', description: 'Basic loyalty tools.', price: 29, monthlyPrice: 29, quarterlyPrice: 78, annualPrice: 278, billingCycle: 'Monthly', features: ['Points Management', 'Basic Rewards'], usageLimits: { members: 500 }, accessRights: ['View Analytics'] },
    { id: 'pkg-2', name: 'Loyalty Pro', platform: 'MCOM Rewards', description: 'Advanced loyalty suite.', price: 99, monthlyPrice: 99, quarterlyPrice: 267, annualPrice: 950, billingCycle: 'Monthly', features: ['Points Management', 'Advanced Rewards', 'Campaign Builder'], usageLimits: { members: 5000 }, accessRights: ['View Analytics', 'Export Data'] },
    { id: 'pkg-3', name: 'Mall Basic', platform: 'MCOM Mall', description: 'Get your store online.', price: 49, monthlyPrice: 49, quarterlyPrice: 132, annualPrice: 470, billingCycle: 'Monthly', features: ['Storefront', 'Product Listings'], usageLimits: { products: 100 }, accessRights: ['Store Admin'] },
  ];
  for (const pkg of packages) {
    await prisma.packageTemplate.upsert({
      where: { id: pkg.id },
      update: {
        name: pkg.name,
        platform: pkg.platform,
        description: pkg.description,
        price: pkg.price,
        monthlyPrice: pkg.monthlyPrice,
        quarterlyPrice: pkg.quarterlyPrice,
        annualPrice: pkg.annualPrice,
        features: pkg.features,
        usageLimits: pkg.usageLimits,
        accessRights: pkg.accessRights,
      },
      create: pkg,
    });
  }

  // 4. Seed Platforms
  console.log('Seeding platforms...');
  const platformsData = [
    { id: 'rewards', name: 'MCOM Rewards', description: 'Loyalty and rewards platform', status: 'Enabled', icon: 'Star', launchDate: new Date('2025-06-01'), totalUsers: 1240, visible: true },
    { id: 'spin', name: 'MCOM Spin', description: 'Spin-to-win engagement', status: 'Enabled', icon: 'Zap', launchDate: new Date('2025-08-15'), totalUsers: 890, visible: true },
    { id: 'mall', name: 'MCOM Mall', description: 'E-commerce marketplace', status: 'Enabled', icon: 'ShoppingBag', launchDate: new Date('2025-03-01'), totalUsers: 2100, visible: true },
    { id: 'audit', name: 'GBS Audit', description: 'Audit and compliance', status: 'Enabled', icon: 'ClipboardCheck', launchDate: new Date('2025-04-01'), totalUsers: 450, visible: true },
    { id: 'expo', name: 'GBS Expo', description: 'Virtual exhibitions', status: 'Enabled', icon: 'Presentation', launchDate: new Date('2025-09-01'), totalUsers: 320, visible: true },
    { id: 'loyalty', name: '24/7 GBS Loyalty', description: 'Cross-platform loyalty engine', status: 'Enabled', icon: 'Heart', launchDate: new Date('2025-01-01'), totalUsers: 3100, visible: true },
  ];
  for (const platform of platformsData) {
    await prisma.ecosystemPlatform.upsert({
      where: { id: platform.id },
      update: {},
      create: platform,
    });
  }

  // 5. Seed Permission Roles Matrix
  console.log('Seeding permission roles...');
  const roles = [
    { role: 'Super Admin', permissions: { create: true, read: true, update: true, delete: true, approve: true, launch: true, manage: true, configure: true } },
    { role: 'Admin', permissions: { create: true, read: true, update: true, delete: true, approve: true, launch: false, manage: true, configure: false } },
    { role: 'Finance Admin', permissions: { create: false, read: true, update: true, delete: false, approve: true, launch: false, manage: false, configure: false } },
    { role: 'Support Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: false, configure: false } },
    { role: 'Membership Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: true, configure: true } },
    { role: 'Platform Admin', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: true, manage: true, configure: true } },
    { role: 'Developer', permissions: { create: true, read: true, update: true, delete: false, approve: false, launch: false, manage: false, configure: false } },
  ];
  for (const r of roles) {
    await prisma.permissionRole.upsert({
      where: { role: r.role },
      update: {},
      create: r,
    });
  }

  // 6. Seed Subscriptions (demo content — first run only, never duplicated)
  console.log('Seeding subscriptions...');
  await seedIfEmpty(prisma.ecosystemSubscription, 'ecosystem subscriptions', [
      { businessId: 'global-retailers-id', businessName: 'Global Retailers Ltd', type: 'Membership', itemName: 'Gold Pro+', status: 'Active', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), amount: 900, billingCycle: 'Monthly' },
      { businessId: 'eco-market-id', businessName: 'Eco Market', type: 'Membership', itemName: 'Silver Normal', status: 'Active', startDate: new Date('2026-02-01'), endDate: new Date('2026-07-31'), amount: 75, billingCycle: 'Monthly' },
  ]);

  // 7. Seed Payments (demo content — first run only)
  console.log('Seeding payments...');
  await seedIfEmpty(prisma.adminPayment, 'admin payments', [
      { businessId: 'global-retailers-id', businessName: 'Global Retailers Ltd', amount: 900, currency: 'GBP', method: 'Stripe', status: 'Completed', date: new Date('2026-04-01'), invoice: 'INV-001', type: 'Membership' },
      { businessId: 'eco-market-id', businessName: 'Eco Market', amount: 75, currency: 'GBP', method: 'Stripe', status: 'Pending', date: new Date('2026-04-03'), invoice: 'INV-003', type: 'Membership' },
  ]);

  // 8. Seed Revenue logs (demo content — first run only)
  console.log('Seeding revenue records...');
  await seedIfEmpty(prisma.revenueRecord, 'revenue records', [
      { date: '2026-04-01', amount: 12800, type: 'Membership', source: 'Monthly billing' },
      { date: '2026-04-02', amount: 4500, type: 'Package', source: 'Package subscriptions' },
      { date: '2026-04-03', amount: 3200, type: 'One-time', source: 'Setup fees' },
  ]);

  // 9. Seed Notifications (demo content — first run only)
  console.log('Seeding notifications...');
  await seedIfEmpty(prisma.broadcastNotification, 'broadcast notifications', [
      { title: 'Welcome to MCOM', message: 'Welcome to the MCOM ecosystem!', audience: ['Businesses'], status: 'Sent', sentCount: 150 },
      { title: 'Platform Maintenance', message: 'Scheduled maintenance on April 10th.', audience: ['Businesses', 'Customers'], status: 'Scheduled', sentCount: 0, scheduledDate: new Date('2026-04-10') },
  ]);

  // 10. Seed Support Tickets (demo content — first run only)
  console.log('Seeding support tickets...');
  await seedIfEmpty(prisma.supportTicket, 'support tickets', [
      { subject: 'Cannot access dashboard', message: 'Getting 403 error on login', fromName: 'John Doe', fromType: 'Business', status: 'Open', priority: 'High', assignedTo: 'Adam Smith' },
      { subject: 'Billing inquiry', message: 'Double charged for March subscription', fromName: 'Jane Smith', fromType: 'Business', status: 'Open', priority: 'Medium', assignedTo: 'Grace Anderson' },
  ]);

  // 11. Seed Audit Logs (demo content — first run only; never wipe real audit history)
  console.log('Seeding audit logs...');
  await seedIfEmpty(prisma.auditLog, 'audit logs', [
      { action: 'Admin Login', adminName: 'Adam Smith', targetType: 'System', targetName: 'Admin Panel', details: 'Successful login from IP 192.168.1.1', timestamp: new Date(), category: 'Authentication' },
      { action: 'Business Created', adminName: 'Adam Smith', targetType: 'Business', targetName: 'NewCo Ltd', details: 'Created business with Gold membership', timestamp: new Date(), category: 'Business' },
  ]);

  // 12. Seed System Settings
  console.log('Seeding settings...');
  await prisma.systemSettings.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      brandName: 'MCOMSolutions',
      supportEmail: 'support@mcomsolutions.co.uk',
      currency: 'GBP',
      sessionTimeout: 60,
      maxLoginAttempts: 5,
      emailEnabled: true,
      smsEnabled: false,
      paymentGateway: 'Stripe',
      maintenanceMode: false,
      allowRegistration: true,
      authConfig: {
        loginEnabled: true,
        registrationEnabled: true,
        ssoEnabled: false,
        passwordMinLength: 8,
        passwordRequireSpecial: true,
        passwordRequireNumber: true,
        sessionDuration: 24,
        maxSessionsPerUser: 3,
      },
      registrationFlow: {
        businessFields: ['Business Name', 'Email', 'Phone', 'Address'],
        customerFields: ['Full Name', 'Email', 'Phone'],
        requireBusinessVerification: true,
        requireEmailVerification: true,
        autoApproveBusinesses: false,
        autoApproveCustomers: true,
      },
      businessProfileConfig: {
        fields: ['Business Name', 'Description', 'Logo'],
        storefrontEnabled: true,
        googleFieldsEnabled: true,
        locationFields: ['Address', 'City', 'Postcode'],
        mediaFields: ['Logo', 'Cover Image'],
      },
    },
    update: {},
  });

  // 13. Seed Launch Rules (demo content — first run only)
  console.log('Seeding launch rules...');
  await seedIfEmpty(prisma.platformLaunchRule, 'platform launch rules', [
      { platformId: 'rewards', requiredMembership: 'Bronze', requiredPackage: 'Loyalty Starter', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified', redirectRule: '/platform/rewards', accessRule: 'Membership + Package required' },
      { platformId: 'mall', requiredMembership: 'Silver', requiredPackage: 'Mall Basic', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified + Google verified', redirectRule: '/platform/mall', accessRule: 'Membership + Package required' },
  ]);

  // 14. Seed Integrations (demo content — first run only)
  console.log('Seeding integrations...');
  await seedIfEmpty(prisma.systemIntegration, 'system integrations', [
      { name: 'Google Business Profile', type: 'External', status: 'Connected', lastSync: new Date(), connectedDate: new Date('2025-12-01') },
      { name: 'Stripe Payments', type: 'Payment', status: 'Connected', lastSync: new Date(), connectedDate: new Date('2025-11-15') },
  ]);

  // 15. Seed API Keys (reference data — upsert by key hash, never wiped)
  console.log('Seeding API keys...');
  const seedKeys = [
    { name: 'Production API', rawKey: 'mcom_prod_a1b2c3d4e5f6', permissions: ['Read', 'Write'], status: 'Active' },
    { name: 'Development API', rawKey: 'mcom_dev_6f5e4d3c2b1a', permissions: ['Read', 'Write', 'Admin'], status: 'Active' },
  ];
  for (const k of seedKeys) {
    const keyHash = crypto.createHash('sha256').update(k.rawKey).digest('hex');
    await prisma.systemApiKey.upsert({
      where: { keyHash },
      update: { name: k.name, permissions: k.permissions, status: k.status },
      create: {
        name: k.name,
        key: k.rawKey.slice(-4),
        keyHash,
        permissions: k.permissions,
        status: k.status,
        lastUsed: new Date(),
      },
    });
  }

  // 16. Seed Boroughs (reference data — upsert by name, never wiped)
  console.log('Seeding boroughs...');
  for (const b of [
      { name: 'Westminster', populationActivity: 'High', businessCount: 452, activeCampaigns: 12, rewardsParticipation: '88%', healthScore: 94, manager: 'James Wilson', area: 'Central London', region: 'West End', engagement: '94.2%', health: 'A+', activity: 'Active Operational' },
      { name: 'Camden', populationActivity: 'Medium', businessCount: 318, activeCampaigns: 8, rewardsParticipation: '76%', healthScore: 82, manager: 'Sarah Chen', area: 'North London', region: 'North-West', engagement: '88.5%', health: 'A', activity: 'Operational' },
      { name: 'Tower Hamlets', populationActivity: 'Very High', businessCount: 284, activeCampaigns: 15, rewardsParticipation: '92%', healthScore: 89, manager: 'David G.', area: 'East London', region: 'East', engagement: '92.1%', health: 'A+', activity: 'High Activity' },
      { name: 'Hackney', populationActivity: 'High', businessCount: 215, activeCampaigns: 6, rewardsParticipation: '81%', healthScore: 85, manager: 'Emma Thompson', area: 'East London', region: 'East End', engagement: '85.4%', health: 'B+', activity: 'Operational' },
  ]) {
    await prisma.borough.upsert({
      where: { name: b.name },
      update: b,
      create: b,
    });
  }

  // 17. Seed High Streets (reference data — create-if-missing by name+borough, never wiped)
  console.log('Seeding high streets...');
  for (const h of [
      { name: 'Rye Lane', borough: 'Southwark', status: 'Active', businessCount: 156 },
      { name: 'Peckham Road', borough: 'Southwark', status: 'Active', businessCount: 45 },
      { name: 'Bellenden Road', borough: 'Southwark', status: 'Active', businessCount: 44 },
      { name: 'Brixton Road', borough: 'Lambeth', status: 'Active', businessCount: 180 },
  ]) {
    const existing = await prisma.highStreet.findFirst({ where: { name: h.name, borough: h.borough } });
    if (!existing) {
      await prisma.highStreet.create({ data: h });
    }
  }

  // 18. Seed Local Malls (reference data — upsert by slug, never wiped)
  console.log('Seeding local malls...');
  await prisma.localMall.upsert({
    where: { slug: 'peckham-localmall' },
    update: {},
    create: {
      name: 'Peckham LocalMall',
      postcodes: ['SE15', 'SE5', 'SE22'],
      borough: 'Southwark',
      primaryHighStreet: 'Rye Lane',
      additionalHighStreets: ['Peckham Road', 'Bellenden Road'],
      businesses: 245,
      customers: 12800,
      campaigns: 8,
      events: 12,
      status: 'Active',
      description: 'Supporting local businesses in Peckham',
      longDescription: 'Peckham LocalMall is the digital town centre for the Peckham area, connecting residents with local businesses, events, and rewards.',
      slug: 'peckham-localmall',
      primaryColour: '#2563EB',
      secondaryColour: '#F59E0B',
      welcomeMessage: 'Welcome to Peckham LocalMall',
      tagline: 'Supporting Local Businesses Together',
      radiusCoverage: '2.5 miles',
      allowBusinessesOutsidePostcode: false,
      allowVirtualBusinesses: true,
      allowHomeBusinesses: true,
      requireVerification: true,
      requireAuditCompletion: false,
      requireMembershipApproval: true,
      leadConsultant: 'John Doe',
      leadConsultantId: 'con-1',
      assignedAccountManagers: ['Sarah Johnson', 'James Wilson'],
      assignedAccountManagerIds: ['am-1', 'am-2'],
      assignedAgents: ['Michael Brown', 'Paul Taylor'],
      assignedAgentIds: ['agent-1', 'agent-2'],
      supportTeam: ['Emma', 'David'],
      enableAudit: true,
      enableRewards: true,
      enableLoyalty: true,
      enableQLinks: true,
      enableSpin: true,
      enableEvents: true,
      enableCampaigns: true,
      enablePushNotifications: true,
      enableMarketplace: false,
      allowGuestBrowsing: true,
      requireRegistrationForRewards: true,
      requireRegistrationForSpin: true,
      enableAutoLocationDetection: true,
      allowManualLocalMallSwitching: true,
      autoApproveBusinesses: false,
      manualApprovalRequired: true,
      requireDocumentVerification: true,
      requireGoogleBusinessMatch: false,
      requireAuditCompletionForBusiness: true,
      defaultMembershipPackage: 'Standard',
      featuredBusinesses: ['The Coffee Shop', 'Peckham Pharmacy', 'Rye Lane Butcher'],
      featuredCategories: ['Food & Drink', 'Retail', 'Health'],
      featuredCampaigns: ['Summer Sale 2025', 'Local Heroes'],
      featuredEvents: ['Peckham Food Festival', 'Summer Market'],
      featuredRewards: ['Welcome Bonus', 'Referral Reward'],
      featuredSpinCampaigns: ['Spin & Win Summer'],
      featuredHighStreets: ['Rye Lane', 'Bellenden Road'],
      categoryPriorities: [
        { name: 'Food & Drink', action: 'show-first' },
        { name: 'Retail', action: 'show-first' },
        { name: 'Beauty', action: 'highlight' },
        { name: 'Health', action: 'highlight' },
        { name: 'Professional Services', action: 'show-first' },
        { name: 'Trades', action: 'hide' },
        { name: 'Entertainment', action: 'highlight' },
      ],
      allowBoroughCampaigns: true,
      allowHighStreetCampaigns: true,
      allowJointCampaigns: false,
      allowSeasonalCampaigns: true,
      campaignApprovalRequired: true,
      enableEventsModule: true,
      requireEventApproval: true,
      maxEventsPerBusiness: 5,
      allowCommunityEvents: true,
      allowBusinessEvents: true,
      enableRewardsModule: true,
      enableLoyaltyModule: true,
      enableBonusCampaigns: false,
      enableDoublePointDays: true,
      enableSeasonalRewards: true,
      enableSpinModule: true,
      allowBusinessSponsoredSpins: true,
      allowBoroughSpins: false,
      allowSeasonalSpins: true,
      maxSpinsPerCustomer: 3,
      enableRotator: true,
      enableLocalFeedDistribution: true,
      enableBoroughFeedDistribution: false,
      enableFeaturedPlacement: true,
    },
  });

  // 19. Seed Programme Phases
  console.log('Seeding programme phases...');
  const phasesData = [
    {
      name: 'Business Foundation',
      dayStart: 1,
      dayEnd: 7,
      description: 'Verify identity, upload assets, confirm details, activate referral profile.',
      color: 'orange',
      order: 0,
      missions: [
        { id: 'verify-identity', title: 'Business Verification & Profile Foundation', description: 'Verify business identity and contact details.', estimatedMinutes: 15, reward: '+50 points', submissionType: 'internal_platform' },
        { id: 'upload-logo', title: 'Upload Logo & Brand Assets', description: 'Upload your logo and brand assets (or request assistance).', estimatedMinutes: 10, reward: '+30 points', submissionType: 'internal_platform' },
        { id: 'confirm-sector', title: 'Confirm Sector & Opening Hours', description: 'Confirm your sector/category and opening hours.', estimatedMinutes: 5, reward: '+20 points', submissionType: 'internal_platform' },
        { id: 'activate-referral', title: 'Activate Referral Profile', description: 'Activate your 247GBS Affiliates referral profile (automatic).', estimatedMinutes: 2, reward: '+25 points', submissionType: 'internal_platform' },
        { id: 'generate-qr', title: 'Generate QR & Smart Links', description: 'Generate your MCOM QLinks for customer engagement.', estimatedMinutes: 5, reward: '+25 points', submissionType: 'internal_platform' },
      ],
    },
    {
      name: 'Digital Presence',
      dayStart: 8,
      dayEnd: 21,
      description: 'Create storefront, add products, publish offers.',
      color: 'sky',
      order: 1,
      missions: [
        { id: 'create-storefront', title: 'Create Storefront', description: 'Create your storefront and business description.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
        { id: 'add-products', title: 'Add Products & Services', description: 'Add products/services, photos, categories, pricing.', estimatedMinutes: 30, reward: '+150 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
        { id: 'publish-offers', title: 'Publish Initial Offers', description: 'Publish initial offers/promotions.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: 'MCOM Mall' },
      ],
    },
    {
      name: 'Customer Retention',
      dayStart: 22,
      dayEnd: 35,
      description: 'Create rewards programme, configure welcome offer, connect QR links.',
      color: 'amber',
      order: 2,
      missions: [
        { id: 'create-rewards', title: 'Create Rewards Programme', description: 'Create your points/rewards programme.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
        { id: 'configure-welcome', title: 'Configure Welcome Offer', description: 'Configure welcome offer and customer benefits.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
        { id: 'connect-qr-rewards', title: 'Connect QR Links to Rewards', description: 'Connect your QR links to rewards journeys.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Rewards' },
      ],
    },
    {
      name: 'Engagement & Capture',
      dayStart: 36,
      dayEnd: 49,
      description: 'Create Spin campaign, configure Hotspot, test customer journeys.',
      color: 'rose',
      order: 3,
      missions: [
        { id: 'create-spin', title: 'Create Spin Campaign', description: 'Create your MCOM Spin campaign.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: 'MCOM Spin' },
        { id: 'configure-hotspot', title: 'Configure Hotspot/Wi-Fi', description: 'Configure Hotspot/Wi-Fi customer capture if applicable.', estimatedMinutes: 15, reward: '+50 points', submissionType: 'internal_platform', system: 'MCOM Hotspot' },
        { id: 'test-journeys', title: 'Test Customer Journeys', description: 'Test customer journeys and data capture.', estimatedMinutes: 10, reward: '+25 points', submissionType: 'internal_platform' },
      ],
    },
    {
      name: 'Network & Visibility',
      dayStart: 50,
      dayEnd: 63,
      description: 'Invite businesses, join community activities, prepare Expo profile.',
      color: 'violet',
      order: 4,
      missions: [
        { id: 'invite-businesses', title: 'Invite Other Businesses', description: 'Invite other businesses via referral tools.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: '247GBS Affiliates' },
        { id: 'join-community', title: 'Join Community Activities', description: 'Join borough/community activities and leaderboard challenges.', estimatedMinutes: 15, reward: '+75 points', submissionType: 'internal_platform', system: '247GBS Expo' },
        { id: 'prepare-expo', title: 'Prepare Expo Profile', description: 'Prepare your Expo/networking profile if eligible.', estimatedMinutes: 10, reward: '+50 points', submissionType: 'internal_platform', system: '247GBS Expo' },
      ],
    },
    {
      name: 'Audit Readiness & Audit',
      dayStart: 64,
      dayEnd: 90,
      description: 'Complete all assets, invite accountant, complete sector audit, receive recommendations.',
      color: 'emerald',
      order: 5,
      missions: [
        { id: 'ensure-complete', title: 'Ensure Profile & Assets Complete', description: 'Ensure profile, storefront, rewards, and assets are complete.', estimatedMinutes: 20, reward: '+100 points', submissionType: 'internal_platform' },
        { id: 'invite-accountant', title: 'Invite Accountant', description: 'Invite accountant if needed for financial sections.', estimatedMinutes: 5, reward: '+25 points', submissionType: 'internal_platform' },
        { id: 'complete-audit', title: 'Complete Business Audit', description: 'Complete the sector-specific audit.', estimatedMinutes: 30, reward: '+200 points', submissionType: 'internal_platform', system: '247GBS Audit' },
        { id: 'review-submit', title: 'Review & Submit', description: 'Review, submit, and receive your Executive Summary and Recommendations.', estimatedMinutes: 15, reward: '+100 points', submissionType: 'internal_platform', system: '247GBS Audit' },
      ],
    },
  ];

  const seededPhases: Record<string, string> = {};
  for (const p of phasesData) {
    const existing = await prisma.programmePhase.findFirst({ where: { name: p.name } });
    if (existing) {
      const updated = await prisma.programmePhase.update({ where: { id: existing.id }, data: p });
      seededPhases[p.name] = updated.id;
    } else {
      const created = await prisma.programmePhase.create({ data: p });
      seededPhases[p.name] = created.id;
    }
  }

  // 20. Seed Readiness Gates
  console.log('Seeding readiness gates...');
  const gatesData = [
    { name: 'Audit Access', minProgressPercent: 80, isEnabled: true },
    { name: 'Expo Publishing', minProgressPercent: 60, isEnabled: true },
    { name: 'Campaign Creation', minProgressPercent: 40, isEnabled: true },
    { name: 'Advanced Tools', minProgressPercent: 20, isEnabled: true },
  ];
  for (const g of gatesData) {
    const existing = await prisma.readinessGate.findFirst({ where: { name: g.name } });
    if (!existing) {
      await prisma.readinessGate.create({ data: g });
    }
  }

  // 21. Seed Support Agents
  console.log('Seeding support agents...');
  const agentsData: { name: string; role: SupportAgentRole; email: string }[] = [
    { name: 'David Brown', role: SupportAgentRole.agent, email: 'david@mcomsolutions.co.uk' },
    { name: 'Sarah Jenkins', role: SupportAgentRole.account_manager, email: 'sarah.jenkins@mcomsolutions.co.uk' },
    { name: 'Frank Taylor', role: SupportAgentRole.consultant, email: 'frank@consultancy.com' },
    { name: 'Michael Chang', role: SupportAgentRole.consultant, email: 'michael.chang@consultancy.com' },
  ];
  const agentMap: Record<string, { id: string; name: string }> = {};
  for (const a of agentsData) {
    const existing = await prisma.supportAgent.findUnique({ where: { email: a.email } });
    if (existing) {
      agentMap[a.email] = { id: existing.id, name: existing.name };
    } else {
      const created = await prisma.supportAgent.create({ data: a });
      agentMap[a.email] = { id: created.id, name: created.name };
    }
  }

  // 22. Seed Business Programmes
  console.log('Seeding business programmes...');
  const enrolledBusinesses = [
    {
      businessName: 'Global Retailers Ltd',
      sector: 'retail',
      currentDay: 26,
      status: 'active' as const,
      phaseName: 'Customer Retention',
      agentEmail: 'david@mcomsolutions.co.uk',
      amEmail: 'sarah.jenkins@mcomsolutions.co.uk',
      consultantEmail: 'frank@consultancy.com',
      completedMissions: ['verify-identity', 'upload-logo', 'confirm-sector', 'create-storefront', 'add-products'],
    },
    {
      businessName: 'Eco Market',
      sector: 'retail',
      currentDay: 14,
      status: 'active' as const,
      phaseName: 'Digital Presence',
      agentEmail: 'david@mcomsolutions.co.uk',
      amEmail: 'sarah.jenkins@mcomsolutions.co.uk',
      consultantEmail: 'michael.chang@consultancy.com',
      completedMissions: ['verify-identity', 'upload-logo', 'confirm-sector', 'create-storefront'],
    },
  ];

  for (const b of enrolledBusinesses) {
    const existing = await prisma.businessProgramme.findFirst({ where: { businessName: b.businessName } });
    const agent = agentMap[b.agentEmail];
    const am = agentMap[b.amEmail];
    const consultant = agentMap[b.consultantEmail];
    const phaseId = seededPhases[b.phaseName];
    const profile = await prisma.businessProfile.findFirst({ where: { businessName: b.businessName } });

    const data = {
      businessId: profile?.id ?? null,
      businessName: b.businessName,
      sector: b.sector,
      currentDay: b.currentDay,
      status: b.status,
      phaseId: phaseId ?? null,
      agentId: agent?.id ?? null,
      agentName: agent?.name ?? '',
      accountManagerId: am?.id ?? null,
      accountManagerName: am?.name ?? '',
      consultantId: consultant?.id ?? null,
      consultantName: consultant?.name ?? '',
      completedMissions: b.completedMissions,
      startedAt: new Date(Date.now() - b.currentDay * 86400000),
    };

    if (existing) {
      await prisma.businessProgramme.update({ where: { id: existing.id }, data });
    } else {
      await prisma.businessProgramme.create({ data });
    }
  }

  // 23. Seed Task Definitions (Task Engine)
  console.log('Seeding task definitions...');
  const tasksData = [
    {
      title: 'Upload Official Business Logo',
      description: 'Upload a high-resolution logo for your storefront and digital directory listings across the ecosystem.',
      targetAudience: TaskAudience.BUSINESS,
      featureKey: 'business.logo_uploaded',
      deadlineDays: 7,
      rewardPoints: 50,
      isActive: true,
      platform: 'mcom_central',
    },
    {
      title: 'Complete Master Business Profile',
      description: 'Fill in your primary business details including telephone, address, sector, category, and operating hours.',
      targetAudience: TaskAudience.BUSINESS,
      featureKey: 'business.profile_completed',
      deadlineDays: 5,
      rewardPoints: 100,
      isActive: true,
      platform: 'mcom_central',
    },
    {
      title: 'Connect Google Business Listing',
      description: 'Link and verify your existing Google Business profile to sync reviews, ratings, and location data.',
      targetAudience: TaskAudience.BUSINESS,
      featureKey: 'business.google_verified',
      deadlineDays: 14,
      rewardPoints: 75,
      isActive: true,
      platform: 'mcom_central',
    },
    {
      title: 'Connect Social Media Channels',
      description: 'Add your business Instagram, Facebook, LinkedIn, or Twitter links to boost cross-platform engagement.',
      targetAudience: TaskAudience.BUSINESS,
      featureKey: 'business.social_linked',
      deadlineDays: 10,
      rewardPoints: 40,
      isActive: true,
      platform: 'mcom_central',
    },
    {
      title: 'Complete Customer Profile Details',
      description: 'Add your contact details and preferences to personalize your ecosystem rewards.',
      targetAudience: TaskAudience.CUSTOMER,
      featureKey: 'customer.profile_completed',
      deadlineDays: 7,
      rewardPoints: 50,
      isActive: true,
      platform: 'mcom_central',
    },
  ];

  const seededTasks = [];
  for (const t of tasksData) {
    const existing = await prisma.taskDefinition.findFirst({ where: { featureKey: t.featureKey } });
    if (existing) {
      const updated = await prisma.taskDefinition.update({ where: { id: existing.id }, data: t });
      seededTasks.push(updated);
    } else {
      const created = await prisma.taskDefinition.create({ data: t });
      seededTasks.push(created);
    }
  }

  // 24. Seed Task Assignments for Existing Users
  console.log('Seeding user task assignments...');
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.BUSINESS, Role.CUSTOMER] } },
  });
  for (const user of users) {
    const eligibleTasks = seededTasks.filter(
      (task) =>
        task.targetAudience === TaskAudience.BOTH ||
        (user.role === Role.BUSINESS && task.targetAudience === TaskAudience.BUSINESS) ||
        (user.role === Role.CUSTOMER && task.targetAudience === TaskAudience.CUSTOMER)
    );

    for (let i = 0; i < eligibleTasks.length; i++) {
      const task = eligibleTasks[i];
      const existing = await prisma.userTaskAssignment.findUnique({
        where: { taskId_userId: { taskId: task.id, userId: user.id } },
      });
      if (!existing) {
        const isCompleted = i === 0;
        const status = isCompleted
          ? TaskAssignmentStatus.COMPLETED
          : i === 1
          ? TaskAssignmentStatus.IN_PROGRESS
          : TaskAssignmentStatus.PENDING;
        const assignedAt = new Date(Date.now() - 3 * 86400000);
        const deadlineAt = new Date(assignedAt.getTime() + task.deadlineDays * 86400000);

        await prisma.userTaskAssignment.create({
          data: {
            taskId: task.id,
            userId: user.id,
            userType: user.role,
            status,
            assignedAt,
            deadlineAt,
            completedAt: isCompleted ? new Date() : null,
            rewardGranted: isCompleted,
            rewardPoints: isCompleted ? task.rewardPoints : 0,
          },
        });
      }
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
