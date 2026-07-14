import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.seedDefaultSsoClients();
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
          rawSecret: 'loyalty_secret_123',
          redirectUris: [
            'https://mcomloyalty.vercel.app/auth/callback',
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
              apiKey: client.apiKey
            }
          });
          console.log(`[Seed] Created default SSO client: ${client.clientId}`);
        } else {
          // Sync redirect URIs in dev environments
          await this.ssoClient.update({
            where: { clientId: client.clientId },
            data: { redirectUris: client.redirectUris }
          });
        }
      }
    } catch (err) {
      console.error('[Seed] Error seeding default SSO clients:', err);
    }
  }
}
