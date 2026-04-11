/**
 * One-time script to mark migrations 001–010 as already applied.
 * Run this once if you set up the project by pasting SQL directly into Supabase
 * instead of using `npm run db:migrate`.
 *
 * Usage: npm run db:repair
 */
import { execSync } from 'child_process'

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) {
  console.error('Missing DATABASE_URL in .env.local')
  console.error('Get it from: Supabase → Settings → Database → Connection Pooling → Session mode → URI')
  process.exit(1)
}

const versions = ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010']

console.log(`Marking ${versions.length} migrations as applied…`)
execSync(
  `npx supabase migration repair --status applied ${versions.join(' ')} --db-url "${dbUrl}"`,
  { stdio: 'inherit' },
)
console.log('Done. Run `npm run db:migrate` to verify.')
