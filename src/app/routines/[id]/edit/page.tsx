import { supabaseServer } from '@/lib/supabase-server'
import RoutineForm from '@/components/RoutineForm'
import type { ExerciseWithClass, RoutineExerciseWithExercise } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await supabaseServer()

  const [{ data: routine }, { data: reData }, { data: exercisesData }] = await Promise.all([
    db.from('routines').select('*').eq('id', id).single(),
    db.from('routine_exercises')
      .select('*, exercises(*, exercise_classes(*))')
      .eq('routine_id', id)
      .order('display_order'),
    db.from('exercises').select('*, exercise_classes(*)').order('exercise_classes(name)'),
  ])

  const initialRows = (reData as RoutineExerciseWithExercise[] ?? []).map((re, i) => ({
    exercise_id: re.exercise_id,
    label: exerciseLabel(re.exercises),
    sets: re.sets,
    target_reps: re.target_reps,
    display_order: i,
  }))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Editar Treino</h1>
      <RoutineForm
        routineId={id}
        allExercises={(exercisesData ?? []) as ExerciseWithClass[]}
        initialData={{ name: routine?.name ?? '', rows: initialRows }}
      />
    </div>
  )
}
