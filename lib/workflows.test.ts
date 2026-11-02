import assert from 'node:assert/strict'
import { mockRepository, purchases, suppliers, inventory, sales } from '../data/mock-repository.ts'

const beforeStock = inventory.find((item) => item.branchId === 'branch-1' && item.productVariantId === 'var-2')?.quantity ?? 0
const purchase = mockRepository.createPurchase({ supplierId: 'supplier-1', branchId: 'branch-1', items: [{ productVariantId: 'var-2', quantity: 3, unitCost: 210 }], total: 630 })
assert.ok(purchase)
assert.equal(mockRepository.receivePurchase(purchase.id, [{ productVariantId: 'var-2', quantity: 3 }]), true)
assert.equal(mockRepository.receivePurchase(purchase.id, [{ productVariantId: 'var-2', quantity: 1 }]), false)
assert.equal(inventory.find((item) => item.branchId === 'branch-1' && item.productVariantId === 'var-2')?.quantity, beforeStock + 3)

const beforeBalance = suppliers[0].balance
assert.ok(mockRepository.paySupplier({ supplierId: 'supplier-1', amount: 100, method: 'cash' }))
assert.equal(suppliers[0].balance, beforeBalance - 100)

const sale = mockRepository.createSale({ branchId: 'branch-1', items: [{ productVariantId: 'var-1', name: 'قميص', quantity: 2, unitPrice: 245, discount: 0 }], subtotal: 490, discount: 0, total: 490, paymentMethod: 'cash', amountPaid: 490, remaining: 0, status: 'completed' })
const saleStock = inventory.find((item) => item.branchId === 'branch-1' && item.productVariantId === 'var-1')
assert.ok(saleStock)
const stockBeforeReturn = saleStock.quantity
assert.ok(mockRepository.returnSale({ saleId: sale.id, branchId: 'branch-1', items: [{ productVariantId: 'var-1', quantity: 1, amount: 245 }], refundAmount: 245, type: 'refund' }))
assert.equal(saleStock.quantity, stockBeforeReturn + 1)
assert.equal(mockRepository.returnSale({ saleId: sale.id, branchId: 'branch-1', items: [{ productVariantId: 'var-1', quantity: 1, amount: 245 }], refundAmount: 245, type: 'refund' }), undefined)
assert.ok(purchases.length > 1 && sales.length > 0)
