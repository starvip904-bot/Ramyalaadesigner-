import type { Branch, Customer, Expense, InventoryItem, Product, ProductVariant, Purchase, Sale, Store, Supplier } from './models'

export const stores: Store[] = [{ id: 'store-1', name: 'متجر دكان الرئيسي', status: 'active', branchIds: ['branch-1', 'branch-2'] }]
export const branches: Branch[] = [
  { id: 'branch-1', storeId: 'store-1', name: 'الفرع الرئيسي', address: 'شارع الملك فهد', status: 'active' },
  { id: 'branch-2', storeId: 'store-1', name: 'فرع العليا', address: 'حي العليا', status: 'active' },
]
export const products: Product[] = [
  { id: 'prod-1', name: 'قميص كتان صيفي', category: 'ملابس رجالية', status: 'active', variants: [{ id: 'var-1', productId: 'prod-1', sku: 'SH-LIN-BLU-M', barcode: '628100000001', size: 'M', color: 'أزرق', price: 245, cost: 120, stock: 24 }] },
  { id: 'prod-2', name: 'فستان سهرة أسود', category: 'فساتين', status: 'active', variants: [{ id: 'var-2', productId: 'prod-2', sku: 'DR-BLK-STD', barcode: '628100000002', size: 'L', color: 'أسود', price: 390, cost: 210, stock: 48 }] },
  { id: 'prod-3', name: 'حذاء رياضي أبيض', category: 'أحذية', status: 'low', variants: [{ id: 'var-3', productId: 'prod-3', sku: 'SN-WHT-42', barcode: '628100000003', size: '42', color: 'أبيض', price: 280, cost: 150, stock: 12 }] },
  { id: 'prod-4', name: 'حقيبة جلدية كلاسيك', category: 'إكسسوارات', status: 'out_of_stock', variants: [{ id: 'var-4', productId: 'prod-4', sku: 'BG-LTH-BRN', barcode: '628100000004', color: 'بني', price: 450, cost: 240, stock: 0 }] },
]
export const inventory: InventoryItem[] = products.map((product, index) => ({ id: `inventory-${index + 1}`, branchId: 'branch-1', productVariantId: product.variants[0].id, quantity: product.variants[0].stock, reorderLevel: 10, updatedAt: '2026-11-03T09:00:00Z' }))
export const customers: Customer[] = [{ id: 'customer-1', name: 'أحمد محمد', phone: '0500000000', totalOrders: 18, totalSpent: 6480, status: 'active' }]
export const suppliers: Supplier[] = [{ id: 'supplier-1', name: 'شركة النور للتجارة', phone: '0110000000', category: 'مواد تغليف', balance: 12800, status: 'active' }]
export const purchases: Purchase[] = [{ id: 'purchase-1', supplierId: 'supplier-1', branchId: 'branch-1', total: 12800, status: 'paid', createdAt: '2026-11-02T09:30:00Z' }]
export const expenses: Expense[] = [{ id: 'expense-1', branchId: 'branch-1', title: 'إيجار الفرع', category: 'تشغيل', amount: 8500, status: 'paid', createdAt: '2026-11-01T09:30:00Z' }]

export interface DokkanRepository {
  listProducts(): Product[]
  listInventory(branchId: string): InventoryItem[]
  createSale(input: Omit<import('./models').Sale, 'id' | 'createdAt'>): import('./models').Sale
}

let saleSequence = 1049
export const mockRepository: DokkanRepository = {
  listProducts: () => products,
  listInventory: (branchId) => inventory.filter((item) => item.branchId === branchId),
  createSale: (input) => ({ ...input, id: `INV-${saleSequence++}`, createdAt: new Date().toISOString() }),
}
