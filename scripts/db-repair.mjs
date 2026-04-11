/**
 * One-time script to mark migrations 001–010 as already applied.
 * Run this once if you set up the project by pasting SQL directly into Supabase
 * instead of using `npm run db:migrate`.
 *
 * Usage: npm run db:repair
 */
import { execSync } from 'child_process'

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD } = process.env

if (!SUPABASE_DB_HOST || !SUPABASE_DB_PORT || !SUPABASE_DB_NAME || !SUPABASE_DB_USER || !SUPABASE_DB_PASSWORD) {
  console.error('Missing one or more SUPABASE_DB_* variables in .env.local')
  console.error('Required: SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const dbUrl = `postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}`

const versions = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']

console.log(`Marking ${versions.length} migrations as applied…`)
execSync(
  `npx supabase migration repair --status applied ${versions.join(' ')} --db-url "${dbUrl}"`,
  { stdio: 'inherit' },
)
console.log('Done. Run `npm run db:migrate` to verify.')
