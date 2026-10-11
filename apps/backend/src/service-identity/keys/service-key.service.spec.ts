import { ConfigService } from '@nestjs/config';
import { ServiceKeyService } from './service-key.service';

function mockConfig(map: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => map[key] } as unknown as ConfigService;
}

describe('ServiceKeyService', () => {
  it('generates an ephemeral keypair in non-production when none is configured', () => {
    const service = new ServiceKeyService(mockConfig({ NODE_ENV: 'test' }));
    service.onModuleInit();

    expect(service.isEphemeral()).toBe(true);
    expect(service.getPrivateKey()).toContain('PRIVATE KEY');
    expect(service.getPublicKey()).toContain('PUBLIC KEY');
  });

  it('fails closed in production when no keypair is configured', () => {
    const service = new ServiceKeyService(mockConfig({ NODE_ENV: 'production' }));
    expect(() => service.onModuleInit()).toThrow(/SERVICE_JWT_PRIVATE_KEY/);
  });

  it('exposes a public JWKS with kid/alg/use and no private material', () => {
    const service = new ServiceKeyService(mockConfig({ NODE_ENV: 'test', SERVICE_JWT_KID: 'kid-1' }));
    service.onModuleInit();

    const jwks = service.getJwks();
    expect(jwks.keys).toHaveLength(1);
    const key = jwks.keys[0];
    expect(key.kid).toBe('kid-1');
    expect(key.alg).toBe('RS256');
    expect(key.use).toBe('sig');
    expect(key.kty).toBe('RSA');
    // Private components must never leak into the JWKS.
    expect(key.d).toBeUndefined();
    expect(key.p).toBeUndefined();
    expect(key.q).toBeUndefined();
  });

  it('normalizes literal \\n escapes in configured PEM keys', () => {
    const service = new ServiceKeyService(
      mockConfig({ NODE_ENV: 'test', SERVICE_JWT_PRIVATE_KEY: 'x\\ny' }),
    );
    // Only the normalization path is under test here — assert via public getter
    // after init with a real pair is covered elsewhere; ensure no throw for
    // valid escaped PEM by generating a real pair.
    const real = new ServiceKeyService(mockConfig({ NODE_ENV: 'test' }));
    real.onModuleInit();
    const escaped = real.getPrivateKey().replace(/\n/g, '\\n');
    const loaded = new ServiceKeyService(
      mockConfig({
        NODE_ENV: 'test',
        SERVICE_JWT_PRIVATE_KEY: escaped,
        SERVICE_JWT_PUBLIC_KEY: real.getPublicKey().replace(/\n/g, '\\n'),
      }),
    );
    expect(() => loaded.onModuleInit()).not.toThrow();
    expect(loaded.getPrivateKey()).toContain('\n');
    void service;
  });

  it('defaults TTL to 300s and honours override', () => {
    const a = new ServiceKeyService(mockConfig({ NODE_ENV: 'test' }));
    expect(a.getTtlSeconds()).toBe(300);
    const b = new ServiceKeyService(mockConfig({ NODE_ENV: 'test', SERVICE_TOKEN_TTL_SECONDS: '60' }));
    expect(b.getTtlSeconds()).toBe(60);
  });
});
