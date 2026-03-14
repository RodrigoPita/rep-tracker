import { supabaseServer } from '@/lib/supabase-server'
import WorkoutClient from '@/components/WorkoutClient'
import type { WorkoutSessionWithRoutine, WorkoutSetWithExercise } from '@/lib/types'

export default async function WorkoutPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const db = supabaseServer()

  const [{ data: session }, { data: sets }] = await Promise.all([
    db.from('workout_sessions').select('*, routines(*)').eq('id', sessionId).single(),
    db.from('workout_sets')
      .select('*, routine_exercises(*, exercises(*, exercise_classes(*)))')
      .eq('session_id', sessionId)
      .order('set_number'),
  ])

  if (!session) {
    return <p className="text-muted-foreground">Sessão não encontrada.</p>
  }

  return (
    <WorkoutClient
      session={session as WorkoutSessionWithRoutine}
      initialSets={(sets ?? []) as WorkoutSetWithExercise[]}
    />
  )
}
