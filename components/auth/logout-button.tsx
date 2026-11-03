'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton() {
  const [busy, setBusy] = useState(false)
  async function logout() { setBusy(true); const { error } = await createClient().auth.signOut(); if (error) { setBusy(false); return }; window.location.replace('/login') }
  return <button type="button" onClick={logout} disabled={busy} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#b44b4b] transition hover:bg-[#fff1f1] disabled:opacity-60"><LogOut size={18}/>{busy ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}</button>
}
