-- Restrict exercise management to the admin user.
-- Replace ADMIN_USER_ID with the actual UUID before applying.

-- Drop the existing open insert policies
drop policy "exercise_classes_insert" on exercise_classes;
drop policy "exercises_insert" on exercises;

-- Admin-only write policies for exercise_classes
create policy "exercise_classes_insert" on exercise_classes
  for insert with check (auth.uid() = 'ADMIN_USER_ID'::uuid);

create policy "exercise_classes_update" on exercise_classes
  for update using (auth.uid() = 'ADMIN_USER_ID'::uuid);

create policy "exercise_classes_delete" on exercise_classes
  for delete using (auth.uid() = 'ADMIN_USER_ID'::uuid);

-- Admin-only write policies for exercises
create policy "exercises_insert" on exercises
  for insert with check (auth.uid() = 'ADMIN_USER_ID'::uuid);

create policy "exercises_update" on exercises
  for update using (auth.uid() = 'ADMIN_USER_ID'::uuid);

create policy "exercises_delete" on exercises
  for delete using (auth.uid() = 'ADMIN_USER_ID'::uuid);
