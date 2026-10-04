import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Phase 6: global exception envelope. Every error response follows the
 * standard shape (`success:false, statusCode, message, errors?, timestamp,
 * path`) per `error-handling-logging.md`. Route-level filters (e.g.
 * MulterExceptionFilter) run before this global fallback.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: string[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const body = res as Record<string, unknown>;
        if (typeof body.message === 'string') {
          message = body.message;
        } else if (Array.isArray(body.message)) {
          message = 'Validation failed';
          errors = body.message.map(String);
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = mapPrismaError(exception);
      message = prismaErrorMessage(exception, status);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(errors ? { errors } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): number {
  switch (error.code) {
    case 'P2002':
      return HttpStatus.CONFLICT;
    case 'P2025':
      return HttpStatus.NOT_FOUND;
    case 'P2003':
    case 'P2014':
    case 'P2000':
      return HttpStatus.BAD_REQUEST;
    default:
      return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

function prismaErrorMessage(error: Prisma.PrismaClientKnownRequestError, status: number): string {
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) return 'Internal server error';
  if (error.code === 'P2002') return 'A record with these details already exists';
  if (error.code === 'P2025') return 'Record not found';
  return 'Invalid request data';
}
