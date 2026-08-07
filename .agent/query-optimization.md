# Query Optimization & Caching

## Avoid N+1 Queries

### ❌ Bad (N+1)
```ts
const users = await prisma.user.findMany()
for (const user of users) {
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
  // N queries — one per user
}
```

### ✅ Good (eager loading with `include`)
```ts
const users = await prisma.user.findMany({
  include: { profile: true, memberships: true }
})
```

### ✅ Better (select only what you need)
```ts
const users = await prisma.user.findMany({
  select: {
    id: true,
    email: true,
    profile: { select: { name: true, avatar: true } },
  }
})
```

### ✅ Best for batch lookups (use `in` clause)
```ts
const userIds = [1, 2, 3, ...]
const profiles = await prisma.profile.findMany({
  where: { userId: { in: userIds } }
})
// Then join in application memory — O(1) map lookup
const profileMap = new Map(profiles.map(p => [p.userId, p]))
```

## Pagination
- Always paginate list endpoints — never return unbounded result sets.
- Use cursor-based pagination for large, real-time datasets (feed, notifications).
- Use offset-based pagination for admin tables and stable datasets.

```ts
// Cursor-based
const messages = await prisma.message.findMany({
  take: 20,
  cursor: cursor ? { id: cursor } : undefined,
  skip: cursor ? 1 : 0, // skip the cursor itself
  orderBy: { createdAt: 'desc' },
  where: { userId },
})
```

```ts
// Offset-based
const [data, total] = await Promise.all([
  prisma.business.findMany({
    skip: (page - 1) * limit,
    take: limit,
    where: { name: { contains: search, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  }),
  prisma.business.count({ where: { name: { contains: search, mode: 'insensitive' } } }),
])
```

## Indexing
- Add `@@index()` on foreign keys, frequently filtered columns, and sort columns.
- Add composite indexes for multi-column filters.

```prisma
model Subscription {
  userId     String   @map("user_id")
  status     String
  expiresAt  DateTime @map("expires_at")

  @@index([userId, status])
  @@index([status, expiresAt])
}
```

## Caching Strategy
- Use **in-memory caching** (Node `Map` or `node-cache`) for infrequently changing reference data (pricing tiers, membership benefits).
- Use **distributed caching** (Redis via `@nestjs/bull` or `ioredis`) for session data, rate limits, and frequently accessed computed data.
- Cache API responses with TTL-based invalidation:
  - Membership tiers: cache for 1 hour
  - User profile: cache for 5 minutes
  - Auth tokens: never cache
- Use **NestJS interceptors** for declarative caching:

```ts
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const key = this.generateKey(context)
    const cached = await this.cache.get(key)
    if (cached) return of(cached)

    return next.handle().pipe(
      tap(response => this.cache.set(key, response, ttl)),
    )
  }
}
```

## Batch Operations
- Use `createMany`, `updateMany`, `deleteMany` instead of looping individual operations.
- Wrap batch operations in a transaction (`$transaction`) for atomicity.

```ts
await prisma.$transaction([
  prisma.subscription.updateMany({ where: { expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } }),
  prisma.notification.createMany({ data: notifications }),
])
```

## Query Logging & Monitoring
- Enable Prisma query logging in development: `log: ['query', 'info', 'warn']`
- Use `PrismaMiddleware` to log slow queries (>100ms) in production.
- Monitor query performance with Prisma's built-in event system.

```ts
prisma.$on('query', (e) => {
  if (e.duration > 100) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`)
  }
})
```

## Read vs Write Separation
- For high-traffic endpoints, consider read replicas.
- Configure Prisma to route read queries to replicas and writes to the primary.
```ts
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL_PRIMARY },
  },
  replicas: [
    { url: process.env.DATABASE_URL_REPLICA_1 },
    { url: process.env.DATABASE_URL_REPLICA_2 },
  ],
})
```
