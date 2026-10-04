import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { MulterError } from 'multer';

/**
 * Phase 1C: map multer transport errors to proper HTTP statuses.
 * Without this, an oversized file surfaces as a 500 instead of 413.
 */
@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception.code === 'LIMIT_FILE_SIZE') {
      const payload = new PayloadTooLargeException(
        'File too large — maximum upload size is 5 MB',
      ).getResponse();
      response.status(413).json(
        typeof payload === 'object'
          ? { success: false, ...(payload as Record<string, unknown>) }
          : payload,
      );
      return;
    }

    response.status(400).json({
      success: false,
      statusCode: 400,
      message: exception.message || 'File upload failed',
      timestamp: new Date().toISOString(),
      path: request?.url,
    });
  }
}
