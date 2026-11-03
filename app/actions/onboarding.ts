'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createMerchantStore(input: { name: string; phone?: string }) {
  const name = input.name.trim()
  if (name.length < 2 || name.length > 120) return { error: 'اكتب اسم متجر صحيحًا.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'يجب تسجيل الدخول أولًا.' }
  const { data, error } = await supabase.rpc('dokkan_create_store_with_free_plan', { store_name: name, store_phone: input.phone?.trim() || null })
  if (error) return { error: error.message === 'store_already_exists' ? 'لديك متجر مرتبط بهذا الحساب بالفعل.' : 'تعذر إنشاء المتجر. حاول مرة أخرى.' }
  revalidatePath('/dashboard')
  return { storeId: data as string }
}
