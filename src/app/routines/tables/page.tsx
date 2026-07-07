import { supabaseServer } from '@/lib/supabase-server'
import RoutineTablesClient, { type RoutineTable, type ExerciseRow, type SessionCol, type GridCell } from '@/components/RoutineTablesClient'

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
    block_id: string | null
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
        'id, routine_id, date, created_at, completed_at, workout_sets(set_number, actual_reps, weight_kg, started_at, completed_at, routine_exercise_id, routine_exercises(display_order, superset_position, block_id, exercises(variant, exercise_classes(name, is_timed))))'
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

    // Row registry: one row per exercise block instance (block_id + superset_position),
    // stable across sessions. Tracks order, class, variant(s), timed flag.
    const rowMeta = new Map<
      string,
      { className: string; variants: Set<string>; isTimed: boolean; order: number; supersetPosition: number }
    >()

    // cells[rowKey][sessionId] = GridCell
    const cells: Record<string, Record<string, GridCell>> = {}
    const sessionCols: SessionCol[] = []

    for (const session of rSessions) {
      let minStart: number | null = null
      let maxEnd: number | null = null

      // group this session's sets by row key
      const bySet = new Map<string, { setNumber: number; value: number; weight: number | null; dur: number | null }[]>()
      for (const set of session.workout_sets) {
        const re = set.routine_exercises
        if (!re || !re.exercises) continue
        const pos = re.superset_position ?? 0
        const blockId = re.block_id ?? set.routine_exercise_id ?? 'unknown'
        const rowKey = `${blockId}:${pos}`
        const isTimed = re.exercises.exercise_classes.is_timed
        if (set.weight_kg != null) hasWeight = true

        const meta = rowMeta.get(rowKey)
        if (!meta) {
          rowMeta.set(rowKey, {
            className: re.exercises.exercise_classes.name,
            variants: new Set([re.exercises.variant]),
            isTimed,
            order: (re.display_order ?? 0) * 10 + pos,
            supersetPosition: pos,
          })
        } else {
          meta.variants.add(re.exercises.variant)
        }

        const value = set.actual_reps ?? 0 // reps (rep-based) or seconds (timed)
        const dur = isTimed
          ? set.actual_reps
          : set.started_at && set.completed_at
            ? Math.max(0, Math.round((new Date(set.completed_at).getTime() - new Date(set.started_at).getTime()) / 1000))
            : null
        if (!bySet.has(rowKey)) bySet.set(rowKey, [])
        bySet.get(rowKey)!.push({ setNumber: set.set_number, value, weight: set.weight_kg, dur })

        if (set.started_at) {
          const t = new Date(set.started_at).getTime()
          if (minStart === null || t < minStart) minStart = t
        }
        if (set.completed_at) {
          const t = new Date(set.completed_at).getTime()
          if (maxEnd === null || t > maxEnd) maxEnd = t
        }
      }

      for (const [rowKey, list] of bySet) {
        list.sort((a, b) => a.setNumber - b.setNumber)
        if (!cells[rowKey]) cells[rowKey] = {}
        cells[rowKey][session.id] = {
          isTimed: rowMeta.get(rowKey)!.isTimed,
          values: list.map((x) => x.value),
          weights: list.map((x) => x.weight),
          durs: list.map((x) => x.dur),
        }
      }

      const durationSec =
        minStart !== null && maxEnd !== null && maxEnd > minStart ? Math.round((maxEnd - minStart) / 1000) : null
      sessionCols.push({ sessionId: session.id, date: session.date, durationSec })
    }

    const rows: ExerciseRow[] = [...rowMeta.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, m]) => ({
        key,
        className: m.className,
        variant: m.variants.size === 1 ? [...m.variants][0] : '',
        isTimed: m.isTimed,
        isSecondary: m.supersetPosition === 1,
      }))

    tables.push({
      routineId: routine.id,
      name: routine.name,
      archived: routine.archived_at != null,
      hasWeight,
      rows,
      sessions: sessionCols,
      cells,
    })
  }

  return <RoutineTablesClient tables={tables} />
}
