-- Add user ownership to user-scoped tables
alter table routines
  add column user_id uuid references auth.users(id) on delete cascade;

alter table workout_sessions
  add column user_id uuid references auth.users(id) on delete cascade;

-- Enable RLS on all tables
alter table exercise_classes enable row level security;
alter table exercises enable row level security;
alter table routines enable row level security;
alter table routine_exercises enable row level security;
alter table workout_sessions enable row level security;
alter table workout_sets enable row level security;

-- exercise_classes: shared seed data — public read/insert
create policy "exercise_classes_select" on exercise_classes for select using (true);
create policy "exercise_classes_insert" on exercise_classes for insert with check (true);

-- exercises: shared seed data — public read/insert
create policy "exercises_select" on exercises for select using (true);
create policy "exercises_insert" on exercises for insert with check (true);

-- routines: scoped to owner
create policy "routines_select" on routines for select using (auth.uid() = user_id);
create policy "routines_insert" on routines for insert with check (auth.uid() = user_id);
create policy "routines_update" on routines for update using (auth.uid() = user_id);
create policy "routines_delete" on routines for delete using (auth.uid() = user_id);

-- routine_exercises: accessible if the parent routine belongs to the user
create policy "routine_exercises_select" on routine_exercises for select using (
  exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_exercises_insert" on routine_exercises for insert with check (
  exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_exercises_update" on routine_exercises for update using (
  exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_exercises_delete" on routine_exercises for delete using (
  exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid())
);

-- workout_sessions: scoped to owner
create policy "workout_sessions_select" on workout_sessions for select using (auth.uid() = user_id);
create policy "workout_sessions_insert" on workout_sessions for insert with check (auth.uid() = user_id);
create policy "workout_sessions_update" on workout_sessions for update using (auth.uid() = user_id);
create policy "workout_sessions_delete" on workout_sessions for delete using (auth.uid() = user_id);

-- workout_sets: accessible if the parent session belongs to the user
create policy "workout_sets_select" on workout_sets for select using (
  exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);
create policy "workout_sets_insert" on workout_sets for insert with check (
  exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);
create policy "workout_sets_update" on workout_sets for update using (
  exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);
create policy "workout_sets_delete" on workout_sets for delete using (
  exists (select 1 from workout_sessions ws where ws.id = session_id and ws.user_id = auth.uid())
);
