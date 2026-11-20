import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookDispatcherService } from '../webhook-dispatcher/webhook-dispatcher.service';
import {
  PROFILE_SYNC_ROLES,
  PROFILE_UPDATED_EVENT,
  appSupportsRole,
  isProfileSyncRole,
} from '../common/profile-sync/profile-sync.constants';

export interface ProfileUpdatedInput {
  /** Central Hub user id — the only identity the receiving app needs. */
  userId: string;
  /** Central role that owns the profile. Drives which apps receive the event. */
  role: Role;
  /** Optional role-specific profile id, kept for audit/correlation only. */
  profileId?: string | null;
  /** Optional field names the caller knows changed. */
  changedFields?: string[];
}

/**
 * Event-driven profile synchronization.
 *
 * Every profile mutation in Central publishes one `profile.updated` event to
 * each app that (a) supports the user's role and (b) configured a single
 * `profileSyncEndpoint`. A BUSINESS profile change therefore never reaches an
 * AGENT-only app such as 247GBS Affiliate.
 *
 * The payload deliberately carries only the central `userId` (plus event
 * metadata). The receiving app then pulls the canonical profile from Central
 * over the secure backend-to-backend service mesh using its RS256 service
 * token — no profile snapshot is pushed over the wire.
 *
 * Delivery reuses the durable webhook pipeline (HMAC signature, BullMQ
 * retries, `AppWebhookLog` audit rows) and is always fire-and-forget so a
 * slow or down consumer can never block the user's profile save.
 */
@Injectable()
export class ProfileSyncService {
  private readonly logger = new Logger(ProfileSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: WebhookDispatcherService,
  ) {}

  /**
   * Publishes a `profile.updated` event. Never throws — profile writes must
   * not fail because a downstream app is unavailable.
   */
  async emitProfileUpdated(input: ProfileUpdatedInput): Promise<void> {
    try {
      if (!input?.userId || !isProfileSyncRole(input.role)) {
        return;
      }

      const clients = await this.prisma.ssoClient.findMany({
        where: {
          isActive: true,
          profileSyncEndpoint: { not: null },
          OR: [
            { supportedRoles: { has: input.role } },
            // Empty = every profile-sync role (legacy/default apps).
            { supportedRoles: { isEmpty: true } },
          ],
        },
        select: {
          clientId: true,
          name: true,
          supportedRoles: true,
          profileSyncEndpoint: true,
        },
      });

      if (clients.length === 0) return;

      const occurredAt = new Date();
      const eventId = `${crypto.randomUUID()}`;

      const data: Record<string, unknown> = {
        eventId,
        occurredAt: occurredAt.toISOString(),
        userId: input.userId,
      };

      let dispatched = 0;
      for (const client of clients) {
        // Defence in depth: never rely on the query alone for role scoping.
        if (!appSupportsRole(client.supportedRoles as Role[], input.role)) {
          continue;
        }
        const endpoint = client.profileSyncEndpoint?.trim();
        if (!endpoint) continue;

        this.dispatcher.dispatchAsync(client.clientId, PROFILE_UPDATED_EVENT, data, {
          targetUrl: endpoint,
        });
        dispatched += 1;
      }

      if (dispatched > 0) {
        this.logger.log(
          `Queued ${PROFILE_UPDATED_EVENT} for ${input.role} user ${input.userId} to ${dispatched} app(s)`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to publish ${PROFILE_UPDATED_EVENT} for user ${input?.userId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /** Roles that can be configured for profile synchronization. */
  getSyncableRoles(): Role[] {
    return [...PROFILE_SYNC_ROLES];
  }
}
