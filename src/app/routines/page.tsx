import { supabaseServer } from '@/lib/supabase-server'
import RoutinesClient from '@/components/RoutinesClient'

export default async function RoutinesPage() {
  const db = await supabaseServer()
  const [{ data: routines }, { data: archivedRoutines }] = await Promise.all([
    db.from('routines').select('*').is('archived_at', null).order('created_at'),
    db.from('routines').select('*').not('archived_at', 'is', null).order('archived_at', { ascending: false }),
  ])
  return <RoutinesClient routines={routines ?? []} archivedRoutines={archivedRoutines ?? []} />
}
