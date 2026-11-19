import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AffiliateTrackingService } from './affiliate-tracking.service';
import { ConfigService } from '@nestjs/config';
import { AffiliateRedemptionService } from './affiliate-redemption.service';

@ApiTags('Local Affiliate — Public')
@Controller()
export class LocalAffiliatePublicController {
  private readonly logger = new Logger(LocalAffiliatePublicController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: AffiliateTrackingService,
    private readonly redemptions: AffiliateRedemptionService,
    private readonly config: ConfigService,
  ) {}

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * The tracking redirect.
   *
   * Never fails the visitor: an unknown or retired code redirects to the offers
   * index, and any persistence error is swallowed. The destination is always
   * resolved server-side — a caller-supplied URL is never honoured, which
   * closes the open-redirect hole.
   */
  @Get('r/:code')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @ApiOperation({ summary: 'Tracking redirect (records the click, then 302s to the provider)' })
  async redirect(@Param('code') code: string, @Req() req: any, @Res() res: Response) {
    try {
      const resolved = await this.tracking.resolveAndRecord(code, req);
      if (!resolved) {
        return res.redirect(
          HttpStatus.FOUND,
          `${this.frontendUrl()}/offers?link=unavailable`,
        );
      }

      res.cookie?.('mcom_laf', code, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
        httpOnly: false,
      });

      return res.redirect(HttpStatus.FOUND, resolved.destinationUrl);
    } catch (error) {
      this.logger.error(
        `Redirect failed for ${code}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return res.redirect(
        HttpStatus.FOUND,
        `${this.frontendUrl()}/offers?link=unavailable`,
      );
    }
  }

  /**
   * Public affiliate page payload.
   * Deliberately PII-free: display name and promotable offers only.
   */
  @Get('public/affiliate/:affiliateCode')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public affiliate page (no PII)' })
  async publicPage(@Param('affiliateCode') affiliateCode: string) {
    const profile = await this.prisma.localAffiliateProfile.findUnique({
      where: { affiliateCode },
      select: {
        affiliateCode: true,
        displayName: true,
        status: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });

    if (!profile || profile.status !== 'ACTIVE') {
      return { success: true, data: null };
    }

    const now = new Date();
    const offers = await this.prisma.affiliateOffer.findMany({
      where: {
        status: 'ACTIVE',
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
      select: {
        slug: true,
        title: true,
        subtitle: true,
        imageUrl: true,
        customerBenefit: true,
        provider: { select: { name: true } },
      },
    });

    const displayName =
      profile.displayName ||
      [profile.user?.firstName, profile.user?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      'A 247GBS Local Affiliate';

    return {
      success: true,
      data: {
        affiliateCode: profile.affiliateCode,
        displayName,
        offers,
      },
    };
  }

  /** Validity check without consuming a use — for "is this still good?" UI. */
  @Post('public/affiliate/vouchers/:code/check')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Check a voucher code without redeeming it' })
  async checkVoucher(@Param('code') code: string) {
    const voucher = await this.prisma.affiliateVoucher.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: {
        code: true,
        status: true,
        expiresAt: true,
        usedCount: true,
        maxUses: true,
        benefit: true,
      },
    });
    if (!voucher) {
      return { success: true, data: { valid: false, reason: 'NOT_FOUND' } };
    }
    const expired =
      voucher.expiresAt !== null && voucher.expiresAt.getTime() < Date.now();
    const valid =
      !expired &&
      voucher.status !== 'REVOKED' &&
      voucher.usedCount < voucher.maxUses;

    return {
      success: true,
      data: {
        valid,
        reason: expired
          ? 'EXPIRED'
          : voucher.status === 'REVOKED'
            ? 'REVOKED'
            : voucher.usedCount >= voucher.maxUses
              ? 'USED'
              : null,
        benefit: valid ? voucher.benefit : null,
      },
    };
  }

  /** Used by the redemption service's own route set — kept for symmetry. */
  get redemptionService(): AffiliateRedemptionService {
    return this.redemptions;
  }
}
