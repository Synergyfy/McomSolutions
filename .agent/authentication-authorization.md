# Authentication & Authorization Rules

## Auth Flow

```
Client → POST /auth/login → LocalStrategy.validate() → returns JWT → Client stores token
Client → GET /resource (Authorization: Bearer <token>) → JwtStrategy.validate() → req.user
```

## Registration Flow
- `/auth/register` accepts user type (`BUSINESS`, `CUSTOMER`, `PARTNER`, `AGENT`, etc.) and routes to the correct onboarding flow.
- Email verification is required before first login. Send verification email with signed link (JWT-based, expires in 24h).
- Password requirements: min 8 chars, at least 1 uppercase, 1 number, 1 special character (validated via `class-validator`).

## Login
- Use `@nestjs/passport` `LocalStrategy` for email/password validation.
- On success, return `{ accessToken, refreshToken, user }`.
- On failure, return `401 Unauthorized` — never reveal whether the email or password was wrong.

```ts
async validate(email: string, password: string): Promise<any> {
  const user = await this.authService.validateUser(email, password)
  if (!user) throw new UnauthorizedException('Invalid credentials')
  return user
}
```

## Token Management
- **Access token**: short-lived (15 min), stored in memory or `Authorization` header (Bearer).
- **Refresh token**: long-lived (7 days), stored in `httpOnly` cookie + DB (hashed).
- Refresh token rotation: each refresh issues a new access + refresh token and invalidates the old refresh token.
- `/auth/refresh` endpoint accepts the refresh token and returns new tokens.
- `/auth/logout` invalidates the refresh token in DB.

```ts
@Post('refresh')
@ApiOperation({ summary: 'Refresh access token' })
async refresh(@Body() dto: RefreshTokenDto) {
  return this.authService.refresh(dto.refreshToken)
}
```

## Guards

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates Bearer token, populates `req.user` |
| `LocalAuthGuard` | Validates email + password for login |
| `RolesGuard` | Checks `@Roles()` metadata against `req.user.role` |
| `OptionalAuthGuard` | Populates `req.user` if token present, but doesn't fail if absent |

## Role-Based Access Control

```ts
// 1. Define roles
export enum UserRole {
  ADMIN = 'ADMIN',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  CUSTOMER = 'CUSTOMER',
  PARTNER = 'PARTNER',
  AGENT = 'AGENT',
  CONSULTANT = 'CONSULTANT',
  ACCOUNT_MANAGER = 'ACCOUNT_MANAGER',
}

// 2. Create @Roles() decorator
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles)

// 3. Use on controller
@Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
async remove(@Param('id') id: string) {}
```

## Resource Ownership
- Users can only access their own resources unless they have admin roles.
- Check ownership in the service layer:

```ts
async getBusinessProfile(userId: string, businessId: string) {
  const business = await prisma.business.findFirst({
    where: { id: businessId, userId }, // ensures ownership
  })
  if (!business) throw new NotFoundException('Business not found')
  return business
}
```

## SSO Architecture
- MCOM Solutions acts as the **SSO provider** for all MCOM platforms (Rewards, Spin, Mall, Audit, Expo).
- SSO flow:
  1. User clicks "Launch Platform" → backend generates a signed SSO token (short-lived, 5 min)
  2. User is redirected to `platform.mcom.com/auth/sso?token=<signed_token>`
  3. Platform validates the token with MCOM Solutions' public key
  4. Platform creates/updates a local session for the user

```ts
@Post('sso/generate')
@UseGuards(JwtAuthGuard)
@ApiOperation({ summary: 'Generate SSO token to launch a platform' })
async generateSsoToken(@Req() req, @Body() dto: SsoRequestDto) {
  return this.ssoService.generateToken(req.user.id, dto.platformId)
}
```

## Multi-Tenancy / Role Separation
- Users can have multiple roles (e.g., a user can be both a `CUSTOMER` and a `BUSINESS_OWNER`).
- Role context is passed per-request or per-session.
- Endpoints should be explicit about which role context they operate in.

## OAuth / Social Login (Future)
- Use `passport-google-oauth20`, `passport-facebook`, etc.
- On first social login, create a local account if one doesn't exist (link by email).
- Store OAuth provider + provider ID in a separate `SocialAccount` model.

## Security Headers for Auth Endpoints
- `Authorization: Bearer <token>` header only — never pass tokens in URL query strings.
- Refresh tokens should be sent in the request body (POST) or as `httpOnly` cookies.
- Log all auth failures (failed login, invalid token, expired refresh) with IP and timestamp.
