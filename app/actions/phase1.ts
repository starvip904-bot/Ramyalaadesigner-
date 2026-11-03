'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function callRpc<T>(name: string, args: Record<string, unknown>) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

export async function createCustomer(input: { storeId: string; name: string; phone?: string; address?: string; notes?: string }) {
  const id = await callRpc<string>('dokkan_create_customer', { p_store_id: input.storeId, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/customers')
  return id
}

export async function updateCustomer(input: { id: string; name: string; phone?: string; address?: string; notes?: string }) {
  await callRpc<void>('dokkan_update_customer', { p_customer_id: input.id, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/customers')
}

export async function archiveCustomer(id: string) {
  await callRpc<void>('dokkan_archive_customer', { p_customer_id: id })
  revalidatePath('/customers')
}

export async function createSupplier(input: { storeId: string; name: string; phone?: string; address?: string; notes?: string }) {
  const id = await callRpc<string>('dokkan_create_supplier', { p_store_id: input.storeId, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/suppliers')
  return id
}

export async function updateSupplier(input: { id: string; name: string; phone?: string; address?: string; notes?: string }) {
  await callRpc<void>('dokkan_update_supplier', { p_supplier_id: input.id, p_name: input.name, p_phone: input.phone ?? null, p_address: input.address ?? null, p_notes: input.notes ?? null })
  revalidatePath('/suppliers')
}

export async function archiveSupplier(id: string) {
  await callRpc<void>('dokkan_archive_supplier', { p_supplier_id: id })
  revalidatePath('/suppliers')
}

export async function saveStoreSettings(input: { storeId: string; address?: string; logoUrl?: string; invoicePrefix: string; nextInvoiceNumber: number; printFormat: string; paperSize: string; rtl: boolean; currency: string; taxEnabled: boolean; taxRate?: number | null }) {
  await callRpc<void>('dokkan_upsert_store_settings', { p_store_id: input.storeId, p_address: input.address ?? null, p_logo_url: input.logoUrl ?? null, p_invoice_prefix: input.invoicePrefix, p_next_invoice_number: input.nextInvoiceNumber, p_print_format: input.printFormat, p_paper_size: input.paperSize, p_rtl: input.rtl, p_currency: input.currency, p_tax_enabled: input.taxEnabled, p_tax_rate: input.taxRate ?? null })
  revalidatePath('/settings')
}
