-- Migration 012: per-set variant picker
--
-- Restructures routine_exercises from one-row-per-block to one-row-per-set so
-- each set in a routine block can have its own exercise variant.
--
-- New columns:
--   set_number       int  — which set within a block (1-based); NULL on legacy block rows
--   block_id         uuid — groups all sets of the same block; NULL on legacy rows
--   exercise_class_id uuid — which exercise class this block belongs to
--
-- After the PL/pgSQL backfill every active routine_exercise row is a per-set row.
-- Legacy block-level rows are soft-deleted (deleted_at set) AFTER workout_sets
-- FKs are re-pointed to the new per-set rows.

ALTER TABLE routine_exercises
  ADD COLUMN set_number        int,
  ADD COLUMN block_id          uuid,
  ADD COLUMN exercise_class_id uuid REFERENCES exercise_classes(id);

-- Backfill: expand every existing block-level row (set_number IS NULL) into N
-- per-set rows, re-point workout_sets FKs, then soft-delete the original row.
DO $$
DECLARE
  re     RECORD;
  s      int;
  new_id uuid;
  cls_id uuid;
BEGIN
  FOR re IN
    SELECT * FROM routine_exercises WHERE set_number IS NULL ORDER BY id
  LOOP
    -- Resolve the exercise class for this block
    SELECT class_id INTO cls_id FROM exercises WHERE id = re.exercise_id;

    FOR s IN 1 .. re.sets LOOP
      -- Insert one per-set row
      INSERT INTO routine_exercises (
        routine_id,
        exercise_id,
        sets,
        target_reps,
        target_seconds,
        rest_seconds,
        display_order,
        set_number,
        block_id,
        exercise_class_id
        -- deleted_at stays NULL (active row)
      ) VALUES (
        re.routine_id,
        re.exercise_id,
        re.sets,
        re.target_reps,
        re.target_seconds,
        re.rest_seconds,
        re.display_order,
        s,
        re.id,   -- reuse old row id as block_id so existing data keeps a stable reference
        cls_id
      )
      RETURNING id INTO new_id;

      -- Re-point any workout_sets that reference this block + have this set_number
      UPDATE workout_sets
         SET routine_exercise_id = new_id
       WHERE routine_exercise_id = re.id
         AND set_number = s;
    END LOOP;

    -- Soft-delete the original block-level row
    UPDATE routine_exercises
       SET deleted_at = NOW()
     WHERE id = re.id;
  END LOOP;
END;
$$;
