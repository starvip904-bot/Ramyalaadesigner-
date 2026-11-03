'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function assertStore(storeId: string) {
  const supabase = await createClient()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('يجب تسجيل الدخول')
  const { data: membership } = await supabase.from('dokkan_members').select('id').eq('store_id', storeId).eq('user_id', user.user.id).eq('status', 'active').maybeSingle()
  if (!membership) throw new Error('لا تملك صلاحية لهذا المتجر')
  return supabase
}

export async function createPurchase(storeId: string, input: { branchId: string; supplierId: string | null; notes: string; items: Array<{ variant_id: string; quantity: number; unit_cost: number; discount: number }> }) {
  const supabase = await assertStore(storeId)
  const { data, error } = await supabase.rpc('dokkan_create_purchase', { p_store_id: storeId, p_branch_id: input.branchId, p_supplier_id: input.supplierId, p_items: input.items, p_notes: input.notes || null })
  if (error) throw new Error(error.message.includes('not authorized') ? 'لا تملك صلاحية إنشاء فاتورة لهذا المتجر' : 'تعذر إنشاء فاتورة الشراء')
  revalidatePath('/purchases')
  return data as string
}

export async function receivePurchase(storeId: string, purchaseId: string) {
  const supabase = await assertStore(storeId)
  const { error } = await supabase.rpc('dokkan_receive_purchase', { p_purchase_id: purchaseId })
  if (error) throw new Error('تعذر استلام الفاتورة وتحديث المخزون')
  revalidatePath('/purchases')
}

export async function recordSupplierPayment(storeId: string, purchaseId: string, amount: number, paymentMethod: string, notes: string) {
  const supabase = await assertStore(storeId)
  const { error } = await supabase.rpc('dokkan_record_supplier_payment', { p_purchase_id: purchaseId, p_amount: amount, payment_method: paymentMethod, p_notes: notes || null })
  if (error) throw new Error(error.message.includes('invalid payment') ? 'قيمة الدفعة تتجاوز المتبقي أو غير صحيحة' : 'تعذر تسجيل الدفعة')
  revalidatePath('/purchases')
}
