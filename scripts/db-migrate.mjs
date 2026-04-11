import { execSync } from 'child_process'

const { SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD } = process.env

if (!SUPABASE_DB_HOST || !SUPABASE_DB_PORT || !SUPABASE_DB_NAME || !SUPABASE_DB_USER || !SUPABASE_DB_PASSWORD) {
  console.error('Missing one or more SUPABASE_DB_* variables in .env.local')
  console.error('Required: SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const dbUrl = `postgresql://${SUPABASE_DB_USER}:${SUPABASE_DB_PASSWORD}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}`

execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: 'inherit' })
