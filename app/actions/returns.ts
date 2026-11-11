
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'
import type { PaymentMethod } from '@/data/models'

type CreateSaleReturnInput = {
  saleId: string
  branchId: string
  items: Array<{
    variantId: string
    quantity: number
  }>
  refundMethod?: PaymentMethod | null
  notes?: string
  idempotencyKey: string
}

type CreateSaleReturnResult =
  | { ok: true; returnId: string }
  | { ok: false; message: string }

function getReturnErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('not authorized')) {
    return 'ليس لديك صلاحية تنفيذ المرتجع على هذا الفرع'
  }

  if (message.includes('not authenticated')) {
    return 'انتهت جلسة الدخول، سجل دخولك مرة أخرى'
  }

  if (message.includes('sale already returned')) {
    return 'هذه الفاتورة تم إرجاعها بالكامل'
  }

  if (message.includes('return quantity exceeds sold quantity')) {
    return 'الكمية المطلوبة أكبر من الكمية المتبقية القابلة للمرتجع'
  }

  if (message.includes('item not found in sale')) {
    return 'أحد المنتجات غير موجود في الفاتورة'
  }

  if (message.includes('refund method required')) {
    return 'اختر طريقة رد المبلغ للعميل'
  }

  if (
    message.includes('invalid return') ||
    message.includes('invalid return quantity') ||
    message.includes('duplicate return item')
  ) {
    return 'راجع بيانات المرتجع والكميات'
  }

  if (
    message.includes('return amount exceeds') ||
    message.includes('refund exceeds paid amount')
  ) {
    return 'قيمة المرتجع تتجاوز المبلغ المسموح به'
  }

  if (message.includes('idempotency key already used')) {
    return 'معرّف العملية مستخدم في مرتجع آخر، حاول مرة أخرى'
  }

  return 'تعذر تسجيل المرتجع حاليًا'
}

export async function createSaleReturn(
  input: CreateSaleReturnInput
): Promise<CreateSaleReturnResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'cashier',
    ])

    if (!input.saleId || !input.branchId) {
      return {
        ok: false,
        message: 'بيانات الفاتورة غير مكتملة',
      }
    }

    await requireRedaBranch(input.branchId)

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return {
        ok: false,
        message: 'اختر صنفًا واحدًا على الأقل للمرتجع',
      }
    }

    if (
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.trim().length < 8 ||
      input.idempotencyKey.trim().length > 120
    ) {
      return {
        ok: false,
        message: 'معرّف عملية المرتجع غير صالح',
      }
    }

    if (
      input.refundMethod != null &&
      !['cash', 'card', 'transfer'].includes(input.refundMethod)
    ) {
      return {
        ok: false,
        message: 'طريقة رد المبلغ غير صحيحة',
      }
    }

    if (input.notes && input.notes.length > 1000) {
      return {
        ok: false,
        message: 'الملاحظات أطول من الحد المسموح',
      }
    }

    const seen = new Set<string>()

    for (const item of input.items) {
      if (
        !item.variantId ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 1000000
      ) {
        return {
          ok: false,
          message: 'راجع الأصناف والكميات المرتجعة',
        }
      }

      if (seen.has(item.variantId)) {
        return {
          ok: false,
          message: 'يوجد صنف مكرر في بيانات المرتجع',
        }
      }

      seen.add(item.variantId)
    }

    const { data, error } = await context.supabase.rpc(
      'dokkan_create_sale_return',
      {
        p_sale_id: input.saleId,
        p_items: input.items.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        p_refund_method: input.refundMethod ?? null,
        p_notes: input.notes?.trim() || null,
        p_idempotency_key: input.idempotencyKey.trim(),
      }
    )

    if (error) {
      console.error('[Returns] RPC failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getReturnErrorMessage(error),
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم استلام رقم المرتجع من قاعدة البيانات',
      }
    }

    revalidatePath('/returns')
    revalidatePath('/sales')
    revalidatePath('/inventory')
    revalidatePath('/dashboard')

    return {
      ok: true,
      returnId: String(data),
    }
  } catch (error) {
    console.error('[Returns] Action failed:', error)

    return {
      ok: false,
      message: getReturnErrorMessage(error),
    }
  }
}
