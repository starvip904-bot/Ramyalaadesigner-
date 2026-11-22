
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

type ReturnActionResult =
  | { ok: true; requestId: string }
  | { ok: false; message: string; retryable?: boolean }

type DecideSaleReturnInput = {
  requestId: string
  decision: 'approved' | 'rejected'
  decisionNotes?: string
}

type DecideSaleReturnResult =
  | { ok: true; returnId: string }
  | { ok: false; message: string; retryable?: boolean }

function getReturnErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('not authorized')) {
    return 'ليس لديك صلاحية تنفيذ هذه العملية على هذا الفرع'
  }

  if (message.includes('not authenticated')) {
    return 'انتهت جلسة الدخول، سجل دخولك مرة أخرى'
  }

  if (message.includes('sale already returned')) {
    return 'هذه الفاتورة تم إرجاعها بالكامل'
  }

  if (
    message.includes('return quantity exceeds available quantity') ||
    message.includes('return quantity exceeds sold quantity')
  ) {
    return 'الكمية المطلوبة أكبر من الكمية المتبقية القابلة للمرتجع'
  }

  if (message.includes('item not found in sale')) {
    return 'أحد المنتجات غير موجود في الفاتورة'
  }

  if (message.includes('refund method required')) {
    return 'طريقة رد المبلغ مطلوبة لإتمام الموافقة'
  }

  if (message.includes('return request not found')) {
    return 'طلب المرتجع غير موجود أو لم يعد متاحًا'
  }

  if (
    message.includes('return request already decided') ||
    message.includes('return request already rejected')
  ) {
    return 'تم اتخاذ قرار على طلب المرتجع من قبل'
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
    return 'معرّف العملية مستخدم في طلب آخر، حاول مرة أخرى'
  }

  return 'تعذر تنفيذ العملية حاليًا'
}

function revalidateReturnPages() {
  revalidatePath('/returns')
  revalidatePath('/sales')
  revalidatePath('/inventory')
  revalidatePath('/dashboard')
  revalidatePath('/reports')
}

/**
 * إنشاء طلب مرتجع معلّق.
 * الكاشير والمالك ومدير الإدارة ومدير الفرع يمكنهم تقديم الطلب.
 * لا يتم تعديل المخزون أو رصيد الفاتورة هنا.
 */
export async function createSaleReturn(
  input: CreateSaleReturnInput
): Promise<ReturnActionResult> {
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
        message: 'معرّف طلب المرتجع غير صالح',
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
      'dokkan_request_sale_return',
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
      console.error('[Returns] Request RPC failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getReturnErrorMessage(error),
        retryable: !error.code,
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم استلام رقم طلب المرتجع',
        retryable: true,
      }
    }

    try {
      revalidateReturnPages()
    } catch (refreshError) {
      console.error(
        '[Returns] Refresh failed after request creation:',
        refreshError
      )
    }

    return {
      ok: true,
      requestId: String(data),
    }
  } catch (error) {
    console.error('[Returns] Request action failed:', error)

    return {
      ok: false,
      message: getReturnErrorMessage(error),
      retryable: true,
    }
  }
}

/**
 * اعتماد أو رفض طلب مرتجع.
 * الاعتماد متاح للمالك ومدير الفرع المعيّن فقط.
 * مدير الإدارة والكاشير ومدير المخزن لا يعتمدون المرتجعات.
 */
export async function decideSaleReturn(
  input: DecideSaleReturnInput
): Promise<DecideSaleReturnResult> {
  try {
    if (
      !input.requestId ||
      !['approved', 'rejected'].includes(input.decision)
    ) {
      return {
        ok: false,
        message: 'بيانات قرار المرتجع غير صحيحة',
      }
    }

    if (
      input.decisionNotes &&
      input.decisionNotes.length > 1000
    ) {
      return {
        ok: false,
        message: 'ملاحظات القرار أطول من الحد المسموح',
      }
    }

    const context = await requireRedaContext([
      'owner',
      'manager',
    ])

    const { data: request, error: requestError } =
      await context.supabase
        .from('dokkan_sale_return_requests')
        .select('id, branch_id')
        .eq('id', input.requestId)
        .eq('store_id', context.storeId)
        .maybeSingle()

    if (requestError) {
      console.error(
        '[Returns] Request lookup failed:',
        requestError
      )

      return {
        ok: false,
        message: 'تعذر التحقق من طلب المرتجع',
        retryable: true,
      }
    }

    if (!request) {
      return {
        ok: false,
        message: 'طلب المرتجع غير موجود أو ليس ضمن متجرك',
      }
    }

    // يثبت أن مدير الفرع معيّن لهذا الفرع.
    // المالك يحتفظ بصلاحية الوصول على مستوى المتجر.
    await requireRedaBranch(request.branch_id)

    const { data, error } = await context.supabase.rpc(
      'dokkan_decide_sale_return',
      {
        p_request_id: input.requestId,
        p_decision: input.decision,
        p_decision_notes: input.decisionNotes?.trim() || null,
      }
    )

    if (error) {
      console.error('[Returns] Decision RPC failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getReturnErrorMessage(error),
        retryable: !error.code,
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم استلام نتيجة قرار المرتجع',
        retryable: true,
      }
    }

    try {
      revalidateReturnPages()
    } catch (refreshError) {
      console.error(
        '[Returns] Refresh failed after decision:',
        refreshError
      )
    }

    return {
      ok: true,
      returnId: String(data),
    }
  } catch (error) {
    console.error('[Returns] Decision action failed:', error)

    return {
      ok: false,
      message: getReturnErrorMessage(error),
      retryable: true,
    }
  }
}
