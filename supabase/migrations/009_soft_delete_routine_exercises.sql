-- Soft-delete for routine_exercises: instead of deleting rows (which would set
-- workout_sets.routine_exercise_id to NULL via migration 008, losing exercise names
-- from historical calendar records), mark removed exercises with deleted_at.
-- The FK stays intact so historical workout_sets can still JOIN to the exercise name.

alter table routine_exercises add column deleted_at timestamptz;
