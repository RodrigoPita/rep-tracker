import { supabaseServer } from '@/lib/supabase-server'
import AnalyticsClient from '@/components/AnalyticsClient'
import type { ExerciseWithClass, WorkoutSession, WorkoutSet } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'

export default async function AnalyticsPage() {
  const db = await supabaseServer()

  const [{ data: exercisesData }, { data: sessions }, { data: allSets }] = await Promise.all([
    db.from('exercises').select('*, exercise_classes(*)').order('exercise_classes(name)'),
    db.from('workout_sessions').select('*').not('completed_at', 'is', null).order('date'),
    db.from('workout_sets').select('*, routine_exercises(exercise_id)').eq('completed', true),
  ])

  const exercises = (exercisesData ?? []) as ExerciseWithClass[]
  const completedSessions: WorkoutSession[] = sessions ?? []
  const completedSets: (WorkoutSet & { routine_exercises: { exercise_id: string } })[] = allSets ?? []

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
  const sessionDates = [...new Set(completedSessions.map((s) => s.date))].sort().reverse()
  let streak = 0
  const today = new Date().toISOString().split('T')[0]
  let cursor = today
  for (const date of sessionDates) {
    if (date === cursor) {
      streak++
      const d = new Date(cursor)
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().split('T')[0]
    } else break
  }

  const summary = { totalSessions: completedSessions.length, mostTrained, streak }

  return (
    <AnalyticsClient
      exercises={exercises}
      summary={summary}
    />
  )
}
