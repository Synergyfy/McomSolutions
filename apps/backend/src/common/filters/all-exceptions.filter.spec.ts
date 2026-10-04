import { ArgumentsHost } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

function hostWith(
  exception: unknown,
  overrides?: { url?: string; body?: unknown },
): ArgumentsHost {
  const jsonCalls: unknown[][] = [];
  const statusCalls: number[] = [];
  const response: any = {
    status: (code: number) => {
      statusCalls.push(code);
      return response;
    },
    json: (body: unknown) => {
      jsonCalls.push([body]);
      return response;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: overrides?.url ?? '/test' }),
    }),
  } as unknown as ArgumentsHost;
  (host as any).__jsonCalls = jsonCalls;
  (host as any).__statusCalls = statusCalls;
  void exception;
  return host;
}

describe('AllExceptionsFilter (Phase 6)', () => {
  const filter = new AllExceptionsFilter();

  it('should envelope HttpException with string message', () => {
    const host = hostWith(null);
    const { BadRequestException } = require('@nestjs/common');
    filter.catch(new BadRequestException('Business name is required'), host);
    const body = (host as any).__jsonCalls[0][0];
    expect((host as any).__statusCalls[0]).toBe(400);
    expect(body).toMatchObject({ success: false, statusCode: 400, message: 'Business name is required' });
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/test');
  });

  it('should flatten class-validator array messages into errors', () => {
    const host = hostWith(null);
    const { BadRequestException } = require('@nestjs/common');
    filter.catch(
      new BadRequestException(['email must be a valid email', 'password is too weak']),
      host,
    );
    const body = (host as any).__jsonCalls[0][0];
    expect(body.message).toBe('Validation failed');
    expect(body.errors).toEqual(['email must be a valid email', 'password is too weak']);
  });

  it('should map Prisma P2002 to 409 without leaking internals', () => {
    const host = hostWith(null);
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    filter.catch(err, host);
    const body = (host as any).__jsonCalls[0][0];
    expect((host as any).__statusCalls[0]).toBe(409);
    expect(body.message).toBe('A record with these details already exists');
  });

  it('should map Prisma P2025 to 404', () => {
    const host = hostWith(null);
    const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: '6.0.0',
    });
    filter.catch(err, host);
    const body = (host as any).__jsonCalls[0][0];
    expect((host as any).__statusCalls[0]).toBe(404);
  });

  it('should hide unknown errors behind a 500 envelope', () => {
    const host = hostWith(null);
    filter.catch(new Error('db connection string postgres://secret'), host);
    const body = (host as any).__jsonCalls[0][0];
    expect((host as any).__statusCalls[0]).toBe(500);
    expect(body.message).toBe('Internal server error');
    expect(JSON.stringify(body)).not.toContain('postgres://');
  });
});
