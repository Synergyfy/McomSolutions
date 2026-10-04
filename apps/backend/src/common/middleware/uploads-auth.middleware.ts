import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * Phase 1C: `/uploads` is no longer open static hosting.
 * Requires a valid Bearer token (regular API audience ONLY — SSO tokens are
 * rejected here by design, see Phase 3 strict audience separation) and stamps
 * every served file with sandboxing headers so an uploaded image can
 * never execute as a script in a victim's browser.
 */
@Injectable()
export class UploadsAuthMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Authentication required to access uploads',
      });
      return;
    }

    // Strict audience separation: only the regular API secret is accepted.
    // SSO audience tokens (SSO_JWT_SECRET) must never grant /uploads access.
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      res.status(500).json({
        success: false,
        statusCode: 500,
        message: 'Upload service misconfigured',
      });
      return;
    }

    try {
      jwt.verify(token, secret);
    } catch {
      res.status(401).json({
        success: false,
        statusCode: 401,
        message: 'Invalid or expired token',
      });
      return;
    }

    // Serve user uploads as inert attachments, never as executable content.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Disposition', 'attachment');
    next();
  }
}
