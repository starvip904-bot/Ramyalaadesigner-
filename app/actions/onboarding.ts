'use server'

import { createClient } from '@/lib/supabase/server'

export async function createMerchantStore() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'سجل الدخول أولًا ثم حاول مرة أخرى.' }
  }

  const { data, error } = await supabase.rpc('dokkan_bootstrap_owner')

  if (error) {
    if (error.message.includes('store already has an owner')) {
      return { error: 'المتجر مربوط بالفعل بحساب مالك آخر.' }
    }

    if (error.message.includes('not authenticated')) {
      return { error: 'انتهت جلسة تسجيل الدخول. سجل الدخول مجددًا.' }
    }

    return {
      error: 'تعذر تفعيل حساب المالك. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم.',
    }
  }

  if (!data) {
    return {
      error: 'تعذر تأكيد تفعيل حساب المالك. حاول مرة أخرى.',
    }
  }

  return { error: null }
}