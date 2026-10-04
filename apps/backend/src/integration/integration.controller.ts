import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiUnauthorizedResponse, ApiHeader } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';

@ApiTags('Integration')
@Controller('integration')
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Get('business')
  @ApiOperation({
    summary: 'Fetch a business profile by API key (server-to-server; header only)',
    description:
      'Phase 4: the API key is accepted via the x-api-key header only. ' +
      'The legacy ?apiKey query parameter was removed (no callers tree-wide) ' +
      'because URLs leak into logs, history, and error trackers.',
  })
  @ApiHeader({ name: 'x-api-key', description: 'Business API key', required: true })
  @ApiOkResponse({ description: 'Business profile with packages' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid API key' })
  async getBusinessProfile(@Headers('x-api-key') headerApiKey?: string) {
    if (!headerApiKey) {
      throw new UnauthorizedException('API Key is missing');
    }
    return this.integrationService.getBusinessByApiKey(headerApiKey);
  }
}
