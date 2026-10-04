import { UploadsAuthMiddleware } from './uploads-auth.middleware';
import * as jwt from 'jsonwebtoken';

describe('UploadsAuthMiddleware (Phase 1C)', () => {
  const SECRET = 'test-uploads-secret';

  const config = { get: (key: string) => (key === 'JWT_SECRET' ? SECRET : undefined) } as any;
  const middleware = new UploadsAuthMiddleware(config);

  const makeRes = () => {
    const res: any = {
      statusCode: 200,
      body: undefined as any,
      headers: {} as Record<string, string>,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(payload: any) {
        res.body = payload;
        return res;
      },
      setHeader(k: string, v: string) {
        res.headers[k] = v;
      },
    };
    return res;
  };

  it('rejects requests without a token (401)', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware.use({ headers: {} } as any, res as any, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects forged tokens (401)', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware.use({ headers: { authorization: 'Bearer forged.token.here' } } as any, res as any, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('serves files for valid tokens with sandboxing headers', () => {
    const token = jwt.sign({ sub: 'u1' }, SECRET);
    const res = makeRes();
    const next = jest.fn();
    middleware.use({ headers: { authorization: `Bearer ${token}` } } as any, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.headers['Content-Disposition']).toBe('attachment');
    expect(res.headers['Content-Security-Policy']).toContain('sandbox');
  });

  it('rejects SSO-audience tokens even when validly signed (strict separation)', () => {
    const ssoToken = jwt.sign({ sub: 'u1' }, 'different-sso-secret');
    const res = makeRes();
    const next = jest.fn();
    middleware.use({ headers: { authorization: `Bearer ${ssoToken}` } } as any, res as any, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
