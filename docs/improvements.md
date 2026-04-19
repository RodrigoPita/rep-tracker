# Rep Tracker — Improvements Backlog

## 1. Navigation & Layout
- Make the nav a two-level layout: **Rep Tracker** logo in a top header, then **Home / Routines / Analytics** as a tab bar below it
- Highlight the active tab (bold + underline or indicator) using `usePathname()`
- Consider a bottom tab bar on mobile instead of a top nav (more thumb-friendly)

---

## 2. Performance — Server Components & SSR
- All pages are currently `'use client'` and fetch after mount, causing a blank flash + round-trip delay on every load
- Move initial data fetching to **server components** (no `'use client'`, use `async/await` directly in the page) so data arrives with the HTML
- Keep only interactive parts (event handlers, state) as client components
- Add **loading skeletons** (`loading.tsx` per route) instead of plain "Carregando..." text

---

## 3. Error Handling
- All Supabase calls currently silently ignore errors (`if (error) { ... }` is absent everywhere)
- Add user-facing error messages (toast or inline) for failed fetches, inserts, and updates
- Handle network offline state gracefully
- Add an `error.tsx` boundary per route for unhandled crashes

---

## 4. Optimistic UI — Workout Checklist
- Tapping "Feito" should update the UI instantly, then sync to Supabase in the background
- If the server call fails, revert and show an error
- Same for "Desfazer"
- Progress bar should update immediately on tap

---

## 5. Exercise Search — Accent & Case Insensitive
- Current search does a JS `.toLowerCase()` but doesn't normalize accents
- Use `String.prototype.normalize('NFD').replace(/[\u0300-\u036f]/g, '')` to strip diacritics before comparing
- "flexao" should match "Flexão", "agachamento" should match "Agachamento", etc.

---

## 6. Routine Builder — Drag and Drop
- Replace the ↑ / ↓ arrow buttons with drag-and-drop reordering of exercise cards
- Use `@dnd-kit/core` + `@dnd-kit/sortable` (lightweight, works well with React)
- Keep arrow buttons as a fallback for accessibility / keyboard users

---

## 7. Analytics — Class-first Filter
- The exercise selector currently lists all variants flat ("Flexão — Diamante", "Flexão — Normal", …)
- Change to a **two-step filter**: first pick an exercise class (e.g. "Flexão"), then optionally drill into a specific variant
- Default view when a class is selected (no variant): aggregate all variants together — total volume, avg reps, personal best across all "Flexão" variants
- Variant drill-down: same charts but scoped to e.g. "Flexão — Diamante" only
- This also makes the "most trained" summary card more meaningful (show class, not variant)

---

## 8. Workout Overview
- The workout checklist page shows the routine name but no broader context
- Add a summary header: routine name, date, total exercises count, estimated sets
- Show which exercises are coming up (a compact list at the top, greyed out until reached)
- "Finalizar treino" should show a completion summary (total sets done, total reps, duration)

---

## 9. Auth — Supabase Auth
- Currently no auth: anyone with the URL can read and write data (RLS is off)
- Add Supabase Auth with email/password (or Google OAuth)
- Enable RLS on all tables with `user_id` policies
- Add `user_id` columns to `routines` and `workout_sessions` (already reserved in schema comments)
- Gate all pages behind a session check; redirect to `/login` if unauthenticated
- Use `@supabase/ssr` for server-side session handling in Next.js App Router

---

## 10. Weight Tracking
- Add `actual_weight` (float, nullable) and `target_weight` (float, nullable) columns to `workout_sets` and `routine_exercises`
- Add a weight input next to the reps input on the workout checklist
- Add a unit preference (kg / lbs) stored in user settings or localStorage
- Update analytics: volume = reps × weight when weight is present; fall back to rep count only

---

## 11. UI/UX Review
- Full visual redesign pass before building new features
- Rethink layout, color system, typography, spacing, and component styles
- Establish a consistent design language to build on top of for all upcoming features

---

## 12. Responsive Design
- Audit all pages at 320px, 375px, and 414px widths — no horizontal scroll, no clipped elements
- Routine form exercise cards: ensure sets/reps inputs and buttons wrap properly on small screens
- Workout checklist set rows: verify they don't overflow on narrow viewports
- Analytics charts: ensure ResponsiveContainer fills width correctly on mobile
- All tap targets must be at minimum 44×44px

## 13. Mobile Feel
- The workout checklist is the most used screen — optimize it for one-handed use
- Consider a floating "Feito" button per exercise group instead of per-set buttons
- Add haptic feedback via `navigator.vibrate()` on set completion
- PWA support: `manifest.json`, service worker, "Add to Home Screen" prompt

---

## 14. Routine Periods
- Allow setting a target number of **training sessions** (not days) for a routine, e.g. 45 sessions
- Track how many sessions have been completed against the target
- Show progress on the routine card (e.g. "32 / 45 sessões")
- Notify the user when fewer than ~5 sessions remain ("Quase lá! Faltam 3 treinos para mudar a rotina")
- Auto-archive the routine when the period ends, or let the user archive manually
- Archived routines preserve all historical workout data — no data loss on delete

---

## 15. Archive Routines
- Add `archived_at` (nullable timestamp) to the `routines` table
- Replace "delete routine" with "archive routine" — keeps all session history intact
- Archived routines are hidden from the active list but accessible via a toggle ("Ver arquivadas")
- Workout sessions and sets referencing archived routines remain queryable for analytics

---

## 16. Calendar View
- New **Calendar** page showing a monthly grid
- Days with completed workout sessions are highlighted (dot or accent background)
- Tapping a day opens a detail view: which routine was done, exercises completed, sets/reps/weight
- Supports navigating between months
- Pairs with archived routines so past workouts remain visible even after archiving

---

## 17. Analytics v2
- Current analytics are limited to a single exercise chart
- Revamp to show: weekly/monthly volume trends, streak tracking, personal records per exercise
- Routine-level summary: avg sessions per week, total volume lifted, most trained exercise class
- Compare periods (e.g. this routine vs. previous one)
- Surface insights based on routine period data (sessions completed, consistency)

---

## 20. Light / Dark Mode
- Add a theme toggle (sun/moon icon) accessible from the nav or settings
- Use Tailwind's `dark:` variant + `next-themes` for SSR-safe theme persistence
- Minimalistic feel: clean whites/off-whites in light, dark greys (not pure black) in dark
- All components and charts must respect the active theme

---

## 21. Dashboard (rename Analytics)
- Rename the **Analytics** page to **Dashboard** — it should be the pulse of your training, not just charts
- Home section: this week's exercise days strip (Mon–Sun) with a green check on days a session was completed (inspired by Fitbit's "Exercise days")
- Routine progress wheel: circular arc showing sessions completed vs target (e.g. 32 / 45) — prominent, top of dashboard
- Streak counter, personal records, total volume this week
- Quick-access to the detailed analytics charts below the summary cards

---

## 22. Exercise Library Page
- New **Library** page listing all exercises grouped by class (Flexão, Agachamento, etc.)
- Filter bar at the top: filter by class or search by name
- Each exercise card shows: name, variant, class — tappable to see stats for that exercise
- Future: add muscle group tags (chest, legs, core, etc.) as a visual badge — leave schema space for it but don't implement tags yet

---

## 23. Set & Exercise Time Tracking
- Record the timestamp when a set is started (user taps the circle) and when it is completed
- Log **time per set** and derive **time per exercise** (first set started → last set completed)
- Log **overall routine duration** (already done via `workout_sessions.completed_at`)
- Surface these in the workout completion summary and on the Dashboard

---

## 24. Rest Timers
- After completing a set, automatically start a **rest countdown** based on a configurable value
  - Two separate values: **rest between sets** (same exercise) and **rest between exercises**
  - Configured per routine or per exercise in the routine builder
- Rest timer counts down to zero, then goes **negative** (overtime) — shown in red
- User taps a button to end rest; actual rest duration is logged alongside the set
- Dashboard / analytics can show: avg rest taken vs configured, how often the user went overtime
- Visual: a subtle countdown bar or timer chip appears between set rows during rest

---

## 25. Achievements ✅
- 7 achievement types implemented:
  - Exercise set milestones: 500 / 2.000 / 5.000 / 10.000 sets per exercise class
  - First full routine period completed
  - Weight logged on 10 sets
  - 5-day training streak (best ever)
- `user_achievements` table in Supabase (migration 010) with RLS
- Checked and unlocked via server action after each workout is finished; toast shown per unlock
- Dashboard shelf shows earned badges + locked global achievements + "Ver todas" link
- `/achievements` page shows full list: earned with date, locked globals, exercise milestone tiers per class with progress bars
- New exercise classes appear in `/achievements` immediately on creation

---

## Priority Order (suggested)

| # | Item | Status | Impact | Effort |
|---|------|--------|--------|--------|
| 1 | Server components / SSR (perf) | ✅ Done | High | Medium |
| 2 | Nav active state + layout | ✅ Done | High | Low |
| 3 | Exercise search accent-insensitive | ✅ Done | High | Low |
| 4 | Analytics class-first filter | ✅ Done | High | Medium |
| 5 | Drag and drop routine builder | ✅ Done | Medium | Medium |
| 6 | Optimistic UI workout | ✅ Done | Medium | Low |
| 7 | Error handling | ✅ Done | Medium | Medium |
| 8 | Workout overview / completion summary | ✅ Done | Medium | Medium |
| 9 | Auth + RLS | ✅ Done | High | High |
| 10 | Weight tracking | ✅ Done | Medium | High |
| 11 | UI/UX review + light/dark mode | ✅ Done | High | High |
| 12 | Responsive design | ✅ Done | High | Low |
| 13 | Mobile feel (bottom nav, PWA) | ✅ Done | High | Medium |
| 14 | Routine periods + session counting | ✅ Done | High | High |
| 15 | Archive routines | ✅ Done | High | Medium |
| 16 | Calendar view | ✅ Done | High | High |
| 17 | Dashboard (Analytics v2) | ✅ Done | High | High |
| 18 | Exercise library page + admin | ✅ Done | Medium | Medium |
| 19 | Set & exercise time tracking | ✅ Done | Medium | High |
| 20 | Rest timers | ✅ Done | High | High |
| 21 | Timed exercises (is_timed) | ✅ Done | High | High |
| 22 | Workout history preservation | ✅ Done | High | Medium |
| 23 | Workout UX (set ordering, blocking) | ✅ Done | Medium | Low |
| 24 | BRT timezone for session dates | ✅ Done | Medium | Low |
| 25 | Dashboard time analytics | ✅ Done | Medium | Low |
| 26 | Achievements | ✅ Done | Medium | High |
| 27 | Automated tests (Jest) | ⏳ Pending | Medium | High |
| 28 | README | ✅ Done | Low | Low |
| 29 | Circuit mode | ✅ Done | Medium | High |
| 30 | Routine builder — per-set variant picker | ✅ Done | High | High |
| 31 | Padrão — between-exercise rest timer | ✅ Done | Medium | Medium |
| 32 | Circuito — between-round rest timer + shared intra-round rest | ✅ Done | Medium | Medium |
| 33 | Workout set — full-row tap target | ✅ Done | High | Low |
| 34 | Workout set — show elapsed time after completion | ✅ Done | Medium | Low |
| 35 | Workout — stable exercise block ordering | ✅ Done | High | Low |

---

## 22. Automated Tests
- Use **Jest** as the test runner
- Add unit tests for pure logic (exercise label formatting, duration formatting, analytics aggregations)
- Add integration tests for Supabase queries using a test database or mocked client
- Add E2E tests for the core flows: login → create routine → start workout → complete sets → finish
- Set up CI to run tests on every PR

---

## 24. Circuit Mode

- Add `is_circuit boolean default false` to the `routines` table (migration)
- Routine builder: toggle at the top of the form — "Padrão / Circuito"
- Workout progression in circuit mode: sets are activated by round, not by exercise
  - Round 1: S1 of every exercise in display order
  - Round 2: S2 of every exercise in display order
  - Round 3: S3 of every exercise in display order
- Workout UI groups sets by round ("Rodada 1 / 3") instead of by exercise
- Rest timers apply between exercises within a round (using each exercise's `rest_seconds`)
- All existing logic (set ordering enforcement, blocking parallel sets, timed exercises, completion summary) must work in circuit mode
- Calendar and dashboard analytics remain unchanged — `workout_sets` rows are the same regardless of mode

---

## 30. Routine Builder — Per-Set Variant Picker

Replace the current flat "Flexão — Diamante" combined exercise selector with a two-level, mobile-friendly builder:

**Exercise class card**
- The user first picks an **exercise class** (e.g. Flexão) via a searchable dropdown — same accent-insensitive search as today
- The class can be added more than once to the same routine (e.g. two separate Flexão blocks)
- Inside the class card: sets count, reps/seconds target, and rest timer (between sets of this block)

**Per-set variant picker**
- Below the config row, one dropdown row appears **per set** — each row lets the user pick the variant for that set
- Variants are scoped to the selected class (e.g. only Flexão variants appear in a Flexão block)
- The variant dropdown also has a search bar
- Example layout for "Flexão — 3 séries · 10 reps · 60 s":
  ```
  S1  Normal      ▾
  S2  Diamante    ▾
  S3  Aberta      ▾
  ```
- Selecting the same variant for every set is allowed (and the default)

**Schema impact**
- `routine_exercises` currently represents one exercise (class + variant) with N sets; this model needs to change to one row **per set**, or a new `routine_sets` table that links a `routine_exercise` (class-level) to a specific `exercise_id` (variant) per set number
- `workout_sets` is unaffected — it already stores one row per set with `routine_exercise_id`
- Migration required; existing routines must be preserved (each existing `routine_exercise` row maps 1:1 to a block with all sets using the same variant)

**Workout UI**
- The workout card header shows the class name and block config
- Each set row shows its variant name instead of just "S1 / S2 / S3"

---

## 31. Padrão — Between-Exercise Rest Timer

Add a second rest timer value to the Padrão routine configuration: a **between-exercise rest** that fires when the last set of an exercise block is completed, instead of the per-block rest.

**Routine builder**
- Add an `inter_exercise_rest_seconds` field to the routine (not to individual exercise blocks)
- Shown as a separate input in the form, e.g. "Descanso entre exercícios"
- If not set, behaviour is unchanged (no inter-exercise rest)

**Schema impact**
- Add `inter_exercise_rest_seconds int` (nullable) to `routines`

**Workout logic**
- When completing the last set of an exercise block and there is a next block:
  - Use `routine.inter_exercise_rest_seconds` for the rest timer instead of the block's `rest_seconds`
- When completing a non-last set, use the block's `rest_seconds` as today
- When completing the last set of the last block, no rest timer (unchanged)

---

## 32. Circuito — Between-Round Rest Timer + Shared Intra-Round Rest

Two circuit-specific timer additions; neither affects Padrão routines.

**Between-round rest**
- A `round_rest_seconds` field on the routine (circuit only)
- Fires after the last exercise of a round is completed, before the first exercise of the next round starts
- Not fired after the final round

**Shared intra-round rest**
- A single `circuit_rest_seconds` field on the routine that replaces per-exercise `rest_seconds` inside a circuit
- Applies between exercises within a round (i.e. after every set except the last of each round)
- Per-exercise `rest_seconds` values are ignored in circuit mode; the shared value is used instead

**Schema impact**
- Add `round_rest_seconds int` (nullable) to `routines`
- Add `circuit_rest_seconds int` (nullable) to `routines`

**Routine builder**
- These two inputs are shown only when Circuito mode is active, below the Padrão/Circuito toggle
- Per-exercise rest inputs are hidden in circuit mode (they have no effect)

**Workout logic**
- After completing a set that is not the last of its round: use `circuit_rest_seconds` (if set)
- After completing the last set of a round (and there is a next round): use `round_rest_seconds` (if set)
- After completing the last set of the last round: no rest timer

---

## 33. Workout Set — Full-Row Tap Target

The set completion circle is too small a tap target, especially mid-workout with sweaty hands.

**Change**
- Make the entire set row (the `<div>` containing the circle, variant label, reps input, and timer) act as the tap/click handler for start → active → complete → undo transitions
- The circle icon stays as a visual indicator but is no longer the only interactive element
- Inputs (reps, weight) inside the row should still receive their own events — use `stopPropagation` where needed so tapping an input doesn't accidentally trigger the set action
- Blocked sets should not be tappable row-wide (same `isBlocked` guard as today)

---

## 34. Workout Set — Show Final Elapsed Time After Completion

While a set is active the stopwatch shows live elapsed time. Once the set is completed, that time disappears. It would be useful to see how long the set took.

**Change**
- After a set is marked complete, display the elapsed duration (derived from `started_at` → `completed_at`) in the same position as the live stopwatch
- Format: same `formatSeconds` used elsewhere (e.g. "1:23" or "45s")
- Only shown when both `started_at` and `completed_at` are present on the set
- Applies to rep-based sets only — timed sets already surface their duration differently

---

## 35. Workout — Stable Exercise Block Ordering

When resuming a mid-session workout the exercise blocks can appear in a different order than the routine was built with, because the sets are fetched ordered by `set_number` but grouping by `block_id` produces an order determined by whichever block's first set appears first in the result — which can vary.

**Fix**
- After grouping sets by `block_id`, sort the resulting groups by `display_order` (from `routine_exercises.display_order`) before rendering
- `display_order` is already present on every `routine_exercise` row; no schema change needed
- Applies to both Padrão and Circuito workout views

---

## 23. README

Follow the style of [chord-recognition](https://github.com/RodrigoPita/chord-recognition) and [songbook-builder](https://github.com/RodrigoPita/songbook-builder):

- Title + emoji
- Tech stack badges (shields.io) — Next.js, TypeScript, Supabase, Tailwind, Vercel
- Short description
- Features section with emoji bullets
- Tech Stack section
- Running Locally (prerequisites, clone, install, env vars, migrate, dev)
- Project structure
- `Made with ❤️ by Rodrigo Pita` footer
