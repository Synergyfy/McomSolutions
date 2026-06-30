import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async getNotifications(businessId: string) {
    return this.prisma.notification.findMany({
      where: {
        OR: [
          { businessId },
          { businessId: null },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async markAllAsRead(businessId: string) {
    return this.prisma.notification.updateMany({
      where: {
        businessId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  async deleteNotification(businessId: string, id: string) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      throw new NotFoundException('Notification not found');
    }

    if (notif.businessId && notif.businessId !== businessId) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async createNotification(data: { businessId?: string; type: string; title: string; message: string }) {
    return this.prisma.notification.create({
      data,
    });
  }
}
