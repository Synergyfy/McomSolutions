import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

import { encrypt } from '../console/crypto.util';

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
      const clients = [
        {
          clientId: 'mcom-mall',
          name: 'MCOM Mall',
          platformSlug: 'mall',
          rawSecret: 'cs_6a5084585409e53bf5481f216acdd7df7a08f82a36ac6a8e0e7a55600f9fa125',
          redirectUris: [
            'http://localhost:3003/auth/callback',
            'https://mcommall.vercel.app/auth/callback',
            'http://localhost:3000/auth/callback',
            'http://localhost:3001/auth/callback',
            'http://localhost:3002/auth/callback',
            'http://localhost:5173/auth/callback',
          ],
          scopes: ['profile', 'email', 'business', 'membership', 'packages'],
          apiKey: 'ak_d6df04f486c22a30ce092334ef76dc547f41e379575232a5',
          appUrl: 'http://localhost:3003',
          billingApiUrl: 'http://localhost:3006',
          corsOrigins: ['http://localhost:3003', 'http://localhost:3006', 'https://mcommall.vercel.app'],
          rawHmacSecret: 'hm_4b5dc7f9fe2ba9a745e35bb38714e1a4a73643a9bf9ea0b1818ae10d90e001f4',
          rawWebhookSecret: 'wh_5a3cc78bd72ddcc40c86d1ee287008dc103963af20fa3c2c',
        },
        {
          clientId: '247gbs',
          name: '247GBS',
          platformSlug: 'audit',
          rawSecret: 'gbs_secret_123',
          redirectUris: [
            'https://247gbs.vercel.app/auth/callback',
            'http://localhost:3010/auth/callback',
          ],
          scopes: ['profile', 'email', 'business', 'membership'],
          apiKey: 'gbs_api_key_secure_987',
          appUrl: 'https://247gbs.vercel.app',
          billingApiUrl: null,
          corsOrigins: ['https://247gbs.vercel.app'],
          rawHmacSecret: null,
          rawWebhookSecret: null,
        },
        {
          clientId: '247gbs-affiliate',
          name: '247GBS Affiliates',
          platformSlug: '247gbs_affiliate',
          rawSecret: 'cs_fb6d2deca93911021a02cd5b40594885738ba7f6b8d38c97ab95421ca8749080',
          redirectUris: [
            'http://localhost:7088/api/v1/auth/sso/callback',
            'http://localhost:7089/auth/callback',
            'https://247gbsaffiliates.com/auth/callback',
          ],
          scopes: ['profile', 'email', 'business', 'membership'],
          apiKey: 'ak_7984163b6d2d4e581aeb25a82c7173acbcba8b142797b613',
          appUrl: 'http://localhost:7089',
          billingApiUrl: null,
          corsOrigins: ['http://localhost:7088'],
          rawHmacSecret: null,
          rawWebhookSecret: null,
        },
      ];

      const encryptionKey = process.env.CONSOLE_ENCRYPTION_KEY;

      for (const client of clients) {
        const existing = await this.ssoClient.findUnique({
          where: { clientId: client.clientId },
        });

        const hmacSecret = client.rawHmacSecret && encryptionKey ? encrypt(client.rawHmacSecret, encryptionKey) : null;
        const webhookSecret = client.rawWebhookSecret && encryptionKey ? encrypt(client.rawWebhookSecret, encryptionKey) : null;

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
              appUrl: client.appUrl ?? null,
              billingApiUrl: client.billingApiUrl ?? null,
              corsOrigins: client.corsOrigins ?? [],
              hmacSecret: hmacSecret ?? null,
              webhookSecret: webhookSecret ?? null,
              isActive: true,
            },
          });
          console.log(`[Seed] Created default SSO client: ${client.clientId}`);
        } else {
          // Preserve custom URIs and fields added directly to DB, only append missing defaults if any
          const mergedUris = Array.from(new Set([...existing.redirectUris, ...client.redirectUris]));
          const mergedCors = Array.from(new Set([...(existing.corsOrigins || []), ...(client.corsOrigins || [])]));
          const updates: Record<string, any> = {};
          if (mergedUris.length !== existing.redirectUris.length) {
            updates.redirectUris = mergedUris;
          }
          if (mergedCors.length !== (existing.corsOrigins || []).length) {
            updates.corsOrigins = mergedCors;
          }
          if (client.platformSlug && existing.platformSlug !== client.platformSlug) {
            updates.platformSlug = client.platformSlug;
          }
          if (client.billingApiUrl && !existing.billingApiUrl) {
            updates.billingApiUrl = client.billingApiUrl;
          }
          if (client.appUrl && !existing.appUrl) {
            updates.appUrl = client.appUrl;
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
