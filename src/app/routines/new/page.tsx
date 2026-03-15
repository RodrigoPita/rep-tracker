import { supabaseServer } from '@/lib/supabase-server'
import RoutineForm from '@/components/RoutineForm'
import type { ExerciseWithClass } from '@/lib/types'

export default async function NewRoutinePage() {
  const db = await supabaseServer()
  const { data } = await db
    .from('exercises')
    .select('*, exercise_classes(*)')
    .order('exercise_classes(name)')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Novo Treino</h1>
      <RoutineForm allExercises={(data ?? []) as ExerciseWithClass[]} />
    </div>
  )
}
