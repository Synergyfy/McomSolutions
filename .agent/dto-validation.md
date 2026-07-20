# DTO & Validation Rules

Stack: `class-validator` + `class-transformer` + NestJS `ValidationPipe`

## Global Validation Pipe (in `main.ts`)

```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Strip unknown properties
  forbidNonWhitelisted: true,    // Throw error on unknown properties
  transform: true,               // Auto-transform types (string "1" → number 1)
  transformOptions: {
    enableImplicitConversion: false, // Use explicit @Type() decorators
  },
  exceptionFactory: (errors) => {
    const messages = errors.map(e =>
      e.constraints ? Object.values(e.constraints).join(', ') : e.toString()
    )
    return new BadRequestException(messages)
  },
}))
```

## DTO Structure

### Create DTO
```ts
export class CreateBusinessDto {
  @ApiProperty({ example: 'Acme Corp', description: 'Business name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string

  @ApiProperty({ example: 'contact@acme.com', description: 'Business email' })
  @IsEmail()
  @IsNotEmpty()
  email: string

  @ApiPropertyOptional({ example: '+2348012345678', description: 'Business phone' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s\-()]{7,20}$/, { message: 'Invalid phone number format' })
  phone?: string

  @ApiPropertyOptional({ example: 'Technology', description: 'Industry category' })
  @IsOptional()
  @IsString()
  industry?: string
}
```

### Update DTO
```ts
export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {}
// All fields become optional — PATCH semantics by default
```

### Query DTO (for list endpoints)
```ts
export class BusinessQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20

  @ApiPropertyOptional({ example: 'Acme' })
  @IsOptional()
  @IsString()
  search?: string

  @ApiPropertyOptional({ example: 'createdAt', enum: ['name', 'createdAt', 'email'] })
  @IsOptional()
  @IsString()
  sort?: string = 'createdAt'

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc' = 'desc'
}
```

## Custom Validators

Create reusable validators in `src/common/validators/`:

```ts
// validators/is-phone-number.validator.ts
import { registerDecorator, ValidationOptions } from 'class-validator'

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isPhoneNumber',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' && /^\+?[\d\s\-()]{7,20}$/.test(value)
        },
        defaultMessage: () => 'Invalid phone number format',
      },
    })
  }
}
```

```ts
// validators/is-password-strong.validator.ts
export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'string' &&
            value.length >= 8 &&
            /[A-Z]/.test(value) &&
            /[0-9]/.test(value) &&
            /[!@#$%^&*(),.?":{}|<>]/.test(value)
        },
        defaultMessage: () =>
          'Password must be at least 8 characters with 1 uppercase, 1 number, and 1 special character',
      },
    })
  }
}
```

## Validation Groups
Use for context-specific validation (e.g., different rules for business vs customer registration):

```ts
export class RegisterDto {
  @IsEmail()
  email: string

  @IsStrongPassword()
  password: string

  @IsOptional()
  @IsString()
  @ValidateIf(o => o.userType === 'BUSINESS')
  @IsNotEmpty({ groups: ['business'] })
  businessName?: string
}
```

## Type Transformation Decorators
- Use `@Type(() => Type)` from `class-transformer` for nested objects, arrays, and primitive conversions.
- Required when `enableImplicitConversion` is false.

```ts
export class CreateMembershipDto {
  @ApiProperty({ type: [String], example: ['feature1', 'feature2'] })
  @IsArray()
  @IsString({ each: true })
  @Type(() => String)
  features: string[]
}
```

## Common Validator Patterns

| Decorator | Use Case |
|-----------|----------|
| `@IsString()` | Text fields |
| `@IsEmail()` | Email addresses |
| `@IsInt()` | Integer IDs, page numbers |
| `@IsNumber()` | Prices, amounts |
| `@IsBoolean()` | Flags, toggle fields |
| `@IsArray()` | Lists of items |
| `@IsEnum()` | Enum validation |
| `@IsDateString()` | ISO date strings |
| `@IsUUID()` | UUID/CUID IDs |
| `@IsOptional()` | Nullable/optional fields |
| `@IsNotEmpty()` | Required non-empty strings |
| `@MinLength(n)` / `@MaxLength(n)` | String length bounds |
| `@Min(n)` / `@Max(n)` | Numeric bounds |
| `@Matches(regex)` | Custom format validation |
| `@ArrayMinSize(n)` / `@ArrayMaxSize(n)` | Array length bounds |

## Validation Rules
- Always validate at the controller boundary — never duplicate validation in services.
- Use DTOs for every request body and query parameters.
- `Create*Dto` fields are required by default (no `@IsOptional`).
- `Update*Dto` extends `PartialType(Create*Dto)` for PATCH semantics.
- Query DTOs every list endpoint — not inline `@Query('page') page = 1` patterns.
- Use `@Type(() => Number)` for query params since they arrive as strings.
- For nested objects in request bodies, define separate DTO classes and use `@ValidateNested()` + `@Type()`.
