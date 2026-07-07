import { supabaseServer } from '@/lib/supabase-server'
import RoutineTablesClient, { type RoutineTable, type TableCell } from '@/components/RoutineTablesClient'

type FetchedSet = {
  id: string
  set_number: number
  actual_reps: number | null
  weight_kg: number | null
  started_at: string | null
  completed_at: string | null
  routine_exercise_id: string | null
  routine_exercises: {
    block_id: string | null
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
        'id, routine_id, date, created_at, completed_at, workout_sets(id, set_number, actual_reps, weight_kg, started_at, completed_at, routine_exercise_id, routine_exercises(block_id, display_order, superset_position, exercises(variant, exercise_classes(name, is_timed))))'
      )
      .not('completed_at', 'is', null)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const routines = (routinesData ?? []) as { id: string; name: string; archived_at: string | null }[]
  const sessions = (sessionsData ?? []) as unknown as FetchedSession[]

  // Group completed sessions by routine (query order = date desc → preserved)
  const byRoutine = new Map<string, FetchedSession[]>()
  for (const s of sessions) {
    if (!byRoutine.has(s.routine_id)) byRoutine.set(s.routine_id, [])
    byRoutine.get(s.routine_id)!.push(s)
  }

  const tables: RoutineTable[] = []
  for (const routine of routines) {
    const rSessions = byRoutine.get(routine.id) ?? []
    if (rSessions.length === 0) continue

    // Column registry across all sessions of this routine.
    // Column key = block_id:superset_position, so a bi-set's main and secondary
    // become two adjacent columns.
    const colMeta = new Map<
      string,
      { className: string; isTimed: boolean; hasWeight: boolean; displayOrder: number; supersetPosition: number }
    >()

    const rows = rSessions.map((session) => {
      const cells: Record<string, TableCell[]> = {}
      let minStart: number | null = null
      let maxEnd: number | null = null

      for (const set of session.workout_sets) {
        const re = set.routine_exercises
        if (!re || !re.exercises) continue // skip sets whose routine_exercise was hard-deleted
        const pos = re.superset_position ?? 0
        const blockId = re.block_id ?? set.routine_exercise_id ?? 'unknown'
        const key = `${blockId}:${pos}`
        const isTimed = re.exercises.exercise_classes.is_timed
        const durationSec = isTimed
          ? set.actual_reps
          : set.started_at && set.completed_at
            ? Math.max(0, Math.round((new Date(set.completed_at).getTime() - new Date(set.started_at).getTime()) / 1000))
            : null

        const cell: TableCell = {
          setNumber: set.set_number,
          variant: re.exercises.variant,
          reps: isTimed ? null : set.actual_reps,
          weightKg: set.weight_kg,
          durationSec,
          isTimed,
        }
        if (!cells[key]) cells[key] = []
        cells[key].push(cell)

        const meta = colMeta.get(key)
        if (!meta) {
          colMeta.set(key, {
            className: re.exercises.exercise_classes.name,
            isTimed,
            hasWeight: set.weight_kg != null,
            displayOrder: re.display_order,
            supersetPosition: pos,
          })
        } else if (set.weight_kg != null) {
          meta.hasWeight = true
        }

        if (set.started_at) {
          const t = new Date(set.started_at).getTime()
          if (minStart === null || t < minStart) minStart = t
        }
        if (set.completed_at) {
          const t = new Date(set.completed_at).getTime()
          if (maxEnd === null || t > maxEnd) maxEnd = t
        }
      }

      for (const k in cells) cells[k].sort((a, b) => a.setNumber - b.setNumber)

      const durationSec =
        minStart !== null && maxEnd !== null && maxEnd > minStart ? Math.round((maxEnd - minStart) / 1000) : null

      return { sessionId: session.id, date: session.date, durationSec, cells }
    })

    const columns = [...colMeta.entries()]
      .sort(
        (a, b) =>
          a[1].displayOrder - b[1].displayOrder ||
          a[1].supersetPosition - b[1].supersetPosition ||
          a[1].className.localeCompare(b[1].className)
      )
      .map(([key, m]) => ({ key, className: m.className, isTimed: m.isTimed, hasWeight: m.hasWeight }))

    tables.push({
      routineId: routine.id,
      name: routine.name,
      archived: routine.archived_at != null,
      columns,
      rows,
    })
  }

  return <RoutineTablesClient tables={tables} />
}
