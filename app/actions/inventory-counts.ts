
'use server'

import { revalidatePath } from 'next/cache'
import {
  requireRedaBranch,
  requireRedaContext,
} from '@/lib/reda-scope'
import { requireStoreSectionPin } from '@/lib/store-section-pin'

const COUNT_ROLES = [
  'owner',
  'manager',
  'admin',
  'stock_manager',
]

const APPROVE_ROLES = ['owner', 'manager']

function refreshInventoryCountPages() {
  revalidatePath('/inventory-counts')
  revalidatePath('/inventory')
  revalidatePath('/products')
}

function validateId(value: string, message: string) {
  if (!value?.trim()) {
    throw new Error(message)
  }
}

export async function createInventoryCountAction(input: {
  branchId: string
  countNumber: string
  countType: 'full' | 'partial'
  notes?: string
  originalCountId?: string
}) {
  const context = await requireRedaContext(COUNT_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.branchId, 'يجب اختيار الفرع.')
  validateId(input.countNumber, 'يجب إدخال رقم الجرد.')

  const countNumber = input.countNumber.trim()
  const notes = input.notes?.trim() || null

  if (countNumber.length > 80) {
    throw new Error('رقم الجرد طويل أكثر من اللازم.')
  }

  if (notes && notes.length > 1000) {
    throw new Error('الملاحظات طويلة أكثر من اللازم.')
  }

  if (!['full', 'partial'].includes(input.countType)) {
    throw new Error('نوع الجرد غير صحيح.')
  }

  await requireRedaBranch(input.branchId)

  const { data, error } = await context.supabase.rpc(
    'dokkan_create_inventory_count',
    {
      p_store_id: context.storeId,
      p_branch_id: input.branchId,
      p_count_number: countNumber,
      p_count_type: input.countType,
      p_notes: notes,
      p_original_count_id: input.originalCountId || null,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Create failed:', error.code)
    throw new Error(
      error.code === '23505'
        ? 'رقم الجرد مستخدم بالفعل. أدخل رقمًا آخر.'
        : 'تعذر إنشاء الجرد. راجع الفرع والصلاحيات.'
    )
  }

  refreshInventoryCountPages()

  return data as string
}

export async function addInventoryCountItemAction(input: {
  countId: string
  branchId: string
  variantId: string
}) {
  const context = await requireRedaContext(COUNT_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.countId, 'الجرد غير محدد.')
  validateId(input.branchId, 'الفرع غير محدد.')
  validateId(input.variantId, 'يجب اختيار متغير المنتج.')

  await requireRedaBranch(input.branchId, {
    activeOnly: false,
  })

  const { data, error } = await context.supabase.rpc(
    'dokkan_add_inventory_count_item',
    {
      p_count_id: input.countId,
      p_product_variant_id: input.variantId,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Add item failed:', error.code)
    throw new Error(
      'تعذر إضافة الصنف. تأكد أن الجرد ما زال قابلًا للتعديل.'
    )
  }

  refreshInventoryCountPages()

  return data as string
}

export async function startInventoryCountAction(input: {
  countId: string
  branchId: string
}) {
  const context = await requireRedaContext(COUNT_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.countId, 'الجرد غير محدد.')
  validateId(input.branchId, 'الفرع غير محدد.')

  // بدء الجرد مسموح فقط للفرع النشط.
  await requireRedaBranch(input.branchId)

  const { error } = await context.supabase.rpc(
    'dokkan_start_inventory_count',
    {
      p_count_id: input.countId,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Start failed:', error.code)
    throw new Error(
      'تعذر بدء الجرد. تأكد من وجود أصناف وأن الجرد في حالة مسودة.'
    )
  }

  refreshInventoryCountPages()
}

export async function recordInventoryCountItemAction(input: {
  countId: string
  branchId: string
  variantId: string
  actualQuantity: number
}) {
  const context = await requireRedaContext(COUNT_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.countId, 'الجرد غير محدد.')
  validateId(input.branchId, 'الفرع غير محدد.')
  validateId(input.variantId, 'الصنف غير محدد.')

  const quantity = Number(input.actualQuantity)

  if (
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    quantity > 99999999999.999 ||
    !/^\d+(\.\d{1,3})?$/.test(String(quantity))
  ) {
    throw new Error(
      'الكمية الفعلية يجب أن تكون رقمًا صحيحًا أو حتى 3 خانات عشرية.'
    )
  }

  // يسمح باستكمال الجرد حتى لو تم إيقاف الفرع بعد إنشائه.
  await requireRedaBranch(input.branchId, {
    activeOnly: false,
  })

  const { error } = await context.supabase.rpc(
    'dokkan_record_inventory_count_item',
    {
      p_count_id: input.countId,
      p_product_variant_id: input.variantId,
      p_actual_quantity: quantity,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Record item failed:', error.code)
    throw new Error(
      'تعذر تسجيل الكمية. تأكد أن الجرد في حالة العدّ.'
    )
  }

  refreshInventoryCountPages()
}

export async function submitInventoryCountForReviewAction(input: {
  countId: string
  branchId: string
}) {
  const context = await requireRedaContext(COUNT_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.countId, 'الجرد غير محدد.')
  validateId(input.branchId, 'الفرع غير محدد.')

  await requireRedaBranch(input.branchId, {
    activeOnly: false,
  })

  const { error } = await context.supabase.rpc(
    'dokkan_submit_inventory_count_for_review',
    {
      p_count_id: input.countId,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Submit failed:', error.code)
    throw new Error(
      'تعذر إرسال الجرد للمراجعة. تأكد من تسجيل الكميات لكل الأصناف.'
    )
  }

  refreshInventoryCountPages()
}

export async function approveInventoryCountAction(input: {
  countId: string
  branchId: string
}) {
  const context = await requireRedaContext(APPROVE_ROLES)
  await requireStoreSectionPin(context)

  validateId(input.countId, 'الجرد غير محدد.')
  validateId(input.branchId, 'الفرع غير محدد.')

  // الاعتماد مسموح للمالك والمدير فقط.
  // لا نشترط أن يكون الفرع نشطًا لاستكمال جرد قديم.
  await requireRedaBranch(input.branchId, {
    activeOnly: false,
  })

  const { error } = await context.supabase.rpc(
    'dokkan_approve_inventory_count',
    {
      p_count_id: input.countId,
    }
  )

  if (error) {
    console.error('[Inventory Counts] Approval failed:', error.code)
    throw new Error(
      'تعذر اعتماد الجرد. تأكد من صلاحية الاعتماد وحالة الجرد.'
    )
  }

  refreshInventoryCountPages()
}
