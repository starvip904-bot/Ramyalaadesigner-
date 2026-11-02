export type PaymentMethod = 'cash' | 'card' | 'transfer'
export type RecordStatus = 'active' | 'inactive' | 'low' | 'out_of_stock' | 'pending' | 'paid'

export interface Store { id: string; name: string; phone?: string; status: 'active' | 'inactive'; branchIds: string[] }
export interface Branch { id: string; storeId: string; name: string; address: string; status: 'active' | 'inactive' }
export interface ProductVariant { id: string; productId: string; sku: string; barcode: string; size?: string; color?: string; price: number; cost: number; stock: number }
export interface Product { id: string; name: string; category: string; brand?: string; status: RecordStatus; variants: ProductVariant[] }
export interface InventoryItem { id: string; branchId: string; productVariantId: string; quantity: number; reorderLevel: number; updatedAt: string }
export interface StockMovement { id: string; branchId: string; productVariantId: string; type: 'purchase' | 'sale' | 'adjustment'; quantity: number; createdAt: string; note?: string }
export interface Customer { id: string; name: string; phone: string; email?: string; totalOrders: number; totalSpent: number; status: 'active' | 'inactive' }
export interface Supplier { id: string; name: string; phone: string; category: string; balance: number; status: 'active' | 'inactive' }
export interface SaleItem { productVariantId: string; name: string; quantity: number; unitPrice: number; discount: number }
export interface Sale { id: string; branchId: string; customerId?: string; items: SaleItem[]; subtotal: number; discount: number; total: number; paymentMethod: PaymentMethod; amountPaid: number; remaining: number; createdAt: string }
export interface Purchase { id: string; supplierId: string; branchId: string; total: number; status: 'pending' | 'paid'; createdAt: string }
export interface Expense { id: string; branchId: string; title: string; category: string; amount: number; status: 'pending' | 'paid'; createdAt: string }
