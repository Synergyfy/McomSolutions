import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../console/crypto.util';
import axios from 'axios';
import * as crypto from 'crypto';

export interface PackageWebhookData {
  packageId: string;
  mcomUserId: string;
  externalPlanId?: string | null;
  packageName: string;
  planType: string;
  status: string;
  billingCycle?: string | null;
  amount?: number | null;
  currency: string;
  expiresAt?: string | null;
  limits?: any;
}

export interface WebhookDispatchResult {
  dispatched: boolean;
  reason?: string;
  statusCode?: number | null;
  logId?: string;
  error?: string;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Asynchronously dispatches a webhook in the background without blocking the caller.
   */
  dispatchAsync(platformIdentifier: string, event: string, data: any): void {
    setImmediate(() => {
      this.dispatch(platformIdentifier, event, data).catch((err) => {
        this.logger.error(
          `Unhandled error dispatching ${event} to ${platformIdentifier}: ${err.message}`,
          err.stack,
        );
      });
    });
  }

  /**
   * Helper to format and dispatch package lifecycle events (package.created / renewed / expired / cancelled).
   */
  async dispatchPackageEvent(
    event: 'package.created' | 'package.renewed' | 'package.cancelled' | 'package.expired',
    opts: {
      platform: string;
      userId: string;
      package: {
        id: string;
        externalPlanId?: string | null;
        packageName: string;
        planType?: string | null;
        status: string;
        billingCycle?: string | null;
        amount?: number | null;
        currency?: string | null;
        expiresAt?: Date | string | null;
        limits?: any;
      };
    },
  ): Promise<void> {
    const data: PackageWebhookData = {
      packageId: opts.package.id,
      mcomUserId: opts.userId,
      externalPlanId: opts.package.externalPlanId ?? null,
      packageName: opts.package.packageName,
      planType: opts.package.planType || 'STANDARD',
      status: opts.package.status,
      billingCycle: opts.package.billingCycle ?? null,
      amount: opts.package.amount ?? null,
      currency: opts.package.currency || 'GBP',
      expiresAt: opts.package.expiresAt instanceof Date
        ? opts.package.expiresAt.toISOString()
        : opts.package.expiresAt ?? null,
      limits: opts.package.limits || {},
    };

    this.dispatchAsync(opts.platform, event, data);
  }

  /**
   * Synchronously dispatches a webhook with retries, signature generation, and audit logging.
   */
  async dispatch(
    platformIdentifier: string,
    event: string,
    data: any,
  ): Promise<WebhookDispatchResult> {
    const client = await this.prisma.ssoClient.findFirst({
      where: {
        OR: [
          { platformSlug: platformIdentifier },
          { clientId: platformIdentifier },
        ],
        isActive: true,
      },
    });

    if (!client) {
      this.logger.warn(`Cannot dispatch ${event}: No active SSO client found for "${platformIdentifier}"`);
      return { dispatched: false, reason: 'APP_NOT_FOUND' };
    }

    if (!client.webhookUrl) {
      this.logger.log(`No webhookUrl configured for app "${client.clientId}" — skipping ${event}`);
      return { dispatched: false, reason: 'NO_WEBHOOK_URL_CONFIGURED' };
    }

    const payload = {
      event,
      platform: client.platformSlug || client.clientId,
      timestamp: new Date().toISOString(),
      data,
    };

    const rawBody = JSON.stringify(payload);
    const secret = this.resolveWebhookSecret(client);
    const signature = this.signPayload(rawBody, secret);

    const maxAttempts = 3;
    let responseStatus: number | null = null;
    let responseBodyText: string | null = null;
    let delivered = false;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await axios.post(client.webhookUrl, rawBody, {
          headers: {
            'Content-Type': 'application/json',
            'X-Mcom-Webhook-Signature': signature,
            'User-Agent': 'McomSolutions-WebhookDispatcher/1.0',
          },
          timeout: 10000,
          validateStatus: () => true, // Don't throw on HTTP status codes
        });

        responseStatus = response.status;
        responseBodyText = typeof response.data === 'string'
          ? response.data.slice(0, 1000)
          : JSON.stringify(response.data).slice(0, 1000);

        if (response.status >= 200 && response.status < 300) {
          delivered = true;
          break;
        } else {
          lastError = new Error(`HTTP ${response.status}: ${responseBodyText}`);
        }
      } catch (err: any) {
        lastError = err;
        responseStatus = err.response?.status || null;
        responseBodyText = err.message || 'Network error';
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }

    let logId: string | undefined;
    try {
      const log = await this.prisma.appWebhookLog.create({
        data: {
          clientId: client.clientId,
          event,
          payload: payload as any,
          statusCode: responseStatus,
          responseBody: responseBodyText,
          deliveredAt: delivered ? new Date() : null,
          failed: !delivered,
        },
      });
      logId = log.id;

      await this.prisma.ssoClient.update({
        where: { id: client.id },
        data: {
          lastWebhookAt: new Date(),
          webhookFailCount: delivered ? 0 : { increment: 1 },
        },
      });
    } catch (dbErr: any) {
      this.logger.error(`Failed to record webhook log: ${dbErr.message}`);
    }

    if (delivered) {
      this.logger.log(`Successfully delivered ${event} webhook to "${client.clientId}" (${client.webhookUrl})`);
      return { dispatched: true, statusCode: responseStatus, logId };
    } else {
      this.logger.warn(
        `Failed to deliver ${event} webhook to "${client.clientId}" after ${maxAttempts} attempts: ${lastError?.message}`,
      );
      return {
        dispatched: false,
        statusCode: responseStatus,
        logId,
        error: lastError?.message || 'Delivery failed',
      };
    }
  }

  private resolveWebhookSecret(client: any): string {
    if (client.webhookSecret) {
      try {
        return decrypt(client.webhookSecret, this.encryptionKey());
      } catch (err: any) {
        if (typeof client.webhookSecret === 'string' && client.webhookSecret.startsWith('wh_')) {
          return client.webhookSecret;
        }
        this.logger.warn(`Failed to decrypt webhook secret for ${client.clientId}: ${err.message}`);
      }
    }

    if (client.hmacSecret) {
      try {
        return decrypt(client.hmacSecret, this.encryptionKey());
      } catch {
        if (typeof client.hmacSecret === 'string' && client.hmacSecret.startsWith('hm_')) {
          return client.hmacSecret;
        }
      }
    }

    return this.config.get<string>('SSO_API_SECRET') || '';
  }

  private signPayload(rawPayload: string, secret: string): string {
    return (
      'sha256=' +
      crypto.createHmac('sha256', secret).update(rawPayload).digest('hex')
    );
  }

  private encryptionKey(): string {
    const key = this.config.get<string>('CONSOLE_ENCRYPTION_KEY');
    if (!key) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new Error('CONSOLE_ENCRYPTION_KEY must be set in production');
      }
      return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    }
    return key;
  }
}
