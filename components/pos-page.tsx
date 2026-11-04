'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import { mockRepository, products, inventory } from '@/data/mock-repository'
import { calculateSaleTotals, getRemainingBalance, paymentMethods, validateStock } from '@/lib/pos'
import type { PaymentMethod, SaleItem } from '@/data/models'

export default function PosPage() {
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<SaleItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [amountPaid, setAmountPaid] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const results = useMemo(() => products.filter((p) => `${p.name} ${p.category} ${p.variants[0].barcode}`.includes(query)), [query])
  const totals = calculateSaleTotals(cart, discount)
  const remaining = getRemainingBalance(totals.total, amountPaid)
  const addProduct = (product: (typeof products)[number]) => {
    const variant = product.variants[0]
    if (variant.stock === 0) return setError('هذا المنتج غير متوفر حالياً')
    setError(null); setMessage(null)
    setCart((current) => { const existing = current.find((item) => item.productVariantId === variant.id); return existing ? current.map((item) => item.productVariantId === variant.id ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock) } : item) : [...current, { productVariantId: variant.id, name: product.name, quantity: 1, unitPrice: variant.price, discount: 0 }] })
  }
  const updateQuantity = (id: string, delta: number) => setCart((current) => current.flatMap((item) => { if (item.productVariantId !== id) return [item]; const next = item.quantity + delta; return next > 0 ? [{ ...item, quantity: Math.min(next, products.flatMap((p) => p.variants).find((v) => v.id === id)?.stock ?? next) }] : [] }))
  const confirmSale = () => {
    if (submitting || cart.length === 0) return
    setError(null); setMessage(null)
    if (!validateStock(cart, products.flatMap((p) => p.variants), inventory)) return setError('لا يمكن إتمام البيع: الكمية المطلوبة غير متوفرة')
    if (amountPaid < totals.total) return setError('المبلغ المدفوع أقل من إجمالي الفاتورة')
    setSubmitting(true)
    const sale = mockRepository.createSale({ branchId: 'branch-1', items: cart, subtotal: totals.subtotal, discount: totals.discountAmount, total: totals.total, paymentMethod, amountPaid, remaining })
    inventory.forEach((item) => { const sold = cart.find((line) => line.productVariantId === item.productVariantId); if (sold) item.quantity -= sold.quantity })
    setCart([]); setAmountPaid(0); setDiscount(0); setMessage(`تم حفظ الفاتورة ${sale.id} بنجاح`); setSubmitting(false)
  }
  return <div className="space-y-6"><div><p className="text-sm text-[#64748b]">الفرع الرئيسي</p><h2 className="mt-1 text-2xl font-extrabold">نقطة البيع</h2></div>{message && <div role="status" className="flex items-center gap-2 rounded-xl bg-[#e4f4ef] p-4 text-sm font-bold text-[#2563eb]"><CheckCircle2 />{message}</div>}{error && <div role="alert" className="rounded-xl bg-[#ffebeb] p-4 text-sm font-bold text-[#c43e3e]">{error}</div>}<div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><label className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-3 text-sm text-[#94a3b8]"><Search /><input aria-label="البحث عن منتج" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن منتج أو باركود..." className="w-full bg-transparent outline-none" /></label><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{results.map((product) => <button type="button" key={product.id} onClick={() => addProduct(product)} className="rounded-xl border border-[#edf0f2] p-3 text-right hover:border-[#93c5fd] disabled:opacity-50" disabled={product.variants[0].stock === 0}><div className="flex aspect-[1.5] items-center justify-center rounded-lg bg-[#f1f5f9] text-3xl">{product.name[0]}</div><p className="mt-3 text-xs font-bold">{product.name}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-[#2563eb]">{product.variants[0].price} ج.م</span><span className="text-[10px] text-[#94a3b8]">متوفر {product.variants[0].stock}</span></div></button>)}</div>{results.length === 0 && <p className="py-10 text-center text-sm text-[#94a3b8]">لا توجد منتجات مطابقة</p>}</section><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex items-center justify-between border-b border-[#f0f1f3] pb-4"><h3 className="font-extrabold">الفاتورة الحالية</h3><span className="text-xs text-[#94a3b8]">{cart.length} منتجات</span></div><div className="flex min-h-32 flex-col gap-3 py-4">{cart.map((item) => <div key={item.productVariantId} className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f8fa] p-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{item.name}</p><p className="text-[11px] text-[#94a3b8]">{item.unitPrice} ج.م</p></div><div className="flex items-center gap-2"><button type="button" aria-label="تقليل الكمية" onClick={() => updateQuantity(item.productVariantId, -1)}><Minus /></button><span className="text-sm font-bold">{item.quantity}</span><button type="button" aria-label="زيادة الكمية" onClick={() => updateQuantity(item.productVariantId, 1)}><Plus /></button><button type="button" aria-label="حذف المنتج" onClick={() => setCart((current) => current.filter((line) => line.productVariantId !== item.productVariantId))}><Trash2 /></button></div></div>)}{cart.length === 0 && <div className="flex flex-1 flex-col items-center justify-center text-center text-[#94a3b8]"><ShoppingCart className="mb-3 text-[#94a3b8]" /><p className="text-sm">أضف المنتجات إلى الفاتورة</p></div>}</div><div className="border-t border-[#f0f1f3] pt-4"><div className="flex justify-between text-sm"><span>المجموع الفرعي</span><b>{totals.subtotal.toFixed(2)} ج.م</b></div><label className="mt-3 flex items-center justify-between gap-3 text-sm"><span>الخصم %</span><input type="number" min="0" max="100" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} className="w-24 rounded-lg border border-[#e2e8f0] p-2 text-center" /></label><div className="mt-3 flex justify-between text-base font-extrabold"><span>الإجمالي</span><b>{totals.total.toFixed(2)} ج.م</b></div><div className="mt-4 grid grid-cols-3 gap-2">{paymentMethods.map((method) => <button type="button" key={method.value} onClick={() => setPaymentMethod(method.value)} className={`rounded-lg border p-2 text-xs font-bold ${paymentMethod === method.value ? 'border-[#2563eb] bg-[#eaf2ff] text-[#2563eb]' : 'border-[#e2e8f0]'}`}>{method.label}</button>)}</div><label className="mt-3 block text-xs font-bold">المبلغ المدفوع<input type="number" min="0" value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-[#e2e8f0] p-2" /></label><p className="mt-2 text-xs text-[#64748b]">المتبقي: <b>{remaining.toFixed(2)} ج.م</b></p><button type="button" disabled={submitting || cart.length === 0} onClick={confirmSale} className="mt-4 w-full rounded-xl bg-[#2563eb] p-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'جارٍ الحفظ...' : 'تأكيد البيع'}</button></div></section></div></div>
}
