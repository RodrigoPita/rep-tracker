import { supabaseServer } from '@/lib/supabase-server'
import DashboardClient from '@/components/DashboardClient'
import type { ExerciseWithClass, WorkoutSession, WorkoutSet } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'

export default async function DashboardPage() {
  const db = await supabaseServer()

  const [
    { data: exercisesData },
    { data: sessionsData },
    { data: allSetsData },
    { data: activePeriodData },
  ] = await Promise.all([
    db.from('exercises').select('*, exercise_classes(*)').order('exercise_classes(name)'),
    db.from('workout_sessions').select('*').not('completed_at', 'is', null).order('date'),
    db.from('workout_sets').select('*, routine_exercises(exercise_id)').eq('completed', true),
    db.from('routine_periods')
      .select('*, routines(id, name)')
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const exercises = (exercisesData ?? []) as ExerciseWithClass[]
  const completedSessions: WorkoutSession[] = sessionsData ?? []
  const completedSets: (WorkoutSet & { routine_exercises: { exercise_id: string } })[] = allSetsData ?? []

  // Most trained exercise
  const exerciseCount: Record<string, number> = {}
  for (const set of completedSets) {
    const eid = set.routine_exercises?.exercise_id
    if (eid) exerciseCount[eid] = (exerciseCount[eid] ?? 0) + 1
  }
  const mostTrainedId = Object.entries(exerciseCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostTrainedEx = exercises.find((e) => e.id === mostTrainedId)
  const mostTrained = mostTrainedEx ? exerciseLabel(mostTrainedEx) : '—'

  // Streak
  const sessionDatesUniq = [...new Set(completedSessions.map((s) => s.date))].sort().reverse()
  let streak = 0
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  let cursor = todayStr
  for (const date of sessionDatesUniq) {
    if (date === cursor) {
      streak++
      const d = new Date(cursor + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().split('T')[0]
    } else break
  }

  // Active routine period progress
  const activePeriod = (activePeriodData as unknown as ({ routine_id: string; target_sessions: number; started_at: string; routines: { name: string } }[]))?.[0] ?? null
  let periodProgress: { routineName: string; completed: number; target: number } | null = null
  if (activePeriod) {
    const periodSessions = completedSessions.filter(
      (s) => s.routine_id === activePeriod.routine_id &&
              s.completed_at != null &&
              s.completed_at >= activePeriod.started_at
    )
    periodProgress = {
      routineName: activePeriod.routines.name,
      completed: periodSessions.length,
      target: activePeriod.target_sessions,
    }
  }

  // Workouts per week — last 12 weeks (Sun–Sat)
  const weeklyData = (() => {
    const result: { week: string; count: number }[] = []
    const dow = now.getDay() // 0 = Sun
    const thisSunday = new Date(now)
    thisSunday.setDate(now.getDate() - dow)
    for (let i = 11; i >= 0; i--) {
      const sunday = new Date(thisSunday)
      sunday.setDate(thisSunday.getDate() - i * 7)
      const nextSunday = new Date(sunday)
      nextSunday.setDate(sunday.getDate() + 7)
      const sundayStr = sunday.toISOString().split('T')[0]
      const nextStr = nextSunday.toISOString().split('T')[0]
      const label = sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      const count = completedSessions.filter((s) => s.date >= sundayStr && s.date < nextStr).length
      result.push({ week: label, count })
    }
    return result
  })()

  // Top 6 exercise classes by completed set count
  const classCount: Record<string, number> = {}
  for (const set of completedSets) {
    const eid = set.routine_exercises?.exercise_id
    if (eid) {
      const ex = exercises.find((e) => e.id === eid)
      if (ex) classCount[ex.class_id] = (classCount[ex.class_id] ?? 0) + 1
    }
  }
  const topExercises = Object.entries(classCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([classId, count]) => {
      const name = exercises.find((e) => e.class_id === classId)?.exercise_classes?.name ?? '—'
      return { label: name, count }
    })

  return (
    <DashboardClient
      sessions={completedSessions}
      summary={{ totalSessions: completedSessions.length, mostTrained, streak }}
      periodProgress={periodProgress}
      weeklyData={weeklyData}
      topExercises={topExercises}
    />
  )
}
