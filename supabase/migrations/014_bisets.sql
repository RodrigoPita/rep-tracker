-- Bi-sets: a block can pair a main exercise (superset_position 0) with a
-- secondary exercise (superset_position 1) performed back-to-back with no rest
-- between them. Rows of a bi-set share the same block_id; play order within a
-- block is (set_number, superset_position). Padrão mode only.
ALTER TABLE routine_exercises ADD COLUMN superset_position smallint NOT NULL DEFAULT 0;
