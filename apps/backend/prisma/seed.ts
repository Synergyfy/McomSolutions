import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  const salt = await bcrypt.genSalt();
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
    { id: 'bronze', name: 'Bronze', description: 'Perfect for local brands and new startups.', price: 10, billingCycle: 'Monthly', platformAccess: ['Loyalty'], usageLimits: { rewards: 100 }, permissions: ['Basic Dashboard'] },
    { id: 'silver', name: 'Silver', description: 'Advanced tools for growing teams.', price: 75, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall'], usageLimits: { rewards: 500 }, permissions: ['Standard Dashboard'] },
    { id: 'gold', name: 'Gold', description: 'Scale your operations with priority access.', price: 350, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards'], usageLimits: { rewards: 2000 }, permissions: ['Full Dashboard'] },
    { id: 'platinum', name: 'Platinum', description: 'Tailored solutions for market leaders.', price: 1200, billingCycle: 'Monthly', platformAccess: ['Loyalty', 'Mall', 'Rewards', 'Audit', 'Expo'], usageLimits: { rewards: 10000 }, permissions: ['Full Dashboard', 'API Access'] },
  ];
  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {},
      create: plan,
    });
  }

  // 3. Seed Package Templates
  console.log('Seeding packages templates...');
  const packages = [
    { id: 'pkg-1', name: 'Loyalty Starter', platform: 'MCOM Rewards', description: 'Basic loyalty tools.', price: 29, billingCycle: 'Monthly', features: ['Points Management', 'Basic Rewards'], usageLimits: { members: 500 }, accessRights: ['View Analytics'] },
    { id: 'pkg-2', name: 'Loyalty Pro', platform: 'MCOM Rewards', description: 'Advanced loyalty suite.', price: 99, billingCycle: 'Monthly', features: ['Points Management', 'Advanced Rewards', 'Campaign Builder'], usageLimits: { members: 5000 }, accessRights: ['View Analytics', 'Export Data'] },
    { id: 'pkg-3', name: 'Mall Basic', platform: 'MCOM Mall', description: 'Get your store online.', price: 49, billingCycle: 'Monthly', features: ['Storefront', 'Product Listings'], usageLimits: { products: 100 }, accessRights: ['Store Admin'] },
  ];
  for (const pkg of packages) {
    await prisma.packageTemplate.upsert({
      where: { id: pkg.id },
      update: {},
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

  // 6. Seed Subscriptions
  console.log('Seeding subscriptions...');
  await prisma.ecosystemSubscription.createMany({
    data: [
      { businessId: 'global-retailers-id', businessName: 'Global Retailers Ltd', type: 'Membership', itemName: 'Gold Pro+', status: 'Active', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), amount: 900, billingCycle: 'Monthly' },
      { businessId: 'eco-market-id', businessName: 'Eco Market', type: 'Membership', itemName: 'Silver Normal', status: 'Active', startDate: new Date('2026-02-01'), endDate: new Date('2026-07-31'), amount: 75, billingCycle: 'Monthly' },
    ],
  });

  // 7. Seed Payments
  console.log('Seeding payments...');
  await prisma.adminPayment.createMany({
    data: [
      { businessId: 'global-retailers-id', businessName: 'Global Retailers Ltd', amount: 900, currency: 'GBP', method: 'Stripe', status: 'Completed', date: new Date('2026-04-01'), invoice: 'INV-001', type: 'Membership' },
      { businessId: 'eco-market-id', businessName: 'Eco Market', amount: 75, currency: 'GBP', method: 'Stripe', status: 'Pending', date: new Date('2026-04-03'), invoice: 'INV-003', type: 'Membership' },
    ],
  });

  // 8. Seed Revenue logs
  console.log('Seeding revenue records...');
  await prisma.revenueRecord.createMany({
    data: [
      { date: '2026-04-01', amount: 12800, type: 'Membership', source: 'Monthly billing' },
      { date: '2026-04-02', amount: 4500, type: 'Package', source: 'Package subscriptions' },
      { date: '2026-04-03', amount: 3200, type: 'One-time', source: 'Setup fees' },
    ],
  });

  // 9. Seed Notifications
  console.log('Seeding notifications...');
  await prisma.broadcastNotification.createMany({
    data: [
      { title: 'Welcome to MCOM', message: 'Welcome to the MCOM ecosystem!', audience: ['Businesses'], status: 'Sent', sentCount: 150 },
      { title: 'Platform Maintenance', message: 'Scheduled maintenance on April 10th.', audience: ['Businesses', 'Customers'], status: 'Scheduled', sentCount: 0, scheduledDate: new Date('2026-04-10') },
    ],
  });

  // 10. Seed Support Tickets
  console.log('Seeding support tickets...');
  await prisma.supportTicket.createMany({
    data: [
      { subject: 'Cannot access dashboard', message: 'Getting 403 error on login', fromName: 'John Doe', fromType: 'Business', status: 'Open', priority: 'High', assignedTo: 'Adam Smith' },
      { subject: 'Billing inquiry', message: 'Double charged for March subscription', fromName: 'Jane Smith', fromType: 'Business', status: 'Open', priority: 'Medium', assignedTo: 'Grace Anderson' },
    ],
  });

  // 11. Seed Audit Logs
  console.log('Seeding audit logs...');
  await prisma.auditLog.createMany({
    data: [
      { action: 'Admin Login', adminName: 'Adam Smith', targetType: 'System', targetName: 'Admin Panel', details: 'Successful login from IP 192.168.1.1', timestamp: new Date(), category: 'Authentication' },
      { action: 'Business Created', adminName: 'Adam Smith', targetType: 'Business', targetName: 'NewCo Ltd', details: 'Created business with Gold membership', timestamp: new Date(), category: 'Business' },
    ],
  });

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

  // 13. Seed Launch Rules
  console.log('Seeding launch rules...');
  await prisma.platformLaunchRule.createMany({
    data: [
      { platformId: 'rewards', requiredMembership: 'Bronze', requiredPackage: 'Loyalty Starter', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified', redirectRule: '/platform/rewards', accessRule: 'Membership + Package required' },
      { platformId: 'mall', requiredMembership: 'Silver', requiredPackage: 'Mall Basic', requiredPermissions: ['Launch Platform'], launchConditions: 'Business must be verified + Google verified', redirectRule: '/platform/mall', accessRule: 'Membership + Package required' },
    ],
  });

  // 14. Seed Integrations
  console.log('Seeding integrations...');
  await prisma.systemIntegration.createMany({
    data: [
      { name: 'Google Business Profile', type: 'External', status: 'Connected', lastSync: new Date(), connectedDate: new Date('2025-12-01') },
      { name: 'Stripe Payments', type: 'Payment', status: 'Connected', lastSync: new Date(), connectedDate: new Date('2025-11-15') },
    ],
  });

  // 15. Seed API Keys
  console.log('Seeding API keys...');
  await prisma.systemApiKey.deleteMany();
  await prisma.systemApiKey.createMany({
    data: [
      { name: 'Production API', key: 'mcom_prod_a1b2c3d4e5f6', permissions: ['Read', 'Write'], status: 'Active', lastUsed: new Date() },
      { name: 'Development API', key: 'mcom_dev_6f5e4d3c2b1a', permissions: ['Read', 'Write', 'Admin'], status: 'Active', lastUsed: new Date() },
    ],
  });

  // 16. Seed Boroughs
  console.log('Seeding boroughs...');
  await prisma.borough.deleteMany();
  await prisma.borough.createMany({
    data: [
      { name: 'Westminster', populationActivity: 'High', businessCount: 452, activeCampaigns: 12, rewardsParticipation: '88%', healthScore: 94, manager: 'James Wilson', area: 'Central London', region: 'West End', engagement: '94.2%', health: 'A+', activity: 'Active Operational' },
      { name: 'Camden', populationActivity: 'Medium', businessCount: 318, activeCampaigns: 8, rewardsParticipation: '76%', healthScore: 82, manager: 'Sarah Chen', area: 'North London', region: 'North-West', engagement: '88.5%', health: 'A', activity: 'Operational' },
      { name: 'Tower Hamlets', populationActivity: 'Very High', businessCount: 284, activeCampaigns: 15, rewardsParticipation: '92%', healthScore: 89, manager: 'David G.', area: 'East London', region: 'East', engagement: '92.1%', health: 'A+', activity: 'High Activity' },
      { name: 'Hackney', populationActivity: 'High', businessCount: 215, activeCampaigns: 6, rewardsParticipation: '81%', healthScore: 85, manager: 'Emma Thompson', area: 'East London', region: 'East End', engagement: '85.4%', health: 'B+', activity: 'Operational' },
    ],
  });

  // 17. Seed High Streets
  console.log('Seeding high streets...');
  await prisma.highStreet.deleteMany();
  await prisma.highStreet.createMany({
    data: [
      { name: 'Rye Lane', borough: 'Southwark', status: 'Active', businessCount: 156 },
      { name: 'Peckham Road', borough: 'Southwark', status: 'Active', businessCount: 45 },
      { name: 'Bellenden Road', borough: 'Southwark', status: 'Active', businessCount: 44 },
      { name: 'Brixton Road', borough: 'Lambeth', status: 'Active', businessCount: 180 },
    ],
  });

  // 18. Seed Local Malls
  console.log('Seeding local malls...');
  await prisma.localMall.deleteMany();
  await prisma.localMall.create({
    data: {
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
