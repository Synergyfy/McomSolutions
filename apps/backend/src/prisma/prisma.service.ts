import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    // Skip seeding in test environments — it runs bcrypt + DB queries on every
    // module bootstrap which saturates CPU when Jest spins up multiple workers.
    if (process.env.NODE_ENV !== 'test') {
      await this.seedDefaultSsoClients();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async seedDefaultSsoClients() {
    try {
      // NOTE — HMAC secret resolution for these seeded clients:
      // They have no per-client `hmacSecret` (that requires the Admin Console to
      // generate + AES-256-GCM encrypt one). The WalletHmacGuard / HmacAuthGuard
      // therefore fall back to: (1) per-client env var MCOM_{CLIENT}_SECRET,
      // then (2) the global SSO_API_SECRET. Issue per-client HMAC secrets via the
      // Mcom Console (`POST /api/v1/admin/console/apps/:clientId/rotate-hmac`)
      // before enabling wallet operations on each platform in production.
      const clients = [
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
          rawSecret: 'mall_secret_123',
          redirectUris: [
            'https://mcommall.vercel.app/auth/callback',
            'http://localhost:3000/auth/callback',
            'http://localhost:3001/auth/callback',
            'http://localhost:3002/auth/callback',
            'http://localhost:3003/auth/callback',
            'http://localhost:3003/auth/sso',
            'http://localhost:5173/auth/callback'
          ],
          scopes: ['profile', 'email', 'business', 'membership'],
          apiKey: 'mcom_mall_api_key_secure_987'
        },
        {
          clientId: 'mcom-loyalty',
          name: 'MCOM Loyalty',
          platformSlug: 'rewards',
          rawSecret: 'loyalty_secret_123',
          redirectUris: [
            'https://mcomloyalty.vercel.app/auth/callback',
            'https://mcomloyalty.vercel.app/sso-login',
            'https://mcomreward.vercel.app/auth/callback',
            'https://mcomreward.vercel.app/sso-login',
            'http://localhost:3005/auth/callback',
            'http://localhost:3005/sso-login',
            'http://localhost:3006/sso-login',
            'http://localhost:5173/sso-login'
          ],
          scopes: ['profile', 'email', 'business', 'membership'],
          apiKey: 'mcom_loyalty_api_key_secure_987'
        },
        {
          clientId: '247gbs',
          name: '247GBS',
          platformSlug: 'audit',
          rawSecret: 'gbs_secret_123',
          redirectUris: [
            'https://247gbs.vercel.app/auth/callback',
            'http://localhost:3010/auth/callback'
          ],
          scopes: ['profile', 'email', 'business', 'membership'],
          apiKey: 'gbs_api_key_secure_987'
        }
      ];

      for (const client of clients) {
        const existing = await this.ssoClient.findUnique({
          where: { clientId: client.clientId }
        });

        if (!existing) {
          const salt = await bcrypt.genSalt();
          const clientSecret = await bcrypt.hash(client.rawSecret, salt);

          await this.ssoClient.create({
            data: {
              clientId: client.clientId,
              clientSecret,
              name: client.name,
              redirectUris: client.redirectUris,
              scopes: client.scopes,
              apiKey: client.apiKey,
              platformSlug: client.platformSlug ?? null,
            }
          });
          console.log(`[Seed] Created default SSO client: ${client.clientId}`);
        } else {
          // Preserve custom URIs added directly to DB, only append missing defaults if any
          const mergedUris = Array.from(new Set([...existing.redirectUris, ...client.redirectUris]));
          const updates: Record<string, any> = {};
          if (mergedUris.length !== existing.redirectUris.length) {
            updates.redirectUris = mergedUris;
          }
          if (client.platformSlug && existing.platformSlug !== client.platformSlug) {
            updates.platformSlug = client.platformSlug;
          }
          if (Object.keys(updates).length > 0) {
            await this.ssoClient.update({
              where: { clientId: client.clientId },
              data: updates,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Seed] Error seeding default SSO clients:', err);
    }
  }
}
