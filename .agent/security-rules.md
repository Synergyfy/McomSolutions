# Security Rules

## Authentication
- Passwords are hashed with `bcryptjs` (salt rounds = 12) — never store plain text.
- JWT tokens use `@nestjs/jwt` with RS256 or HS256.
- Access tokens expire in 15 minutes; refresh tokens expire in 7 days.
- Store refresh tokens in DB (hashed) and rotate on use.
- Always validate tokens with `passport-jwt` strategy.

```ts
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('JWT_SECRET'),
    })
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { id: payload.sub, email: payload.email, role: payload.role }
  }
}
```

## Authorization
- Use role-based access control (RBAC) with `@Roles()` decorator + `RolesGuard`.
- Permissions are checked at the service layer for critical operations (defense in depth).
- Never trust `req.user` alone — re-verify ownership for resource-specific operations.

```ts
@SetMetadata('roles', ['ADMIN', 'BUSINESS_OWNER'])
@UseGuards(JwtAuthGuard, RolesGuard)
```

## Input Validation
- All inputs are validated with `class-validator` + `ValidationPipe` (global).
- Enable `whitelist: true` and `forbidNonWhitelisted: true` to strip/block unknown properties.
- Sanitize strings — strip HTML tags from user-supplied text fields.

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
```

## Rate Limiting
- Apply rate limiting on auth endpoints (login, register, forgot-password) — e.g. 5 attempts per minute per IP.
- Use `@nestjs/throttler` or a reverse-proxy (nginx/Cloudflare) rate limit.

## CORS
- Restrict origins to known frontend domains in production.
```ts
app.enableCors({
  origin: ['https://mcomsolutions.com', 'https://admin.mcomsolutions.com'],
  credentials: true,
})
```

## Environment & Secrets
- All secrets (DB URLs, JWT secrets, API keys) live in `.env` files — never hardcoded.
- Use `@nestjs/config` with `ConfigService` — never `process.env` directly.
- `.env.example` checked into git with placeholder values only.
- Validate `.env` at startup with `Joi` or a custom validation schema.

## SQL Injection
- Prisma parameterizes queries by default — never use raw queries unless absolutely necessary.
- If raw queries are required, use `$queryRawUnsafe` with bound parameters, never string interpolation.

```ts
// SAFE
await prisma.$queryRawUnsafe('SELECT * FROM users WHERE email = $1', email)
// UNSAFE — never do this
await prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)
```

## CSRF
- For cookie-based auth (if used): implement CSRF tokens via `csurf` or double-submit cookie pattern.
- For token-based auth (Bearer): CSRF is generally not needed — CORS + SameSite cookies suffice.

## Helmet
- Use `helmet` middleware (via NestJS or Express) to set secure HTTP headers.

```ts
import helmet from 'helmet'
app.use(helmet())
```

## Additional
- No secrets in logs: implement a custom logger that redacts sensitive fields.
- HTTPS only in production.
- Use `cookie-parser` with `httpOnly`, `secure`, `sameSite: 'strict'` for session cookies.
- Implement account lockout after N failed login attempts.
