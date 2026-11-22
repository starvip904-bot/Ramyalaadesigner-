
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaBranch, requireRedaContext } from '@/lib/reda-scope'

function validateText(value: string, label: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${label} is required`)
  }

  return trimmed
}

function getBranchMutationError(
  message: string | undefined,
  fallback: string
) {
  if (message?.includes('FREE_PLAN_BRANCH_LIMIT_REACHED')) {
    return new Error('FREE_PLAN_BRANCH_LIMIT_REACHED')
  }

  if (message?.includes('SUBSCRIPTION_PLAN_UNRESOLVED')) {
    return new Error('SUBSCRIPTION_PLAN_UNRESOLVED')
  }

  return new Error(fallback)
}

export async function createStoreAction(_input: {
  name: string
  phone?: string
}) {
  throw new Error('REDA_STORE_CREATION_DISABLED')
}

export async function updateStoreAction(_input: {
  id: string
  name: string
  phone?: string
}) {
  throw new Error('REDA_STORE_MUTATION_DISABLED')
}

export async function archiveStoreAction(_id: string) {
  throw new Error('REDA_STORE_MUTATION_DISABLED')
}

export async function createBranchAction(input: {
  storeId: string
  name: string
  address?: string
}) {
  const { supabase, storeId } = await requireRedaContext([
    'owner',
    'admin',
  ])

  if (input.storeId !== storeId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  const { data, error } = await supabase.rpc('dokkan_create_branch', {
    target_store_id: storeId,
    branch_name: validateText(input.name, 'Branch name'),
    branch_address: input.address?.trim() || null,
  })

  if (error) {
    throw getBranchMutationError(
      error.message,
      'تعذر إنشاء الفرع. تحقق من الصلاحيات والبيانات.'
    )
  }

  revalidatePath('/stores')

  return data as string
}

export async function updateBranchAction(input: {
  id: string
  name: string
  address?: string
}) {
  const { supabase } = await requireRedaContext(['owner', 'admin'])

  await requireRedaBranch(input.id, { activeOnly: false })

  const { error } = await supabase.rpc('dokkan_update_branch', {
    target_branch_id: input.id,
    branch_name: validateText(input.name, 'Branch name'),
    branch_address: input.address?.trim() || null,
  })

  if (error) {
    throw new Error('Unable to update branch')
  }

  revalidatePath('/stores')
}

export async function setBranchStatusAction(
  id: string,
  status: 'active' | 'inactive'
) {
  const { supabase } = await requireRedaContext(['owner', 'admin'])

  await requireRedaBranch(id, { activeOnly: false })

  const { error } = await supabase.rpc('dokkan_set_branch_status', {
    target_branch_id: id,
    next_status: status,
  })

  if (error) {
    throw getBranchMutationError(
      error.message,
      'تعذر تحديث حالة الفرع.'
    )
  }

  revalidatePath('/stores')
}
