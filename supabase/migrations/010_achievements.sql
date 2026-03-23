-- Achievements: milestone badges earned by users.
-- achievement_key: the type of achievement (e.g. 'exercise_sessions_10')
-- achievement_id:  unique instance identifier; for class-based achievements this is
--                  '<key>:<exercise_class_id>'; for global ones it equals <key>.
-- metadata:        display data (e.g. exercise class name, count reached)

create table user_achievements (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  achievement_key text        not null,
  achievement_id  text        not null,
  metadata        jsonb       not null default '{}',
  earned_at       timestamptz not null default now(),
  unique (user_id, achievement_id)
);

alter table user_achievements enable row level security;

create policy "users can read own achievements"
  on user_achievements for select
  using (auth.uid() = user_id);

create policy "users can insert own achievements"
  on user_achievements for insert
  with check (auth.uid() = user_id);
