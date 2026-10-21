import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

/** Phase 4: caller identity for notification scoping (userId first, businessId fallback). */
export interface NotificationIdentity {
  userId?: string | null;
  businessId?: string | null;
}

const BROADCAST_OR = { userId: null, businessId: null } as const;

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Historical behaviour: no query → return the caller's array directly.
   * Any filter/page/limit → return a paginated envelope with unreadCount.
   */
  async getNotifications(identity: NotificationIdentity, query?: NotificationQueryDto) {
    const ownedOr = this.ownedOr(identity);
    const hasQuery = !!(
      query &&
      (query.page !== undefined ||
        query.limit !== undefined ||
        query.category ||
        query.unreadOnly !== undefined ||
        query.search)
    );

    if (!hasQuery) {
      const notifications = await this.prisma.notification.findMany({
        where: this.buildWhere(identity, query),
        orderBy: { createdAt: 'desc' },
      });
      return notifications.map((n) => this.toResponse(n));
    }

    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const where = this.buildWhere(identity, query);

    const [total, unreadCount, notifications] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { OR: ownedOr as never, read: false },
      }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: notifications.map((n) => this.toResponse(n)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      unreadCount,
    };
  }

  async getUnreadCount(identity: NotificationIdentity) {
    const ownedOr = this.ownedOr(identity);
    if (ownedOr.length === 0) {
      return { success: true, unreadCount: 0 };
    }
    const unreadCount = await this.prisma.notification.count({
      where: { OR: ownedOr as never, read: false },
    });
    return { success: true, unreadCount };
  }

  async markAllAsRead(identity: NotificationIdentity) {
    // Scoped to the caller's own rows only — global broadcasts are never
    // mass-marked by a single non-admin user.
    const ors: Array<Record<string, unknown>> = [];
    if (identity.userId) ors.push({ userId: identity.userId, read: false });
    if (identity.businessId) ors.push({ businessId: identity.businessId, read: false });
    if (ors.length === 0) return { count: 0 };
    return this.prisma.notification.updateMany({
      where: { OR: ors as never },
      data: {
        read: true,
      },
    });
  }

  async markOneAsRead(identity: NotificationIdentity, id: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif || !this.isOwned(identity, notif)) {
      throw new NotFoundException('Notification not found');
    }

    if (notif.read) {
      return this.toResponse(notif);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
    return this.toResponse(updated);
  }

  async deleteNotification(identity: NotificationIdentity, id: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      throw new NotFoundException('Notification not found');
    }

    // Global broadcasts (no keys) can only be removed by admins (separate endpoint).
    if (!this.isOwned(identity, notif)) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async createNotification(data: { businessId?: string; userId?: string; type: string; title: string; message: string }) {
    return this.prisma.notification.create({
      data,
    });
  }

  private ownedOr(identity: NotificationIdentity): Array<Record<string, unknown>> {
    const ors: Array<Record<string, unknown>> = [];
    if (identity.userId) ors.push({ userId: identity.userId });
    if (identity.businessId) ors.push({ businessId: identity.businessId });
    return ors;
  }

  private buildWhere(
    identity: NotificationIdentity,
    query: NotificationQueryDto | undefined,
  ): Prisma.NotificationWhereInput {
    const ownedOr = this.ownedOr(identity);

    // Broadcast rows have no per-user read state. For unread-only views we
    // leave them out so a single broadcast can never pin the unread badge
    // forever. Normal lists still include them for compatibility with the
    // existing notification centre.
    const ors = query?.unreadOnly ? ownedOr : [...ownedOr, BROADCAST_OR];

    const where: Prisma.NotificationWhereInput = { OR: ors as never };

    if (query?.category) {
      where.type = query.category;
    }
    if (query?.unreadOnly) {
      where.read = false;
    }
    if (query?.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { message: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    return where;
  }

  private isOwned(identity: NotificationIdentity, notif: { userId?: string | null; businessId?: string | null }) {
    return Boolean(
      (identity.userId && notif.userId === identity.userId) ||
        (identity.businessId && notif.businessId === identity.businessId),
    );
  }

  private toResponse(notif: any) {
    return {
      ...notif,
      body: notif.message,
      category: notif.type,
      isRead: notif.read,
    };
  }
}
