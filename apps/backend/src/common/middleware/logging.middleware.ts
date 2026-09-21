import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { STATUS_CODES } from 'http';
import { randomUUID } from 'crypto';

const colors = {
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

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'pass',
  'secret',
  'token',
  'authorization',
  'cookie',
  'signature',
  'apikey',
  'api_key',
  'creditcard',
  'cardnumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'pin',
  'privatekey',
  'private_key',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern.replace(/[-_]/g, '')));
}

function sanitizeData(data: any, seen = new WeakSet()): any {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (seen.has(data)) return '[Circular]';

  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item, seen));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      if (typeof value === 'string' && (value.startsWith('Bearer ') || value.startsWith('Basic '))) {
        const prefix = value.split(' ')[0];
        sanitized[key] = `${prefix} [MASKED]`;
      } else {
        sanitized[key] = '[MASKED]';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, seen);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function formatBytes(bytesStr: string | number | undefined): string {
  const bytes = Number(bytesStr);
  if (isNaN(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function formatPayload(payload: any, maxLen = 4000): string {
  if (payload === undefined || payload === null) {
    return '(empty)';
  }
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return '(empty)';
    try {
      const parsed = JSON.parse(trimmed);
      const sanitized = sanitizeData(parsed);
      return truncate(JSON.stringify(sanitized, null, 2), maxLen);
    } catch {
      return truncate(trimmed, maxLen);
    }
  }
  if (Buffer.isBuffer(payload)) {
    return `[Buffer: ${payload.length} bytes]`;
  }
  try {
    const sanitized = sanitizeData(payload);
    return truncate(JSON.stringify(sanitized, null, 2), maxLen);
  } catch (err: any) {
    return `[Unserializable payload: ${err?.message || 'unknown'}]`;
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}\n... [Truncated ${str.length - maxLen} additional characters]`;
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers, query, body } = request;

    // Generate or use existing correlation/request ID
    const incomingReqId = headers['x-request-id'] as string;
    const reqId = incomingReqId || randomUUID().slice(0, 8);
    response.setHeader('x-request-id', reqId);

    // Skip verbose payload logging for static assets or docs to reduce noise
    const isStaticAsset =
      originalUrl.startsWith('/uploads') ||
      originalUrl.startsWith('/docs') ||
      originalUrl.includes('favicon.ico');

    const methodBadge = colors.getMethodBadge(method);

    // Sanitize headers
    const sanitizedHeaders = sanitizeData({
      host: headers.host,
      'user-agent': headers['user-agent'],
      'content-type': headers['content-type'],
      authorization: headers.authorization,
      'x-mcom-client-id': headers['x-mcom-client-id'],
      'x-mcom-signature': headers['x-mcom-signature'],
      'x-idempotency-key': headers['x-idempotency-key'],
      ...headers,
    });

    // 1. Log Incoming Request
    if (!isStaticAsset) {
      const hasQuery = query && Object.keys(query).length > 0;
      const hasBody = body && (typeof body === 'object' ? Object.keys(body).length > 0 : Boolean(body));

      const inLogParts = [
        `--> [${reqId}] ${methodBadge} ${originalUrl} (IP: ${ip || 'unknown'})`,
        hasQuery ? `    Query: ${JSON.stringify(sanitizeData(query))}` : null,
        hasBody ? `    Payload:\n${formatPayload(body)}` : null,
      ].filter(Boolean);

      this.logger.log(inLogParts.join('\n'));
    }

    // 2. Intercept Outgoing Response Body
    let responseBody: any = undefined;

    const originalSend = response.send.bind(response);
    const originalJson = response.json.bind(response);

    response.json = function (chunk: any): Response {
      responseBody = chunk;
      return originalJson(chunk);
    };

    response.send = function (chunk: any): Response {
      if (responseBody === undefined) {
        responseBody = chunk;
      }
      return originalSend(chunk);
    };

    // 3. Log Outgoing Response on finish
    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const sizeStr = formatBytes(contentLength);
      const duration = Date.now() - startTime;

      const statusBadge = colors.getStatusBadge(statusCode);
      const durationBadge = colors.getDurationBadge(duration);
      const sizeBadge = sizeStr ? ` \x1b[90m(${sizeStr})\x1b[0m` : '';

      const outSummary = `<-- [${reqId}] ${methodBadge} ${originalUrl} ${statusBadge} ${durationBadge}${sizeBadge}`;

      if (isStaticAsset) {
        if (statusCode >= 500) {
          this.logger.error(outSummary);
        } else if (statusCode >= 400) {
          this.logger.warn(outSummary);
        } else {
          this.logger.log(outSummary);
        }
        return;
      }

      const contentType = response.get('content-type') || '';
      const isBinaryResponse =
        contentType.includes('image/') ||
        contentType.includes('audio/') ||
        contentType.includes('video/') ||
        contentType.includes('application/octet-stream') ||
        contentType.includes('application/pdf');

      const formattedResPayload = isBinaryResponse
        ? `[Binary Stream: ${contentType}]`
        : formatPayload(responseBody);

      const outLog = `${outSummary}\n    Response Payload:\n${formattedResPayload}`;

      if (statusCode >= 500) {
        this.logger.error(outLog);
      } else if (statusCode >= 400) {
        this.logger.warn(outLog);
      } else {
        this.logger.log(outLog);
      }
    });

    next();
  }
}


