# API Conventions

## Base URL
- All endpoints are prefixed with `/api/v1/`.
- Version is set via NestJS global prefix:

```ts
app.setGlobalPrefix('api/v1')
```

## HTTP Methods & Semantics

| Method | Purpose | Body | Idempotent |
|--------|---------|------|------------|
| `GET` | Retrieve resource(s) | No | Yes |
| `POST` | Create resource / trigger action | Yes | No |
| `PUT` | Full replacement of resource | Yes | Yes |
| `PATCH` | Partial update of resource | Yes | No |
| `DELETE` | Remove resource | Optional | Yes |

## URL Naming
- **Plural nouns** for collection resources: `GET /api/v1/businesses`, `POST /api/v1/memberships`
- **Nested routes** for sub-resources: `GET /api/v1/users/:userId/subscriptions`
- **Actions** as verbs only when not CRUD: `POST /api/v1/auth/login`, `POST /api/v1/notifications/:id/read`
- **kebab-case**: `POST /api/v1/business-profiles` not `businessProfiles`

## Response Envelope

### Success (Single)
```json
{
  "success": true,
  "data": { "id": "abc123", "name": "Acme Corp", "email": "acme@example.com" },
  "message": "Business created successfully"
}
```

### Success (List)
```json
{
  "success": true,
  "data": [
    { "id": "abc123", "name": "Acme Corp" },
    { "id": "def456", "name": "Beta Inc" }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Error
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "errors": ["email must be a valid email"],
  "timestamp": "2026-07-12T17:00:00.000Z",
  "path": "/api/v1/auth/register"
}
```

## Standard Query Parameters for List Endpoints

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number (offset pagination) |
| `limit` | int | 20 | Items per page (max 100) |
| `cursor` | string | — | Cursor ID (cursor pagination) |
| `sort` | string | `createdAt` | Sort field |
| `order` | `asc`/`desc` | `desc` | Sort direction |
| `search` | string | — | Search term for text fields |

```ts
// Example: GET /api/v1/businesses?page=1&limit=20&sort=name&order=asc&search=Acme
```

## Controller Patterns

```ts
@ApiTags('Businesses')
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new business profile' })
  @ApiCreatedResponse({ type: BusinessResponseDto })
  create(@Body() dto: CreateBusinessDto): Promise<BusinessResponseDto> {
    return this.businessService.create(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all businesses' })
  @ApiOkResponse({ type: PaginatedBusinessResponseDto })
  findAll(@Query() query: BusinessQueryDto): Promise<PaginatedBusinessResponseDto> {
    return this.businessService.findAll(query)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a business by ID' })
  @ApiOkResponse({ type: BusinessResponseDto })
  @ApiNotFoundResponse()
  findOne(@Param('id') id: string): Promise<BusinessResponseDto> {
    return this.businessService.findOne(id)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a business profile' })
  @ApiOkResponse({ type: BusinessResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateBusinessDto): Promise<BusinessResponseDto> {
    return this.businessService.update(id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BUSINESS_OWNER)
  @ApiOperation({ summary: 'Soft-delete a business' })
  @ApiNoContentResponse()
  async remove(@Param('id') id: string): Promise<void> {
    await this.businessService.remove(id)
  }
}
```

## Additional Conventions
- `GET /:id` returns 404 if not found — never return 200 with null data.
- `DELETE` returns `204 No Content` on success — no body.
- `POST` returns `201 Created` with the created resource body.
- `PATCH` returns `200 OK` with the updated resource body.
- Paginated `GET` lists always return `total`, `page`, `limit`, `totalPages` in the envelope.
- Use `@ApiBearerAuth()` on all protected routes.
- Never expose internal IDs (auto-increment) — use CUIDs/UUIDs in URLs.
