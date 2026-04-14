import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const userId = process.env.ADMIN_USER_ID

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
if (!userId) {
  console.error('Missing ADMIN_USER_ID in .env.local')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey)

const { data: archived, error: fetchError } = await supabase
  .from('routines')
  .select('id, name')
  .eq('user_id', userId)
  .not('archived_at', 'is', null)

if (fetchError) { console.error('Failed to fetch archived routines:', fetchError.message); process.exit(1) }

if (!archived || archived.length === 0) {
  console.log('No archived routines found.')
  process.exit(0)
}

console.log(`Found ${archived.length} archived routine(s) to delete:`)
for (const r of archived) console.log(`  - ${r.name} (${r.id})`)
console.log('Deleting… (cascades to routine_exercises, routine_periods, workout_sessions, workout_sets)')

const { error: deleteError } = await supabase
  .from('routines')
  .delete()
  .eq('user_id', userId)
  .not('archived_at', 'is', null)

if (deleteError) { console.error('Delete failed:', deleteError.message); process.exit(1) }

console.log(`✓ Deleted ${archived.length} archived routine(s) and all associated data.`)
