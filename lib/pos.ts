import type { InventoryItem, PaymentMethod, ProductVariant, SaleItem } from '../data/models'

export function calculateSaleTotals(items: SaleItem[], discountPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const discount = Math.min(100, Math.max(0, discountPercent))
  const discountAmount = subtotal * (discount / 100)
  return { subtotal, discountAmount, total: Math.max(0, subtotal - discountAmount) }
}

export function validateStock(items: SaleItem[], variants: ProductVariant[], inventoryItems: InventoryItem[]) {
  return items.every((item) => {
    const variant = variants.find((candidate) => candidate.id === item.productVariantId)
    const inventory = inventoryItems.find((candidate) => candidate.productVariantId === item.productVariantId)
    return Boolean(variant && inventory && item.quantity > 0 && inventory.quantity >= item.quantity)
  })
}

export function getRemainingBalance(total: number, amountPaid: number) { return Math.max(0, total - Math.max(0, amountPaid)) }
export const paymentMethods: { value: PaymentMethod; label: string }[] = [{ value: 'cash', label: 'نقدي' }, { value: 'card', label: 'بطاقة' }, { value: 'transfer', label: 'تحويل بنكي' }]
