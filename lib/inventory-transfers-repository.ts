
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

export async function getInventoryTransfersPageData() {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
    'stock_manager',
  ])

  const { supabase, storeId, membership } = context

  let allowedBranchIds: string[] | null = null

  // مدير الفرع يرى الفروع المسندة إليه فقط.
  if (membership.role === 'manager') {
    const { data: assignments, error: assignmentsError } =
      await supabase
        .from('dokkan_member_branches')
        .select('branch_id')
        .eq('store_id', storeId)
        .eq('member_id', membership.id)

    if (assignmentsError) {
      throw new Error('Unable to load manager branch assignments')
    }

    allowedBranchIds = (assignments ?? []).map(
      (assignment) => assignment.branch_id
    )
  }

  const [
    { data: branches, error: branchesError },
    { data: products, error: productsError },
    { data: transfers, error: transfersError },
  ] = await Promise.all([
    supabase
      .from('dokkan_branches')
      .select('id, store_id, name, status')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('name', { ascending: true }),

    supabase
      .from('dokkan_products')
      .select(`
        id,
        name,
        category,
        brand,
        status,
        dokkan_product_variants(
          id,
          product_id,
          sku,
          barcode,
          size,
          color,
          price,
          cost
        )
      `)
      .eq('store_id', storeId)
      .order('name', { ascending: true }),

    supabase
      .from('dokkan_inventory_transfers')
      .select(`
        id,
        store_id,
        source_branch_id,
        destination_branch_id,
        product_variant_id,
        quantity,
        status,
        requested_by,
        received_by,
        created_at,
        received_at,
        note,
        source_branch:dokkan_branches!dokkan_inventory_transfers_source_branch_id_fkey(
          id,
          name
        ),
        destination_branch:dokkan_branches!dokkan_inventory_transfers_destination_branch_id_fkey(
          id,
          name
        ),
        variant:dokkan_product_variants!dokkan_inventory_transfers_product_variant_id_fkey(
          id,
          sku,
          barcode,
          size,
          color,
          product:dokkan_products!dokkan_product_variants_product_id_fkey(
            id,
            name
          )
        )
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false }),
  ])

  if (branchesError || productsError || transfersError) {
    console.error('[Inventory Transfers] Page data loading failed:', {
      branchesError: branchesError?.message,
      productsError: productsError?.message,
      transfersError: transfersError?.message,
    })

    throw new Error('Unable to load inventory transfers page data')
  }

  const visibleBranches =
    allowedBranchIds === null
      ? branches ?? []
      : (branches ?? []).filter((branch) =>
          allowedBranchIds?.includes(branch.id)
        )

  let movements: Array<{
    id: string
    store_id: string
    branch_id: string
    product_variant_id: string
    movement_type: string
    quantity: number
    created_at: string
  }> = []

  if (allowedBranchIds === null) {
    const { data, error } = await supabase
      .from('dokkan_inventory_movements')
      .select(`
        id,
        store_id,
        branch_id,
        product_variant_id,
        movement_type,
        quantity,
        created_at
      `)
      .eq('store_id', storeId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error('Unable to load inventory movements')
    }

    movements = data ?? []
  } else if (allowedBranchIds.length > 0) {
    const { data, error } = await supabase
      .from('dokkan_inventory_movements')
      .select(`
        id,
        store_id,
        branch_id,
        product_variant_id,
        movement_type,
        quantity,
        created_at
      `)
      .eq('store_id', storeId)
      .in('branch_id', allowedBranchIds)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error('Unable to load inventory movements')
    }

    movements = data ?? []
  }

  return {
    role: membership.role,
    storeId,
    branches: visibleBranches,
    products: products ?? [],
    movements,
    transfers: transfers ?? [],
  }
}
