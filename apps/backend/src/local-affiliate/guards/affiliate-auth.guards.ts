import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Populates `req.user` when a valid Bearer token is present and simply
 * continues when it is not. Used by the public marketplace, where an anonymous
 * visitor must still be able to browse offers.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return (user ?? null) as TUser;
  }
}

/**
 * Accepts either a business JWT (the owner/staff logged into the dashboard) or
 * a business API key in `x-api-key` (a POS or the business's own backend).
 *
 * The API-key path mirrors `IntegrationController`, which already reads the key
 * from a header only — never from the query string, because URLs leak into
 * logs and error trackers.
 */
@Injectable()
export class BusinessOrApiKeyGuard extends AuthGuard('jwt') {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers?.['x-api-key'];

    if (typeof apiKey === 'string' && apiKey.trim()) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { apiKey: apiKey.trim(), deletedAt: null },
        select: { id: true, businessName: true, userId: true },
      });
      if (!business) {
        throw new UnauthorizedException('Invalid business API key');
      }
      req.businessActor = {
        businessId: business.id,
        businessName: business.businessName,
        userId: business.userId,
        via: 'api-key',
      };
      return true;
    }

    const result = await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if (request.user?.userId) {
      const business = await this.prisma.businessProfile.findFirst({
        where: { userId: request.user.userId, deletedAt: null },
        select: { id: true, businessName: true },
      });
      request.businessActor = business
        ? {
            businessId: business.id,
            businessName: business.businessName,
            userId: request.user.userId,
            via: 'jwt',
          }
        : {
            businessId: null,
            businessName: null,
            userId: request.user.userId,
            via: 'jwt',
          };
    }
    return result as boolean;
  }
}
