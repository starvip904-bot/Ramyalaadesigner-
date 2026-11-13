
export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'transfer'
export type RecordStatus = 'active' | 'inactive' | 'low' | 'out_of_stock' | 'pending' | 'paid'
export type EmployeeRole = 'owner' | 'manager' | 'cashier' | 'stock_manager' | 'viewer'

export interface Store { id: string; name: string; phone?: string; status: 'active' | 'inactive'; branchIds: string[] }
export interface Branch { id: string; storeId: string; name: string; address: string; status: 'active' | 'inactive'; employeeIds?: string[] }
export interface ProductVariant { id: string; productId: string; sku: string; barcode: string; size?: string; color?: string; price: number; cost: number; stock: number }
export interface Product { id: string; name: string; category: string; brand?: string; status: RecordStatus; variants: ProductVariant[] }
export interface InventoryItem { id: string; branchId: string; productVariantId: string; quantity: number; reorderLevel: number; updatedAt: string }
export interface StockMovement { id: string; branchId: string; productVariantId: string; type: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'return'; quantity: number; createdAt: string; note?: string; targetBranchId?: string; referenceId?: string }
export interface Customer { id: string; name: string; phone: string; email?: string; totalOrders: number; totalSpent: number; balance: number; status: 'active' | 'inactive' }
export interface Supplier { id: string; name: string; phone: string; category: string; balance: number; status: 'active' | 'inactive' }
export interface SaleItem { productVariantId: string; name: string; quantity: number; unitPrice: number; discount: number }
export interface Sale { id: string; branchId: string; customerId?: string; items: SaleItem[]; subtotal: number; discount: number; total: number; paymentMethod: PaymentMethod; amountPaid: number; remaining: number; status?: 'completed' | 'returned' | 'partially_returned'; createdAt: string }
export interface PurchaseItem { productVariantId: string; quantity: number; receivedQuantity?: number; unitCost: number }
export interface Purchase { id: string; supplierId: string; branchId: string; items: PurchaseItem[]; total: number; amountPaid: number; status: 'pending' | 'paid' | 'received' | 'partially_received'; createdAt: string; postedAt?: string }
export interface SupplierPayment { id: string; supplierId: string; purchaseId?: string; amount: number; method: PaymentMethod; note?: string; createdAt: string }
export interface CustomerPayment { id: string; customerId: string; amount: number; method: PaymentMethod; note?: string; createdAt: string }
export interface SaleReturn { id: string; saleId: string; branchId: string; items: Array<{ productVariantId: string; quantity: number; amount: number }>; refundAmount: number; type: 'refund' | 'exchange'; createdAt: string }
export interface Expense { id: string; branchId: string; title: string; category: string; amount: number; status: 'pending' | 'paid'; createdAt: string }
export interface Employee { id: string; name: string; phone: string; role: EmployeeRole; branchIds: string[]; status: 'active' | 'inactive' }
export interface PermissionSet { role: EmployeeRole; label: string; permissions: string[] }
export interface InventoryTransfer { id: string; fromBranchId: string; toBranchId: string; productVariantId: string; quantity: number; status: 'requested' | 'received' | 'cancelled'; requestedBy: string; createdAt: string; receivedAt?: string }
export interface AuditEntry { id: string; userId: string; userName: string; action: string; referenceType: string; referenceId: string; createdAt: string }
