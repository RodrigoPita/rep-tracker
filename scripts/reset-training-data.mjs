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

console.log(`Resetting training data for user ${userId}…`)

const { error: achievementsError } = await supabase
  .from('user_achievements')
  .delete()
  .eq('user_id', userId)
if (achievementsError) { console.error('user_achievements:', achievementsError.message); process.exit(1) }
console.log('✓ user_achievements')

const { error: periodsError } = await supabase
  .from('routine_periods')
  .delete()
  .eq('user_id', userId)
if (periodsError) { console.error('routine_periods:', periodsError.message); process.exit(1) }
console.log('✓ routine_periods')

const { data: sessions } = await supabase
  .from('workout_sessions')
  .select('id')
  .eq('user_id', userId)

const sessionIds = (sessions ?? []).map((s) => s.id)

if (sessionIds.length > 0) {
  const { error: setsError } = await supabase
    .from('workout_sets')
    .delete()
    .in('session_id', sessionIds)
  if (setsError) { console.error('workout_sets:', setsError.message); process.exit(1) }
  console.log('✓ workout_sets')

  const { error: sessionsError } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('user_id', userId)
  if (sessionsError) { console.error('workout_sessions:', sessionsError.message); process.exit(1) }
  console.log('✓ workout_sessions')
} else {
  console.log('✓ workout_sets (none)')
  console.log('✓ workout_sessions (none)')
}

console.log('Done. Routines, exercises, and library are untouched.')
