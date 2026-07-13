import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { ip, method, originalUrl } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

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
    });

    next();
  }
}
