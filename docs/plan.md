# rep-tracker — Plan of Action

## Overview

A minimalistic fitness tracker web app for logging workout sets, tracking reps, and analyzing progress over time.

## Tech Stack

| Layer       | Choice                          |
|-------------|----------------------------------|
| Framework   | Next.js 15 (App Router)          |
| Language    | TypeScript                       |
| Database    | Supabase (PostgreSQL)            |
| Auth        | None yet (single-user prototype) |
| Styling     | Tailwind CSS + shadcn/ui         |
| Charts      | Recharts                         |
| Deployment  | Vercel                           |

---

## Database Schema

### `exercises`
Global pool of exercise names (e.g. "Push-ups", "Pull-ups").

| Column       | Type      | Notes                  |
|--------------|-----------|------------------------|
| id           | uuid PK   | auto-generated         |
| name         | text      | unique                 |
| created_at   | timestamp |                        |

### `routines`
Named workout routines created by the user.

| Column       | Type      | Notes                        |
|--------------|-----------|------------------------------|
| id           | uuid PK   |                              |
| name         | text      | e.g. "Push Day", "Pull Day"  |
| created_at   | timestamp |                              |
| *user_id*    | *uuid FK* | *reserved for multi-user*    |

### `routine_exercises`
Exercises assigned to a routine, with target sets/reps and display order.

| Column          | Type    | Notes                            |
|-----------------|---------|----------------------------------|
| id              | uuid PK |                                  |
| routine_id      | uuid FK |                                  |
| exercise_id     | uuid FK |                                  |
| sets            | int     | number of sets                   |
| target_reps     | int     | target reps per set              |
| display_order   | int     | order shown in the routine       |

### `workout_sessions`
A single training session — links a routine to a date.

| Column       | Type      | Notes                        |
|--------------|-----------|------------------------------|
| id           | uuid PK   |                              |
| routine_id   | uuid FK   |                              |
| date         | date      |                              |
| completed_at | timestamp | null if still in progress    |
| created_at   | timestamp |                              |
| *user_id*    | *uuid FK* | *reserved for multi-user*    |

### `workout_sets`
One row per set performed in a session.

| Column               | Type      | Notes                                    |
|----------------------|-----------|------------------------------------------|
| id                   | uuid PK   |                                          |
| session_id           | uuid FK   |                                          |
| routine_exercise_id  | uuid FK   |                                          |
| set_number           | int       | 1-based index within the exercise        |
| target_reps          | int       | snapshot of target at time of workout    |
| actual_reps          | int       | null until logged                        |
| completed            | boolean   | default false                            |
| completed_at         | timestamp | null until completed                     |

---

## Pages & Routes

| Route                     | Description                                              |
|---------------------------|----------------------------------------------------------|
| `/`                       | Home — pick today's routine and start/resume a session   |
| `/workout/[sessionId]`    | Active workout checklist (sets grouped by exercise)      |
| `/routines`               | List all routines                                        |
| `/routines/new`           | Create a new routine                                     |
| `/routines/[id]/edit`     | Edit an existing routine                                 |
| `/analytics`              | Dashboard — per-exercise charts and stats                |

---

## Feature Breakdown

### Routine Builder (`/routines/new`, `/routines/[id]/edit`)
- Name the routine
- Search/select exercises from the global pool (or create a new exercise inline)
- Set number of sets and target reps per exercise
- Reorder exercises via drag-and-drop (or up/down buttons)

### Workout Checklist (`/workout/[sessionId]`)
- Sets grouped by exercise, displayed in routine order
- Each set row shows target reps and a "complete" button
- Tapping complete logs `actual_reps = target_reps`
- User can override and type a different rep count
- Progress bar at the top (X of Y sets completed)
- "Finish workout" button marks session as complete

### Analytics Dashboard (`/analytics`)
- Exercise selector
- Charts per exercise:
  - Total volume over time (reps × sets per session)
  - Average reps per set over time
  - Personal best (highest single-set rep count)
- Summary cards: total sessions, most trained exercise, current streak

---

## TODO (Future Improvements)

- [ ] Multi-user support via Supabase Auth (email/password or OAuth)
- [ ] Weight tracking per set (`actual_weight`, `target_weight` columns)
- [ ] Rest timer between sets
- [ ] Push notifications / reminders
- [ ] Routine templates / sharing
- [ ] Mobile PWA support

---

## Project Setup Steps

1. Create Supabase project at [supabase.com](https://supabase.com)
2. Run schema migrations (SQL in `supabase/migrations/`)
3. Copy `.env.local.example` to `.env.local` and fill in Supabase keys
4. `npm install` → `npm run dev`
5. Deploy to Vercel — add env vars in Vercel dashboard

---

## Folder Structure (planned)

```
rep-tracker/
├── docs/                   # Project documentation
├── supabase/
│   └── migrations/         # SQL migration files
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── page.tsx        # Home
│   │   ├── workout/
│   │   ├── routines/
│   │   └── analytics/
│   ├── components/         # Shared UI components
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client
│   │   └── types.ts        # Generated + custom types
│   └── hooks/              # Custom React hooks
├── .env.local.example
└── README.md
```
