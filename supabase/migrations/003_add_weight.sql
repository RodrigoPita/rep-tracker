-- Add optional weight tracking per set
alter table workout_sets
  add column weight_kg numeric check (weight_kg > 0);
