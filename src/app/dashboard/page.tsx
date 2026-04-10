import { supabaseServer } from '@/lib/supabase-server'
import DashboardClient from '@/components/DashboardClient'
import type { ExerciseWithClass, WorkoutSession, WorkoutSet } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
import { computeCurrentStreak } from '@/lib/utils'
import type { UserAchievement } from '@/lib/achievements'

function formatMin(min: number): string {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default async function DashboardPage() {
  const db = await supabaseServer()

  const [
    { data: exercisesData },
    { data: sessionsData },
    { data: allSetsData },
    { data: activePeriodData },
    { data: achievementsData },
  ] = await Promise.all([
    db.from('exercises').select('*, exercise_classes(*)').order('exercise_classes(name)'),
    db.from('workout_sessions').select('*').not('completed_at', 'is', null).order('date'),
    db.from('workout_sets').select('*, routine_exercises(exercise_id)').eq('completed', true).not('completed_at', 'is', null),
    db.from('routine_periods')
      .select('*, routines(id, name)')
      .is('completed_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
    db.from('user_achievements').select('*').order('earned_at', { ascending: false }),
  ])

  const exercises = (exercisesData ?? []) as ExerciseWithClass[]
  const completedSessions: WorkoutSession[] = sessionsData ?? []
  const completedSets: (WorkoutSet & { routine_exercises: { exercise_id: string } })[] = allSetsData ?? []

  // Average session duration — first set started_at → last set completed_at.
  // Falls back to session created_at → completed_at for older sessions without per-set tracking.
  const avgDurationMin = (() => {
    if (completedSessions.length === 0) return null
    const durations: number[] = []
    for (const session of completedSessions) {
      if (!session.completed_at) continue
      const sessionSets = completedSets.filter((s) => s.session_id === session.id)
      const starts = sessionSets.map((s) => s.started_at).filter(Boolean) as string[]
      const ends = sessionSets.map((s) => s.completed_at).filter(Boolean) as string[]
      if (starts.length > 0 && ends.length > 0) {
        const first = Math.min(...starts.map((s) => new Date(s).getTime()))
        const last = Math.max(...ends.map((e) => new Date(e).getTime()))
        durations.push((last - first) / 60000)
      } else {
        durations.push((new Date(session.completed_at).getTime() - new Date(session.created_at).getTime()) / 60000)
      }
    }
    return durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null
  })()

  // Average active time per session (only for sets with started_at tracking)
  const setsBySession = completedSets.reduce<Record<string, WorkoutSet[]>>((acc, s) => {
    if (!acc[s.session_id]) acc[s.session_id] = []
    acc[s.session_id].push(s)
    return acc
  }, {})
  const sessionActiveTimes = Object.values(setsBySession)
    .map((sets) =>
      sets.reduce((sum, s) => {
        if (s.started_at && s.completed_at) {
          return sum + (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000
        }
        return sum
      }, 0)
    )
    .filter((t) => t > 0)
  const avgActiveMin = sessionActiveTimes.length > 0
    ? Math.round(sessionActiveTimes.reduce((a, b) => a + b, 0) / sessionActiveTimes.length)
    : null

  const timeStats = avgDurationMin !== null
    ? { avgDuration: formatMin(avgDurationMin), avgActive: avgActiveMin !== null ? formatMin(avgActiveMin) : null }
    : null

  // Most trained exercise
  const exerciseCount: Record<string, number> = {}
  for (const set of completedSets) {
    const eid = set.routine_exercises?.exercise_id
    if (eid) exerciseCount[eid] = (exerciseCount[eid] ?? 0) + 1
  }
  const mostTrainedId = Object.entries(exerciseCount).sort((a, b) => b[1] - a[1])[0]?.[0]
  const mostTrainedEx = exercises.find((e) => e.id === mostTrainedId)
  const mostTrained = mostTrainedEx ? exerciseLabel(mostTrainedEx) : '—'

  const now = new Date()

  // Streak
  const sessionDatesUniq = [...new Set(completedSessions.map((s) => s.date))]
  const streak = computeCurrentStreak(sessionDatesUniq)

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

  const achievements = (achievementsData ?? []) as UserAchievement[]

  return (
    <DashboardClient
      sessions={completedSessions}
      summary={{ totalSessions: completedSessions.length, mostTrained, streak }}
      periodProgress={periodProgress}
      weeklyData={weeklyData}
      topExercises={topExercises}
      timeStats={timeStats}
      achievements={achievements}
    />
  )
}
