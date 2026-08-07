# Swagger Documentation Setup

The project uses `@nestjs/swagger` (v11). Every controller and DTO must be documented.

## Setup (already in `main.ts`)
```ts
const config = new DocumentBuilder()
  .setTitle('MCOM Solutions API')
  .setDescription('Central authentication, membership, and platform-launching API')
  .setVersion('1.0')
  .addBearerAuth()
  .build()
const document = SwaggerModule.createDocument(app, config)
SwaggerModule.setup('api/docs', app, document)
```

## Controller Documentation

```ts
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiConflictResponse({ description: 'Email already exists' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto)
  }
}
```

## DTO Documentation

```ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  email: string

  @ApiProperty({ example: 'StrongP@ss1', description: 'Password (min 8 chars)' })
  password: string

  @ApiPropertyOptional({ example: 'Acme Corp', description: 'Business name (required for business registration)' })
  businessName?: string
}
```

## Response DTOs

```ts
export class AuthResponseDto {
  @ApiProperty({ example: true })
  success: boolean

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...' })
  accessToken: string

  @ApiProperty({ type: UserDto })
  user: UserDto
}
```

## Query Parameters

```ts
@Get('businesses')
@ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number' })
@ApiQuery({ name: 'limit', required: false, example: 20, description: 'Items per page' })
@ApiQuery({ name: 'search', required: false, example: 'Acme', description: 'Search by name' })
@ApiOkResponse({ type: PaginatedBusinessDto })
async findAll(
  @Query('page') page = 1,
  @Query('limit') limit = 20,
  @Query('search') search?: string,
) {}
```

## Paginated Response DTO

```ts
export class PaginatedBusinessDto {
  @ApiProperty({ example: true })
  success: boolean

  @ApiProperty({ type: [BusinessDto] })
  data: BusinessDto[]

  @ApiProperty({ example: 42 })
  total: number

  @ApiProperty({ example: 3 })
  page: number

  @ApiProperty({ example: 20 })
  limit: number

  @ApiProperty({ example: 3 })
  totalPages: number
}
```

## Decorating Enums

```ts
@ApiProperty({ enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] })
tier: string
```

## Bearer Auth on Specific Routes

```ts
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Get('profile')
@ApiOperation({ summary: 'Get current user profile' })
getProfile(@Req() req) {}
```

## Rules
- Every endpoint must have `@ApiOperation()` and appropriate response decorators.
- Every DTO property must have `@ApiProperty()` or `@ApiPropertyOptional()` with `example` and `description`.
- Use `@ApiBearerAuth()` on protected routes.
- Group related endpoints with `@ApiTags()`.
- Don't expose internal error details in responses (use `@ApiInternalServerErrorResponse` sparingly).
