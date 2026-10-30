import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRE_SERVICE_SCOPES_KEY } from './require-service-scopes.decorator';

/**
 * Enforces the scopes declared with `@RequireServiceScopes(...)`. Runs after
 * `ServiceAuthGuard`, which populates `req.serviceCaller`.
 */
@Injectable()
export class ServiceScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndMerge<string[]>(REQUIRE_SERVICE_SCOPES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const scopes = req.serviceCaller?.scopes ?? [];
    const missing = required.filter((scope) => !scopes.includes(scope));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Missing required service scope(s): ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
