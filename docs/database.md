# Database

Supabase (PostgreSQL) hosted in São Paulo (`gru1`). Row Level Security is enabled on all tables; every policy scopes data to `auth.uid() = user_id`.

Migrations live in `supabase/migrations/` and are applied in order.

---

## Tables

### `exercise_classes`

Top-level exercise categories shared across all users (e.g. Flexão, Barra).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | unique |
| `is_timed` | boolean | default `false`; timed exercises use seconds instead of reps |
| `created_at` | timestamptz | |

RLS: public read; insert restricted to admin via policy.

---

### `exercises`

Specific variants within a class (e.g. class=Flexão, variant=Diamante).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `class_id` | uuid FK | → `exercise_classes.id` |
| `variant` | text | |
| `created_at` | timestamptz | |

Unique constraint: `(class_id, variant)`.
RLS: public read; insert restricted to admin.

---

### `routines`

Named workout plans created by the user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `auth.users.id` |
| `name` | text | |
| `archived_at` | timestamptz | null = active; set to archive instead of deleting |
| `created_at` | timestamptz | |

---

### `routine_exercises`

Exercises assigned to a routine with targets and display order.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `routine_id` | uuid FK | → `routines.id` |
| `exercise_id` | uuid FK | → `exercises.id` |
| `sets` | int | default 3 |
| `target_reps` | int | default 10 |
| `target_seconds` | int | nullable; used when `exercise_classes.is_timed = true` |
| `rest_seconds` | int | nullable; rest duration after each set |
| `display_order` | int | default 0 |
| `deleted_at` | timestamptz | nullable; soft-delete — never hard-delete this table |

**Important:** rows are soft-deleted by setting `deleted_at`. Active queries filter `.is('deleted_at', null)`. This preserves the FK from `workout_sets` so exercise names remain visible in the calendar history.

---

### `routine_periods`

Optional session-count goal for a routine.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `routine_id` | uuid FK | → `routines.id` |
| `user_id` | uuid FK | → `auth.users.id` |
| `target_sessions` | int | target number of sessions to complete |
| `started_at` | timestamptz | |
| `completed_at` | timestamptz | null until the period is finished |
| `created_at` | timestamptz | |

---

### `workout_sessions`

A single training session linking a routine to a date.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `auth.users.id` |
| `routine_id` | uuid FK | → `routines.id` |
| `date` | date | stored in UTC-3 (BRT); use `todayBRT()` when inserting |
| `completed_at` | timestamptz | null while in progress; set on "Finalizar treino" |
| `created_at` | timestamptz | |

---

### `workout_sets`

One row per set performed in a session.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | uuid FK | → `workout_sessions.id` |
| `routine_exercise_id` | uuid FK nullable | → `routine_exercises.id` ON DELETE SET NULL |
| `set_number` | int | 1-based index within the exercise group |
| `target_reps` | int | snapshot of the target at session creation time |
| `actual_reps` | int | nullable; stores elapsed seconds for timed exercises |
| `weight_kg` | numeric | nullable; optional per-set weight |
| `completed` | boolean | default false |
| `started_at` | timestamptz | set when the user begins the set |
| `completed_at` | timestamptz | set when the set is marked done |
| `rest_ended_at` | timestamptz | set when the rest timer is dismissed |

`routine_exercise_id` is nullable and set to NULL on delete (not cascade) to preserve history if a `routine_exercise` row is removed. In practice `routine_exercises` are soft-deleted so this should not occur.

---

### `user_achievements`

Earned achievement badges for the user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `user_id` | uuid FK | → `auth.users.id` ON DELETE CASCADE |
| `achievement_key` | text | type identifier (e.g. `exercise_sessions_500`) — see `src/lib/achievements.ts` |
| `achievement_id` | text | unique instance ID; for exercise milestones: `<key>:<class_uuid>`; for global: same as key |
| `metadata` | jsonb | display data (e.g. `{ exercise_name: "Flexão", max_streak: "7" }`) |
| `earned_at` | timestamptz | default `now()` |
| `created_at` | timestamptz | |

Unique constraint: `(user_id, achievement_id)` — prevents duplicates on concurrent checks.

---

## Migrations

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: exercise_classes, exercises, routines, routine_exercises, workout_sessions, workout_sets. Seeds 10 exercise classes and 41 variants. |
| `002_add_auth.sql` | Adds `user_id` to routines and workout_sessions. Enables RLS on all tables with user-scoped policies. |
| `003_add_weight.sql` | Adds `weight_kg` (numeric, nullable) to workout_sets. |
| `004_routine_periods.sql` | Creates routine_periods table for session-count goals. |
| `005_exercise_admin.sql` | Adds `is_timed` to exercise_classes. Adds admin-only insert policies for exercise_classes and exercises. |
| `006_time_tracking.sql` | Adds `started_at`, `completed_at`, `rest_ended_at` to workout_sets. |
| `007_timed_exercises.sql` | Adds `target_seconds` and `rest_seconds` to routine_exercises. |
| `008_preserve_workout_history.sql` | Changes `routine_exercise_id` FK in workout_sets to ON DELETE SET NULL (was CASCADE). |
| `009_soft_delete_routine_exercises.sql` | Adds `deleted_at` (timestamptz, nullable) to routine_exercises. |
| `010_achievements.sql` | Creates user_achievements table with RLS. |

---

## RLS Summary

| Table | Read | Write |
|-------|------|-------|
| `exercise_classes` | public | admin only |
| `exercises` | public | admin only |
| `routines` | own rows | own rows |
| `routine_exercises` | via routine ownership | via routine ownership |
| `routine_periods` | own rows | own rows |
| `workout_sessions` | own rows | own rows |
| `workout_sets` | via session ownership | via session ownership |
| `user_achievements` | own rows | own rows (insert only) |
