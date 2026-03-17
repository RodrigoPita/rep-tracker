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
| 11 | UI/UX review | 🔜 Next | High | High |
| 12 | Responsive design | ⏳ Pending | High | Low |
| 13 | Mobile feel | ⏳ Pending | High | Medium |
| 14 | Routine periods + session counting | ⏳ Pending | High | High |
| 15 | Archive routines | ⏳ Pending | High | Medium |
| 16 | Calendar view | ⏳ Pending | High | High |
| 17 | Analytics v2 | ⏳ Pending | High | High |
| 18 | Automated tests | ⏳ Pending | Medium | High |
| 19 | README | ⏳ Pending | Low | Low |

---

## 18. Automated Tests
- Use **Jest** as the test runner
- Add unit tests for pure logic (exercise label formatting, duration formatting, analytics aggregations)
- Add integration tests for Supabase queries using a test database or mocked client
- Add E2E tests for the core flows: login → create routine → start workout → complete sets → finish
- Set up CI to run tests on every PR

---

## 19. README

Follow the style of [chord-recognition](https://github.com/RodrigoPita/chord-recognition) and [songbook-builder](https://github.com/RodrigoPita/songbook-builder):

- Title + emoji
- Tech stack badges (shields.io) — Next.js, TypeScript, Supabase, Tailwind, Vercel
- Short description
- Features section with emoji bullets
- Tech Stack section
- Running Locally (prerequisites, clone, install, env vars, migrate, dev)
- Project structure
- `Made with ❤️ by Rodrigo Pita` footer
