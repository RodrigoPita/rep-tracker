-- Mark exercise classes as time-based (e.g. Prancha) vs rep-based
alter table exercise_classes add column is_timed boolean not null default false;

-- Target duration in seconds for timed exercises in a routine
alter table routine_exercises add column target_seconds int;
