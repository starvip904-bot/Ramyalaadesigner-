
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'
import type { PaymentMethod } from '@/data/models'

type CreateSaleInput = {
  branchId: string
  items: Array<{
    variantId: string
    quantity: number
  }>
  discountPercent: number
  amountPaid: number
  paymentMethod: PaymentMethod
  customerId?: string | null
  notes?: string
  idempotencyKey: string
}

type CreateSaleResult =
  | { ok: true; saleId: string }
  | { ok: false; message: string }

function getSaleErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('insufficient stock')) {
    return 'الكمية المطلوبة أكبر من المخزون المتاح'
  }

  if (message.includes('not authorized')) {
    return 'ليس لديك صلاحية تنفيذ عملية البيع'
  }

  if (message.includes('not authenticated')) {
    return 'انتهت جلسة الدخول، سجل دخولك مرة أخرى'
  }

  if (message.includes('invalid customer')) {
    return 'العميل المحدد غير موجود أو غير نشط'
  }

  if (message.includes('invalid payment')) {
    return 'راجع طريقة الدفع'
  }

  if (message.includes('invalid product') || message.includes('invalid product variant')) {
    return 'أحد المنتجات غير موجود أو غير نشط'
  }

  if (message.includes('invalid quantity') || message.includes('invalid sale') || message.includes('duplicate sale item')) {
    return 'راجع بيانات الفاتورة والكميات'
  }

  return 'تعذر حفظ الفاتورة. حاول مرة أخرى'
}

export async function createPosSale(
  input: CreateSaleInput
): Promise<CreateSaleResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'cashier',
    ])

    if (!input.branchId) {
      return { ok: false, message: 'اختر الفرع أولاً' }
    }

    await requireRedaBranch(input.branchId)

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { ok: false, message: 'أضف منتجات إلى الفاتورة' }
    }

    if (
      !Number.isFinite(input.discountPercent) ||
      input.discountPercent < 0 ||
      input.discountPercent > 100
    ) {
      return { ok: false, message: 'نسبة الخصم غير صحيحة' }
    }

    if (!Number.isFinite(input.amountPaid) || input.amountPaid < 0) {
      return { ok: false, message: 'بيانات الدفع غير صحيحة' }
    }

    if (!['cash', 'wallet', 'transfer'].includes(input.paymentMethod)) {
      return { ok: false, message: 'طريقة الدفع غير صحيحة' }
    }

    if (
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.trim().length < 8
    ) {
      return { ok: false, message: 'معرّف الفاتورة غير صالح' }
    }

    const seen = new Set<string>()

    for (const item of input.items) {
      if (
        !item.variantId ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return { ok: false, message: 'راجع المنتجات والكميات' }
      }

      if (seen.has(item.variantId)) {
        return { ok: false, message: 'يوجد منتج مكرر في الفاتورة' }
      }

      seen.add(item.variantId)
    }

    const { data, error } = await context.supabase.rpc(
      'dokkan_create_sale',
      {
        p_store_id: context.storeId,
        p_branch_id: input.branchId,
        p_items: input.items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
          discount: 0,
        })),
        p_discount_percent: input.discountPercent,
        p_amount_paid: input.amountPaid,
        p_payment_method: input.paymentMethod,
        p_customer_id: input.customerId ?? null,
        p_notes: input.notes?.trim() || null,
        p_idempotency_key: input.idempotencyKey.trim(),
      }
    )

    if (error) {
      console.error('[POS] Sale RPC failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getSaleErrorMessage(error),
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم استلام رقم الفاتورة من قاعدة البيانات',
      }
    }

    try {
      revalidatePath('/pos')
      revalidatePath('/dashboard')
      revalidatePath('/sales')
    } catch (refreshError) {
      console.error('[POS] Refresh failed after successful sale:', refreshError)
    }

    return {
      ok: true,
      saleId: String(data),
    }
  } catch (error) {
    console.error('[POS] Sale action failed:', error)

    return {
      ok: false,
      message: getSaleErrorMessage(error),
    }
  }
}
