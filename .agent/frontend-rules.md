# Frontend Rules

Stack: React 19 + Vite + TypeScript + Tailwind CSS v4 + React Router v7 + TanStack React Query v5 + Zustand v5 + Axios

## Component Architecture
- **Pages** go in `src/pages/` — one file per route.
- **Shared components** go in `src/components/` — grouped by domain (e.g. `components/ui/`, `components/auth/`).
- **One component per file** — default export.
- Components are **pure functions** (no class components).
- Keep components small — if a component exceeds ~150 lines, extract sub-components.

```tsx
// ✅ Good
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoginForm />
    </div>
  )
}
```

## Styling
- Use Tailwind CSS v4 exclusively — no CSS modules, no styled-components.
- Use `clsx` / `tailwind-merge` (`cn` utility) for conditional classes.
- Extract repeated class combinations into reusable components, not CSS.
- Use `motion` (framer-motion) for animations — declared inline, not in separate files.

```tsx
import { cn } from '@/lib/utils'

function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700',
        className
      )}
      {...props}
    />
  )
}
```

## State Management

### Zustand (Global State)
- Use for: auth state, current user, UI toggles (sidebar, modals).
- Keep stores atomic — separate stores for auth, UI, etc.
- No derived state in stores — compute in components or selectors.

```ts
// stores/auth-store.ts
import { create } from 'zustand'

interface AuthState {
  user: User | null
  token: string | null
  login: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}))
```

### TanStack React Query (Server State)
- **All** server data fetching goes through React Query — no raw `useEffect` + `fetch`.
- Define query keys as constants in `src/lib/query-keys.ts`.
- Use query factories to keep keys consistent.

```ts
// lib/query-keys.ts
export const queryKeys = {
  memberships: {
    all: ['memberships'] as const,
    byId: (id: string) => ['memberships', id] as const,
  },
  businesses: {
    all: ['businesses'] as const,
    list: (filters: BusinessFilters) => ['businesses', 'list', filters] as const,
  },
}
```

```ts
// hooks/use-memberships.ts
export function useMemberships() {
  return useQuery({
    queryKey: queryKeys.memberships.all,
    queryFn: () => api.get<Membership[]>('/memberships'),
  })
}
```

- Mutations use `useMutation` with optimistic updates where appropriate.
- Always invalidate related queries on mutation success.

```ts
const mutation = useMutation({
  mutationFn: (data: CreateBusinessDto) => api.post('/businesses', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.businesses.all })
  },
})
```

## Routing (React Router v7)
- Define routes in `src/router.tsx` using the new route object API.
- Lazy-load pages with `React.lazy` and `Suspense`.
- Protect authenticated routes with a `<ProtectedRoute>` wrapper component.

```tsx
const routes = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      {
        path: 'dashboard',
        element: <ProtectedRoute />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'membership', element: <MembershipPage /> },
        ],
      },
    ],
  },
]
```

## API Layer (Axios)
- Single Axios instance configured in `src/lib/axios.ts`.
- Base URL from env variable (`VITE_API_URL`).
- Attach `Authorization` header via interceptor (read from Zustand store).
- Handle 401 responses globally — auto-redirect to login.

```ts
// lib/axios.ts
import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
```

## Naming
- **Files**: `kebab-case` — `login-form.tsx`, `use-memberships.ts`
- **Components**: `PascalCase`
- **Hooks**: `camelCase` with `use` prefix
- **Functions**: `camelCase`
- **CSS classes**: Tailwind utility classes only (no custom CSS class names)

## Folder Structure
```
src/
├── components/
│   ├── ui/          # Button, Input, Card, Modal, etc.
│   ├── auth/        # LoginForm, RegisterForm
│   ├── membership/  # MembershipCard, PricingTable
│   └── layout/      # Header, Sidebar, Footer
├── hooks/           # use-memberships.ts, use-businesses.ts
├── lib/             # axios.ts, query-keys.ts, utils.ts
├── pages/           # login.tsx, dashboard.tsx
├── stores/          # auth-store.ts, ui-store.ts
├── types/           # api.ts, user.ts, membership.ts
├── router.tsx
└── main.tsx
```

## Performance
- Use `React.memo` sparingly — only on expensive re-renders with visible lag.
- Avoid inline arrow functions in JSX props for frequently re-rendered lists.
- Use `useCallback` / `useMemo` only for referential stability in dependency arrays.
- Lazy-load route pages and heavy components (charts, tables).

## Environment Variables
- All frontend env vars prefixed with `VITE_`.
- Define types for env vars in `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}
```
