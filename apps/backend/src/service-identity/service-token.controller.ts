import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SsoClientGuard } from '../auth/guards/sso-client.guard';
import { ServiceTokenService } from './service-token.service';
import { ServiceTokenDto, TokenExchangeDto } from './dto/service-token.dto';

/**
 * Ecosystem service-token issuance. Registered apps exchange their client
 * credentials (or a user's SSO token) for a short-lived RS256 service token
 * they then present directly to a peer backend.
 */
@ApiTags('Ecosystem Service Identity')
@Controller('auth/service-token')
export class ServiceTokenController {
  constructor(private readonly serviceTokenService: ServiceTokenService) {}

  @UseGuards(SsoClientGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post()
  @ApiOperation({
    summary: 'Issue a service-to-service access token (OAuth2 client_credentials)',
    description:
      'Authenticate with HTTP Basic (client_id:client_secret) or body credentials. ' +
      'Returns a short-lived RS256 JWT that peers verify offline via JWKS.',
  })
  @ApiBody({ type: ServiceTokenDto })
  @ApiCreatedResponse({ description: 'Service token issued' })
  @ApiBadRequestResponse({ description: 'Unknown audience or invalid request' })
  @ApiForbiddenResponse({ description: 'Service disabled or scope not permitted' })
  @ApiUnauthorizedResponse({ description: 'Invalid client credentials' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  issueServiceToken(@Body() dto: ServiceTokenDto, @Req() req: Request) {
    const client = (req as any).ssoClient;
    const scopes = dto.scope ? dto.scope.split(/\s+/).filter(Boolean) : [];
    return this.serviceTokenService.issueClientCredentialsToken(
      client,
      scopes,
      dto.audience,
    );
  }

  @UseGuards(SsoClientGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('exchange')
  @ApiOperation({
    summary: 'Exchange a user SSO token for a delegated service token (RFC 8693)',
    description:
      'The caller presents a user SSO access token as subject_token. MCOM issues a ' +
      'token bound to the target audience carrying an `act` (actor) claim, so the ' +
      'receiver knows which app is acting on behalf of which user.',
  })
  @ApiBody({ type: TokenExchangeDto })
  @ApiCreatedResponse({ description: 'Delegated service token issued' })
  @ApiBadRequestResponse({ description: 'Unknown audience or invalid request' })
  @ApiForbiddenResponse({ description: 'Service disabled or scope not permitted' })
  @ApiUnauthorizedResponse({ description: 'Invalid client credentials or subject_token' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  exchangeToken(@Body() dto: TokenExchangeDto, @Req() req: Request) {
    const client = (req as any).ssoClient;
    const scopes = dto.scope ? dto.scope.split(/\s+/).filter(Boolean) : [];
    return this.serviceTokenService.exchangeUserToken(
      client,
      dto.subject_token ?? '',
      dto.audience,
      scopes,
    );
  }
}
