# Error Handling & Logging

## Global Exception Filter

Define a single `HttpExceptionFilter` in `src/common/filters/` that catches all exceptions and returns a consistent JSON envelope.

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = 500
    let message = 'Internal server error'
    let errors: string[] | undefined

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'string') {
        message = res
      } else if (typeof res === 'object') {
        message = (res as any).message || message
        errors = Array.isArray((res as any).message) ? (res as any).message : undefined
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = mapPrismaError(exception)
      message = getPrismaErrorMessage(exception)
    }

    logger.error(`${status} — ${message}`, exception instanceof Error ? exception.stack : '')

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest<Request>().url,
    })
  }
}
```

## Error Response Envelope

Every error response must follow this shape:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be a valid email", "password must be at least 8 characters"],
  "timestamp": "2026-07-12T17:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

## Mapping Common Errors

| HTTP Status | When |
|-------------|------|
| 400 | Validation errors (`BadRequestException`) |
| 401 | Missing/invalid auth token (`UnauthorizedException`) |
| 403 | Insufficient permissions (`ForbiddenException`) |
| 404 | Resource not found (`NotFoundException`) |
| 409 | Duplicate/conflict (`ConflictException`) |
| 422 | Business rule violation (custom `UnprocessableEntityException`) |
| 429 | Rate limited (`TooManyRequestsException`) |
| 500 | Unhandled errors (`InternalServerErrorException`) |

## Prisma Error Mapping

```ts
function mapPrismaError(error: Prisma.PrismaClientKnownRequestError): number {
  switch (error.code) {
    case 'P2002': return 409  // Unique constraint violation
    case 'P2025': return 404  // Record not found
    case 'P2003': return 400  // Foreign key constraint
    case 'P2014': return 400  // Required relation violation
    case 'P2000': return 400  // Value too long
    default:      return 500
  }
}
```

## Structured Logging (Pino / Winston)

Use a structured logger (not `console.log`). Log in JSON format for production log aggregation.

```ts
// src/common/logger/logger.service.ts
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty' }
    : undefined,
  redact: ['req.headers.authorization', 'req.body.password', 'req.body.token'],
})
```

## What to Log

| Level | When |
|-------|------|
| `error` | Unhandled exceptions, DB errors, external API failures |
| `warn` | Slow queries (>100ms), rate limit approaching, deprecated API usage |
| `info` | User registration, login, payment events, subscription changes |
| `debug` | Request/response bodies (dev only), Prisma query details |
| `trace` | Full I/O details (rarely used) |

## Log Rules
- Never log: passwords, tokens, credit card numbers, API secrets, OAuth tokens.
- Log user actions with `userId` and `action` for audit trails.
- Include correlation ID (`req.id` or `x-request-id`) in every log line for tracing.
- Use async logging — never block the event loop for I/O.

```ts
// Add correlation ID middleware
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('x-request-id', req.id)
  next()
})
```

## Service Layer Errors
- Services throw typed `HttpException` subclasses — never return `{ error: ... }` objects.
- Use descriptive messages: `new BadRequestException('Business name is required')` — not `new BadRequestException('Error')`.
- Catch known Prisma errors at the service level and re-throw as HTTP exceptions.

```ts
async createBusiness(dto: CreateBusinessDto) {
  try {
    return await this.prisma.business.create({ data: dto })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('A business with this email already exists')
      }
    }
    throw error
  }
}
```

## Frontend Error Handling
- Axios interceptor handles 401 → auto-logout + redirect.
- React Query `onError` callbacks show toast notifications for toast-worthy errors (create/update/delete failures).
- Generic API error component for unexpected failures.
- Never show raw `Error.message` to users — map to user-friendly text.
