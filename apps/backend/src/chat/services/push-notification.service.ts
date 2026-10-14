import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { PushSubscriptionDto } from '../dto/chat.dto';
import * as webpush from 'web-push';

@Injectable()
export class PushNotificationService implements OnModuleInit {
  private readonly logger = new Logger(PushNotificationService.name);
  private vapidPublicKey: string = '';
  private isConfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    let publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT') || 'mailto:support@centralhubsolution.com';

    if (!publicKey || !privateKey) {
      this.logger.warn('VAPID keys not configured in environment. Generating development ephemeral VAPID keys.');
      try {
        const generated = webpush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
      } catch (err: any) {
        this.logger.error(`Failed to generate fallback VAPID keys: ${err.message}`);
        return;
      }
    }

    try {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidPublicKey = publicKey;
      this.isConfigured = true;
      this.logger.log('Web Push VAPID details initialized successfully');
    } catch (err: any) {
      this.logger.warn(`Could not set VAPID details: ${err.message}`);
    }
  }

  getPublicKey(): string {
    return this.vapidPublicKey;
  }

  async saveSubscription(userId: string, dto: PushSubscriptionDto) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: dto.userAgent,
      },
    });
  }

  async removeSubscription(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    });
  }

  async sendPushToUser(
    userId: string,
    payload: { title: string; body: string; icon?: string; data?: Record<string, any> },
  ): Promise<{ sent: number; failed: number }> {
    if (!this.isConfigured) {
      return { sent: 0, failed: 0 };
    }

    // Check user preference
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (pref && !pref.pushEnabled) {
      return { sent: 0, failed: 0 };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const stringified = JSON.stringify(payload);

    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushConfig, stringified);
        sent++;
      } catch (err: any) {
        failed++;
        this.logger.warn(`Push delivery failed for user ${userId}: ${err.statusCode || err.message}`);
        // If expired or revoked by browser, prune from database
        if (err.statusCode === 404 || err.statusCode === 410) {
          this.logger.log(`Removing expired push subscription ${sub.endpoint}`);
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    }

    return { sent, failed };
  }
}
