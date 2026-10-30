import { SetMetadata } from '@nestjs/common';
import { PartnerFeature } from './service-mesh.constants';

export const REQUIRE_PARTNER_FEATURES_KEY = 'partner.requiredFeatures';

/**
 * Gates a partner route behind one or more feature flags. Disabled routes
 * return 503 `FEATURE_DISABLED` (never 404) so Rewards can distinguish a
 * rollout state from a missing endpoint.
 */
export const RequirePartnerFeature = (...features: PartnerFeature[]) =>
  SetMetadata(REQUIRE_PARTNER_FEATURES_KEY, features);
