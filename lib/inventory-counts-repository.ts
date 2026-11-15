import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'

const COUNT_ROLES = [
  'owner',
  'manager',
  'admin',
  'stock_manager',
]

export type InventoryCountStatus =
  | 'draft'
  | 'counting'
  | 'review'
  | 'approved'
  | 'cancelled'

export type InventoryCountSummary = {
  count_id: string
  store_id: string
  branch_id: string
  branch_name: string
  count_number: string
  count_type: 'full' | 'partial'
  status: InventoryCountStatus
  notes: string | null
  created_by: string | null
  started_by: string | null
  approved_by: string | null
  started_at: string | null
  approved_at: string | null
  original_count_id: string | null
  created_at: string
  updated_at: string
  total_items: number
  counted_items: number
  total_difference: number
}

export type InventoryCountItem = {
  id: string
  count_id: string
  store_id: string
  branch_id: string
  product_variant_id: string
  product_name: string
  category: string | null
  brand: string | null
  sku: string | null
  barcode: string | null
  size: string | null
  color: string | null
  system_quantity_at_start: number
  system_quantity_at_count: number | null
  actual_quantity: number | null
  difference: number | null
  counted_by: string | null
  count_at: string | null
  created_at: string
  updated_at: string
}

export type InventoryCountEvent = {
  id: string
  count_id: string
  actor_id: string | null
  event_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export type InventoryCountAdjustment = {
  id: string
  count_id: string
  count_item_id: string
  product_variant_id: string
  movement_id: string
  adjustment_quantity: number
  created_at: string
}

export type InventoryCountDetails = {
  count: {
    id: string
    store_id: string
    branch_id: string
    count_number: string
    count_type: 'full' | 'partial'
    status: InventoryCountStatus
    notes: string | null
    created_by: string | null
    started_by: string | null
    approved_by: string | null
    started_at: string | null
    approved_at: string | null
    original_count_id: string | null
    created_at: string
    updated_at: string
  }
  branch_name: string
  items: InventoryCountItem[]
  events: InventoryCountEvent[]
  adjustments: InventoryCountAdjustment[]
}

export type InventoryCountBranch = {
  id: string
  store_id: string
  name: string
  address: string | null
  status: 'active' | 'inactive'
}

export type InventoryCountProduct = {
  id: string
  store_id: string
  name: string
  category: string | null
  brand: string | null
  status: 'active' | 'inactive'
  dokkan_product_variants: {
    id: string
    sku: string
    barcode: string | null
    size: string | null
    color: string | null
    price: number
    cost: number
  }[]
}

export async function getInventoryCountsPageData(input?: {
  branchId?: string
  status?: InventoryCountStatus
}) {
  const context = await requireRedaContext(COUNT_ROLES)

  const branchId = input?.branchId || null
  const status = input?.status || null

  const [
    countsResult,
    branchesResult,
    productsResult,
  ] = await Promise.all([
    context.supabase.rpc('dokkan_list_inventory_counts', {
      p_store_id: context.storeId,
      p_branch_id: branchId,
      p_status: status,
    }),

    context.supabase
      .from('dokkan_branches')
      .select('id, store_id, name, address, status')
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: true }),

    context.supabase
      .from('dokkan_products')
      .select(`
        id,
        store_id,
        name,
        category,
        brand,
        status,
        dokkan_product_variants(
          id,
          sku,
          barcode,
          size,
          color,
          price,
          cost
        )
      `)
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: true }),
  ])

  if (countsResult.error) {
    console.error(
      '[Inventory Counts] List failed:',
      countsResult.error.code
    )
    throw new Error('تعذر تحميل قائمة الجرد.')
  }

  if (branchesResult.error) {
    console.error(
      '[Inventory Counts] Branches failed:',
      branchesResult.error.code
    )
    throw new Error('تعذر تحميل الفروع.')
  }

  if (productsResult.error) {
    console.error(
      '[Inventory Counts] Products failed:',
      productsResult.error.code
    )
    throw new Error('تعذر تحميل المنتجات.')
  }

  return {
    storeId: context.storeId,
    userRole: context.membership.role || null,
    canApprove: ['owner', 'manager'].includes(
      context.membership.role || ''
    ),
    counts: (countsResult.data ?? []) as InventoryCountSummary[],
    branches: (branchesResult.data ?? []) as InventoryCountBranch[],
    products: (productsResult.data ?? []) as InventoryCountProduct[],
  }
}

export async function getInventoryCountDetails(
  countId: string
): Promise<InventoryCountDetails> {
  if (!countId?.trim()) {
    throw new Error('يجب تحديد الجرد.')
  }

  const context = await requireRedaContext(COUNT_ROLES)

  const { data, error } = await context.supabase.rpc(
    'dokkan_get_inventory_count',
    {
      p_count_id: countId,
    }
  )

  if (error || !data) {
    console.error(
      '[Inventory Counts] Details failed:',
      error?.code
    )
    throw new Error('تعذر تحميل تفاصيل الجرد.')
  }

  return data as InventoryCountDetails
}