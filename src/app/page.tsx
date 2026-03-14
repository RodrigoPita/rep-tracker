import { supabaseServer } from '@/lib/supabase-server'
import HomeClient from '@/components/HomeClient'

export default async function HomePage() {
  const db = supabaseServer()
  const [{ data: routines }, { data: activeSessions }] = await Promise.all([
    db.from('routines').select('*').order('created_at'),
    db.from('workout_sessions').select('*').is('completed_at', null).order('created_at', { ascending: false }),
  ])

  return (
    <HomeClient
      routines={routines ?? []}
      activeSessions={activeSessions ?? []}
    />
  )
}
