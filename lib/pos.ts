
import type { InventoryItem, PaymentMethod, ProductVariant, SaleItem } from '../data/models'

export function calculateSaleTotals(
  items: SaleItem[],
  discountPercent: number,
  taxEnabled = false,
  taxRate = 0,
) {
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  )

  const discount = Math.min(100, Math.max(0, discountPercent))
  const discountAmount = Math.round(subtotal * (discount / 100) * 100) / 100

  const taxableAmount = Math.max(0, subtotal - discountAmount)

  const safeTaxRate =
    taxEnabled && Number.isFinite(taxRate)
      ? Math.min(100, Math.max(0, taxRate))
      : 0

  const taxAmount = Math.round(taxableAmount * (safeTaxRate / 100) * 100) / 100

  const total = Math.round((taxableAmount + taxAmount) * 100) / 100

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    taxEnabled: taxEnabled && safeTaxRate > 0,
    taxRate: safeTaxRate,
    taxAmount,
    total,
  }
}

export function validateStock(
  items: SaleItem[],
  variants: ProductVariant[],
  inventoryItems: InventoryItem[],
) {
  return items.every((item) => {
    const variant = variants.find(
      (candidate) => candidate.id === item.productVariantId,
    )

    const inventory = inventoryItems.find(
      (candidate) => candidate.productVariantId === item.productVariantId,
    )

    return Boolean(
      variant &&
      inventory &&
      item.quantity > 0 &&
      inventory.quantity >= item.quantity,
    )
  })
}

export const paymentMethods: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'wallet', label: 'محفظة إلكترونية' },
  { value: 'transfer', label: 'تحويل بنكي' },
]
