import type { Branch, Customer, Employee, Expense, InventoryItem, Product, Purchase, Sale, StockMovement, Store, Supplier } from './models'

export const stores: Store[] = [{ id: 'store-1', name: 'متجر دكان الرئيسي', phone: '0110000000', status: 'active', branchIds: ['branch-1', 'branch-2'] }]
export const branches: Branch[] = [
  { id: 'branch-1', storeId: 'store-1', name: 'الفرع الرئيسي', address: 'شارع الملك فهد', status: 'active', employeeIds: ['employee-1', 'employee-2'] },
  { id: 'branch-2', storeId: 'store-1', name: 'فرع العليا', address: 'حي العليا', status: 'active', employeeIds: ['employee-3'] },
]
export const products: Product[] = [
  { id: 'prod-1', name: 'قميص كتان صيفي', category: 'ملابس رجالية', status: 'active', variants: [{ id: 'var-1', productId: 'prod-1', sku: 'SH-LIN-BLU-M', barcode: '628100000001', size: 'M', color: 'أزرق', price: 245, cost: 120, stock: 24 }] },
  { id: 'prod-2', name: 'فستان سهرة أسود', category: 'فساتين', status: 'active', variants: [{ id: 'var-2', productId: 'prod-2', sku: 'DR-BLK-STD', barcode: '628100000002', size: 'L', color: 'أسود', price: 390, cost: 210, stock: 48 }] },
  { id: 'prod-3', name: 'حذاء رياضي أبيض', category: 'أحذية', status: 'low', variants: [{ id: 'var-3', productId: 'prod-3', sku: 'SN-WHT-42', barcode: '628100000003', size: '42', color: 'أبيض', price: 280, cost: 150, stock: 12 }] },
  { id: 'prod-4', name: 'حقيبة جلدية كلاسيك', category: 'إكسسوارات', status: 'out_of_stock', variants: [{ id: 'var-4', productId: 'prod-4', sku: 'BG-LTH-BRN', barcode: '628100000004', color: 'بني', price: 450, cost: 240, stock: 0 }] },
]
export const inventory: InventoryItem[] = products.flatMap((product) => branches.map((branch, index) => ({ id: `inventory-${product.id}-${branch.id}`, branchId: branch.id, productVariantId: product.variants[0].id, quantity: branch.id === 'branch-1' ? product.variants[0].stock : Math.max(0, product.variants[0].stock - index * 4), reorderLevel: 10, updatedAt: '2026-11-03T09:00:00Z' })))
export const stockMovements: StockMovement[] = [{ id: 'movement-1', branchId: 'branch-1', productVariantId: 'var-1', type: 'purchase', quantity: 24, createdAt: '2026-11-03T09:00:00Z', note: 'توريد افتتاحي' }]
export const customers: Customer[] = [{ id: 'customer-1', name: 'أحمد محمد', phone: '0500000000', totalOrders: 18, totalSpent: 6480, balance: 0, status: 'active' }]
export const suppliers: Supplier[] = [{ id: 'supplier-1', name: 'شركة النور للتجارة', phone: '0110000000', category: 'مواد تغليف', balance: 12800, status: 'active' }]
export const purchases: Purchase[] = [{ id: 'purchase-1', supplierId: 'supplier-1', branchId: 'branch-1', total: 12800, amountPaid: 12800, status: 'paid', createdAt: '2026-11-02T09:30:00Z' }]
export const expenses: Expense[] = [{ id: 'expense-1', branchId: 'branch-1', title: 'إيجار الفرع', category: 'تشغيل', amount: 8500, status: 'paid', createdAt: '2026-11-01T09:30:00Z' }]
export const employees: Employee[] = [
  { id: 'employee-1', name: 'محمد عبدالله', phone: '0501111111', role: 'owner', branchIds: ['branch-1'], status: 'active' },
  { id: 'employee-2', name: 'نورة أحمد', phone: '0502222222', role: 'manager', branchIds: ['branch-1'], status: 'active' },
  { id: 'employee-3', name: 'عمر خالد', phone: '0503333333', role: 'cashier', branchIds: ['branch-2'], status: 'active' },
]
export const sales: Sale[] = []

export interface DokkanRepository {
  listProducts(): Product[]; createProduct(input: Omit<Product, 'id'>): Product; updateProduct(id: string, input: Partial<Product>): Product | undefined; deleteProduct(id: string): boolean
  listInventory(branchId?: string): InventoryItem[]; adjustStock(input: { branchId: string; productVariantId: string; quantity: number; note?: string }): InventoryItem | undefined; transferStock(input: { fromBranchId: string; toBranchId: string; productVariantId: string; quantity: number }): boolean
  listSales(): Sale[]; createSale(input: Omit<Sale, 'id' | 'createdAt'>): Sale
  listCustomers(): Customer[]; createCustomer(input: Omit<Customer, 'id'>): Customer; updateCustomer(id: string, input: Partial<Customer>): Customer | undefined
  listSuppliers(): Supplier[]; createSupplier(input: Omit<Supplier, 'id'>): Supplier; updateSupplier(id: string, input: Partial<Supplier>): Supplier | undefined
  listExpenses(): Expense[]; createExpense(input: Omit<Expense, 'id' | 'createdAt'>): Expense; deleteExpense(id: string): boolean
}

let sequence = 100
const nextId = (prefix: string) => `${prefix}-${sequence++}`
const now = () => new Date().toISOString()
export const mockRepository: DokkanRepository = {
  listProducts: () => products,
  createProduct: (input) => { const product = { ...input, id: nextId('prod') }; products.push(product); return product },
  updateProduct: (id, input) => { const index = products.findIndex((item) => item.id === id); if (index < 0) return undefined; products[index] = { ...products[index], ...input }; return products[index] },
  deleteProduct: (id) => { const index = products.findIndex((item) => item.id === id); if (index < 0) return false; products.splice(index, 1); return true },
  listInventory: (branchId) => branchId ? inventory.filter((item) => item.branchId === branchId) : inventory,
  adjustStock: ({ branchId, productVariantId, quantity, note }) => { const item = inventory.find((entry) => entry.branchId === branchId && entry.productVariantId === productVariantId); if (!item || item.quantity + quantity < 0) return undefined; item.quantity += quantity; item.updatedAt = now(); stockMovements.push({ id: nextId('movement'), branchId, productVariantId, type: 'adjustment', quantity, createdAt: now(), note }); return item },
  transferStock: ({ fromBranchId, toBranchId, productVariantId, quantity }) => { if (quantity <= 0) return false; const source = inventory.find((item) => item.branchId === fromBranchId && item.productVariantId === productVariantId); const target = inventory.find((item) => item.branchId === toBranchId && item.productVariantId === productVariantId); if (!source || !target || source.quantity < quantity) return false; source.quantity -= quantity; target.quantity += quantity; stockMovements.push({ id: nextId('movement'), branchId: fromBranchId, targetBranchId: toBranchId, productVariantId, type: 'transfer', quantity: -quantity, createdAt: now() }); return true },
  listSales: () => sales,
  createSale: (input) => { const sale = { ...input, id: `INV-${sequence++}`, createdAt: now() }; sales.push(sale); return sale },
  listCustomers: () => customers,
  createCustomer: (input) => { const customer = { ...input, id: nextId('customer') }; customers.push(customer); return customer },
  updateCustomer: (id, input) => { const item = customers.find((entry) => entry.id === id); if (!item) return undefined; Object.assign(item, input); return item },
  listSuppliers: () => suppliers,
  createSupplier: (input) => { const supplier = { ...input, id: nextId('supplier') }; suppliers.push(supplier); return supplier },
  updateSupplier: (id, input) => { const item = suppliers.find((entry) => entry.id === id); if (!item) return undefined; Object.assign(item, input); return item },
  listExpenses: () => expenses,
  createExpense: (input) => { const expense = { ...input, id: nextId('expense'), createdAt: now() }; expenses.push(expense); return expense },
  deleteExpense: (id) => { const index = expenses.findIndex((item) => item.id === id); if (index < 0) return false; expenses.splice(index, 1); return true },
}
