
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'
import { requireStoreSectionPin } from '@/lib/store-section-pin'

type TransferResult =
  | { ok: true; transferId: string }
  | { ok: false; message: string }

type RequestTransferInput = {
  sourceBranchId: string
  destinationBranchId: string
  productVariantId: string
  quantity: number
  note?: string
  idempotencyKey: string
}

function getTransferErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message.toLowerCase() : ''

  if (message.includes('insufficient stock')) {
    return 'الكمية المطلوبة أكبر من المخزون المتاح في فرع المصدر'
  }

  if (message.includes('not authorized for both branches')) {
    return 'يجب أن تكون لديك صلاحية الوصول إلى الفرعين'
  }

  if (
    message.includes('not authorized') ||
    message.includes('branch_access_denied')
  ) {
    return 'ليس لديك صلاحية لتنفيذ العملية على هذه الفروع'
  }

  if (message.includes('not authenticated')) {
    return 'انتهت جلسة الدخول، سجل دخولك مرة أخرى'
  }

  if (message.includes('idempotency key reused')) {
    return 'تم استخدام معرّف الطلب مع بيانات مختلفة. ابدأ طلبًا جديدًا'
  }

  if (message.includes('transfer is not awaiting receipt')) {
    return 'هذا التحويل لم يعد في انتظار الاستلام'
  }

  if (message.includes('only pending transfers can be cancelled')) {
    return 'لا يمكن إلغاء تحويل تم استلامه'
  }

  if (message.includes('invalid product variant')) {
    return 'المنتج المحدد غير موجود في هذا المتجر'
  }

  if (
    message.includes('invalid inventory transfer') ||
    message.includes('invalid transfer branches') ||
    message.includes('invalid quantity')
  ) {
    return 'راجع بيانات التحويل والكمية والفروع'
  }

  return 'تعذر تنفيذ عملية التحويل. حاول مرة أخرى'
}

function validateIdempotencyKey(value: string) {
  return (
    typeof value === 'string' &&
    value.trim().length >= 8 &&
    value.trim().length <= 120
  )
}

export async function requestInventoryTransfer(
  input: RequestTransferInput
): Promise<TransferResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'stock_manager',
    ])

    await requireStoreSectionPin(context)

    if (
      !input.sourceBranchId ||
      !input.destinationBranchId ||
      !input.productVariantId ||
      input.sourceBranchId === input.destinationBranchId ||
      !Number.isFinite(input.quantity) ||
      input.quantity <= 0 ||
      input.quantity > 1000000 ||
      !validateIdempotencyKey(input.idempotencyKey) ||
      (input.note?.length ?? 0) > 1000
    ) {
      return {
        ok: false,
        message: 'راجع بيانات التحويل والكمية والفروع',
      }
    }

    await requireRedaBranch(input.sourceBranchId)
    await requireRedaBranch(input.destinationBranchId)

    const { data, error } = await context.supabase.rpc(
      'dokkan_request_inventory_transfer',
      {
        p_store_id: context.storeId,
        p_source_branch_id: input.sourceBranchId,
        p_destination_branch_id: input.destinationBranchId,
        p_product_variant_id: input.productVariantId,
        p_quantity: input.quantity,
        p_note: input.note?.trim() || null,
        p_idempotency_key: input.idempotencyKey.trim(),
      }
    )

    if (error) {
      console.error('[Inventory Transfer] Request failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getTransferErrorMessage(error),
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم استلام رقم طلب التحويل من قاعدة البيانات',
      }
    }

    revalidatePath('/transfers')
    revalidatePath('/inventory')
    revalidatePath('/products')
    revalidatePath('/dashboard')

    return {
      ok: true,
      transferId: String(data),
    }
  } catch (error) {
    console.error('[Inventory Transfer] Request action failed:', error)

    return {
      ok: false,
      message: getTransferErrorMessage(error),
    }
  }
}

export async function receiveInventoryTransfer(
  transferId: string
): Promise<TransferResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'stock_manager',
    ])

    await requireStoreSectionPin(context)

    if (!transferId?.trim()) {
      return {
        ok: false,
        message: 'يجب تحديد طلب التحويل',
      }
    }

    const { data, error } = await context.supabase.rpc(
      'dokkan_receive_inventory_transfer',
      {
        p_transfer_id: transferId,
      }
    )

    if (error) {
      console.error('[Inventory Transfer] Receive failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getTransferErrorMessage(error),
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم تأكيد استلام التحويل',
      }
    }

    revalidatePath('/transfers')
    revalidatePath('/inventory')
    revalidatePath('/products')
    revalidatePath('/dashboard')

    return {
      ok: true,
      transferId: String(data),
    }
  } catch (error) {
    console.error('[Inventory Transfer] Receive action failed:', error)

    return {
      ok: false,
      message: getTransferErrorMessage(error),
    }
  }
}

export async function cancelInventoryTransfer(
  transferId: string
): Promise<TransferResult> {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
      'stock_manager',
    ])

    await requireStoreSectionPin(context)

    if (!transferId?.trim()) {
      return {
        ok: false,
        message: 'يجب تحديد طلب التحويل',
      }
    }

    const { data, error } = await context.supabase.rpc(
      'dokkan_cancel_inventory_transfer',
      {
        p_transfer_id: transferId,
      }
    )

    if (error) {
      console.error('[Inventory Transfer] Cancel failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false,
        message: getTransferErrorMessage(error),
      }
    }

    if (!data) {
      return {
        ok: false,
        message: 'لم يتم إلغاء طلب التحويل',
      }
    }

    revalidatePath('/transfers')
    revalidatePath('/inventory')
    revalidatePath('/products')
    revalidatePath('/dashboard')

    return {
      ok: true,
      transferId: String(data),
    }
  } catch (error) {
    console.error('[Inventory Transfer] Cancel action failed:', error)

    return {
      ok: false,
      message: getTransferErrorMessage(error),
    }
  }
}
