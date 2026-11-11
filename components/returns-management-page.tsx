
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSaleReturn } from '@/app/actions/returns'
import {
  RotateCcw,
  Search,
  ReceiptText,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

type SaleItem = {
  id: string
  product_variant_id: string
  quantity: number
  unit_price: number
  discount: number
  dokkan_product_variants?: {
    sku?: string | null
    size?: string | null
    color?: string | null
    dokkan_products?: { name?: string | null } | null
  } | null
}

type Sale = {
  id: string
  branch_id: string
  total: number
  amount_paid: number
  remaining: number
  payment_method: string
  status: string
  created_at: string
  dokkan_branches?: { name?: string | null } | null
  dokkan_customers?: {
    name?: string | null
    phone?: string | null
  } | null
  dokkan_sale_items: SaleItem[]
}

type ReturnItem = {
  product_variant_id: string
  quantity: number
  amount: number
}

type SaleReturn = {
  id: string
  sale_id: string
  branch_id: string
  refund_amount: number
  applied_to_balance: number
  refund_method: string | null
  notes: string | null
  created_at: string
  dokkan_sale_return_items: ReturnItem[]
}

type Props = {
  sales: Sale[]
  returns: SaleReturn[]
}

type PendingReturnAttempt = {
  saleId: string
  branchId: string
  items: Array<{
    variantId: string
    quantity: number
  }>
  refundMethod: 'cash' | 'card' | 'transfer'
  notes: string
  idempotencyKey: string
}

const money = (value: number) =>
  new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const date = (value: string) =>
  new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

const paymentLabel = (method?: string | null) => {
  if (method === 'cash') return 'نقدي'
  if (method === 'card') return 'بطاقة'
  if (method === 'transfer') return 'تحويل بنكي'
  return 'غير محدد'
}

export default function ReturnsManagementPage({
  sales,
  returns,
}: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [refundMethod, setRefundMethod] = useState<
    'cash' | 'card' | 'transfer'
  >('cash')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState('')
  const [pendingAttempt, setPendingAttempt] =
    useState<PendingReturnAttempt | null>(null)

  const selectedSale = sales.find(
    (sale) => sale.id === selectedSaleId
  )

  const visibleSales = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return sales.slice(0, 30)

    return sales.filter((sale) => {
      const customer = sale.dokkan_customers?.name || 'عميل نقدي'
      const phone = sale.dokkan_customers?.phone || ''
      const invoice = sale.id

      return (
        customer.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query) ||
        invoice.toLowerCase().includes(query)
      )
    }).slice(0, 30)
  }, [sales, search])

  const returnedQuantities = useMemo(() => {
    const totals: Record<string, number> = {}

    if (!selectedSale) return totals

    for (const record of returns) {
      if (record.sale_id !== selectedSale.id) continue

      for (const item of record.dokkan_sale_return_items || []) {
        totals[item.product_variant_id] =
          (totals[item.product_variant_id] || 0) +
          Number(item.quantity || 0)
      }
    }

    return totals
  }, [returns, selectedSale])

  const saleItems = useMemo(() => {
    if (!selectedSale) return []

    const grouped = new Map<string, {
      variantId: string
      name: string
      sku: string
      size: string
      color: string
      quantity: number
      unitPrice: number
      discount: number
    }>()

    for (const item of selectedSale.dokkan_sale_items || []) {
      const variantId = item.product_variant_id
      const variant = item.dokkan_product_variants
      const product = variant?.dokkan_products

      const existing = grouped.get(variantId)

      if (existing) {
        existing.quantity += Number(item.quantity || 0)
        existing.discount += Number(item.discount || 0)
      } else {
        grouped.set(variantId, {
          variantId,
          name: product?.name || 'منتج',
          sku: variant?.sku || '',
          size: variant?.size || '',
          color: variant?.color || '',
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unit_price || 0),
          discount: Number(item.discount || 0),
        })
      }
    }

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      alreadyReturned: returnedQuantities[item.variantId] || 0,
      available: Math.max(
        0,
        item.quantity - (returnedQuantities[item.variantId] || 0)
      ),
    }))
  }, [selectedSale, returnedQuantities])

  const selectedReturns = returns.filter(
    (record) => record.sale_id === selectedSaleId
  )

  const totalReturnQuantity = saleItems.reduce(
    (sum, item) => sum + item.available,
    0
  )

  const hasSelectedQuantities = saleItems.some(
    (item) => Number(quantities[item.variantId] || 0) > 0
  )

  function selectSale(saleId: string) {
    // لا نسمح بتغيير الفاتورة أثناء وجود عملية غير مؤكدة.
    if (pendingAttempt || loading) return

    setSelectedSaleId(saleId)
    setQuantities({})
    setNotes('')
    setMessage('')
    setSuccess('')
  }

  function updateQuantity(variantId: string, value: string) {
    if (pendingAttempt || loading) return

    setQuantities((current) => ({
      ...current,
      [variantId]: value,
    }))
  }

  async function submitReturn() {
    if (loading) return

    if (!selectedSale && !pendingAttempt) {
      setMessage('اختر الفاتورة أولًا')
      return
    }

    // عند إعادة المحاولة نستخدم نفس الطلب ونفس المفتاح.
    let attempt = pendingAttempt

    if (!attempt) {
      if (!selectedSale) {
        setMessage('اختر الفاتورة أولًا')
        return
      }

      const items = saleItems
        .map((item) => ({
          variantId: item.variantId,
          quantity: Number(quantities[item.variantId] || 0),
          available: item.available,
        }))
        .filter((item) => item.quantity > 0)

      if (items.length === 0) {
        setMessage('أدخل كمية مرتجعة لصنف واحد على الأقل')
        return
      }

      const invalid = items.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > item.available
      )

      if (invalid) {
        setMessage('راجع الكميات؛ يوجد صنف تجاوز الكمية المتاحة للمرتجع')
        return
      }

      attempt = {
        saleId: selectedSale.id,
        branchId: selectedSale.branch_id,
        items: items.map(({ variantId, quantity }) => ({
          variantId,
          quantity,
        })),
        refundMethod,
        notes,
        idempotencyKey: crypto.randomUUID(),
      }

      setPendingAttempt(attempt)
    }

    setLoading(true)
    setMessage('')
    setSuccess('')

    try {
      const result = await createSaleReturn(attempt)

      if (!result.ok) {
        setMessage(
          result.retryable
            ? `${result.message}. لو هتعيد المحاولة، استخدم زر إعادة المحاولة بنفس الطلب.`
            : result.message
        )

        if (!result.retryable) {
          setPendingAttempt(null)
        }

        return
      }

      setSuccess(
        `تم تسجيل المرتجع بنجاح. رقم العملية: ${result.returnId}`
      )

      setPendingAttempt(null)
      setQuantities({})
      setNotes('')
      router.refresh()
    } catch {
      // قد تكون قاعدة البيانات حفظت العملية قبل انقطاع الاتصال.
      // لذلك لا ننشئ مفتاحًا جديدًا عند إعادة المحاولة.
      setMessage(
        'تعذر تأكيد النتيجة بسبب الاتصال. اضغط إعادة المحاولة بنفس الطلب، ولا تنشئ مرتجعًا جديدًا.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <RotateCcw className="text-blue-600" />
            <h2 className="text-2xl font-extrabold">
              المرتجعات والاستبدال
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            اختر فاتورة وحدد الأصناف والكميات المراد إرجاعها
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {returns.length} عملية مرتجع مسجلة
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Search size={19} className="text-slate-400" />
          <h3 className="font-bold">البحث عن فاتورة</h3>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث برقم الفاتورة أو اسم العميل أو الهاتف..."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
        />

        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {visibleSales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              لا توجد فواتير مطابقة للبحث
            </p>
          ) : (
            visibleSales.map((sale) => (
              <button
                key={sale.id}
                type="button"
                onClick={() => selectSale(sale.id)}
                disabled={Boolean(pendingAttempt) || loading}
                className={`w-full rounded-xl border p-4 text-right transition ${
                  selectedSaleId === sale.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">
                      {sale.dokkan_customers?.name || 'عميل نقدي'}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {sale.dokkan_customers?.phone || 'بدون رقم هاتف'}
                    </p>
                  </div>

                  <div className="text-left">
                    <p className="text-sm font-extrabold text-blue-700">
                      {money(Number(sale.total))}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {date(sale.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>
                    الفرع: {sale.dokkan_branches?.name || '—'}
                  </span>

                  <span>
                    المتبقي: {money(Number(sale.remaining))}
                  </span>

                  <span>
                    طريقة الدفع: {paymentLabel(sale.payment_method)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedSale && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-5 flex items-center gap-2">
              <ReceiptText className="text-blue-600" />
              <h3 className="font-extrabold">
                تفاصيل الفاتورة المختارة
              </h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  إجمالي الفاتورة
                </p>
                <p className="mt-2 font-extrabold">
                  {money(Number(selectedSale.total))}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">المدفوع</p>
                <p className="mt-2 font-extrabold">
                  {money(Number(selectedSale.amount_paid))}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  المتبقي على العميل
                </p>
                <p className="mt-2 font-extrabold text-orange-600">
                  {money(Number(selectedSale.remaining))}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  الكميات المتاحة للمرتجع
                </p>
                <p className="mt-2 font-extrabold">
                  {totalReturnQuantity}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <Package className="text-blue-600" />
              <h3 className="font-extrabold">أصناف الفاتورة</h3>
            </div>

            {saleItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                لا توجد أصناف في هذه الفاتورة
              </p>
            ) : (
              <div className="space-y-3">
                {saleItems.map((item) => (
                  <div
                    key={item.variantId}
                    className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <p className="font-bold">{item.name}</p>

                      <p className="mt-1 text-xs text-slate-500">
                        {[
                          item.sku && `كود: ${item.sku}`,
                          item.size && `المقاس: ${item.size}`,
                          item.color && `اللون: ${item.color}`,
                        ]
                          .filter(Boolean)
                          .join(' — ') || 'بدون تفاصيل إضافية'}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        المباع: {item.quantity}
                        {' — '}
                        المرتجع سابقًا: {item.alreadyReturned}
                      </p>
                    </div>

                    <div className="self-center text-sm">
                      <p className="text-slate-500">المتاح</p>
                      <p className="mt-1 font-extrabold">
                        {item.available}
                      </p>
                    </div>

                    <div className="self-center">
                      <label className="mb-1 block text-xs font-bold text-slate-500">
                        كمية المرتجع
                      </label>

                      <input
                        type="number"
                        min="0"
                        max={item.available}
                        step="0.01"
                        disabled={
                          item.available <= 0 ||
                          Boolean(pendingAttempt) ||
                          loading
                        }
                        value={quantities[item.variantId] || ''}
                        onChange={(event) =>
                          updateQuantity(
                            item.variantId,
                            event.target.value
                          )
                        }
                        placeholder="0"
                        className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 font-extrabold">
              بيانات رد المبلغ
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                طريقة رد المبلغ

                <select
                  value={pendingAttempt?.refundMethod ?? refundMethod}
                  disabled={Boolean(pendingAttempt) || loading}
                  onChange={(event) =>
                    setRefundMethod(
                      event.target.value as typeof refundMethod
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal outline-none focus:border-blue-500"
                >
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="transfer">تحويل بنكي</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                ملاحظات المرتجع

                <input
                  value={pendingAttempt?.notes ?? notes}
                  disabled={Boolean(pendingAttempt) || loading}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  placeholder="سبب الإرجاع أو أي ملاحظات..."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-blue-500"
                />
              </label>
            </div>

            <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-800">
              سيتم خصم قيمة المرتجع من المبلغ المتبقي على الفاتورة أولًا.
              وإذا زادت قيمة المرتجع عن المتبقي، يتم رد الزيادة بطريقة الدفع المختارة.
              إجمالي الفاتورة الأصلية والمبلغ المدفوع الأصلي لن يتم تغييرهما.
            </p>

            {pendingAttempt && (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm leading-6 text-orange-800">
                توجد عملية مرتجع لم يتم تأكيد نتيجتها بعد.
                استخدم زر إعادة المحاولة بنفس الطلب، ولا تبدأ مرتجعًا جديدًا قبل التأكد من نتيجتها.
              </div>
            )}

            {message && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={18} />
                {message}
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 size={18} />
                {success}
              </div>
            )}

            <button
              type="button"
              onClick={submitReturn}
              disabled={
                loading ||
                (!hasSelectedQuantities && !pendingAttempt)
              }
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  جارٍ تسجيل المرتجع...
                </>
              ) : (
                <>
                  <RotateCcw size={18} />
                  {pendingAttempt
                    ? 'إعادة محاولة نفس المرتجع'
                    : 'تسجيل المرتجع'}
                </>
              )}
            </button>
          </section>

          {selectedReturns.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 font-extrabold">
                سجل مرتجعات هذه الفاتورة
              </h3>

              <div className="space-y-3">
                {selectedReturns.map((record) => (
                  <div
                    key={record.id}
                    className="rounded-xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-sm font-bold">
                        مرتجع #{record.id.slice(0, 8)}
                      </span>

                      <span className="text-xs text-slate-500">
                        {date(record.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p>
                        رد نقدي:{' '}
                        <b>{money(Number(record.refund_amount))}</b>
                      </p>

                      <p>
                        خصم من المتبقي:{' '}
                        <b>
                          {money(Number(record.applied_to_balance))}
                        </b>
                      </p>

                      <p>
                        طريقة الرد:{' '}
                        <b>{paymentLabel(record.refund_method)}</b>
                      </p>
                    </div>

                    {record.notes && (
                      <p className="mt-2 text-xs text-slate-500">
                        ملاحظات: {record.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
