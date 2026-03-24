import { supabaseServer } from '@/lib/supabase-server'
import HomeClient from '@/components/HomeClient'

export default async function HomePage() {
  const db = await supabaseServer()
  const [{ data: routines }, { data: activeSessions }, { data: periods }, { data: completedSessions }] = await Promise.all([
    db.from('routines').select('*').is('archived_at', null).order('created_at'),
    db.from('workout_sessions').select('*').is('completed_at', null).order('created_at', { ascending: false }),
    db.from('routine_periods').select('*').is('completed_at', null),
    db.from('workout_sessions').select('routine_id, completed_at').not('completed_at', 'is', null),
  ])

  const sessionCounts = (periods ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.routine_id] = (completedSessions ?? []).filter(
      (s) => s.routine_id === p.routine_id && s.completed_at! >= p.started_at
    ).length
    return acc
  }, {})

  return (
    <HomeClient
      routines={routines ?? []}
      activeSessions={activeSessions ?? []}
      periods={periods ?? []}
      sessionCounts={sessionCounts}
    />
  )
}
