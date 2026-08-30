import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { STATUS_CODES } from 'http';

const colors = {
  // Methods
  getMethodBadge(method: string): string {
    const m = method.toUpperCase();
    switch (m) {
      case 'GET':
        return `\x1b[36;1m${m.padEnd(7)}\x1b[0m`; // Cyan Bold
      case 'POST':
        return `\x1b[32;1m${m.padEnd(7)}\x1b[0m`; // Green Bold
      case 'PUT':
        return `\x1b[33;1m${m.padEnd(7)}\x1b[0m`; // Yellow Bold
      case 'PATCH':
        return `\x1b[35;1m${m.padEnd(7)}\x1b[0m`; // Magenta Bold
      case 'DELETE':
        return `\x1b[31;1m${m.padEnd(7)}\x1b[0m`; // Red Bold
      case 'OPTIONS':
      case 'HEAD':
        return `\x1b[90m${m.padEnd(7)}\x1b[0m`; // Gray
      default:
        return `\x1b[97;1m${m.padEnd(7)}\x1b[0m`;
    }
  },

  // Status code with text description & colors
  getStatusBadge(status: number): string {
    const statusText = STATUS_CODES[status] || '';
    const text = `${status} ${statusText}`.trim();
    if (status >= 500) {
      return `\x1b[31;1m${text}\x1b[0m`; // Red Bold
    }
    if (status >= 400) {
      return `\x1b[33;1m${text}\x1b[0m`; // Yellow Bold
    }
    if (status >= 300) {
      return `\x1b[36;1m${text}\x1b[0m`; // Cyan Bold
    }
    if (status >= 200) {
      return `\x1b[32;1m${text}\x1b[0m`; // Green Bold
    }
    return `\x1b[37m${text}\x1b[0m`;
  },

  // Latency with color indicators
  getDurationBadge(ms: number): string {
    const formatted = ms < 1 ? '<1ms' : ms < 100 ? `${ms.toFixed(1)}ms` : `${Math.round(ms)}ms`;
    if (ms >= 1000) {
      return `\x1b[31;1m+${formatted}\x1b[0m`; // Red Bold
    }
    if (ms >= 300) {
      return `\x1b[33m+${formatted}\x1b[0m`; // Yellow
    }
    return `\x1b[32m+${formatted}\x1b[0m`; // Green
  },
};

function formatBytes(bytesStr: string | number | undefined): string {
  const bytes = Number(bytesStr);
  if (isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const startTime = Date.now();

    const isSsoEndpoint = originalUrl.includes('/auth/sso/authorize') || originalUrl.includes('/auth/sso/token');
    const isDataUserEndpoint = originalUrl.includes('/data/user');
    const isTargetEndpoint = isSsoEndpoint || isDataUserEndpoint;
    let responseBody: any = null;

    if (isTargetEndpoint) {
      const originalSend = response.send;
      response.send = function (...args: any[]): Response {
        const chunk = args[0];
        try {
          if (typeof chunk === 'string') {
            responseBody = chunk;
          } else if (Buffer.isBuffer(chunk)) {
            responseBody = chunk.toString('utf8');
          } else {
            responseBody = JSON.stringify(chunk);
          }
        } catch (e) {
          responseBody = '[Unparseable response]';
        }
        return originalSend.apply(this, args);
      };
    }

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const sizeStr = formatBytes(contentLength);
      const duration = Date.now() - startTime;

      // Terminal formatted badges
      const methodBadge = colors.getMethodBadge(method);
      const statusBadge = colors.getStatusBadge(statusCode);
      const durationBadge = colors.getDurationBadge(duration);
      const sizeBadge = sizeStr ? ` \x1b[90m(${sizeStr})\x1b[0m` : '';

      const logLine = `${methodBadge} ${originalUrl} ${statusBadge} ${durationBadge}${sizeBadge}`;

      if (statusCode >= 500) {
        this.logger.error(logLine);
      } else if (statusCode >= 400) {
        this.logger.warn(logLine);
      } else {
        this.logger.log(logLine);
      }

      if (isTargetEndpoint) {
        // Mask sensitive request fields
        const maskedBody = { ...request.body };
        if (maskedBody.client_secret) maskedBody.client_secret = '[MASKED]';
        if (maskedBody.password) maskedBody.password = '[MASKED]';

        const maskedHeaders = { ...request.headers };
        if (maskedHeaders.authorization) {
          if (maskedHeaders.authorization.toLowerCase().startsWith('basic ')) {
            maskedHeaders.authorization = 'Basic [MASKED]';
          } else if (maskedHeaders.authorization.toLowerCase().startsWith('bearer ')) {
            maskedHeaders.authorization = 'Bearer [MASKED]';
          } else {
            maskedHeaders.authorization = '[MASKED]';
          }
        }
        if (maskedHeaders['x-signature']) {
          maskedHeaders['x-signature'] = '[MASKED]';
        }

        // Mask sensitive response fields if it's JSON
        let responseBodyToLog = responseBody;
        try {
          const parsed = JSON.parse(responseBody);
          if (parsed.accessToken) parsed.accessToken = '[MASKED]';
          if (parsed.refreshToken) parsed.refreshToken = '[MASKED]';
          if (parsed.code) parsed.code = '[MASKED]';
          responseBodyToLog = JSON.stringify(parsed);
        } catch (e) {
          // not JSON, or invalid JSON
        }

        const endpointType = isSsoEndpoint ? 'SSO' : 'Data User';

        this.logger.log(
          `[${endpointType} Details] [${method}] ${originalUrl}\n` +
          `  Request Headers: ${JSON.stringify(maskedHeaders)}\n` +
          `  Request Query: ${JSON.stringify(request.query)}\n` +
          `  Request Body: ${JSON.stringify(maskedBody)}\n` +
          `  Response Status: ${statusCode}\n` +
          `  Response Body: ${responseBodyToLog}`
        );
      }
    });

    next();
  }
}

