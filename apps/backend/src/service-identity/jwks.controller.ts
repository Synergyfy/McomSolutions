import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ServiceKeyService } from './keys/service-key.service';

/**
 * Public JWKS endpoint. Partner app backends fetch this (and cache it) to
 * verify service tokens OFFLINE. Contains public key material only.
 *
 * Served at the root (no /api/v1 prefix) via main.ts setGlobalPrefix exclude.
 */
@ApiExcludeController()
@Controller('.well-known')
export class JwksController {
  constructor(private readonly keys: ServiceKeyService) {}

  @Get('jwks.json')
  getJwks() {
    return this.keys.getJwks();
  }
}
