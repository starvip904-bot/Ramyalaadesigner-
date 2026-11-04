'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext, requireRedaPurchase, requireRedaStoreId } from '@/lib/reda-scope'

async function assertStore(storeId: string, branchId?: string) {
  const scopedStoreId = requireRedaStoreId(storeId)
  const context = await requireRedaContext()
  if (branchId) await requireRedaBranch(branchId)
  return { ...context, storeId: scopedStoreId }
}

export async function createPurchase(storeId: string, input: { branchId: string; supplierId: string | null; notes: string; items: Array<{ variant_id: string; quantity: number; unit_cost: number; discount: number }> }) {
  const { supabase, storeId: scopedStoreId } = await assertStore(storeId, input.branchId)
  const { data, error } = await supabase.rpc('dokkan_create_purchase', { p_store_id: scopedStoreId, p_branch_id: input.branchId, p_supplier_id: input.supplierId, p_items: input.items, p_notes: input.notes || null })
  if (error) throw new Error(error.message.includes('not authorized') ? 'لا تملك صلاحية إنشاء فاتورة لهذا المتجر' : 'تعذر إنشاء فاتورة الشراء')
  revalidatePath('/purchases')
  return data as string
}

export async function receivePurchase(storeId: string, purchaseId: string) {
  const { supabase } = await assertStore(storeId)
  await requireRedaPurchase(purchaseId)
  const { error } = await supabase.rpc('dokkan_receive_purchase', { p_purchase_id: purchaseId })
  if (error) throw new Error('تعذر استلام الفاتورة وتحديث المخزون')
  revalidatePath('/purchases')
}

export type PaymentResult = {
  ok: boolean
  message: string
  diagnosticId: string
  paymentId?: string
}

export async function recordSupplierPayment(storeId: string, purchaseId: string, amount: number, paymentMethod: string, notes: string, idempotencyKey: string): Promise<PaymentResult> {
  const diagnosticId = `pay-${crypto.randomUUID().slice(0, 12)}`
  try {
    if (!Number.isFinite(amount) || amount <= 0 || !idempotencyKey.trim()) {
      return { ok: false, message: 'تحقق من مبلغ الدفعة وحاول مرة أخرى.', diagnosticId }
    }
    const { supabase } = await assertStore(storeId)
    await requireRedaPurchase(purchaseId)
    const { data, error } = await supabase.rpc('dokkan_record_supplier_payment', {
      p_purchase_id: purchaseId,
      p_amount: amount,
      payment_method: paymentMethod,
      p_notes: notes || null,
      p_idempotency_key: idempotencyKey,
    })
    if (error) {
      console.error('[phase1-payment]', { diagnosticId, stage: 'RPC', code: error.code })
      const message = error.message.includes('invalid payment') ? 'قيمة الدفعة تتجاوز المتبقي أو غير صحيحة.' : error.message.includes('not authorized') ? 'لا تملك صلاحية تسجيل دفعة لهذا المتجر.' : 'تعذر تسجيل الدفعة. حاول مرة أخرى.'
      return { ok: false, message, diagnosticId }
    }
    try {
      revalidatePath('/purchases')
    } catch (error) {
      console.error('[phase1-payment]', { diagnosticId, stage: 'REFRESH', error: error instanceof Error ? error.name : 'unknown' })
      return { ok: true, message: 'تم تسجيل الدفعة، لكن تعذر تحديث القائمة تلقائيًا.', diagnosticId, paymentId: data as string }
    }
    return { ok: true, message: 'تم تسجيل دفعة المورد.', diagnosticId, paymentId: data as string }
  } catch (error) {
    console.error('[phase1-payment]', { diagnosticId, stage: 'AUTH_OR_TENANT', error: error instanceof Error ? error.name : 'unknown' })
    return { ok: false, message: 'تعذر التحقق من الجلسة أو المتجر الحالي.', diagnosticId }
  }
}
