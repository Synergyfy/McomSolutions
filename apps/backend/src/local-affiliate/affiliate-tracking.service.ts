import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateCatalogueService } from './affiliate-catalogue.service';
import { hashIp } from './local-affiliate.util';

export interface ResolvedClick {
  trackingLinkId: string;
  localAffiliateId: string;
  offerId: string;
  destinationUrl: string;
}

/**
 * The public tracking layer.
 *
 * Hard rules (from the PRD):
 *   • The redirect must never fail the visitor — every persistence error is
 *     swallowed and the redirect still completes.
 *   • The destination is always resolved server-side from the offer. A caller
 *     supplied destination is never honoured (open-redirect protection).
 *   • IPs are stored hashed, never raw.
 */
@Injectable()
export class AffiliateTrackingService {
  private readonly logger = new Logger(AffiliateTrackingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogue: AffiliateCatalogueService,
  ) {}

  /**
   * Resolves a tracking code and records the click.
   * Returns `null` when the code is unknown or the offer is no longer active —
   * the controller turns that into a redirect to the offers index, never a 404.
   */
  async resolveAndRecord(
    code: string,
    req?: Partial<Request>,
  ): Promise<ResolvedClick | null> {
    let link;
    try {
      link = await this.prisma.affiliateTrackingLink.findUnique({
        where: { code },
        include: {
          offer: { include: { provider: true } },
        },
      });
    } catch (error) {
      this.logger.error(
        `Tracking lookup failed for ${code}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    if (!link || !link.isActive || !link.offer) return null;
    if (link.offer.status !== 'ACTIVE') return null;

    const destination =
      link.providerLinkUrl ??
      this.catalogue.buildProviderUrl(link.code, {
        destinationUrl: link.offer.destinationUrl,
        provider: {
          code: link.offer.provider.code,
          type: link.offer.provider.type,
        },
      });

    // Click persistence is best-effort. A failure must not block the visitor.
    try {
      const now = new Date();
      await this.prisma.affiliateClick.create({
        data: {
          trackingLinkId: link.id,
          occurredAt: now,
          ipHash: hashIp(req?.ip),
          userAgent: (req?.headers?.['user-agent'] as string | undefined)?.slice(
            0,
            500,
          ),
          referrer: (req?.headers?.referer as string | undefined)?.slice(0, 1000),
          source: 'INTERNAL_REDIRECT',
        },
      });

      await this.prisma.affiliateTrackingLink.update({
        where: { id: link.id },
        data: { clickCount: { increment: 1 }, lastClickAt: now },
      });

      await this.prisma.localAffiliateProfile
        .updateMany({
          where: { id: link.localAffiliateId, firstClickAt: null },
          data: { firstClickAt: now },
        })
        .catch(() => undefined);
    } catch (error) {
      this.logger.warn(
        `Click could not be recorded for ${code}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return {
      trackingLinkId: link.id,
      localAffiliateId: link.localAffiliateId,
      offerId: link.offerId,
      destinationUrl: destination,
    };
  }

  /** Last recorded click for a link, used by the attribution window check. */
  async lastClickAt(trackingLinkId: string): Promise<Date | null> {
    const click = await this.prisma.affiliateClick.findFirst({
      where: { trackingLinkId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    });
    return click?.occurredAt ?? null;
  }

  async markConverted(trackingLinkId: string, at: Date): Promise<void> {
    await this.prisma.affiliateClick
      .updateMany({
        where: { trackingLinkId, convertedAt: null },
        data: { convertedAt: at },
      })
      .catch(() => undefined);
  }

  async findByCode(code: string) {
    const link = await this.prisma.affiliateTrackingLink.findUnique({
      where: { code },
      include: { offer: true },
    });
    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }
    return link;
  }

  /** Used by the partner pre-checkout validation endpoint. */
  async validateCode(code: string) {
    const link = await this.prisma.affiliateTrackingLink.findUnique({
      where: { code },
      include: {
        offer: { select: { id: true, status: true, endsAt: true } },
        localAffiliate: { select: { id: true, status: true } },
      },
    });

    const valid =
      !!link &&
      link.isActive &&
      link.localAffiliate?.status === 'ACTIVE' &&
      link.offer?.status === 'ACTIVE' &&
      (!link.offer?.endsAt || link.offer.endsAt >= new Date());

    return {
      success: true,
      data: {
        valid,
        // Deliberately no PII: the caller only needs the ids to attach the
        // reference to its own order.
        affiliateId: valid ? link!.localAffiliateId : null,
        offerId: valid ? link!.offerId : null,
        campaignId: valid ? link!.campaignId : null,
      },
    };
  }

  /** Aggregated click stats used by admin reports. */
  async clickStats(localAffiliateId: string) {
    const [total, converted] = await Promise.all([
      this.prisma.affiliateClick.count({
        where: { trackingLink: { localAffiliateId } },
      }),
      this.prisma.affiliateClick.count({
        where: {
          trackingLink: { localAffiliateId },
          convertedAt: { not: null },
        },
      }),
    ]);
    return { total, converted };
  }
}
