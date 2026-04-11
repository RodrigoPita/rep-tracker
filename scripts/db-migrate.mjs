import { execSync } from 'child_process'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Missing DATABASE_URL in .env.local')
  console.error('Get it from: Supabase → Settings → Database → Connection Pooling → Session mode → URI')
  process.exit(1)
}

execSync(`npx supabase db push --db-url "${dbUrl}"`, { stdio: 'inherit' })
