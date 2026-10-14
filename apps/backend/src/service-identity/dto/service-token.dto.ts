import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * OAuth 2.0 `client_credentials` request for an ecosystem service token.
 * Client credentials may be supplied via HTTP Basic auth (preferred) or in the
 * body — both are accepted by SsoClientGuard.
 */
export class ServiceTokenDto {
  @ApiPropertyOptional({ example: 'client_credentials', description: 'OAuth 2.0 grant type' })
  @IsOptional()
  @IsString()
  grant_type?: string;

  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Client ID (if not sent via Basic auth)' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({ example: 'cs_secret_xxx', description: 'Client secret (if not sent via Basic auth)' })
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiPropertyOptional({
    example: 'rewards:read rewards:write',
    description: 'Space-separated scopes to request. Must be a subset of the app serviceScopes.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;

  @ApiPropertyOptional({
    example: 'mcom-rewards',
    description: 'Target app (audience) clientId or platformSlug. Defaults to mcom-ecosystem.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  audience?: string;
}

/**
 * RFC 8693 token exchange: turn a user's SSO access token into a delegated
 * service token bound to a target audience, carrying an `act` (actor) claim.
 */
export class TokenExchangeDto {
  @ApiPropertyOptional({ example: 'urn:ietf:params:oauth:grant-type:token-exchange' })
  @IsOptional()
  @IsString()
  grant_type?: string;

  @ApiPropertyOptional({ example: 'mcom-mall', description: 'Caller client ID (if not sent via Basic auth)' })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiPropertyOptional({ example: 'cs_secret_xxx', description: 'Caller client secret (if not sent via Basic auth)' })
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiPropertyOptional({
    example: 'eyJhbGciOi...',
    description: 'The subject token — a user SSO access token issued by MCOM.',
  })
  @IsOptional()
  @IsString()
  subject_token?: string;

  @ApiPropertyOptional({
    example: 'urn:ietf:params:oauth:token-type:access_token',
    description: 'Type of the subject token (defaults to access_token).',
  })
  @IsOptional()
  @IsString()
  subject_token_type?: string;

  @ApiPropertyOptional({
    example: 'mcom-rewards',
    description: 'Target app (audience) clientId or platformSlug.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  audience?: string;

  @ApiPropertyOptional({
    example: 'rewards:read',
    description: 'Space-separated scopes to request. Must be a subset of the app serviceScopes.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  scope?: string;
}
