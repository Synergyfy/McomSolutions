# Prisma Patterns & DB Indexing

## Schema Design Rules
- Every model gets `id`, `createdAt`, `updatedAt` (see `migration-rules.md`).
- Use `cuid()` for IDs — not auto-increment integers (better for distributed systems and security).
- Use native database types where possible: `DateTime` for timestamps, `Decimal` for money, `Json` for flexible metadata.
- Prefer `String` enums over `Int` enums for readability in the database.

## DB Indexing — Where & Why

### Always Index
```prisma
model Subscription {
  userId    String   @map("user_id")
  status    String   // BRONZE, SILVER, GOLD, PLATFORM
  expiresAt DateTime @map("expires_at")
  platform  String?  // null = membership; "REWARDS", "SPIN", etc. = platform package

  @@index([userId])                        // Foreign key lookups
  @@index([status])                        // Filtering by status
  @@index([expiresAt])                     // Expiry/cron queries
  @@index([userId, status])               // Composite: user's active subscriptions
  @@index([platform, status, expiresAt])   // Composite: bulk expiry checks per platform
  @@map("subscriptions")
}
```

### Composite Index Rules
- Order columns by cardinality (most selective first) for equality filters.
- Add sort columns at the end for `ORDER BY`.
- Example: `@@index([status, expiresAt])` — good for `WHERE status = 'ACTIVE' ORDER BY expiresAt ASC`.

### When Not to Index
- Small tables (< 1000 rows that stay small).
- Columns rarely used in `WHERE`, `JOIN`, or `ORDER BY`.
- Columns with very low cardinality like boolean flags (unless combined with other columns).
- Over-indexing slows writes — each index adds insert/update overhead.

## Transactions

### Sequential Operations

```ts
await prisma.$transaction(async (tx) => {
  const subscription = await tx.subscription.create({ data: { ... } })
  await tx.invoice.create({ data: { subscriptionId: subscription.id, ... } })
  await tx.notification.create({ data: { userId: subscription.userId, ... } })
})
```

### Interactive Transactions (for conditional logic)

```ts
await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } })
  if (user.tier !== 'PLATINUM') {
    throw new BadRequestException('Upgrade not allowed')
  }
  await tx.subscription.update({ where: { userId }, data: { tier: 'PLATINUM' } })
})
```

### Batch Transactions
```ts
const [updated, created] = await prisma.$transaction([
  prisma.subscription.updateMany({
    where: { expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  }),
  prisma.auditLog.create({ data: { action: 'BATCH_EXPIRE', ... } }),
])
```

## Soft Deletes (Global Middleware)

```ts
// prisma/prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn']
        : ['warn'],
    })

    this.$use(async (params, next) => {
      const softDeleteModels = ['user', 'business', 'subscription']
      if (softDeleteModels.includes(params.model ?? '') &&
          ['findMany', 'findFirst', 'findUnique'].includes(params.action)) {
        params.args.where = { ...params.args.where, deletedAt: null }
      }
      if (params.action === 'findUnique') {
        params.action = 'findFirst'
      }
      return next(params)
    })
  }

  async onModuleInit() {
    await this.$connect()
  }
}
```

## Reusable Query Fragments

Define common `select` / `include` objects in `src/prisma/selects.ts`:

```ts
export const userWithProfile = {
  id: true,
  email: true,
  profile: {
    select: { name: true, avatar: true, phone: true },
  },
} satisfies Prisma.UserSelect

export const businessWithOwner = {
  id: true,
  name: true,
  email: true,
  user: { select: { id: true, email: true } },
  memberships: { select: { tier: true, status: true, expiresAt: true } },
} satisfies Prisma.BusinessSelect
```

## Raw Queries (When Needed)
- Prefer Prisma's typed API for 95% of queries.
- Use raw queries only for: complex aggregations, window functions, full-text search, CTEs.

```ts
const results = await prisma.$queryRaw<Array<{ id: string; total: number }>>`
  SELECT b.id, COUNT(s.id) as total
  FROM businesses b
  JOIN subscriptions s ON s.business_id = b.id
  WHERE s.status = 'ACTIVE'
  GROUP BY b.id
  HAVING COUNT(s.id) > 5
`
```

## Connection Management
- Use a single `PrismaClient` instance — don't create new instances per request.
- Already handled by `PrismaService` (singleton module).
- Configure connection pool size in `DATABASE_URL`:
  ```
  DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10"
  ```

## Prisma Client Extensions (v6+)
Use extensions for cross-cutting concerns instead of middleware where possible:

```ts
export const prisma = new PrismaClient()

const xprisma = prisma.$extends({
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`
        },
      },
    },
  },
  query: {
    user: {
      async findFirst({ args, query }) {
        args.where = { ...args.where, deletedAt: null }
        return query(args)
      },
    },
  },
})
```

## Common Query Patterns

### Upsert (create or update)
```ts
await prisma.businessProfile.upsert({
  where: { userId },
  create: { userId, name, email, ...rest },
  update: { name, email, ...rest },
})
```

### Paginated List with Count
```ts
const [items, total] = await Promise.all([
  prisma.business.findMany({ skip, take, where, orderBy, include }),
  prisma.business.count({ where }),
])
```

### Check Existence Only
```ts
const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
if (exists) throw new ConflictException('Email already registered')
```

## Migration Safety
- `prisma migrate dev` in development — generates migration file and applies.
- `prisma migrate deploy` in CI/production — applies pending migrations without resetting.
- Never use `prisma db push` in production (it's for prototyping only).
