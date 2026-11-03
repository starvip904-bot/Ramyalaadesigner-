'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

function validateText(value: string, label: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required`)
  return trimmed
}

export async function createStoreAction(input: { name: string; phone?: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_create_store', { store_name: validateText(input.name, 'Store name'), store_phone: input.phone?.trim() || null })
  if (error) throw new Error('Unable to create store')
  revalidatePath('/stores')
  return data as string
}

export async function updateStoreAction(input: { id: string; name: string; phone?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_update_store', { target_store_id: input.id, store_name: validateText(input.name, 'Store name'), store_phone: input.phone?.trim() || null })
  if (error) throw new Error('Unable to update store')
  revalidatePath('/stores')
}

export async function archiveStoreAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_archive_store', { target_store_id: id })
  if (error) throw new Error('Unable to archive store')
  revalidatePath('/stores')
}

export async function createBranchAction(input: { storeId: string; name: string; address?: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('dokkan_create_branch', { target_store_id: input.storeId, branch_name: validateText(input.name, 'Branch name'), branch_address: input.address?.trim() || null })
  if (error) throw new Error('Unable to create branch')
  revalidatePath('/stores')
  return data as string
}

export async function updateBranchAction(input: { id: string; name: string; address?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_update_branch', { target_branch_id: input.id, branch_name: validateText(input.name, 'Branch name'), branch_address: input.address?.trim() || null })
  if (error) throw new Error('Unable to update branch')
  revalidatePath('/stores')
}

export async function setBranchStatusAction(id: string, status: 'active' | 'inactive') {
  const supabase = await createClient()
  const { error } = await supabase.rpc('dokkan_set_branch_status', { target_branch_id: id, next_status: status })
  if (error) throw new Error('Unable to update branch status')
  revalidatePath('/stores')
}
