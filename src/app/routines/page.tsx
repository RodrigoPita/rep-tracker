import { supabaseServer } from '@/lib/supabase-server'
import RoutinesClient from '@/components/RoutinesClient'

export default async function RoutinesPage() {
  const db = supabaseServer()
  const { data: routines } = await db.from('routines').select('*').order('created_at')
  return <RoutinesClient routines={routines ?? []} />
}
