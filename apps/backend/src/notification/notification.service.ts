import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Phase 4: caller identity for notification scoping (userId first, businessId fallback). */
export interface NotificationIdentity {
  userId?: string | null;
  businessId?: string | null;
}

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(identity: NotificationIdentity) {
    const ors: Array<Record<string, unknown>> = [];
    if (identity.userId) ors.push({ userId: identity.userId });
    if (identity.businessId) ors.push({ businessId: identity.businessId });
    // Global broadcasts (no keys) stay visible to everyone.
    ors.push({ userId: null, businessId: null });
    return this.prisma.notification.findMany({
      where: { OR: ors as never },
      orderBy: {
        createdAt: 'desc',
      },
    });
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

  async deleteNotification(identity: NotificationIdentity, id: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      throw new NotFoundException('Notification not found');
    }

    const owned =
      (identity.userId && notif.userId === identity.userId) ||
      (identity.businessId && notif.businessId === identity.businessId);
    // Global broadcasts (no keys) can only be removed by admins (separate endpoint).
    if (!owned) {
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
}
