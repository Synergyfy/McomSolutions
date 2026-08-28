import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Guards every Mcom Console endpoint. Requires a valid JWT (JwtAuthGuard runs
 * first) AND the ADMIN role.
 */
@Injectable()
export class ConsoleAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.user) {
      throw new UnauthorizedException();
    }
    if (req.user.role !== 'ADMIN') {
      throw new ForbiddenException('ADMIN role required');
    }
    return true;
  }
}