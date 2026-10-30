import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PARTNER_FEATURES_KEY } from './require-partner-feature.decorator';
import {
  FEATURE_DISABLED_CODE,
  PartnerFeature,
} from './service-mesh.constants';

/**
 * Feature-flag gate for partner routes. Disabled features answer
 * `503 FEATURE_DISABLED` instead of 404 so callers can tell rollout state
 * from a missing endpoint.
 */
@Injectable()
export class PartnerFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required =
      this.reflector.getAllAndMerge<PartnerFeature[]>(REQUIRE_PARTNER_FEATURES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    for (const feature of required) {
      if (!this.isEnabled(feature)) {
        throw new HttpException(
          {
            code: FEATURE_DISABLED_CODE,
            message: `Partner feature "${feature}" is disabled`,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
    }
    return true;
  }

  private isEnabled(feature: PartnerFeature): boolean {
    const raw = (this.config.get<string>(feature) ?? '').trim().toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes';
  }
}
