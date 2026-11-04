import { JwtService } from '@nestjs/jwt';
import { ChatSessionService } from './chat-session.service';

const SSO_SECRET = 'test-sso-secret';
const API_SECRET = 'test-api-secret';

describe('ChatSessionService', () => {
  let service: ChatSessionService;
  let jwt: JwtService;
  let prisma: any;
  let redis: any;
  let config: any;

  const client: any = {
    id: 'client-db-id',
    clientId: '247gbs-affiliate',
    platformSlug: '247gbs_affiliate',
  };

  beforeEach(() => {
    jwt = new JwtService({ secret: API_SECRET });
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'agent@example.com',
          role: 'AGENT',
          tokenVersion: 3,
          businessProfile: null,
        }),
      },
      ssoSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
    };
    redis = {
      set: jest.fn().mockResolvedValue(undefined),
      compareAndDelete: jest.fn().mockResolvedValue(true),
    };
    config = {
      get: jest.fn((key: string) => {
        if (key === 'SSO_JWT_SECRET') return SSO_SECRET;
        if (key === 'CHAT_ACCESS_TOKEN_TTL') return '900';
        if (key === 'CHAT_SOCKET_TOKEN_TTL') return '90';
        return undefined;
      }),
    };

    service = new ChatSessionService(jwt as any, config, prisma, redis);
  });

  function subjectToken(userId = 'user-1'): string {
    return jwt.sign({ sub: userId, email: 'agent@example.com' }, {
      secret: SSO_SECRET,
      expiresIn: '5m',
    });
  }

  it('issues a REST token and a single-use socket token', async () => {
    const result = await service.issueForClient(client, subjectToken());

    expect(result.userId).toBe('user-1');
    expect(result.expiresIn).toBe(900);
    expect(result.socketExpiresIn).toBe(90);

    const access = jwt.verify(result.accessToken, { secret: API_SECRET }) as any;
    expect(access).toMatchObject({
      sub: 'user-1',
      role: 'AGENT',
      tv: 3,
      aud: 'chat',
      scope: 'chat',
    });

    const socket = jwt.verify(result.socketToken, { secret: API_SECRET }) as any;
    expect(socket).toMatchObject({
      sub: 'user-1',
      aud: 'chat:ws',
      scope: 'chat',
      platform: '247gbs_affiliate',
    });
    expect(socket.jti).toBeTruthy();

    expect(redis.set).toHaveBeenCalledWith(
      `chat:ws-jti:${socket.jti}`,
      { userId: 'user-1' },
      expect.any(Number),
    );
  });

  it('rejects an invalid or expired subject token', async () => {
    await expect(service.issueForClient(client, 'not-a-jwt')).rejects.toThrow(
      /Invalid or expired SSO subject token/,
    );
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects when the calling app has no live SSO session for the user', async () => {
    prisma.ssoSession.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.issueForClient(client, subjectToken()),
    ).rejects.toThrow(/No active SSO session/);
  });

  it('consumes a socket token exactly once', async () => {
    const result = await service.issueForClient(client, subjectToken());

    const payload = await service.consumeSocketToken(result.socketToken);
    expect(payload.sub).toBe('user-1');
    expect(redis.compareAndDelete).toHaveBeenCalledWith(
      `chat:ws-jti:${payload.jti}`,
      { userId: 'user-1' },
    );

    // Simulate a replay: the jti is already gone.
    redis.compareAndDelete.mockResolvedValueOnce(false);
    await expect(service.consumeSocketToken(result.socketToken)).rejects.toThrow(
      /already used or expired/,
    );
  });

  it('mints a socket-only token for an already-authenticated user', async () => {
    const result = await service.issueSocketToken({
      id: 'user-1',
      email: 'agent@example.com',
      role: 'AGENT',
      tokenVersion: 3,
    });

    expect(result.expiresIn).toBe(90);
    const payload = jwt.verify(result.socketToken, { secret: API_SECRET }) as any;
    expect(payload).toMatchObject({
      sub: 'user-1',
      aud: 'chat:ws',
      scope: 'chat',
      tv: 3,
    });
    expect(redis.set).toHaveBeenCalledWith(
      `chat:ws-jti:${payload.jti}`,
      { userId: 'user-1' },
      expect.any(Number),
    );
  });

  it('rejects a valid API token that is not scoped to chat:ws', async () => {
    const plain = jwt.sign({ sub: 'user-1', tv: 3 });
    await expect(service.consumeSocketToken(plain)).rejects.toThrow(
      /Not a chat socket token/,
    );
  });
});
