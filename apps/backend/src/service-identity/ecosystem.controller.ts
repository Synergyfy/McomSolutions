import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { EcosystemService } from './ecosystem.service';
import { ServiceKeyService } from './keys/service-key.service';

/**
 * Public ecosystem service registry + discovery. Partner backends cache this
 * to resolve peers and the JWKS URI. Not on the request path.
 */
@ApiTags('Ecosystem Service Identity')
@Controller('ecosystem')
export class EcosystemController {
  constructor(
    private readonly ecosystemService: EcosystemService,
    private readonly keys: ServiceKeyService,
  ) {}

  @Get('services')
  @ApiOperation({ summary: 'List active registered ecosystem services (cached)' })
  @ApiOkResponse({ description: 'List of registered services with base URLs and scopes' })
  listServices() {
    return this.ecosystemService.listServices();
  }

  @Get('services/:clientId')
  @ApiOperation({ summary: 'Get a single registered ecosystem service by clientId or platformSlug' })
  @ApiParam({ name: 'clientId', example: 'mcom-rewards' })
  @ApiOkResponse({ description: 'Service registry entry' })
  @ApiNotFoundResponse({ description: 'Service not found' })
  getService(@Param('clientId') clientId: string) {
    return this.ecosystemService.getService(clientId);
  }

  @Get('jwks')
  @ApiOperation({ summary: 'Public JWKS (alias of /.well-known/jwks.json)' })
  @ApiOkResponse({ description: 'Public JSON Web Key Set' })
  getJwks() {
    return this.keys.getJwks();
  }

  @Get('discovery')
  @ApiOperation({ summary: 'Service identity discovery document' })
  @ApiOkResponse({ description: 'Issuer, JWKS URI, and endpoint locations' })
  discovery() {
    return this.ecosystemService.discovery();
  }
}
