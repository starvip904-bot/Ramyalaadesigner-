
import 'server-only'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_STORAGE_SUPABASE_URL

const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL_MISSING')
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_ADMIN_KEY_MISSING')
}

export function createAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}
