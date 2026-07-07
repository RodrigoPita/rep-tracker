import { supabaseServer } from '@/lib/supabase-server'
import RoutineTablesClient, { type RoutineTable, type SetEntry } from '@/components/RoutineTablesClient'

type FetchedSet = {
  set_number: number
  actual_reps: number | null
  weight_kg: number | null
  started_at: string | null
  completed_at: string | null
  routine_exercise_id: string | null
  routine_exercises: {
    display_order: number
    superset_position: number | null
    exercises: {
      variant: string
      exercise_classes: { name: string; is_timed: boolean }
    } | null
  } | null
}

type FetchedSession = {
  id: string
  routine_id: string
  date: string
  created_at: string
  completed_at: string | null
  workout_sets: FetchedSet[]
}

export default async function TablesPage() {
  const db = await supabaseServer()

  const [{ data: routinesData }, { data: sessionsData }] = await Promise.all([
    db.from('routines').select('id, name, archived_at').order('created_at'),
    db
      .from('workout_sessions')
      .select(
        'id, routine_id, date, created_at, completed_at, workout_sets(set_number, actual_reps, weight_kg, started_at, completed_at, routine_exercise_id, routine_exercises(display_order, superset_position, exercises(variant, exercise_classes(name, is_timed))))'
      )
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const routines = (routinesData ?? []) as { id: string; name: string; archived_at: string | null }[]
  const sessions = (sessionsData ?? []) as unknown as FetchedSession[]

  const byRoutine = new Map<string, FetchedSession[]>()
  for (const s of sessions) {
    if (!byRoutine.has(s.routine_id)) byRoutine.set(s.routine_id, [])
    byRoutine.get(s.routine_id)!.push(s)
  }

  const tables: RoutineTable[] = []
  for (const routine of routines) {
    const rSessions = byRoutine.get(routine.id) ?? []
    if (rSessions.length === 0) continue

    let hasWeight = false

    const sessionRows = rSessions.map((session) => {
      let minStart: number | null = null
      let maxEnd: number | null = null

      const ordered: { entry: SetEntry; order: number }[] = []
      for (const set of session.workout_sets) {
        const re = set.routine_exercises
        if (!re || !re.exercises) continue // skip sets whose routine_exercise was hard-deleted
        const isTimed = re.exercises.exercise_classes.is_timed
        const durationSec = isTimed
          ? set.actual_reps
          : set.started_at && set.completed_at
            ? Math.max(0, Math.round((new Date(set.completed_at).getTime() - new Date(set.started_at).getTime()) / 1000))
            : null
        if (set.weight_kg != null) hasWeight = true

        ordered.push({
          entry: {
            className: re.exercises.exercise_classes.name,
            variant: re.exercises.variant,
            setNumber: set.set_number,
            reps: isTimed ? null : set.actual_reps,
            weightKg: set.weight_kg,
            durationSec,
            isTimed,
          },
          // sort key: block order → set number → main before secondary
          order: (re.display_order ?? 0) * 10000 + set.set_number * 10 + (re.superset_position ?? 0),
        })

        if (set.started_at) {
          const t = new Date(set.started_at).getTime()
          if (minStart === null || t < minStart) minStart = t
        }
        if (set.completed_at) {
          const t = new Date(set.completed_at).getTime()
          if (maxEnd === null || t > maxEnd) maxEnd = t
        }
      }

      ordered.sort((a, b) => a.order - b.order)
      const durationSec =
        minStart !== null && maxEnd !== null && maxEnd > minStart ? Math.round((maxEnd - minStart) / 1000) : null

      return {
        sessionId: session.id,
        date: session.date,
        durationSec,
        sets: ordered.map((o) => o.entry),
      }
    })

    tables.push({
      routineId: routine.id,
      name: routine.name,
      archived: routine.archived_at != null,
      hasWeight,
      sessions: sessionRows,
    })
  }

  return <RoutineTablesClient tables={tables} />
}
