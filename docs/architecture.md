# Architecture

## Server vs. Client Components

The project follows the Next.js App Router pattern strictly: **server components fetch data, client components handle interaction.**

```
page.tsx  (server component)
  │  async/await — queries Supabase directly
  │  passes typed props down
  └─► *Client.tsx  (client component, 'use client')
        useState / useEffect / event handlers
        direct Supabase mutations (browser client)
```

Every page in `src/app/` is a server component by default. The paired `*Client.tsx` in `src/components/` handles everything interactive. This keeps all data fetching on the server (no loading spinners on first visit) while preserving reactivity where needed.

**Examples:**
- `app/dashboard/page.tsx` fetches 5 queries in `Promise.all`, computes aggregations, passes results to `DashboardClient.tsx`
- `app/routines/[id]/edit/page.tsx` fetches the routine and all exercises, passes to `RoutineForm.tsx`
- `components/NavBar.tsx` is a server component that fetches the user; `NavClient.tsx` handles logout and the theme toggle

**`ThemeProvider` and `SonnerToaster`** are tiny `'use client'` wrappers that must exist as separate files because the root layout is a server component and cannot use React hooks directly.

---

## Authentication Flow

```
Every request
  └─► src/middleware.ts
        │  createServerClient (reads session cookie)
        │  supabase.auth.getUser()
        ├─ not authenticated → redirect to /login
        ├─ authenticated + on /login → redirect to /
        └─ pass through (refresh session cookie)

/login page
  └─► LoginClient.tsx
        supabase.auth.signInWithOAuth({ provider: 'google' })
        → redirects to Google → returns to /auth/callback

/auth/callback/route.ts
  └─► exchanges OAuth code for session via exchangeCodeForSession()
      → sets session cookie → redirects to /
```

The session lives in cookies managed by `@supabase/ssr`. Middleware refreshes the session on every request so it never expires mid-use. The `supabaseServer()` factory reads those cookies; the browser client (`supabase.ts`) reads them automatically.

**Admin role:** There is no roles table. The `ADMIN_USER_ID` environment variable holds the UUID of the admin user. Components check `user.id === process.env.ADMIN_USER_ID` server-side. Admin-only UI (exercise library management) is hidden for all other users.

---

## Supabase Clients

### Browser client — `src/lib/supabase.ts`

```ts
const supabase = createBrowserClient(url, anonKey)
export { supabase }
```

A singleton used in all `'use client'` components for mutations (insert, update). Exported as a named singleton — import it directly, never instantiate it yourself.

### Server client — `src/lib/supabase-server.ts`

```ts
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, { cookies: { ... } })
}
```

Called at the top of every server component page. Returns a fresh client with the current request's cookies. Cookie *writes* are swallowed in server components (middleware owns session refresh); only cookie *reads* matter here.

---

## Data Flow

### Reading (server side)

All queries run in the server component before the page HTML is sent. Multiple independent queries are always parallelised with `Promise.all`.

```ts
const [{ data: sessions }, { data: periods }, { data: sets }] = await Promise.all([
  db.from('workout_sessions').select(...),
  db.from('routine_periods').select(...),
  db.from('workout_sets').select(...),
])
```

Computed values (aggregations, streak, weekly chart data) are derived server-side and passed as plain props to the client component. The client component is pure UI — no fetching.

### Writing (client side)

Mutations happen directly from client components using the browser Supabase client:

```ts
const { error } = await supabase.from('workout_sets').update({ completed: true }).eq('id', id)
if (error) { toast.error('Erro ao salvar.'); return }
```

Optimistic state updates are applied before the network call; on error the state is rolled back and a toast is shown via Sonner.

**Server actions** are used only where a mutation needs server-side logic: `src/app/actions/achievements.ts` runs after a workout is finished to check and unlock achievements, because it needs to query multiple tables and insert rows atomically.

---

## Key Conventions

### Dates and timezone

All session dates are stored as `date` (not `timestamptz`) in UTC-3 (Brazil Standard Time). Always use `todayBRT()` from `src/lib/utils.ts` instead of `new Date().toISOString().split('T')[0]` — the latter would give the wrong date after 9 PM in Brazil.

```ts
import { todayBRT } from '@/lib/utils'
const today = todayBRT() // "2026-03-24"
```

### Exercise display label

`exerciseLabel()` in `src/lib/types.ts` formats an exercise as `"Flexão — Diamante"`. Use it everywhere an exercise name is displayed to the user.

### Accent-insensitive search

`normalize()` in `src/lib/utils.ts` strips diacritics and lowercases a string. Use it on both sides of any search comparison so "flexao" matches "Flexão".

### Streak utilities

`computeCurrentStreak(dates)` — consecutive days ending today (used on the dashboard).
`computeMaxStreak(dates)` — best streak ever (used in achievement checks).
Both are in `src/lib/utils.ts` and expect an array of `YYYY-MM-DD` strings.

### Soft deletes on routine exercises

Never call `.delete()` on `routine_exercises`. Set `deleted_at = now()` instead. The history of completed sets must remain intact in the calendar even after a routine is edited. Queries that build the active routine editor filter `.is('deleted_at', null)`.

### Timed exercises

`exercise_classes.is_timed = true` means the exercise is measured in seconds rather than reps. In `workout_sets`, `actual_reps` stores elapsed seconds for timed sets. In `routine_exercises`, `target_seconds` holds the target duration (used in place of `target_reps`).

---

## Loading States

Every route has a `loading.tsx` file that renders a `PageSkeleton` immediately while the server component fetches data. This makes navigation feel instant — the skeleton appears in under 50 ms, then the real content replaces it when ready.

The client-side router cache is configured with `staleTimes.dynamic = 30` in `next.config.ts`. Pages visited in the last 30 seconds are served from cache without a server round-trip, making back-navigation instant.

---

## CI / Deployment

- **Branch strategy:** `feat/<name>` off `main`; PRs require CI to pass before merge
- **CI:** GitHub Actions (`.github/workflows/ci.yml`) runs `npm run build` on every PR to `main`
- **Vercel:** auto-deploys `main` on merge; `preferredRegion = 'gru1'` (set in `src/app/layout.tsx`) co-locates functions with the Supabase database in São Paulo
- **Secrets required in GitHub Actions:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Secrets required in Vercel:** same as above, plus `ADMIN_USER_ID`
