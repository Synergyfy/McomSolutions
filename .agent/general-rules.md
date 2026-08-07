# General Coding Rules

## DRY (Don't Repeat Yourself)
- Extract shared logic into services, not utils files.
- Use Prisma's `select` / `include` consistently — define reusable field selections in a shared constants file (e.g. `prisma/selects.ts`) rather than inlining them in every query.
- Controller → Service → Repository pattern. Controllers never contain business logic.
- Shared DTOs and interfaces live in `src/common/` or `src/shared/`.
- Validate using `class-validator` DTOs once at the controller boundary, not again in services.

## Typing Rules
- Always use strict TypeScript. No `any` unless absolutely unavoidable (and then annotate with a comment explaining why).
- Define interfaces/types for every DTO, entity, and response shape.
- Use Prisma-generated types (`Prisma.UserCreateInput`, `User`, etc.) instead of duplicating type definitions.
- Use `Pick`, `Omit`, `Partial` from your DTOs rather than creating near-duplicate types.
- API responses should be wrapped in a standard envelope:

```ts
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}
```

## Naming Conventions
- **Files**: `kebab-case` — e.g. `user-profile.service.ts`
- **Classes**: `PascalCase`
- **Variables/Functions**: `camelCase`
- **Database columns**: `snake_case`
- **Prisma models**: `PascalCase` (Prisma default)
- **Routes**: plural nouns, kebab-case — e.g. `GET /api/v1/business-profiles`
- **DTOs**: suffix with `Dto` — e.g. `CreateUserDto`

## File & Folder Structure
- Each feature module gets its own folder under `src/`: `auth/`, `pricing/`, `payment/`, `business/`, etc.
- Each module folder contains: `*.controller.ts`, `*.service.ts`, `*.module.ts`, and optionally `dto/`, `guards/`, `strategies/`.

## Error Handling
- Use NestJS exception filters (`HttpException` subclasses) — never return raw error objects.
- Define a global exception filter in `src/common/filters/`.
- Business-logic exceptions belong in the service layer; throw `BadRequestException`, `NotFoundException`, etc.

## Imports
- Use barrel files (`index.ts`) per module for clean imports.
- Prefer relative imports within the same module; use `@/` path alias for cross-module imports.

## Testing
- Unit test services; e2e test controllers + full request/response cycles.
- Use `@nestjs/testing` `Test.createTestingModule`.
- Mock Prisma service in unit tests.
