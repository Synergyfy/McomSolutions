import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Owns the asymmetric keypair used to sign ecosystem service-to-service tokens.
 *
 * Design: MCOM is the sole issuer (control plane). It signs short-lived RS256
 * JWTs with a private key; partner apps verify them OFFLINE using the public
 * JWKS served at `/.well-known/jwks.json`. No request ever transits MCOM.
 *
 * Config:
 *  - SERVICE_JWT_PRIVATE_KEY / SERVICE_JWT_PUBLIC_KEY (PEM; `\n` escapes ok)
 *  - SERVICE_JWT_KID, SERVICE_JWT_ISSUER, SERVICE_TOKEN_TTL_SECONDS
 *
 * Production fails closed when the keypair is missing. In dev/test an ephemeral
 * keypair is generated at boot so the flow works without secrets (tokens issued
 * before a restart will not verify after it — dev only).
 */
@Injectable()
export class ServiceKeyService implements OnModuleInit {
  private readonly logger = new Logger(ServiceKeyService.name);
  private privateKey!: string;
  private publicKey!: string;
  private kid!: string;
  private issuer!: string;
  private ephemeral = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const priv = normalizePem(this.config.get<string>('SERVICE_JWT_PRIVATE_KEY'));
    const pub = normalizePem(this.config.get<string>('SERVICE_JWT_PUBLIC_KEY'));
    this.issuer = this.config.get<string>('SERVICE_JWT_ISSUER') || 'mcom-solutions';

    if (priv && pub) {
      this.privateKey = priv;
      this.publicKey = pub;
      this.kid = this.config.get<string>('SERVICE_JWT_KID') || this.deriveKid(pub);
      return;
    }

    if (isProd) {
      throw new Error(
        'SERVICE_JWT_PRIVATE_KEY and SERVICE_JWT_PUBLIC_KEY are required in production.',
      );
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.kid = this.config.get<string>('SERVICE_JWT_KID') || 'mcom-svc-dev';
    this.ephemeral = true;
    this.logger.warn(
      'No SERVICE_JWT keypair configured — generated an ephemeral RSA keypair for this process (dev only).',
    );
  }

  getIssuer(): string {
    return this.issuer;
  }

  getKid(): string {
    return this.kid;
  }

  getPrivateKey(): string {
    return this.privateKey;
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  isEphemeral(): boolean {
    return this.ephemeral;
  }

  getTtlSeconds(): number {
    const raw = parseInt(this.config.get<string>('SERVICE_TOKEN_TTL_SECONDS') || '300', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 300;
  }

  /** Public JWKS document — contains no private material. */
  getJwks(): { keys: Array<Record<string, unknown>> } {
    const jwk = crypto
      .createPublicKey(this.publicKey)
      .export({ format: 'jwk' }) as Record<string, unknown>;
    return {
      keys: [{ ...jwk, kid: this.kid, use: 'sig', alg: 'RS256' }],
    };
  }

  private deriveKid(pubPem: string): string {
    const der = crypto
      .createPublicKey(pubPem)
      .export({ type: 'spki', format: 'der' });
    return `svc-${crypto.createHash('sha256').update(der).digest('hex').slice(0, 16)}`;
  }
}

/** Normalize PEM from env: trim and convert literal `\n` escapes to newlines. */
function normalizePem(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.includes('\\n') ? trimmed.replace(/\\n/g, '\n') : trimmed;
}
