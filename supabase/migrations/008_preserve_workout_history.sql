-- When a routine_exercise is deleted, preserve the workout_set rows by setting
-- routine_exercise_id to NULL rather than cascade-deleting the set.
-- This keeps historical workout data intact even when routines are modified.

alter table workout_sets
  alter column routine_exercise_id drop not null;

alter table workout_sets
  drop constraint workout_sets_routine_exercise_id_fkey;

alter table workout_sets
  add constraint workout_sets_routine_exercise_id_fkey
  foreign key (routine_exercise_id)
  references routine_exercises(id)
  on delete set null;
