import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
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
      const contentLength = response.get('content-length') || '0';
      const duration = Date.now() - startTime;

      // Colorize the status code for terminal readability
      let statusString = `${statusCode}`;
      if (statusCode >= 500) {
        statusString = `\x1b[31m${statusCode}\x1b[0m`; // Red
      } else if (statusCode >= 400) {
        statusString = `\x1b[33m${statusCode}\x1b[0m`; // Yellow
      } else if (statusCode >= 300) {
        statusString = `\x1b[36m${statusCode}\x1b[0m`; // Cyan
      } else if (statusCode >= 200) {
        statusString = `\x1b[32m${statusCode}\x1b[0m`; // Green
      }

      this.logger.log(
        `[${method}] ${originalUrl} ${statusString} - ${contentLength}b - ${duration}ms | IP: ${ip} | ${userAgent}`,
      );

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

