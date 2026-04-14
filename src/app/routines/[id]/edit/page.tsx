import { supabaseServer } from '@/lib/supabase-server'
import RoutineForm from '@/components/RoutineForm'
import type { ExerciseWithClass, RoutineExerciseWithExercise } from '@/lib/types'

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const db = await supabaseServer()

  const [{ data: routine }, { data: reData }, { data: exercisesData }] = await Promise.all([
    db.from('routines').select('*').eq('id', id).single(),
    db.from('routine_exercises')
      .select('*, exercises(*, exercise_classes(*))')
      .eq('routine_id', id)
      .is('deleted_at', null)
      .not('set_number', 'is', null)   // only per-set rows
      .order('display_order')
      .order('set_number'),
    db.from('exercises').select('*, exercise_classes(*)').order('exercise_classes(name)'),
  ])

  // Group per-set rows by block_id, preserving display_order sort
  const rowsTyped = (reData ?? []) as RoutineExerciseWithExercise[]

  const blockMap = new Map<string, RoutineExerciseWithExercise[]>()
  for (const re of rowsTyped) {
    const key = re.block_id ?? re.id  // block_id always set for per-set rows; fallback is safe
    if (!blockMap.has(key)) blockMap.set(key, [])
    blockMap.get(key)!.push(re)
  }

  const initialBlocks = Array.from(blockMap.entries()).map(([blockId, rows], i) => {
    const first = rows[0]
    return {
      draftId: crypto.randomUUID(),
      blockId,
      classId: first.exercise_class_id ?? first.exercises.class_id,
      className: first.exercises.exercise_classes.name,
      isTimed: first.exercises.exercise_classes.is_timed,
      targetReps: first.target_reps,
      targetSeconds: first.target_seconds ?? null,
      restSeconds: first.rest_seconds ?? null,
      displayOrder: i,
      setRows: rows.map((re) => ({
        id: re.id,
        draftId: crypto.randomUUID(),
        exerciseId: re.exercise_id,
        variantLabel: re.exercises.variant,
      })),
    }
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Editar Treino</h1>
      <RoutineForm
        routineId={id}
        allExercises={(exercisesData ?? []) as ExerciseWithClass[]}
        initialData={{ name: routine?.name ?? '', blocks: initialBlocks, isCircuit: routine?.is_circuit ?? false, interExerciseRestSeconds: routine?.inter_exercise_rest_seconds ?? null, roundRestSeconds: routine?.round_rest_seconds ?? null, circuitRestSeconds: routine?.circuit_rest_seconds ?? null }}
      />
    </div>
  )
}
