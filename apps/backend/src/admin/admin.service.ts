import { Injectable, NotFoundException, BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import {
  CreateBusinessUserDto,
  CreateCustomerUserDto,
  CreateAgentUserDto,
  CreateConsultantUserDto,
  CreateAccountManagerDto,
  CreateMembershipPlanDto,
  CreatePackageTemplateDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  UpdateEcosystemPlatformDto,
  CreatePlatformLaunchRuleDto,
  UpdatePermissionRoleDto,
  RecordPaymentDto,
  UpdatePaymentStatusDto,
  CreateBroadcastNotificationDto,
  UpdateSupportTicketDto,
  UpdateSystemSettingsDto,
  CreateBoroughDto,
  CreateHighStreetDto,
  CreateLocalMallDto,
  AdminQueryDto,
  UpdateMembershipPlanDto,
  UpdatePackageTemplateDto,
  UpdateBoroughDto,
  UpdateHighStreetDto,
  UpdateLocalMallDto,
  UpdatePlatformLaunchRuleDto,
  UpdateBroadcastNotificationDto,
  ClearAuditLogsDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly RECURRING_REVENUE_FACTOR = 0.7;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ─── Admin Auth ─────────────────────────────────────────
  async loginAdmin(email: string, password: string) {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.role !== Role.ADMIN) {
      throw new UnauthorizedException('Access denied. Admin privileges required.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.firstName || user.email.split('@')[0],
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.logAudit('Admin Login', 'System', 'Admin Panel', `Admin login from ${email}`, payload.name);

    return {
      accessToken,
      refreshToken,
      admin: {
        id: user.id,
        email: user.email,
        name: payload.name,
        role: user.role,
      },
    };
  }

  // ─── Helpers: Audit Logger ──────────────────────────────
  async logAudit(
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'General',
  ) {
    return this.logAuditTx(this.prisma, action, targetType, targetName, details, adminName, category);
  }

  async logAuditTx(
    tx: any,
    action: string,
    targetType: string,
    targetName: string,
    details: string,
    adminName = 'System',
    category = 'General',
  ) {
    return tx.auditLog.create({
      data: {
        action,
        adminName,
        targetType,
        targetName,
        details,
        category,
      },
    });
  }

  // ─── Dashboard Stats ────────────────────────────────────
  async getStats() {
    const todayStr = new Date().toISOString().split('T')[0];

    const [
      businessesCount,
      customersCount,
      agentsCount,
      consultantsCount,
      managersCount,
      activeSubs,
      expiredSubs,
      pendingSubs,
      cancelledSubs,
      completedPaymentsAgg,
      todayRevenueAgg,
      monthlyRevenueAgg,
      platforms,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.BUSINESS } }),
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      this.prisma.user.count({ where: { role: Role.AGENT } }),
      this.prisma.user.count({ where: { role: Role.CONSULTANT } }),
      this.prisma.user.count({ where: { role: Role.ACCOUNT_MANAGER } }),
      this.prisma.ecosystemSubscription.count({ where: { status: 'Active' } }),
      this.prisma.ecosystemSubscription.count({ where: { status: 'Expired' } }),
      this.prisma.ecosystemSubscription.count({ where: { status: 'Pending' } }),
      this.prisma.ecosystemSubscription.count({ where: { status: 'Cancelled' } }),
      this.prisma.adminPayment.aggregate({
        _sum: { amount: true },
        where: { status: 'Completed' },
      }),
      this.prisma.revenueRecord.aggregate({
        _sum: { amount: true },
        where: { date: todayStr },
      }),
      this.prisma.revenueRecord.aggregate({
        _sum: { amount: true },
      }),
      this.prisma.ecosystemPlatform.findMany(),
    ]);

    const todayRevenue = todayRevenueAgg._sum.amount || 0;
    const monthlyRevenue = monthlyRevenueAgg._sum.amount || 0;
    const completedPayments = completedPaymentsAgg._sum.amount || 0;
    const recurringRevenue = monthlyRevenue * this.RECURRING_REVENUE_FACTOR;

    // Platforms users mapping
    const platformList = platforms.map(p => ({
      id: p.id,
      name: p.name,
      totalUsers: p.totalUsers,
    }));

    return {
      success: true,
      data: {
        ecosystemStats: {
          totalBusinesses: businessesCount,
          totalCustomers: customersCount,
          totalAgents: agentsCount,
          totalConsultants: consultantsCount,
          totalAccountManagers: managersCount,
          totalPlatformUsers: platformList.reduce((sum, p) => sum + p.totalUsers, 0),
        },
        membershipStats: {
          active: activeSubs,
          expired: expiredSubs,
          pending: pendingSubs,
          cancelled: cancelledSubs,
        },
        revenueStats: {
          todayRevenue,
          monthlyRevenue,
          totalCompleted: completedPayments,
          recurringRevenue,
        },
        platforms: platformList,
      },
    };
  }

  // ─── Business Users Management ────────────────────────
  async getBusinesses(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        skip,
        take: limit,
        where,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    const formatted = items.map(b => ({
      id: b.id,
      userId: b.userId,
      name: b.businessName,
      email: b.email,
      phone: b.phone,
      membership: `${b.membershipLevel} ${b.membershipTier}`,
      platformAccess: b.localMallName ? ['Mall'] : ['Loyalty'],
      status: b.membershipStatus === 'active' ? 'Active' : 'Suspended',
      revenue: '£0',
      source: 'direct',
      joined: b.createdAt.toISOString().split('T')[0],
      googleVerified: b.isOnGoogle,
    }));

    return {
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createBusiness(dto: CreateBusinessUserDto, adminName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = Math.random().toString(36).slice(-8) + '1!A';
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          role: Role.BUSINESS,
          businessProfile: {
            create: {
              businessName: dto.name,
              businessType: 'retail',
              country: 'United Kingdom',
              phone: dto.phone || '',
              email: dto.email.toLowerCase(),
              isOnGoogle: dto.googleVerified || false,
            },
          },
        },
        include: { businessProfile: true },
      });

      await this.logAuditTx(tx, 'Business Created', 'Business', dto.name, `Created business account`, adminName);
      return createdUser;
    });

    return { success: true, data: { ...user.businessProfile, tempPassword } };
  }

  async updateBusiness(id: string, updates: Partial<CreateBusinessUserDto>, adminName?: string) {
    const profile = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Business profile not found');

    const data: any = {};
    if (updates.name) data.businessName = updates.name;
    if (updates.phone) data.phone = updates.phone;
    if (updates.googleVerified !== undefined) data.isOnGoogle = updates.googleVerified;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.businessProfile.update({
        where: { id },
        data,
      });

      await this.logAuditTx(tx, 'Business Updated', 'Business', result.businessName, `Updated business fields`, adminName);
      return result;
    });

    return { success: true, data: updated };
  }

  async deleteBusiness(id: string, adminName?: string) {
    const profile = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Business profile not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });
      await this.logAuditTx(tx, 'Business Deleted', 'Business', id, `Deleted business permanently`, adminName);
    });

    return { success: true };
  }

  // ─── Customer Users Management ────────────────────────
  async getCustomers(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: Role.CUSTOMER };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        include: { customerProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = items.map(u => ({
      id: u.customerProfile?.id || u.id,
      userId: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      phone: '', // Customer profile has no phone mapping
      loyaltyPoints: u.customerProfile?.loyaltyPoints || 0,
      platformUsage: u.customerProfile?.platformUsage || [],
      membershipStatus: u.customerProfile?.membershipStatus || 'None',
      status: u.customerProfile?.status || 'Active',
    }));

    return {
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createCustomer(dto: CreateCustomerUserDto, adminName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = Math.random().toString(36).slice(-8) + '1!A';
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const parts = dto.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          role: Role.CUSTOMER,
          firstName,
          lastName,
          customerProfile: {
            create: {
              loyaltyPoints: dto.loyaltyPoints || 0,
              platformUsage: dto.platformUsage || [],
              membershipStatus: dto.membershipStatus || 'None',
              status: dto.status || 'Active',
            },
          },
        },
        include: { customerProfile: true },
      });

      await this.logAuditTx(tx, 'Customer Created', 'Customer', dto.name, `Created customer profile`, adminName);
      return createdUser;
    });

    return { success: true, data: { ...user.customerProfile, tempPassword } };
  }

  async updateCustomer(id: string, updates: Partial<CreateCustomerUserDto>, adminName?: string) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Customer profile not found');

    const data: any = {};
    if (updates.loyaltyPoints !== undefined) data.loyaltyPoints = updates.loyaltyPoints;
    if (updates.platformUsage) data.platformUsage = updates.platformUsage;
    if (updates.membershipStatus) data.membershipStatus = updates.membershipStatus;
    if (updates.status) data.status = updates.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.customerProfile.update({
        where: { id },
        data,
      });

      await this.logAuditTx(tx, 'Customer Updated', 'Customer', id, `Updated customer profile`, adminName);
      return result;
    });

    return { success: true, data: updated };
  }

  async deleteCustomer(id: string, adminName?: string) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Customer profile not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });
      await this.logAuditTx(tx, 'Customer Deleted', 'Customer', id, `Deleted customer profile`, adminName);
    });

    return { success: true };
  }

  // ─── Agent Users Management ───────────────────────────
  async getAgents(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: Role.AGENT };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        include: { agentProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = items.map(u => ({
      id: u.agentProfile?.id || u.id,
      userId: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      phone: '',
      permissions: u.agentProfile?.permissions || [],
      status: u.agentProfile?.status || 'Active',
    }));

    return {
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createAgent(dto: CreateAgentUserDto, adminName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = Math.random().toString(36).slice(-8) + '1!A';
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const parts = dto.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          role: Role.AGENT,
          firstName,
          lastName,
          agentProfile: {
            create: {
              permissions: dto.permissions || [],
              status: dto.status || 'Active',
            },
          },
        },
        include: { agentProfile: true },
      });

      await this.logAuditTx(tx, 'Agent Created', 'Agent', dto.name, `Created agent account`, adminName);
      return createdUser;
    });

    return { success: true, data: { ...user.agentProfile, tempPassword } };
  }

  async updateAgent(id: string, updates: Partial<CreateAgentUserDto>, adminName?: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    const data: any = {};
    if (updates.permissions) data.permissions = updates.permissions;
    if (updates.status) data.status = updates.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.agentProfile.update({
        where: { id },
        data,
      });

      await this.logAuditTx(tx, 'Agent Updated', 'Agent', id, `Updated agent permissions/status`, adminName);
      return result;
    });

    return { success: true, data: updated };
  }

  async deleteAgent(id: string, adminName?: string) {
    const profile = await this.prisma.agentProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Agent profile not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });
      await this.logAuditTx(tx, 'Agent Deleted', 'Agent', id, `Deleted agent profile`, adminName);
    });

    return { success: true };
  }

  // ─── Consultant Users Management ──────────────────────
  async getConsultants(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: Role.CONSULTANT };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        include: { consultantProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = items.map(u => ({
      id: u.consultantProfile?.id || u.id,
      userId: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      phone: '',
      specialisation: u.consultantProfile?.specialisation || '',
      status: u.consultantProfile?.status || 'Active',
    }));

    return {
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createConsultant(dto: CreateConsultantUserDto, adminName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = Math.random().toString(36).slice(-8) + '1!A';
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const parts = dto.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          role: Role.CONSULTANT,
          firstName,
          lastName,
          consultantProfile: {
            create: {
              specialisation: dto.specialisation || '',
              status: dto.status || 'Active',
            },
          },
        },
        include: { consultantProfile: true },
      });

      await this.logAuditTx(tx, 'Consultant Created', 'Consultant', dto.name, `Created consultant profile`, adminName);
      return createdUser;
    });

    return { success: true, data: { ...user.consultantProfile, tempPassword } };
  }

  async updateConsultant(id: string, updates: Partial<CreateConsultantUserDto>, adminName?: string) {
    const profile = await this.prisma.consultantProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Consultant profile not found');

    const data: any = {};
    if (updates.specialisation) data.specialisation = updates.specialisation;
    if (updates.status) data.status = updates.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.consultantProfile.update({
        where: { id },
        data,
      });

      await this.logAuditTx(tx, 'Consultant Updated', 'Consultant', id, `Updated consultant specialisation/status`, adminName);
      return result;
    });

    return { success: true, data: updated };
  }

  async deleteConsultant(id: string, adminName?: string) {
    const profile = await this.prisma.consultantProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Consultant profile not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });
      await this.logAuditTx(tx, 'Consultant Deleted', 'Consultant', id, `Deleted consultant profile`, adminName);
    });

    return { success: true };
  }

  // ─── Account Manager Management ──────────────────────
  async getAccountManagers(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { role: Role.ACCOUNT_MANAGER };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        include: { accountManagerProfile: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formatted = items.map(u => ({
      id: u.accountManagerProfile?.id || u.id,
      userId: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email.split('@')[0],
      email: u.email,
      phone: '',
      assignedBusinesses: u.accountManagerProfile?.assignedBusinesses || 0,
      status: u.accountManagerProfile?.status || 'Active',
    }));

    return {
      success: true,
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createAccountManager(dto: CreateAccountManagerDto, adminName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) throw new ConflictException('Email already registered');

    const tempPassword = Math.random().toString(36).slice(-8) + '1!A';
    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(tempPassword, salt);

    const parts = dto.name.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: passwordHash,
          role: Role.ACCOUNT_MANAGER,
          firstName,
          lastName,
          accountManagerProfile: {
            create: {
              assignedBusinesses: dto.assignedBusinesses || 0,
              status: dto.status || 'Active',
            },
          },
        },
        include: { accountManagerProfile: true },
      });

      await this.logAuditTx(tx, 'Account Manager Created', 'Account Manager', dto.name, `Created account manager`, adminName);
      return createdUser;
    });

    return { success: true, data: { ...user.accountManagerProfile, tempPassword } };
  }

  async updateAccountManager(id: string, updates: Partial<CreateAccountManagerDto>, adminName?: string) {
    const profile = await this.prisma.accountManagerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Account manager profile not found');

    const data: any = {};
    if (updates.assignedBusinesses !== undefined) data.assignedBusinesses = updates.assignedBusinesses;
    if (updates.status) data.status = updates.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.accountManagerProfile.update({
        where: { id },
        data,
      });

      await this.logAuditTx(tx, 'Account Manager Updated', 'Account Manager', id, `Updated account manager profile`, adminName);
      return result;
    });

    return { success: true, data: updated };
  }

  async deleteAccountManager(id: string, adminName?: string) {
    const profile = await this.prisma.accountManagerProfile.findUnique({ where: { id } });
    if (!profile) throw new NotFoundException('Account manager profile not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: profile.userId } });
      await this.logAuditTx(tx, 'Account Manager Deleted', 'Account Manager', id, `Deleted account manager profile`, adminName);
    });

    return { success: true };
  }

  // ─── Membership Plans CRUD ─────────────────────────────
  async getPlans() {
    const items = await this.prisma.membershipPlan.findMany({ orderBy: { createdAt: 'desc' } });
    return { success: true, data: items };
  }

  async createPlan(dto: CreateMembershipPlanDto, adminName?: string) {
    const plan = await this.prisma.$transaction(async (tx) => {
      const result = await tx.membershipPlan.create({
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          billingCycle: dto.billingCycle,
          platformAccess: dto.platformAccess,
          usageLimits: dto.usageLimits,
          permissions: dto.permissions,
          archived: false,
        },
      });

      await this.logAuditTx(tx, 'Membership Created', 'Membership', dto.name, `Created ${dto.name} membership`, adminName);
      return result;
    });

    return { success: true, data: plan };
  }

  async updatePlan(id: string, updates: UpdateMembershipPlanDto, adminName?: string) {
    const planExists = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!planExists) throw new NotFoundException('Plan not found');

    const plan = await this.prisma.$transaction(async (tx) => {
      const result = await tx.membershipPlan.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'Membership Updated', 'Membership', id, `Updated membership plan settings`, adminName);
      return result;
    });

    return { success: true, data: plan };
  }

  async deletePlan(id: string, adminName?: string) {
    const planExists = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!planExists) throw new NotFoundException('Plan not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.membershipPlan.delete({ where: { id } });
      await this.logAuditTx(tx, 'Membership Deleted', 'Membership', id, `Deleted membership plan`, adminName);
    });

    return { success: true };
  }

  // ─── Packages CRUD ─────────────────────────────────────
  async getPackages() {
    const items = await this.prisma.packageTemplate.findMany({ orderBy: { createdAt: 'desc' } });
    return { success: true, data: items };
  }

  async createPackage(dto: CreatePackageTemplateDto, adminName?: string) {
    const pkg = await this.prisma.$transaction(async (tx) => {
      const result = await tx.packageTemplate.create({
        data: {
          name: dto.name,
          platform: dto.platform,
          description: dto.description,
          price: dto.price,
          billingCycle: dto.billingCycle,
          features: dto.features,
          usageLimits: dto.usageLimits,
          accessRights: dto.accessRights,
          archived: false,
        },
      });

      await this.logAuditTx(tx, 'Package Created', 'Package', dto.name, `Created ${dto.name} package`, adminName);
      return result;
    });

    return { success: true, data: pkg };
  }

  async updatePackage(id: string, updates: UpdatePackageTemplateDto, adminName?: string) {
    const pkgExists = await this.prisma.packageTemplate.findUnique({ where: { id } });
    if (!pkgExists) throw new NotFoundException('Package not found');

    const pkg = await this.prisma.$transaction(async (tx) => {
      const result = await tx.packageTemplate.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'Package Updated', 'Package', id, `Updated package template settings`, adminName);
      return result;
    });

    return { success: true, data: pkg };
  }

  async deletePackage(id: string, adminName?: string) {
    const pkgExists = await this.prisma.packageTemplate.findUnique({ where: { id } });
    if (!pkgExists) throw new NotFoundException('Package not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.packageTemplate.delete({ where: { id } });
      await this.logAuditTx(tx, 'Package Deleted', 'Package', id, `Deleted package`, adminName);
    });

    return { success: true };
  }

  // ─── Subscriptions ─────────────────────────────────────
  async getSubscriptions(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { itemName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.ecosystemSubscription.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ecosystemSubscription.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createSubscription(dto: CreateSubscriptionDto, adminName?: string) {
    let businessId = dto.businessId;
    if (!businessId) {
      const biz = await this.prisma.businessProfile.findFirst({ where: { businessName: dto.businessName } });
      if (!biz) throw new BadRequestException(`Business with name "${dto.businessName}" not found`);
      businessId = biz.id;
    }

    const sub = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ecosystemSubscription.create({
        data: {
          businessId,
          businessName: dto.businessName,
          type: dto.type,
          itemName: dto.itemName,
          status: dto.status || 'Active',
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          amount: dto.amount,
          billingCycle: dto.billingCycle,
        },
      });

      await this.logAuditTx(tx, 'Subscription Created', 'Subscription', dto.businessName, `Created ${dto.type} subscription`, adminName);
      return result;
    });

    return { success: true, data: sub };
  }

  async updateSubscription(id: string, dto: UpdateSubscriptionDto, adminName?: string) {
    const subExists = await this.prisma.ecosystemSubscription.findUnique({ where: { id } });
    if (!subExists) throw new NotFoundException('Subscription not found');

    const sub = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ecosystemSubscription.update({
        where: { id },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        },
      });
      await this.logAuditTx(tx, 'Subscription Updated', 'Subscription', result.businessName, `Updated subscription status/endDate`, adminName);
      return result;
    });

    return { success: true, data: sub };
  }

  // ─── Platforms Access Control ──────────────────────────
  async getPlatforms() {
    const platforms = await this.prisma.ecosystemPlatform.findMany({ orderBy: { name: 'asc' } });
    const rules = await this.prisma.platformLaunchRule.findMany();
    return {
      success: true,
      data: {
        platforms,
        launchRules: rules,
      },
    };
  }

  async updatePlatform(id: string, dto: UpdateEcosystemPlatformDto, adminName?: string) {
    const plat = await this.prisma.ecosystemPlatform.findUnique({ where: { id } });
    if (!plat) throw new NotFoundException('Platform not found');

    const platform = await this.prisma.$transaction(async (tx) => {
      const result = await tx.ecosystemPlatform.update({
        where: { id },
        data: dto,
      });

      await this.logAuditTx(tx, 'Platform Updated', 'Platform', id, `Updated platform settings`, adminName);
      return result;
    });

    return { success: true, data: platform };
  }

  async createLaunchRule(dto: CreatePlatformLaunchRuleDto, adminName?: string) {
    const rule = await this.prisma.$transaction(async (tx) => {
      const result = await tx.platformLaunchRule.create({
        data: dto,
      });

      await this.logAuditTx(tx, 'Launch Rule Created', 'Launch Rule', dto.platformId, `Created launch rule for ${dto.platformId}`, adminName);
      return result;
    });

    return { success: true, data: rule };
  }

  async updateLaunchRule(id: string, updates: UpdatePlatformLaunchRuleDto, adminName?: string) {
    const ruleExists = await this.prisma.platformLaunchRule.findUnique({ where: { id } });
    if (!ruleExists) throw new NotFoundException('Platform launch rule not found');

    const rule = await this.prisma.$transaction(async (tx) => {
      const result = await tx.platformLaunchRule.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'Launch Rule Updated', 'Launch Rule', id, `Updated platform launch rule`, adminName);
      return result;
    });

    return { success: true, data: rule };
  }

  async deleteLaunchRule(id: string, adminName?: string) {
    const ruleExists = await this.prisma.platformLaunchRule.findUnique({ where: { id } });
    if (!ruleExists) throw new NotFoundException('Platform launch rule not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.platformLaunchRule.delete({ where: { id } });
      await this.logAuditTx(tx, 'Launch Rule Deleted', 'Launch Rule', id, `Deleted launch rule`, adminName);
    });

    return { success: true };
  }

  // ─── Permission Matrix ─────────────────────────────────
  async getPermissions() {
    const items = await this.prisma.permissionRole.findMany();
    return { success: true, data: items };
  }

  async updatePermissionRole(role: string, dto: UpdatePermissionRoleDto, adminName?: string) {
    const item = await this.prisma.$transaction(async (tx) => {
      const result = await tx.permissionRole.upsert({
        where: { role },
        create: {
          role,
          permissions: dto.permissions,
        },
        update: {
          permissions: dto.permissions,
        },
      });
      await this.logAuditTx(tx, 'Permissions Updated', 'Permissions', role, `Updated permissions matrix for role: ${role}`, adminName);
      return result;
    });

    return { success: true, data: item };
  }

  // ─── Finance & Revenue ─────────────────────────────────
  async getPayments(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { businessName: { contains: search, mode: 'insensitive' } },
        { invoice: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.adminPayment.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminPayment.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async recordPayment(dto: RecordPaymentDto, adminName?: string) {
    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.adminPayment.create({
        data: {
          businessId: dto.businessId,
          businessName: dto.businessName,
          amount: dto.amount,
          currency: dto.currency || 'GBP',
          method: dto.method,
          status: dto.status,
          invoice: dto.invoice,
          type: dto.type,
        },
      });

      // Record dynamic revenue log
      await tx.revenueRecord.create({
        data: {
          date: new Date().toISOString().split('T')[0],
          amount: dto.amount,
          type: dto.type,
          source: dto.method,
        },
      });

      await this.logAuditTx(tx, 'Payment Recorded', 'Payment', dto.businessName, `Payment of £${dto.amount}`, adminName);
      return createdPayment;
    });

    return { success: true, data: payment };
  }

  async updatePaymentStatus(id: string, dto: UpdatePaymentStatusDto, adminName?: string) {
    const paymentExists = await this.prisma.adminPayment.findUnique({ where: { id } });
    if (!paymentExists) throw new NotFoundException('Payment not found');

    const payment = await this.prisma.$transaction(async (tx) => {
      const result = await tx.adminPayment.update({
        where: { id },
        data: { status: dto.status },
      });

      if (dto.status === 'Refunded') {
        await this.logAuditTx(tx, 'Payment Refunded', 'Payment', result.businessName, `Refunded £${result.amount}`, adminName);
      } else {
        await this.logAuditTx(tx, 'Payment Status Updated', 'Payment', result.businessName, `Updated payment status to ${dto.status}`, adminName);
      }
      return result;
    });

    return { success: true, data: payment };
  }

  async getRevenue(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { type: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.revenueRecord.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.revenueRecord.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── Communication ─────────────────────────────────────
  async getNotifications(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.broadcastNotification.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.broadcastNotification.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async createNotification(dto: CreateBroadcastNotificationDto, adminName?: string) {
    const notif = await this.prisma.$transaction(async (tx) => {
      const result = await tx.broadcastNotification.create({
        data: {
          title: dto.title,
          message: dto.message,
          audience: dto.audience,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
          status: dto.status || 'Sent',
          sentCount: 0,
        },
      });

      await this.logAuditTx(tx, 'Notification Created', 'Notification', dto.title, `Created broadcast notification: ${dto.title}`, adminName);
      return result;
    });

    return { success: true, data: notif };
  }

  async updateNotification(id: string, updates: UpdateBroadcastNotificationDto, adminName?: string) {
    const notifExists = await this.prisma.broadcastNotification.findUnique({ where: { id } });
    if (!notifExists) throw new NotFoundException('Notification not found');

    const notif = await this.prisma.$transaction(async (tx) => {
      const result = await tx.broadcastNotification.update({
        where: { id },
        data: {
          ...updates,
          ...(updates.scheduledDate && { scheduledDate: new Date(updates.scheduledDate) }),
        },
      });
      await this.logAuditTx(tx, 'Notification Updated', 'Notification', result.title, `Updated broadcast notification settings`, adminName);
      return result;
    });

    return { success: true, data: notif };
  }

  async deleteNotification(id: string, adminName?: string) {
    const notifExists = await this.prisma.broadcastNotification.findUnique({ where: { id } });
    if (!notifExists) throw new NotFoundException('Notification not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.broadcastNotification.delete({ where: { id } });
      await this.logAuditTx(tx, 'Notification Deleted', 'Notification', id, `Deleted broadcast notification`, adminName);
    });

    return { success: true };
  }

  async getTickets(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        skip,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateTicket(id: string, dto: UpdateSupportTicketDto, adminName?: string) {
    const ticketExists = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticketExists) throw new NotFoundException('Support ticket not found');

    const ticket = await this.prisma.$transaction(async (tx) => {
      const result = await tx.supportTicket.update({
        where: { id },
        data: dto,
      });
      await this.logAuditTx(tx, 'Ticket Updated', 'Ticket', id, `Updated support ticket status/assignee`, adminName);
      return result;
    });

    return { success: true, data: ticket };
  }

  // ─── System Audit & Settings ──────────────────────────
  async getAuditLogs(query: AdminQueryDto) {
    const { search, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { adminName: { contains: search, mode: 'insensitive' } },
        { targetName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        where,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async clearAuditLogs(body: ClearAuditLogsDto, adminName?: string) {
    if (body.confirm !== 'CONFIRM') {
      throw new BadRequestException('Action rejected: Please confirm by sending "CONFIRM" in the body.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany();
      await this.logAuditTx(tx, 'Logs Cleared', 'System', 'AuditLogs', `Cleared all system audit logs`, adminName);
    });

    return { success: true };
  }

  async getSettings() {
    let settings = await this.prisma.systemSettings.findFirst();
    if (!settings) {
      // Create defaults
      settings = await this.prisma.systemSettings.create({
        data: {
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
      });
    }
    return { success: true, data: settings };
  }

  async updateSettings(dto: UpdateSystemSettingsDto) {
    const settings = await this.prisma.systemSettings.findFirst();
    const id = settings?.id || 'global';

    const updated = await this.prisma.systemSettings.upsert({
      where: { id },
      create: {
        id,
        ...dto,
      },
      update: dto,
    });

    return { success: true, data: updated };
  }

  // ─── Localities (Boroughs, High Streets, Local Malls) ─
  async getBoroughs() {
    const items = await this.prisma.borough.findMany({ orderBy: { name: 'asc' } });
    return { success: true, data: items };
  }

  async createBorough(dto: CreateBoroughDto, adminName?: string) {
    const borough = await this.prisma.$transaction(async (tx) => {
      const result = await tx.borough.create({
        data: dto,
      });
      await this.logAuditTx(tx, 'Borough Created', 'Borough', dto.name, `Onboarded borough ${dto.name}`, adminName);
      return result;
    });

    return { success: true, data: borough };
  }

  async updateBorough(id: string, updates: UpdateBoroughDto, adminName?: string) {
    const boroughExists = await this.prisma.borough.findUnique({ where: { id } });
    if (!boroughExists) throw new NotFoundException('Borough not found');

    const borough = await this.prisma.$transaction(async (tx) => {
      const result = await tx.borough.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'Borough Updated', 'Borough', id, `Updated borough settings`, adminName);
      return result;
    });

    return { success: true, data: borough };
  }

  async deleteBorough(id: string, adminName?: string) {
    const boroughExists = await this.prisma.borough.findUnique({ where: { id } });
    if (!boroughExists) throw new NotFoundException('Borough not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.borough.delete({ where: { id } });
      await this.logAuditTx(tx, 'Borough Deleted', 'Borough', id, `Deleted borough`, adminName);
    });

    return { success: true };
  }

  async getHighStreets() {
    const items = await this.prisma.highStreet.findMany({ orderBy: { name: 'asc' } });
    return { success: true, data: items };
  }

  async createHighStreet(dto: CreateHighStreetDto, adminName?: string) {
    const hs = await this.prisma.$transaction(async (tx) => {
      const result = await tx.highStreet.create({
        data: dto,
      });
      await this.logAuditTx(tx, 'HighStreet Created', 'HighStreet', dto.name, `Created high street: ${dto.name}`, adminName);
      return result;
    });

    return { success: true, data: hs };
  }

  async updateHighStreet(id: string, updates: UpdateHighStreetDto, adminName?: string) {
    const hsExists = await this.prisma.highStreet.findUnique({ where: { id } });
    if (!hsExists) throw new NotFoundException('High street not found');

    const hs = await this.prisma.$transaction(async (tx) => {
      const result = await tx.highStreet.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'HighStreet Updated', 'HighStreet', id, `Updated high street settings`, adminName);
      return result;
    });

    return { success: true, data: hs };
  }

  async deleteHighStreet(id: string, adminName?: string) {
    const hsExists = await this.prisma.highStreet.findUnique({ where: { id } });
    if (!hsExists) throw new NotFoundException('High street not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.highStreet.delete({ where: { id } });
      await this.logAuditTx(tx, 'HighStreet Deleted', 'HighStreet', id, `Deleted high street`, adminName);
    });

    return { success: true };
  }

  async getLocalMalls() {
    const items = await this.prisma.localMall.findMany({ orderBy: { name: 'asc' } });
    return { success: true, data: items };
  }

  async createLocalMall(dto: CreateLocalMallDto, adminName?: string) {
    const existing = await this.prisma.localMall.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already exists');

    const mall = await this.prisma.$transaction(async (tx) => {
      const result = await tx.localMall.create({
        data: {
          name: dto.name,
          postcodes: dto.postcodes,
          borough: dto.borough,
          primaryHighStreet: dto.primaryHighStreet,
          additionalHighStreets: dto.additionalHighStreets,
          status: dto.status || 'Active',
          description: dto.description,
          longDescription: dto.longDescription,
          slug: dto.slug,
          primaryColour: dto.primaryColour,
          secondaryColour: dto.secondaryColour,
          welcomeMessage: dto.welcomeMessage,
          tagline: dto.tagline,
          radiusCoverage: dto.radiusCoverage,
          allowBusinessesOutsidePostcode: dto.allowBusinessesOutsidePostcode ?? false,
          allowVirtualBusinesses: dto.allowVirtualBusinesses ?? true,
          allowHomeBusinesses: dto.allowHomeBusinesses ?? true,
          requireVerification: dto.requireVerification ?? true,
          requireAuditCompletion: dto.requireAuditCompletion ?? false,
          requireMembershipApproval: dto.requireMembershipApproval ?? true,
          leadConsultant: dto.leadConsultant,
          assignedAccountManagers: dto.assignedAccountManagers || [],
          assignedAgents: dto.assignedAgents || [],
          supportTeam: dto.supportTeam || [],
          categoryPriorities: dto.categoryPriorities || {},
        },
      });

      await this.logAuditTx(tx, 'LocalMall Created', 'LocalMall', dto.name, `Created LocalMall postcode territory`, adminName);
      return result;
    });

    return { success: true, data: mall };
  }

  async updateLocalMall(id: string, updates: UpdateLocalMallDto, adminName?: string) {
    const mallExists = await this.prisma.localMall.findUnique({ where: { id } });
    if (!mallExists) throw new NotFoundException('Local mall not found');

    const mall = await this.prisma.$transaction(async (tx) => {
      const result = await tx.localMall.update({
        where: { id },
        data: updates,
      });
      await this.logAuditTx(tx, 'LocalMall Updated', 'LocalMall', id, `Updated LocalMall settings`, adminName);
      return result;
    });

    return { success: true, data: mall };
  }

  async deleteLocalMall(id: string, adminName?: string) {
    const mallExists = await this.prisma.localMall.findUnique({ where: { id } });
    if (!mallExists) throw new NotFoundException('Local mall not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.localMall.delete({ where: { id } });
      await this.logAuditTx(tx, 'LocalMall Deleted', 'LocalMall', id, `Deleted LocalMall`, adminName);
    });

    return { success: true };
  }
}
