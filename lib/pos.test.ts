
import { strict as assert } from 'node:assert'
import { calculateSaleTotals, validateStock } from './pos.ts'

const item = {
  productVariantId: 'var-1',
  name: 'قميص',
  quantity: 2,
  unitPrice: 100,
  discount: 0,
}

assert.deepEqual(calculateSaleTotals([item], 10), {
  subtotal: 200,
  discountAmount: 20,
  total: 180,
})

assert.equal(
  validateStock(
    [item],
    [{
      id: 'var-1',
      productId: 'prod-1',
      sku: 'SKU',
      barcode: '1',
      price: 100,
      cost: 50,
      stock: 2,
    }],
    [{
      id: 'i',
      branchId: 'branch-1',
      productVariantId: 'var-1',
      quantity: 2,
      reorderLevel: 1,
      updatedAt: '',
    }],
  ),
  true,
)

assert.equal(
  validateStock(
    [{ ...item, quantity: 3 }],
    [{
      id: 'var-1',
      productId: 'prod-1',
      sku: 'SKU',
      barcode: '1',
      price: 100,
      cost: 50,
      stock: 2,
    }],
    [{
      id: 'i',
      branchId: 'branch-1',
      productVariantId: 'var-1',
      quantity: 2,
      reorderLevel: 1,
      updatedAt: '',
    }],
  ),
  false,
)
