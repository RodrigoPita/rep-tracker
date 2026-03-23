import { supabaseServer } from '@/lib/supabase-server'
import CalendarClient from '@/components/CalendarClient'
import type { CalendarSession } from '@/lib/types'

export default async function CalendarPage() {
  const db = await supabaseServer()

  const { data } = await db
    .from('workout_sessions')
    .select(`
      id, date, completed_at, routine_id, created_at,
      routines(id, name, archived_at, created_at),
      workout_sets(
        id, session_id, routine_exercise_id, set_number, target_reps,
        actual_reps, weight_kg, completed, completed_at,
        routine_exercises(
          id, routine_id, exercise_id, sets, target_reps, display_order,
          exercises(id, variant, class_id, created_at, exercise_classes(name, is_timed))
        )
      )
    `)
    .not('completed_at', 'is', null)
    .order('date', { ascending: false })

  const sessions = (data ?? []) as unknown as CalendarSession[]

  return <CalendarClient sessions={sessions} />
}
