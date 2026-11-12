'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function logout() { setBusy(true); const { error } = await createClient().auth.signOut(); if (error) { setBusy(false); return }; window.location.replace('/login') }
  return <button type="button" onClick={logout} disabled={busy} aria-label="تسجيل الخروج" className={`flex items-center gap-2 rounded-xl text-sm font-semibold text-[#b44b4b] transition hover:bg-[#fff1f1] disabled:opacity-60 ${compact ? 'px-2.5 py-2' : 'w-full px-3 py-2.5'}`}><LogOut size={18}/><span className={compact ? 'hidden sm:inline' : ''}>{busy ? 'جارٍ تسجيل الخروج...' : 'تسجيل الخروج'}</span></button>
}
