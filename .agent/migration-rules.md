# Prisma Migration Rules

## Creating Migrations
- Always run `npx prisma migrate dev --name <descriptive-name>` after schema changes.
- Migration names should describe the change: e.g. `add_business_phone_field`, `create_subscriptions_table`.
- Review the generated SQL in `prisma/migrations/<id>_<name>/migration.sql` before applying.
- Never edit migration files after they've been applied to a shared environment.

## Schema Conventions
- Every model must have:
  - `id String @id @default(cuid())`
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
- Use `snake_case` for column names via `@map`.
- Use `@@map("table_name")` for table names.
- Add `@@index()` for frequently queried foreign keys and composite lookups.

```prisma
model Business {
  id        String   @id @default(cuid())
  name      String   @map("name")
  email     String?  @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  memberships Membership[]

  @@index([email])
  @@map("businesses")
}
```

## Deploying Migrations
- Production: `npx prisma migrate deploy` (safe, applies pending migrations only).
- Staging/Dev: `npx prisma migrate dev` (allows reset).
- Never use `prisma db push` in production — it skips migration history.

## Seeding
- Use `prisma/seed.ts` for development seed data.
- Run with `npx prisma db seed`.
- Keep seeds idempotent (use `upsert` where possible).

## Rolling Back
- Prisma doesn't support "rollback" natively.
- To revert: create a new migration that reverses the schema change (add back removed fields, drop added columns).
- Never delete a migration file that has been applied to a shared DB — it will break the migration history chain.

## Soft Deletes
- Use `deletedAt DateTime?` nullable field instead of hard deletes.
- Add `@map("deleted_at")`.
- All queries should filter `WHERE deleted_at IS NULL` unless explicitly querying trashed records.
- Consider a global query middleware in `PrismaService` to automatically filter soft-deleted records.

```ts
prisma.$use(async (params, next) => {
  if (params.model && params.action.startsWith('find')) {
    params.args.where = { ...params.args.where, deletedAt: null }
  }
  return next(params)
})
```

## Schema Validation
- Use `@default`, `@unique`, and `@relation` constraints at the schema level — don't rely on application code alone.
- Use enums for fixed sets of values (e.g. membership tier, subscription status).
