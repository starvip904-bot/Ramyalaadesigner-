
'use server'

import { createClient } from '@/lib/supabase/server'

type CreateMerchantStoreInput = {
  name: string
  phone?: string
}

export async function createMerchantStore(input: CreateMerchantStoreInput) {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: 'سجل الدخول أولًا ثم حاول مرة أخرى.' }
  }

  const name = input?.name?.trim()
  const phone = input?.phone?.trim() || null

  if (!name || name.length < 2 || name.length > 120) {
    return { error: 'اكتب اسم المتجر بشكل صحيح (من حرفين إلى 120 حرفًا).' }
  }

  if (phone && phone.length > 40) {
    return { error: 'رقم الهاتف طويل جدًا.' }
  }

  const { data, error } = await supabase.rpc('dokkan_create_store', {
    p_name: name,
    p_phone: phone,
  })

  if (error) {
    const message = error.message || ''

    if (message.includes('not authenticated')) {
      return { error: 'انتهت جلسة تسجيل الدخول. سجل الدخول مجددًا.' }
    }

    if (message.includes('user already belongs to a store')) {
      return { error: 'هذا الحساب مرتبط بمتجر بالفعل. سجّل الدخول إلى متجرك.' }
    }

    if (message.includes('invalid store name')) {
      return { error: 'اسم المتجر غير صحيح.' }
    }

    if (message.includes('invalid phone')) {
      return { error: 'رقم الهاتف غير صحيح.' }
    }

    console.error('Dokkan store onboarding failed:', error)

    return {
      error: 'تعذر إنشاء المتجر. حاول مرة أخرى، وإذا استمرت المشكلة تواصل مع الدعم.',
    }
  }

  if (!data) {
    return { error: 'لم يتم تأكيد إنشاء المتجر. حاول مرة أخرى.' }
  }

  return { error: null, storeId: data as string }
}
