import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] || request.query?.apiKey;

    if (!apiKey) {
      throw new UnauthorizedException('API Key (X-Api-Key header) is required');
    }

    const client = await this.prisma.ssoClient.findFirst({
      where: { apiKey, isActive: true },
    });

    if (!client) {
      throw new UnauthorizedException('Invalid or inactive API Key');
    }

    request.serviceClient = client;
    return true;
  }
}
