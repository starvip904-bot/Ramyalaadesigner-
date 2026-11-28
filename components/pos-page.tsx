
'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  ArrowRight,
  CreditCard,
  Barcode,
} from 'lucide-react'

import { createPosSale } from '@/app/actions/pos'
import { calculateSaleTotals, paymentMethods } from '@/lib/pos'
import type { PaymentMethod, SaleItem } from '@/data/models'

type PosVariant = {
  id: string
  sku: string | null
  barcode: string | null
  size: string | null
  color: string | null
  price: number | string
  cost: number | string | null
}

type PosProduct = {
  id: string
  name: string
  category: string | null
  status: string
  dokkan_product_variants: PosVariant[]
}

type PosBranch = {
  id: string
  name: string
  status: string
}

type PosMovement = {
  branch_id: string
  product_variant_id: string
  movement_type: string
  quantity: number | string
}

type PosCustomer = {
  id: string
  name: string
  phone: string | null
  status: string
}

type PosCatalog = {
  products: PosProduct[]
  branches: PosBranch[]
  movements: PosMovement[]
  customers: PosCustomer[]
}

type PosPageProps = {
  initialData: PosCatalog
  taxEnabled: boolean
  taxRate: number
}

export default function PosPage({
  initialData,
  taxEnabled,
  taxRate,
}: PosPageProps) {
  const router = useRouter()
  const requestKey = useRef<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [query, setQuery] = useState('')
  const [branchId, setBranchId] = useState(
    initialData.branches.find((branch) => branch.status === 'active')?.id ?? ''
  )
  const [cart, setCart] = useState<SaleItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)

  const branches = initialData.branches.filter(
    (branch) => branch.status === 'active'
  )

  const products = initialData.products.filter(
    (product) => product.status === 'active'
  )

  const customers = initialData.customers.filter(
    (customer) => customer.status === 'active'
  )

  const stockMap = useMemo(() => {
    const result = new Map<string, number>()

    for (const movement of initialData.movements) {
      const key = `${movement.branch_id}:${movement.product_variant_id}`

      const positiveTypes = [
        'opening',
        'purchase',
        'return',
        'adjustment',
        'transfer_in',
      ]

      const negativeTypes = ['sale', 'transfer_out', 'damage']

      const sign = positiveTypes.includes(movement.movement_type)
        ? 1
        : negativeTypes.includes(movement.movement_type)
          ? -1
          : 0

      result.set(
        key,
        (result.get(key) ?? 0) + sign * Number(movement.quantity)
      )
    }

    return result
  }, [initialData.movements])

  const getStock = (variantId: string) =>
    Math.max(0, stockMap.get(`${branchId}:${variantId}`) ?? 0)

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.flatMap((product) =>
      product.dokkan_product_variants
        .map((variant) => ({ product, variant }))
        .filter(({ product, variant }) => {
          if (!normalizedQuery) return true

          const searchable = [
            product.name,
            product.category ?? '',
            variant.sku ?? '',
            variant.barcode ?? '',
            variant.size ?? '',
            variant.color ?? '',
          ]
            .join(' ')
            .toLowerCase()

          return searchable.includes(normalizedQuery)
        })
    )
  }, [products, query])

  const totals = calculateSaleTotals(
    cart,
    discount,
    taxEnabled,
    taxRate
  )

  const invalidateRequest = () => {
    requestKey.current = null
  }

  const addProduct = (product: PosProduct, variant: PosVariant) => {
    const stock = getStock(variant.id)

    if (stock <= 0) {
      setError('هذا الصنف غير متوفر في الفرع المحدد')
      return
    }

    invalidateRequest()
    setError(null)
    setMessage(null)
    setShowCheckout(false)

    const name = [
      product.name,
      variant.size ? `مقاس ${variant.size}` : '',
      variant.color ?? '',
    ]
      .filter(Boolean)
      .join(' - ')

    setCart((current) => {
      const existing = current.find(
        (item) => item.productVariantId === variant.id
      )

      if (existing) {
        return current.map((item) =>
          item.productVariantId === variant.id
            ? { ...item, quantity: Math.min(item.quantity + 1, stock) }
            : item
        )
      }

      return [
        ...current,
        {
          productVariantId: variant.id,
          name,
          quantity: 1,
          unitPrice: Number(variant.price),
          discount: 0,
        },
      ]
    })
  }

  const handleBarcodeEnter = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== 'Enter') return

    event.preventDefault()

    const scannedValue = query.trim().toLowerCase()
    if (!scannedValue) return

    const exactMatch = products
      .flatMap((product) =>
        product.dokkan_product_variants.map((variant) => ({
          product,
          variant,
        }))
      )
      .find(
        ({ variant }) =>
          variant.barcode?.trim().toLowerCase() === scannedValue ||
          variant.sku?.trim().toLowerCase() === scannedValue
      )

    if (exactMatch) {
      addProduct(exactMatch.product, exactMatch.variant)
      setQuery('')
      searchInputRef.current?.focus()
      return
    }

    if (results.length === 1) {
      addProduct(results[0].product, results[0].variant)
      setQuery('')
      searchInputRef.current?.focus()
      return
    }

    setError('لم يتم العثور على صنف مطابق للباركود أو الكود المدخل')
  }

  const updateQuantity = (id: string, delta: number) => {
    invalidateRequest()
    setError(null)
    setShowCheckout(false)

    setCart((current) =>
      current.flatMap((item) => {
        if (item.productVariantId !== id) return [item]

        const next = item.quantity + delta
        const stock = getStock(id)

        if (next <= 0) return []
        return [{ ...item, quantity: Math.min(next, stock) }]
      })
    )
  }

  const removeProduct = (id: string) => {
    invalidateRequest()
    setShowCheckout(false)
    setCart((current) =>
      current.filter((item) => item.productVariantId !== id)
    )
  }

  const confirmSale = async () => {
    if (submitting || cart.length === 0) return

    setError(null)
    setMessage(null)

    if (!branchId) {
      setError('اختر الفرع أولاً')
      return
    }

    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      setError('نسبة الخصم يجب أن تكون بين صفر و100')
      return
    }

    for (const item of cart) {
      if (item.quantity > getStock(item.productVariantId)) {
        setError(`المخزون غير كافٍ للصنف: ${item.name}`)
        setShowCheckout(false)
        return
      }
    }

    setSubmitting(true)

    try {
      requestKey.current ??= crypto.randomUUID()

      const result = await createPosSale({
        branchId,
        items: cart.map((item) => ({
          variantId: item.productVariantId,
          quantity: item.quantity,
        })),
        discountPercent: discount,
        amountPaid: totals.total,
        paymentMethod,
        customerId: customerId || null,
        notes,
        idempotencyKey: requestKey.current,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      requestKey.current = null
      setCart([])
      setDiscount(0)
      setCustomerId('')
      setNotes('')
      setShowCheckout(false)

      setMessage(`تم حفظ الفاتورة بنجاح. رقم الفاتورة: ${result.saleId}`)

      router.refresh()
    } catch {
      setError('حدث خطأ أثناء الاتصال. يمكنك إعادة المحاولة بأمان')
    } finally {
      setSubmitting(false)
    }
  }

  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <main className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm dokkan-text-muted">المبيعات</p>
          <h1 className="mt-1 text-2xl font-extrabold">نقطة البيع</h1>
          <p className="mt-1 text-xs dokkan-text-muted">
            أضف المنتجات إلى الفاتورة ثم انتقل إلى الدفع
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold dokkan-panel">
          <ShoppingCart size={18} />
          <span>{cartQuantity} قطعة في السلة</span>
        </div>
      </header>

      {message && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl p-4 text-sm font-bold"
          style={{
            background: 'var(--success-soft)',
            color: 'var(--success)',
          }}
        >
          <CheckCircle2 size={20} />
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl p-4 text-sm font-bold"
          style={{
            background: 'var(--danger-soft)',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      <label className="block space-y-2 text-sm font-bold">
        اختر الفرع
        <select
          value={branchId}
          onChange={(event) => {
            invalidateRequest()
            setBranchId(event.target.value)
            setCart([])
            setShowCheckout(false)
            setError(null)
            setMessage(null)
          }}
          className="dokkan-input w-full rounded-xl p-3"
        >
          <option value="">اختر الفرع</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="dokkan-card min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="mb-4">
            <label className="dokkan-input flex items-center gap-2 rounded-xl px-3 py-3 text-sm">
              <Search size={19} className="dokkan-text-muted shrink-0" />
              <input
                ref={searchInputRef}
                aria-label="البحث عن منتج أو إدخال الباركود"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleBarcodeEnter}
                placeholder="ابحث بالاسم أو امسح الباركود..."
                className="w-full min-w-0 bg-transparent outline-none"
              />
              <Barcode size={19} className="dokkan-text-muted shrink-0" />
            </label>
            <p className="mt-2 text-xs dokkan-text-muted">
              يمكنك الضغط على Enter بعد قراءة الباركود لإضافة الصنف مباشرة
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ product, variant }) => {
              const stock = getStock(variant.id)

              return (
                <button
                  type="button"
                  key={variant.id}
                  onClick={() => addProduct(product, variant)}
                  disabled={stock <= 0 || !branchId}
                  className="dokkan-panel group rounded-xl p-3 text-right transition hover:-translate-y-0.5 hover:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div
                    className="flex aspect-[1.5] items-center justify-center rounded-lg text-3xl font-extrabold"
                    style={{
                      background: 'var(--surface-secondary)',
                      color: 'var(--brand)',
                    }}
                  >
                    {product.name[0]}
                  </div>

                  <p className="mt-3 text-sm font-bold">
                    {product.name}
                  </p>

                  <p className="mt-1 text-xs dokkan-text-muted">
                    {[variant.size, variant.color]
                      .filter(Boolean)
                      .join(' · ') || 'بدون مواصفات'}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span
                      className="text-sm font-extrabold"
                      style={{ color: 'var(--brand)' }}
                    >
                      {Number(variant.price).toFixed(2)} ج.م
                    </span>
                    <span className="text-xs dokkan-text-muted">
                      المتاح {stock}
                    </span>
                  </div>

                  {variant.barcode && (
                    <p className="mt-2 truncate text-[10px] dokkan-text-muted">
                      باركود: {variant.barcode}
                    </p>
                  )}

                  <span
                    className="mt-3 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold"
                    style={{
                      background: 'var(--brand-soft)',
                      color: 'var(--brand)',
                    }}
                  >
                    <Plus size={15} />
                    إضافة للفاتورة
                  </span>
                </button>
              )
            })}
          </div>

          {results.length === 0 && (
            <p className="py-10 text-center text-sm dokkan-text-muted">
              لا توجد منتجات مطابقة
            </p>
          )}

          {products.length === 0 && (
            <p className="py-10 text-center text-sm dokkan-text-muted">
              لا توجد منتجات نشطة في قاعدة البيانات
            </p>
          )}
        </section>

        <section className="dokkan-card min-w-0 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between border-b pb-4"
            style={{ borderColor: 'var(--line)' }}
          >
            <div>
              <h2 className="font-extrabold">الفاتورة الحالية</h2>
              <p className="mt-1 text-xs dokkan-text-muted">
                {cart.length} أصناف · {cartQuantity} قطعة
              </p>
            </div>

            <ShoppingCart size={21} className="dokkan-text-muted" />
          </div>

          <div className="flex min-h-28 flex-col gap-3 py-4">
            {cart.map((item) => (
              <div
                key={item.productVariantId}
                className="flex items-center justify-between gap-2 rounded-xl p-3"
                style={{ background: 'var(--surface-secondary)' }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.name}</p>
                  <p className="mt-1 text-xs dokkan-text-muted">
                    {item.unitPrice.toFixed(2)} ج.م
                  </p>
                  <p className="mt-1 text-xs font-bold">
                    الإجمالي: {(item.unitPrice * item.quantity).toFixed(2)} ج.م
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="تقليل الكمية"
                    onClick={() => updateQuantity(item.productVariantId, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <Minus size={16} />
                  </button>

                  <span className="min-w-7 text-center text-sm font-extrabold">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    aria-label="زيادة الكمية"
                    onClick={() => updateQuantity(item.productVariantId, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <Plus size={16} />
                  </button>

                  <button
                    type="button"
                    aria-label="حذف المنتج"
                    onClick={() => removeProduct(item.productVariantId)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg"
                    style={{
                      background: 'var(--danger-soft)',
                      color: 'var(--danger)',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-8 text-center dokkan-text-muted">
                <ShoppingCart className="mb-3" size={30} />
                <p className="text-sm">أضف المنتجات إلى الفاتورة</p>
              </div>
            )}
          </div>

          <div
            className="space-y-4 border-t pt-4"
            style={{ borderColor: 'var(--line)' }}
          >
            <label className="block text-sm font-bold">
              العميل (اختياري)
              <select
                value={customerId}
                onChange={(event) => {
                  invalidateRequest()
                  setCustomerId(event.target.value)
                  setShowCheckout(false)
                }}
                className="dokkan-input mt-2 w-full rounded-lg p-3 font-normal"
              >
                <option value="">عميل نقدي / بدون تحديد عميل</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                    {customer.phone ? ` - ${customer.phone}` : ''}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <span className="mt-1 block text-xs font-normal dokkan-text-muted">
                  لا يوجد عملاء نشطون مسجلون حاليًا
                </span>
              )}
            </label>

            <label className="block text-xs font-bold">
              ملاحظات الفاتورة (اختياري)
              <textarea
                value={notes}
                onChange={(event) => {
                  invalidateRequest()
                  setNotes(event.target.value)
                  setShowCheckout(false)
                }}
                rows={2}
                maxLength={500}
                className="dokkan-input mt-2 w-full rounded-lg p-3 font-normal"
                placeholder="اكتب أي ملاحظات تخص الفاتورة"
              />
            </label>

            <div className="flex justify-between text-sm">
              <span className="dokkan-text-muted">المجموع الفرعي</span>
              <b>{totals.subtotal.toFixed(2)} ج.م</b>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>الخصم %</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(event) => {
                  invalidateRequest()
                  setDiscount(Number(event.target.value))
                  setShowCheckout(false)
                }}
                className="dokkan-input w-24 rounded-lg p-2 text-center"
              />
            </label>

            <div className="flex justify-between text-sm">
              <span className="dokkan-text-muted">قيمة الخصم</span>
              <b>{totals.discountAmount.toFixed(2)} ج.م</b>
            </div>

            <div className="flex justify-between text-sm">
              <span className="dokkan-text-muted">المبلغ بعد الخصم</span>
              <b>{totals.taxableAmount.toFixed(2)} ج.م</b>
            </div>

            <div className="flex justify-between text-sm">
              <span className="dokkan-text-muted">
                {totals.taxEnabled
                  ? `الضريبة (${totals.taxRate}%)`
                  : 'الضريبة'}
              </span>
              <b>
                {totals.taxEnabled
                  ? `${totals.taxAmount.toFixed(2)} ج.م`
                  : 'غير مفعلة'}
              </b>
            </div>

            <div
              className="flex justify-between rounded-xl p-4 text-base font-extrabold"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand)',
              }}
            >
              <span>الإجمالي النهائي</span>
              <b>{totals.total.toFixed(2)} ج.م</b>
            </div>

            {!showCheckout ? (
              <button
                type="button"
                disabled={cart.length === 0 || !branchId}
                onClick={() => {
                  setError(null)
                  setShowCheckout(true)
                }}
                className="dokkan-primary flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CreditCard size={18} />
                متابعة إلى الدفع
              </button>
            ) : (
              <div
                className="space-y-4 rounded-xl border p-4"
                style={{
                  borderColor: 'var(--brand)',
                  background: 'var(--surface-secondary)',
                }}
              >
                <div>
                  <h3 className="font-extrabold">اختيار وسيلة الدفع</h3>
                  <p className="mt-1 text-xs dokkan-text-muted">
                    اختر طريقة دفع الفاتورة قبل تأكيد البيع
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      type="button"
                      key={method.value}
                      onClick={() => {
                        invalidateRequest()
                        setPaymentMethod(method.value)
                      }}
                      className="rounded-lg border p-3 text-xs font-bold transition"
                      style={{
                        borderColor:
                          paymentMethod === method.value
                            ? 'var(--brand)'
                            : 'var(--line)',
                        background:
                          paymentMethod === method.value
                            ? 'var(--brand-soft)'
                            : 'var(--card)',
                        color:
                          paymentMethod === method.value
                            ? 'var(--brand)'
                            : 'var(--foreground)',
                      }}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>

                <div className="flex justify-between text-sm">
                  <span className="dokkan-text-muted">المبلغ المدفوع بالكامل</span>
                  <b>{totals.total.toFixed(2)} ج.م</b>
                </div>

                <button
                  type="button"
                  disabled={submitting || cart.length === 0 || !branchId}
                  onClick={confirmSale}
                  className="dokkan-primary w-full rounded-xl p-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'جارٍ حفظ الفاتورة...' : 'تأكيد البيع وحفظ الفاتورة'}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowCheckout(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <ArrowRight size={17} />
                  العودة إلى الفاتورة
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
