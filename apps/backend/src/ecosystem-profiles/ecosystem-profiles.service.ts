import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SsoService } from '../auth/sso.service';
import { appSupportsRole } from '../common/profile-sync/profile-sync.constants';

/**
 * Secure server-to-server profile lookup.
 *
 * After receiving a `profile.updated` event (which carries only `userId`), an
 * app backend calls this service through the B2B service mesh to pull the
 * canonical profile. Access is scoped twice:
 *   1. The caller must present a valid RS256 service token and `central:read`.
 *   2. The caller may only read users whose role that app supports in Console.
 */
@Injectable()
export class EcosystemProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sso: SsoService,
  ) {}

  async getProfileForCaller(callerAppId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const caller = await this.prisma.ssoClient.findUnique({
      where: { clientId: callerAppId },
      select: { supportedRoles: true, isActive: true },
    });
    if (!caller || !caller.isActive) {
      throw new ForbiddenException('Calling application is not active');
    }

    if (
      !appSupportsRole(
        (caller.supportedRoles ?? []) as Role[],
        user.role as Role,
      )
    ) {
      throw new ForbiddenException(
        `This application does not serve the ${user.role} role`,
      );
    }

    // Reuses the canonical SSO identity payload (every role profile + the
    // calling app's entitlement view) so downstream copies stay identical to
    // what the app would have received at login.
    return this.sso.getIntrospectedEntitlement(callerAppId, userId);
  }
}
