# Rep Tracker — Documentation

Rep Tracker is a personal fitness tracker for logging bodyweight workouts. The app is built for single-user daily use on mobile, with a focus on fast interaction and a clean UI.

**Live app:** https://rep-tracker-ten.vercel.app
**Repository:** https://github.com/RodrigoPita/rep-tracker

---

## Index

| Document | Description |
|----------|-------------|
| [architecture.md](architecture.md) | Server/client pattern, auth flow, data flow, key conventions |
| [database.md](database.md) | Full schema, all tables and columns, migration history |
| [improvements.md](improvements.md) | Feature backlog with status and priority |

---

## App at a Glance

### Routes

| Route | Description |
|-------|-------------|
| `/` | Home — pick a routine and start or resume a session |
| `/workout/[sessionId]` | Active workout checklist |
| `/routines` | List of active and archived routines |
| `/routines/new` | Create a new routine |
| `/routines/[id]/edit` | Edit an existing routine |
| `/calendar` | Monthly calendar with workout history |
| `/dashboard` | Stats, charts, streak, and achievements shelf |
| `/library` | Exercise class browser (admin: add/remove classes and variants) |
| `/achievements` | Full achievements list with progress |
| `/login` | Google OAuth login |

### Core Concepts

**Exercise class → exercise → routine exercise**
An *exercise class* is a movement category (e.g. Flexão). An *exercise* is a specific variant within that class (e.g. Diamante). A *routine exercise* assigns an exercise to a routine with a set/rep target and display order.

**Routine → session → set**
A *routine* is a reusable workout plan. Starting a routine creates a *workout session* for today. Each set completed within that session is stored as a *workout set*.

**Routine period**
An optional goal attached to a routine: complete N sessions before archiving it. Progress is tracked against this target on the home page and dashboard.

**Timed exercises**
Exercise classes can be flagged as `is_timed`. For timed exercises, `actual_reps` stores elapsed seconds; the workout UI shows a countdown instead of a rep counter.

**Soft deletes**
`routine_exercises` are never hard-deleted — instead `deleted_at` is set. This preserves the exercise name in the calendar history even after a routine is edited.

---

## Stack Summary

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Drag & drop | @dnd-kit |
| Toasts | Sonner |
| Theming | next-themes |
| Deployment | Vercel (`gru1` — São Paulo) |
