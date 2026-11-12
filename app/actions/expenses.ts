
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext, requireRedaBranch } from '@/lib/reda-scope'

export type CreateExpenseInput = {
  branchId: string
  title: string
  category: string
  amount: number
  notes?: string
}

export async function createExpense(input: CreateExpenseInput) {
  try {
    const context = await requireRedaContext([
      'owner',
      'admin',
      'manager',
    ])

    const title = input.title.trim()
    const category = input.category.trim()
    const amount = Number(input.amount)

    if (!input.branchId || !title || !category) {
      return {
        ok: false as const,
        message: 'أكمل البيانات المطلوبة',
      }
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false as const,
        message: 'أدخل مبلغًا صحيحًا أكبر من صفر',
      }
    }

    await requireRedaBranch(input.branchId)

    const { data, error } = await context.supabase.rpc(
      'dokkan_record_expense',
      {
        target_store_id: context.storeId,
        target_branch_id: input.branchId,
        expense_title: title,
        expense_category: category,
        expense_amount: amount,
        expense_notes: input.notes?.trim() || null,
      }
    )

    if (error) {
      console.error('[Expenses] Save failed:', {
        code: error.code,
        message: error.message,
      })

      return {
        ok: false as const,
        message: 'تعذر حفظ المصروف. راجع البيانات وحاول مرة أخرى.',
      }
    }

    revalidatePath('/expenses')
    revalidatePath('/dashboard')
    revalidatePath('/reports')

    return {
      ok: true as const,
      id: data as string,
      message: 'تم حفظ المصروف بنجاح',
    }
  } catch (error) {
    console.error('[Expenses] Action failed:', error)

    return {
      ok: false as const,
      message: 'ليس لديك صلاحية أو تعذر تنفيذ العملية',
    }
  }
}
