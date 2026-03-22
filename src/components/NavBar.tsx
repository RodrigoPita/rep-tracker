import { supabaseServer } from '@/lib/supabase-server'
import NavClient from './NavClient'

export default async function NavBar() {
  const db = await supabaseServer()
  const { data: { user } } = await db.auth.getUser()

  const displayName = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email?.split('@')[0]
    ?? null

  return <NavClient userEmail={user?.email ?? null} displayName={displayName} />
}
