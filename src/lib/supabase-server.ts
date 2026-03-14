import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client for use in server components.
 * A new instance is created per call (per request) — do not share across requests.
 */
export function supabaseServer() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
