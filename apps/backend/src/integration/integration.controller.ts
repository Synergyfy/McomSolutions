import { Controller, Get, Headers, Query } from '@nestjs/common';
import { IntegrationService } from './integration.service';

@Controller('integration')
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Get('business')
  async getBusinessProfile(
    @Headers('x-api-key') headerApiKey?: string,
    @Query('apiKey') queryApiKey?: string,
  ) {
    const key = headerApiKey || queryApiKey;
    return this.integrationService.getBusinessByApiKey(key);
  }
}
