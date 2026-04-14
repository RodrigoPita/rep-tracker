-- #31: Padrão between-exercise rest timer
ALTER TABLE routines ADD COLUMN inter_exercise_rest_seconds int;

-- #32: Circuit between-round rest + shared intra-round rest
ALTER TABLE routines ADD COLUMN round_rest_seconds int;
ALTER TABLE routines ADD COLUMN circuit_rest_seconds int;
