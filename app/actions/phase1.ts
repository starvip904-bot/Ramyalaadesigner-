'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type SavePhase = 'AUTH' | 'TENANT_CONTEXT' | 'MEMBERSHIP' | 'RPC' | 'REFRESH_LIST'
type CustomerSaveResult = { ok: true; id: string; diagnosticId: string } | { ok: false; diagnosticId: string; message: string }

class PhaseError extends Error {
  constructor(public readonly phase: SavePhase, message: string) {
    super(message)
  }
}

function getErrorDigest(error: unknown) {
  if (error && typeof error === 'object' && 'digest' in error) return String(error.digest)
  return undefined
}

function createDiagnosticId() {
  return `cust-${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`
}

function toSafeMessage(error: unknown) {
  if (error instanceof Error && error.message.includes('not authorized')) return 'ليس لديك صلاحية تنفيذ هذه العملية'
  if (error instanceof Error && (error.message.includes('invalid customer') || error.message.includes('invalid supplier'))) return 'تحقق من البيانات المطلوبة'
  if (error instanceof Error && (error.message.includes('duplicate') || error.message.includes('already exists'))) return 'هذا السجل موجود بالفعل'
  if (error instanceof PhaseError && error.message === 'auth') return 'انتهت جلسة الدخول، يرجى تسجيل الدخول مرة أخرى'
  return 'تعذر حفظ العميل حاليًا'
}

async function callRpc<T>(name: string, args: Record<string, unknown>, diagnosticId = 'phase1') {
  const supabase = await createClient()
  console.info('[v0] Phase 1 RPC start', { operation: 'create_customer', name, diagnosticId })
  const { data, error } = await supabase.rpc(name, args)
  if (error) {
    console.error('[v0] Phase 1 RPC failed', { operation: 'create_customer', name, code: error.code, digest: getErrorDigest(error), diagnosticId })
    throw new PhaseError('RPC', error.message)
  }
  return data as T
}

async function assertStoreMembership(storeId: string, diagnosticId: string) {
  console.info('[v0] Phase 1 tenant context start', { operation: 'create_customer', diagnosticId })
  if (!storeId || !crypto.randomUUID) throw new PhaseError('TENANT_CONTEXT', 'invalid tenant')
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    console.error('[v0] Phase 1 auth failed', { operation: 'create_customer', code: userError?.name, diagnosticId })
    throw new PhaseError('AUTH', 'auth')
  }
  const { data, error } = await supabase.from('dokkan_members').select('store_id').eq('user_id', user.id).eq('store_id', storeId).eq('status', 'active').maybeSingle()
  if (error || !data) {
    console.error('[v0] Phase 1 membership failed', { operation: 'create_customer', code: error?.code, diagnosticId })
    throw new PhaseError('MEMBERSHIP', 'not authorized')
  }
}

export async function createCustomer(input: { storeId: string; name: string; phone?: string; address?: string; notes?: string }): Promise<CustomerSaveResult> {
  const diagnosticId = createDiagnosticId()
  try {
    if (!input.name.trim()) return { ok: false, diagnosticId, message: 'أدخل اسم العميل' }
    await assertStoreMembership(input.storeId, diagnosticId)
    const id = await callRpc<string>('dokkan_create_customer', { p_store_id: input.storeId, p_name: input.name.trim(), p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null }, diagnosticId)
    try {
      revalidatePath('/customers')
    } catch (error) {
      console.error('[v0] Phase 1 refresh failed', { operation: 'create_customer', digest: getErrorDigest(error), diagnosticId })
      throw new PhaseError('REFRESH_LIST', 'refresh failed')
    }
    return { ok: true, id, diagnosticId }
  } catch (error) {
    const phase = error instanceof PhaseError ? error.phase : 'RPC'
    console.error('[v0] Phase 1 customer save failed', { operation: 'create_customer', phase, digest: getErrorDigest(error), diagnosticId })
    return { ok: false, diagnosticId, message: toSafeMessage(error) }
  }
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
