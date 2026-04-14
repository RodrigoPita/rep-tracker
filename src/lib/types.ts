export type ExerciseClass = {
  id: string
  name: string
  is_timed: boolean
  created_at: string
}

export type ExerciseClassWithVariants = {
  id: string
  name: string
  is_timed: boolean
  exercises: { id: string; variant: string }[]
}

export type Exercise = {
  id: string
  class_id: string
  variant: string
  created_at: string
}

export type Routine = {
  id: string
  name: string
  is_circuit: boolean
  archived_at: string | null
  created_at: string
}

export type RoutinePeriod = {
  id: string
  routine_id: string
  user_id: string
  target_sessions: number
  started_at: string
  completed_at: string | null
  created_at: string
}

export type RoutineExercise = {
  id: string
  routine_id: string
  exercise_id: string
  sets: number
  target_reps: number
  target_seconds: number | null
  display_order: number
  rest_seconds: number | null
  // per-set variant fields (null on legacy block-level rows)
  set_number: number | null
  block_id: string | null
  exercise_class_id: string | null
}

export type WorkoutSession = {
  id: string
  routine_id: string
  date: string
  completed_at: string | null
  created_at: string
}

export type WorkoutSet = {
  id: string
  session_id: string
  routine_exercise_id: string | null
  set_number: number
  target_reps: number
  actual_reps: number | null
  weight_kg: number | null
  completed: boolean
  completed_at: string | null
  started_at: string | null
  rest_ended_at: string | null
}

// Joined types used in UI
export type ExerciseWithClass = Exercise & {
  exercise_classes: ExerciseClass
}

export type RoutineExerciseWithExercise = RoutineExercise & {
  exercises: ExerciseWithClass
}

export type WorkoutSetWithExercise = WorkoutSet & {
  routine_exercises: RoutineExercise & {
    exercises: ExerciseWithClass
  }
}

export type WorkoutSessionWithRoutine = WorkoutSession & {
  routines: Routine
}

export type CalendarSession = WorkoutSession & {
  routines: Routine
  workout_sets: Array<WorkoutSet & {
    routine_exercises: (RoutineExercise & {
      exercises: Exercise & { exercise_classes: { name: string; is_timed: boolean } }
    }) | null
  }>
}

/** "Flexão — Diamante" */
export function exerciseLabel(exercise: ExerciseWithClass): string {
  return `${exercise.exercise_classes.name} — ${exercise.variant}`
}

/** "Padrão" | "Circuito" */
export function routineMode(isCircuit: boolean): string {
  return isCircuit ? 'Circuito' : 'Padrão'
}

/** "seg" | "reps" */
export function setUnit(isTimed: boolean): string {
  return isTimed ? 'seg' : 'reps'
}
