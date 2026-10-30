import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SERVICE_SCOPES_KEY = 'service.requiredScopes';

/**
 * Declares the service scopes a partner route requires. The
 * `ServiceScopesGuard` rejects requests missing any of them with 403.
 */
export const RequireServiceScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRE_SERVICE_SCOPES_KEY, scopes);
