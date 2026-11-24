'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'
import type { PaymentMethod } from '@/data/models'

type ReturnItemInput = {
  variantId: string
  quantity: number
}

type CreateSaleReturnInput = {
  saleId: string
  branchId: string
  items: ReturnItemInput[]
  refundMethod?: PaymentMethod | null
  notes?: string
  idempotencyKey: string
}

type CreateSaleExchangeInput = {
  saleId: string
  branchId: string
  returnItems: ReturnItemInput[]
  exchangeItems: ReturnItemInput[]
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
  settlementMethod?: PaymentMethod | null
}

type DecideSaleReturnResult =
  | { ok: true; returnId: string }
  | { ok: false; message: string; retryable?: boolean }

const paymentMethods: PaymentMethod[] = ['cash', 'card', 'transfer']

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

  if (message.includes('insufficient replacement stock')) {
    return 'الكمية المتاحة من الصنف البديل غير كافية في هذا الفرع'
  }

  if (message.includes('exchange settlement method required')) {
    return 'حدد طريقة تحصيل أو رد فرق السعر قبل اعتماد الاستبدال'
  }

  if (message.includes('item not found in sale')) {
    return 'أحد المنتجات غير موجود في الفاتورة'
  }

  if (message.includes('refund method required')) {
    return 'طريقة رد المبلغ مطلوبة لإتمام الموافقة'
  }

  if (
    message.includes('return request not found') ||
    message.includes('exchange request not found')
  ) {
    return 'طلب المرتجع أو الاستبدال غير موجود أو لم يعد متاحًا'
  }

  if (
    message.includes('return request already decided') ||
    message.includes('return request already rejected') ||
    message.includes('exchange request already decided')
  ) {
    return 'تم اتخاذ قرار على الطلب من قبل'
  }

  if (
    message.includes('invalid return') ||
    message.includes('invalid exchange') ||
    message.includes('invalid return quantity') ||
    message.includes('invalid exchange quantity') ||
    message.includes('duplicate return item') ||
    message.includes('duplicate exchange item')
  ) {
    return 'راجع بيانات الأصناف والكميات'
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

function validateItems(items: ReturnItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'اختر صنفًا واحدًا على الأقل'
  }

  const seen = new Set<string>()

  for (const item of items) {
    if (
      !item.variantId ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      item.quantity > 1000000
    ) {
      return 'راجع الأصناف والكميات'
    }

    if (seen.has(item.variantId)) {
      return 'يوجد صنف مكرر في البيانات'
    }

    seen.add(item.variantId)
  }

  return null
}

/**
 * إنشاء طلب مرتجع معلّق.
 * لا يتم تعديل المخزون أو رد المبلغ قبل الاعتماد.
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
      return { ok: false, message: 'بيانات الفاتورة غير مكتملة' }
    }

    await requireRedaBranch(input.branchId)

    const itemsError = validateItems(input.items)
    if (itemsError) {
      return { ok: false, message: itemsError }
    }

    if (
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.trim().length < 8 ||
      input.idempotencyKey.trim().length > 120
    ) {
      return { ok: false, message: 'معرّف طلب المرتجع غير صالح' }
    }

    if (
      input.refundMethod != null &&
      !paymentMethods.includes(input.refundMethod)
    ) {
      return { ok: false, message: 'طريقة رد المبلغ غير صحيحة' }
    }

    if (input.notes && input.notes.length > 1000) {
      return { ok: false, message: 'الملاحظات أطول من الحد المسموح' }
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

    return { ok: true, requestId: String(data) }
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
 * إنشاء طلب استبدال.
 * يتم حفظ الأصناف البديلة وأسعارها الحالية في قاعدة البيانات،
 * ولا تتغير الكميات أو المدفوعات عند تقديم الطلب.
 */
export async function createSaleExchange(
  input: CreateSaleExchangeInput
): Promise<ReturnActionResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'cashier',
    ])

    if (!input.saleId || !input.branchId) {
      return { ok: false, message: 'بيانات الفاتورة غير مكتملة' }
    }

    await requireRedaBranch(input.branchId)

    const returnItemsError = validateItems(input.returnItems)

    if (returnItemsError) {
      return {
        ok: false,
        message: 'أصناف المرتجع: ' + returnItemsError,
      }
    }

    const exchangeItemsError = validateItems(input.exchangeItems)

    if (exchangeItemsError) {
      return {
        ok: false,
        message: 'أصناف البديل: ' + exchangeItemsError,
      }
    }

    if (
      typeof input.idempotencyKey !== 'string' ||
      input.idempotencyKey.trim().length < 8 ||
      input.idempotencyKey.trim().length > 120
    ) {
      return {
        ok: false,
        message: 'معرّف طلب الاستبدال غير صالح',
      }
    }

    if (input.notes && input.notes.length > 1000) {
      return {
        ok: false,
        message: 'الملاحظات أطول من الحد المسموح',
      }
    }

    const { data, error } = await context.supabase.rpc(
      'dokkan_request_sale_exchange',
      {
        p_sale_id: input.saleId,
        p_return_items: input.returnItems.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        p_exchange_items: input.exchangeItems.map((item) => ({
          variant_id: item.variantId,
          quantity: item.quantity,
        })),
        // طريقة التحصيل أو الرد تتحدد عند الاعتماد.
        p_payment_method: null,
        p_notes: input.notes?.trim() || null,
        p_idempotency_key: input.idempotencyKey.trim(),
      }
    )

    if (error) {
      console.error('[Returns] Exchange request RPC failed:', {
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
        message: 'لم يتم استلام رقم طلب الاستبدال',
        retryable: true,
      }
    }

    try {
      revalidateReturnPages()
    } catch (refreshError) {
      console.error(
        '[Returns] Refresh failed after exchange request:',
        refreshError
      )
    }

    return { ok: true, requestId: String(data) }
  } catch (error) {
    console.error('[Returns] Exchange request action failed:', error)

    return {
      ok: false,
      message: getReturnErrorMessage(error),
      retryable: true,
    }
  }
}

/**
 * اعتماد أو رفض طلب مرتجع أو استبدال.
 * الاعتماد متاح للمالك ومدير الفرع المعيّن فقط.
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
        message: 'بيانات القرار غير صحيحة',
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

    if (
      input.settlementMethod != null &&
      !paymentMethods.includes(input.settlementMethod)
    ) {
      return {
        ok: false,
        message: 'طريقة تسوية فرق السعر غير صحيحة',
      }
    }

    const context = await requireRedaContext(['owner', 'manager'])

    const { data: request, error: requestError } =
      await context.supabase
        .from('dokkan_sale_return_requests')
        .select('id, branch_id, return_type')
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
        message: 'تعذر التحقق من الطلب',
        retryable: true,
      }
    }

    if (!request) {
      return {
        ok: false,
        message: 'الطلب غير موجود أو ليس ضمن متجرك',
      }
    }

    await requireRedaBranch(request.branch_id)

    const isExchange = request.return_type === 'exchange'

    if (isExchange) {
      const { data, error } = await context.supabase.rpc(
        'dokkan_decide_sale_exchange',
        {
          p_request_id: input.requestId,
          p_decision: input.decision,
          p_decision_notes: input.decisionNotes?.trim() || null,
          p_settlement_method:
            input.decision === 'approved'
              ? input.settlementMethod ?? null
              : null,
        }
      )

      if (error) {
        console.error(
          '[Returns] Exchange decision RPC failed:',
          {
            code: error.code,
            message: error.message,
          }
        )

        return {
          ok: false,
          message: getReturnErrorMessage(error),
          retryable: !error.code,
        }
      }

      if (!data) {
        return {
          ok: false,
          message: 'لم يتم استلام نتيجة قرار الاستبدال',
          retryable: true,
        }
      }

      try {
        revalidateReturnPages()
      } catch (refreshError) {
        console.error(
          '[Returns] Refresh failed after exchange decision:',
          refreshError
        )
      }

      return { ok: true, returnId: String(data) }
    }

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

    return { ok: true, returnId: String(data) }
  } catch (error) {
    console.error('[Returns] Decision action failed:', error)

    return {
      ok: false,
      message: getReturnErrorMessage(error),
      retryable: true,
    }
  }
}