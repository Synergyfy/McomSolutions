import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

const AFFILIATE_CLIENT_IDS = ['247gbs-affiliate', '247gbs'];

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Shared-secret guard for the 247GBS Affiliates backend-to-backend callback
 * (submission / review acknowledgement). Accepts the configured internal API
 * key, the console app registry api key, or the legacy `INTERNAL_API_KEY`.
 */
@Injectable()
export class AffiliateApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(AffiliateApiKeyGuard.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const provided =
      request.headers['x-api-key'] ||
      request.headers['x-mcom-solution-api-key'] ||
      '';
    if (!provided) throw new UnauthorizedException('Missing affiliate API key');

    const candidates = new Set<string>();
    const envKey = this.config.get<string>('AFFILIATE_INTERNAL_API_KEY');
    if (envKey) candidates.add(envKey);
    const legacy = this.config.get<string>('INTERNAL_API_KEY');
    if (legacy) candidates.add(legacy);

    const client = await this.prisma.ssoClient.findFirst({
      where: { clientId: { in: AFFILIATE_CLIENT_IDS } },
      select: { apiKey: true },
    });
    if (client?.apiKey) candidates.add(client.apiKey);

    for (const candidate of candidates) {
      if (safeEqual(String(provided), candidate)) return true;
    }

    this.logger.warn(`Rejected affiliate callback with invalid API key (ip=${request.ip})`);
    throw new UnauthorizedException('Invalid affiliate API key');
  }
}
