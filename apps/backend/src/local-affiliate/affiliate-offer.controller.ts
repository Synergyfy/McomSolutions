import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/affiliate-auth.guards';
import { AffiliateCatalogueService } from './affiliate-catalogue.service';
import { CreateOfferLinkDto, OfferQueryDto } from './dto/affiliate-offer.dto';

@ApiTags('Affiliate Offers')
@Controller()
export class AffiliateOfferController {
  constructor(private readonly catalogue: AffiliateCatalogueService) {}

  @Get('affiliate-offers')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Browse the affiliate marketplace',
    description:
      'Only currently active offers are returned. When the caller is an active affiliate, offers are further filtered by eligibility (location, status) and each row reports whether it can be promoted.',
  })
  list(@Query() query: OfferQueryDto, @Req() req: any) {
    return this.catalogue.listOffers(query, req.user?.userId);
  }

  @Get('affiliate-offers/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Offer detail, including why it cannot be promoted' })
  detail(@Param('slug') slug: string, @Req() req: any) {
    return this.catalogue.getOffer(slug, req.user?.userId);
  }

  @Post('affiliate-offers/:offerId/link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create or return my tracking link for an offer',
    description:
      'Idempotent per (affiliate, offer, campaign). The returned tracking code is the only opaque value that crosses an external boundary.',
  })
  createLink(
    @Req() req: any,
    @Param('offerId') offerId: string,
    @Body() dto: CreateOfferLinkDto,
  ) {
    return this.catalogue.createLink(req.user.userId, offerId, dto);
  }

  @Get('affiliate-campaigns')
  @ApiOperation({ summary: 'Active and scheduled affiliate campaigns' })
  campaigns() {
    return this.catalogue.listCampaigns();
  }

  @Get('affiliate-campaigns/:code')
  @ApiOperation({ summary: 'Campaign detail with its offers' })
  campaign(@Param('code') code: string) {
    return this.catalogue.getCampaign(code);
  }
}
