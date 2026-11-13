
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
}

export default function PosPage({ initialData }: PosPageProps) {
  const router = useRouter()
  const requestKey = useRef<string | null>(null)

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

  const totals = calculateSaleTotals(cart, discount)

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

  const updateQuantity = (id: string, delta: number) => {
    invalidateRequest()
    setError(null)

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

      setMessage(`تم حفظ الفاتورة بنجاح. رقم الفاتورة: ${result.saleId}`)

      router.refresh()
    } catch {
      setError('حدث خطأ أثناء الاتصال. يمكنك إعادة المحاولة بأمان')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="space-y-6" dir="rtl">
      <header>
        <p className="text-sm text-[#64748b]">المبيعات</p>
        <h1 className="mt-1 text-2xl font-extrabold">نقطة البيع</h1>
        <p className="mt-1 text-xs text-[#64748b]">
          المنتجات والكميات معروضة من قاعدة البيانات
        </p>
      </header>

      {message && (
        <div role="status" className="flex items-center gap-2 rounded-xl bg-[#e4f4ef] p-4 text-sm font-bold text-[#166534]">
          <CheckCircle2 />
          {message}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl bg-[#ffebeb] p-4 text-sm font-bold text-[#c43e3e]">
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
            setError(null)
            setMessage(null)
          }}
          className="w-full rounded-xl border border-[#e2e8f0] bg-white p-3"
        >
          <option value="">اختر الفرع</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <label className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-3 text-sm text-[#64748b]">
            <Search />
            <input
              aria-label="البحث عن منتج"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالاسم أو الباركود أو المقاس..."
              className="w-full bg-transparent outline-none"
            />
          </label>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map(({ product, variant }) => {
              const stock = getStock(variant.id)

              return (
                <button
                  type="button"
                  key={variant.id}
                  onClick={() => addProduct(product, variant)}
                  disabled={stock <= 0 || !branchId}
                  className="rounded-xl border border-[#edf0f2] p-3 text-right hover:border-[#93c5fd] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <div className="flex aspect-[1.5] items-center justify-center rounded-lg bg-[#f1f5f9] text-3xl">
                    {product.name[0]}
                  </div>

                  <p className="mt-3 text-xs font-bold">{product.name}</p>

                  <p className="mt-1 text-[11px] text-[#64748b]">
                    {[variant.size, variant.color].filter(Boolean).join(' · ') || 'بدون مواصفات'}
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#2563eb]">
                      {Number(variant.price).toFixed(2)} ج.م
                    </span>
                    <span className="text-[10px] text-[#64748b]">
                      المتاح {stock}
                    </span>
                  </div>

                  {variant.barcode && (
                    <p className="mt-1 text-[10px] text-[#94a3b8]">
                      باركود: {variant.barcode}
                    </p>
                  )}
                </button>
              )
            })}
          </div>

          {results.length === 0 && (
            <p className="py-10 text-center text-sm text-[#94a3b8]">
              لا توجد منتجات مطابقة
            </p>
          )}

          {products.length === 0 && (
            <p className="py-10 text-center text-sm text-[#94a3b8]">
              لا توجد منتجات نشطة في قاعدة البيانات
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <div className="flex items-center justify-between border-b border-[#f0f1f3] pb-4">
            <h2 className="font-extrabold">الفاتورة الحالية</h2>
            <span className="text-xs text-[#94a3b8]">
              {cart.length} أصناف
            </span>
          </div>

          <div className="flex min-h-32 flex-col gap-3 py-4">
            {cart.map((item) => (
              <div
                key={item.productVariantId}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f8fa] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{item.name}</p>
                  <p className="text-[11px] text-[#94a3b8]">
                    {item.unitPrice.toFixed(2)} ج.م
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label="تقليل الكمية"
                    onClick={() => updateQuantity(item.productVariantId, -1)}
                  >
                    <Minus size={18} />
                  </button>

                  <span className="text-sm font-bold">{item.quantity}</span>

                  <button
                    type="button"
                    aria-label="زيادة الكمية"
                    onClick={() => updateQuantity(item.productVariantId, 1)}
                  >
                    <Plus size={18} />
                  </button>

                  <button
                    type="button"
                    aria-label="حذف المنتج"
                    onClick={() => removeProduct(item.productVariantId)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}

            {cart.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-[#94a3b8]">
                <ShoppingCart className="mb-3" />
                <p className="text-sm">أضف المنتجات إلى الفاتورة</p>
              </div>
            )}
          </div>

          <div className="border-t border-[#f0f1f3] pt-4">
            <label className="mb-4 block text-sm font-bold">
              العميل (اختياري)
              <select
                value={customerId}
                onChange={(event) => {
                  invalidateRequest()
                  setCustomerId(event.target.value)
                }}
                className="mt-2 w-full rounded-lg border border-[#e2e8f0] bg-white p-3 font-normal"
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
                <span className="mt-1 block text-xs font-normal text-[#94a3b8]">
                  لا يوجد عملاء نشطون مسجلون حاليًا
                </span>
              )}
            </label>

            <label className="mb-4 block text-xs font-bold">
              ملاحظات الفاتورة (اختياري)
              <textarea
                value={notes}
                onChange={(event) => {
                  invalidateRequest()
                  setNotes(event.target.value)
                }}
                rows={2}
                maxLength={500}
                className="mt-1 w-full rounded-lg border border-[#e2e8f0] p-2 font-normal"
                placeholder="اكتب أي ملاحظات تخص الفاتورة"
              />
            </label>

            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي</span>
              <b>{totals.subtotal.toFixed(2)} ج.م</b>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span>الخصم %</span>
              <input
                type="number"
                min="0"
                max="100"
                value={discount}
                onChange={(event) => {
                  invalidateRequest()
                  setDiscount(Number(event.target.value))
                }}
                className="w-24 rounded-lg border border-[#e2e8f0] p-2 text-center"
              />
            </label>

            <div className="mt-3 flex justify-between text-base font-extrabold">
              <span>الإجمالي</span>
              <b>{totals.total.toFixed(2)} ج.م</b>
            </div>

            <p className="mt-2 text-xs font-bold text-green-700">
              المبلغ المدفوع بالكامل: {totals.total.toFixed(2)} ج.م
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <button
                  type="button"
                  key={method.value}
                  onClick={() => {
                    invalidateRequest()
                    setPaymentMethod(method.value)
                  }}
                  className={`rounded-lg border p-2 text-xs font-bold ${
                    paymentMethod === method.value
                      ? 'border-[#2563eb] bg-[#eaf2ff] text-[#2563eb]'
                      : 'border-[#e2e8f0]'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting || cart.length === 0 || !branchId}
              onClick={confirmSale}
              className="mt-4 w-full rounded-xl bg-[#2563eb] p-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'جارٍ حفظ الفاتورة...' : 'تأكيد البيع'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
