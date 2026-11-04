import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SsoClient } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

export type ChatTokenAudience = 'chat' | 'chat:ws';

export interface ChatSessionResponse {
  accessToken: string;
  expiresIn: number;
  socketToken: string;
  socketExpiresIn: number;
  userId: string;
}

interface SsoSubjectPayload {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  jti?: string;
}

/**
 * Mints scoped chat tokens for trusted ecosystem apps (e.g. 247GBS
 * Affiliates) that already hold a user's Central SSO access token
 * server-side.
 *
 * The browser only ever receives `socketToken` (short-lived, single-use).
 * The longer-lived `accessToken` stays on the partner backend and is used for
 * REST proxying — it is never exposed cross-origin.
 */
@Injectable()
export class ChatSessionService {
  private readonly logger = new Logger(ChatSessionService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Verify a user's SSO access token and mint chat credentials for `client`. */
  async issueForClient(client: SsoClient, subjectToken: string): Promise<ChatSessionResponse> {
    const ssoSecret = this.config.get<string>('SSO_JWT_SECRET');
    if (!ssoSecret) {
      throw new UnauthorizedException('SSO is not configured on this server');
    }

    let subject: SsoSubjectPayload;
    try {
      subject = this.jwt.verify<SsoSubjectPayload>(subjectToken, {
        secret: ssoSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired SSO subject token');
    }

    const userId = subject.sub || subject.id || subject.userId;
    if (!userId) {
      throw new UnauthorizedException('SSO subject token has no user identifier');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        businessProfile: { select: { id: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException('User not found or deactivated');
    }

    // The caller must actually hold a live SSO session for this user. This
    // stops a registered app from minting chat tokens for arbitrary users even
    // if it somehow obtained another app's subject token.
    const session = await this.prisma.ssoSession.findFirst({
      where: {
        userId: user.id,
        clientId: client.id,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) {
      throw new ForbiddenException(
        'No active SSO session for this user on the calling application',
      );
    }

    const accessTtl = this.resolveTtl('CHAT_ACCESS_TOKEN_TTL', 900);
    const socketTtl = this.resolveTtl('CHAT_SOCKET_TOKEN_TTL', 90);

    const accessJti = crypto.randomUUID();
    const socketJti = crypto.randomUUID();
    const common = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion ?? 0,
      act: { sub: client.clientId },
    };

    const accessToken = this.jwt.sign(
      {
        ...common,
        jti: accessJti,
        aud: 'chat',
        scope: 'chat',
        businessId: user.businessProfile?.id ?? null,
      },
      { expiresIn: accessTtl },
    );

    const socketToken = this.jwt.sign(
      {
        ...common,
        jti: socketJti,
        aud: 'chat:ws',
        scope: 'chat',
        platform: client.platformSlug || client.clientId,
      },
      { expiresIn: socketTtl },
    );

    // Register the socket jti so the handshake can consume it exactly once.
    await this.redis.set(
      this.socketJtiKey(socketJti),
      { userId: user.id },
      socketTtl + 10,
    );

    this.logger.log(
      `Issued chat session for user ${user.id} via client ${client.clientId} (socket TTL ${socketTtl}s)`,
    );

    return {
      accessToken,
      expiresIn: accessTtl,
      socketToken,
      socketExpiresIn: socketTtl,
      userId: user.id,
    };
  }

  /**
   * Mint a fresh single-use socket token for an already-authenticated chat
   * user. Used on browser reconnects so the partner backend never has to
   * re-run client-credential (bcrypt) verification for every reconnect.
   */
  async issueSocketToken(user: {
    id: string;
    email: string;
    role: string;
    tokenVersion?: number;
  }): Promise<{ socketToken: string; expiresIn: number }> {
    const socketTtl = this.resolveTtl('CHAT_SOCKET_TOKEN_TTL', 90);
    const socketJti = crypto.randomUUID();

    const socketToken = this.jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tv: user.tokenVersion ?? 0,
        jti: socketJti,
        aud: 'chat:ws',
        scope: 'chat',
      },
      { expiresIn: socketTtl },
    );

    await this.redis.set(
      this.socketJtiKey(socketJti),
      { userId: user.id },
      socketTtl + 10,
    );

    return { socketToken, expiresIn: socketTtl };
  }

  /**
   * Verify a `chat:ws` token and consume its jti. Replays and expired tokens
   * are rejected. Returns the verified payload.
   */
  async consumeSocketToken(token: string): Promise<any> {
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired socket token');
    }

    if (payload.aud !== 'chat:ws' || payload.scope !== 'chat' || !payload.jti) {
      throw new UnauthorizedException('Not a chat socket token');
    }

    const consumed = await this.redis.compareAndDelete(
      this.socketJtiKey(payload.jti),
      { userId: payload.sub },
    );
    if (!consumed) {
      throw new UnauthorizedException('Socket token already used or expired');
    }

    return payload;
  }

  private socketJtiKey(jti: string): string {
    return `chat:ws-jti:${jti}`;
  }

  private resolveTtl(envKey: string, fallback: number): number {
    const raw = this.config.get<string>(envKey);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
