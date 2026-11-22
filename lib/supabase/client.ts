import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_STORAGE_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STORAGE_SUPABASE_ANON_KEY!,
  )
}
