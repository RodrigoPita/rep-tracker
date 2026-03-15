import { supabaseServer } from '@/lib/supabase-server'
import NavClient from './NavClient'

export default async function NavBar() {
  const db = await supabaseServer()
  const { data: { user } } = await db.auth.getUser()

  return <NavClient userEmail={user?.email ?? null} />
}
