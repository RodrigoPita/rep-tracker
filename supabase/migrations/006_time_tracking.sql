-- Set time tracking: when a set was started and when rest after it ended
alter table workout_sets
  add column started_at timestamptz,
  add column rest_ended_at timestamptz;

-- Configurable rest duration per exercise in a routine (seconds, nullable = no timer)
alter table routine_exercises
  add column rest_seconds int;
