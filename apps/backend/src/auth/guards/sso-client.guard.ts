import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class SsoClientGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // Check basic auth header first
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('basic ')) {
      const base64Credentials = authHeader.substring(6).trim();
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const parts = credentials.split(':');
      clientId = parts[0];
      clientSecret = parts[1];
    } else {
      // Fallback to request body or query params
      clientId = request.body?.client_id || request.query?.client_id;
      clientSecret = request.body?.client_secret || request.query?.client_secret;
    }

    if (!clientId || !clientSecret) {
      throw new UnauthorizedException('Client credentials (client_id, client_secret) are required');
    }

    const client = await this.prisma.ssoClient.findUnique({
      where: { clientId },
    });

    if (!client || !client.isActive) {
      throw new UnauthorizedException('Invalid or inactive client');
    }

    const isMatch = await bcrypt.compare(clientSecret, client.clientSecret);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid client credentials');
    }

    // Attach client to request for downstream controller usage
    request.ssoClient = client;
    return true;
  }
}
