-- Soft-delete routines instead of hard-deleting them
alter table routines
  add column archived_at timestamptz;

-- Routine periods: a goal of N sessions for a given routine
create table routine_periods (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references routines(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  target_sessions int not null check (target_sessions > 0),
  started_at  timestamptz not null default now(),
  completed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- RLS
alter table routine_periods enable row level security;

create policy "routine_periods_select" on routine_periods
  for select using (auth.uid() = user_id);

create policy "routine_periods_insert" on routine_periods
  for insert with check (auth.uid() = user_id);

create policy "routine_periods_update" on routine_periods
  for update using (auth.uid() = user_id);

create policy "routine_periods_delete" on routine_periods
  for delete using (auth.uid() = user_id);
