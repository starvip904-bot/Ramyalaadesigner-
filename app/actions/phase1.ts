'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function getErrorDigest(error: unknown) {
  if (error && typeof error === 'object' && 'digest' in error) return String(error.digest)
  return undefined
}

async function callRpc<T>(name: string, args: Record<string, unknown>) {
  const supabase = await createClient()
  console.info('[v0] Phase 1 RPC start', { name })
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    console.error('[v0] Phase 1 RPC failed', { name, code: error.code, digest: getErrorDigest(error), message: error.message })
    if (error.message.includes('not authorized')) throw new Error('ليس لديك صلاحية تنفيذ هذه العملية')
    if (error.message.includes('invalid customer') || error.message.includes('invalid supplier')) throw new Error('تحقق من البيانات المطلوبة')
    if (error.message.includes('duplicate') || error.code === '23505') throw new Error('هذا السجل موجود بالفعل')
    throw new Error('تعذر حفظ البيانات حاليًا')
  }
  return data as T
}

async function assertStoreMembership(storeId: string) {
  console.info('[v0] Phase 1 customer membership check')
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('[v0] Phase 1 customer auth failed', { code: userError?.name })
    throw new Error('انتهت جلسة الدخول، يرجى تسجيل الدخول مرة أخرى')
  }
  const { data, error } = await supabase.from('dokkan_members').select('store_id').eq('user_id', user.id).eq('store_id', storeId).eq('status', 'active').maybeSingle()
  if (error || !data) throw new Error('ليس لديك صلاحية لهذا المتجر')
}

export async function createCustomer(input: { storeId: string; name: string; phone?: string; address?: string; notes?: string }) {
  await assertStoreMembership(input.storeId)
  const id = await callRpc<string>('dokkan_create_customer', { p_store_id: input.storeId, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/customers')
  return id
}

export async function updateCustomer(input: { id: string; name: string; phone?: string; address?: string; notes?: string }) {
  await callRpc<void>('dokkan_update_customer', { p_customer_id: input.id, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/customers')
}

export async function archiveCustomer(id: string) {
  await callRpc<void>('dokkan_archive_customer', { p_customer_id: id })
  revalidatePath('/customers')
}

export async function createSupplier(input: { storeId: string; name: string; phone?: string; address?: string; notes?: string }) {
  const id = await callRpc<string>('dokkan_create_supplier', { p_store_id: input.storeId, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/suppliers')
  return id
}

export async function updateSupplier(input: { id: string; name: string; phone?: string; address?: string; notes?: string }) {
  await callRpc<void>('dokkan_update_supplier', { p_supplier_id: input.id, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/suppliers')
}

export async function archiveSupplier(id: string) {
  await callRpc<void>('dokkan_archive_supplier', { p_supplier_id: id })
  revalidatePath('/suppliers')
}

export async function saveStoreSettings(input: { storeId: string; address?: string; logoUrl?: string; invoicePrefix: string; nextInvoiceNumber: number; printFormat: string; paperSize: string; rtl: boolean; currency: string; taxEnabled: boolean; taxRate?: number | null }) {
  await callRpc<void>('dokkan_upsert_store_settings', { p_store_id: input.storeId, p_address: input.address ?? null, p_logo_url: input.logoUrl ?? null, p_invoice_prefix: input.invoicePrefix, p_next_invoice_number: input.nextInvoiceNumber, p_print_format: input.printFormat, p_paper_size: input.paperSize, p_rtl: input.rtl, p_currency: input.currency, p_tax_enabled: input.taxEnabled, p_tax_rate: input.taxRate ?? null })
  revalidatePath('/settings')
}
