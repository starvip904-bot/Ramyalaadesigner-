
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPurchase,
  receivePurchase,
  recordSupplierPayment,
  getPurchaseDetailsAction,
} from '@/app/actions/purchases'

type Variant = {
  id: string
  sku: string | null
  size: string | null
  color: string | null
  cost: number | null
}

type Product = {
  id: string
  name: string
  dokkan_product_variants: Variant[]
}

type Catalog = {
  products: Product[]
  branches: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
}

type Line = {
  variant_id: string
  quantity: number
  unit_cost: number
  discount: number
}

type Purchase = {
  id: string
  status: string
  total: number
  amount_paid: number
  notes: string | null
  created_at: string
  supplier_id: string | null
  supplier?: { id: string; name: string } | null
  branch?: { id: string; name: string } | null
}

type PurchaseDetails = {
  id: string
  status: string
  total: number
  amount_paid: number
  notes: string | null
  created_at: string
  posted_at?: string | null
  supplier?: { id: string; name: string; phone?: string | null } | null
  branch?: { id: string; name: string } | null
  items?: Array<{
    id: string
    quantity: number
    received_quantity?: number
    unit_cost: number
    discount?: number
    product_variant_id?: string
    variant?: {
      id: string
      sku?: string | null
      size?: string | null
      color?: string | null
      product_name?: string | null
    }
  }>
  payments?: Array<{
    id: string
    amount: number
    payment_method: string
    notes?: string | null
    created_at: string
  }>
}

const money = (value: number) =>
  `${Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const paymentMethodLabel = (method: string) => ({
  cash: 'نقدي',
  card: 'بطاقة',
  transfer: 'تحويل بنكي',
}[method] || method)

const purchaseStatus = (status: string) => ({
  pending: 'مسودة / بانتظار الاستلام',
  paid: 'مدفوعة',
  received: 'تم الاستلام',
  partially_received: 'استلام جزئي',
  cancelled: 'ملغاة',
}[status] || status)

const statusStyle = (status: string) => {
  if (status === 'received') {
    return 'bg-green-50 text-green-700'
  }

  if (status === 'paid') {
    return 'bg-blue-50 text-blue-700'
  }

  if (status === 'cancelled') {
    return 'bg-red-50 text-red-700'
  }

  return 'bg-orange-50 text-orange-700'
}

function normalizePurchase(row: any): Purchase {
  return {
    ...row,
    amount_paid: Number(row.amount_paid ?? row.paid_amount ?? 0),
    total: Number(row.total ?? 0),
  }
}

export default function PurchasesPage({
  storeId,
  initialPurchases,
  catalog,
}: {
  storeId: string
  initialPurchases: Purchase[]
  catalog: Catalog
}) {
  const router = useRouter()

  const variants = useMemo(
    () =>
      catalog.products.flatMap((product) =>
        product.dokkan_product_variants.map((variant) => ({
          ...variant,
          productName: product.name,
        }))
      ),
    [catalog.products]
  )

  const firstVariant = variants[0]

  const [purchases, setPurchases] = useState<Purchase[]>(
    initialPurchases.map(normalizePurchase)
  )

  const [branchId, setBranchId] = useState(
    catalog.branches[0]?.id ?? ''
  )

  const [supplierId, setSupplierId] = useState('')

  const [lines, setLines] = useState<Line[]>(
    firstVariant
      ? [{
          variant_id: firstVariant.id,
          quantity: 1,
          unit_cost: Number(firstVariant.cost ?? 0),
          discount: 0,
        }]
      : []
  )

  const [paymentAmounts, setPaymentAmounts] = useState<
    Record<string, string>
  >({})

  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, string>
  >({})

  const [paymentKeys, setPaymentKeys] = useState<
    Record<string, string>
  >({})

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [details, setDetails] = useState<PurchaseDetails | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  useEffect(() => {
    setPurchases(initialPurchases.map(normalizePurchase))
  }, [initialPurchases])

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) =>
          sum +
          line.quantity * line.unit_cost -
          line.discount,
        0
      ),
    [lines]
  )

  const purchasesTotal = purchases.reduce(
    (sum, purchase) =>
      sum + Number(purchase.total || 0),
    0
  )

  const purchasesPaid = purchases.reduce(
    (sum, purchase) =>
      sum + Number(purchase.amount_paid || 0),
    0
  )

  const purchasesRemaining = purchases.reduce(
    (sum, purchase) =>
      sum +
      Math.max(
        0,
        Number(purchase.total || 0) -
        Number(purchase.amount_paid || 0)
      ),
    0
  )

  const updateLine = (
    index: number,
    patch: Partial<Line>
  ) => {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index
          ? { ...line, ...patch }
          : line
      )
    )
  }

  const addLine = () => {
    if (!firstVariant) return

    setLines((current) => [
      ...current,
      {
        variant_id: firstVariant.id,
        quantity: 1,
        unit_cost: Number(firstVariant.cost ?? 0),
        discount: 0,
      },
    ])

    setMessage('')
  }

  const removeLine = (index: number) => {
    setLines((current) =>
      current.filter((_, lineIndex) => lineIndex !== index)
    )
    setMessage('')
  }

  const changeVariant = (
    index: number,
    variantId: string
  ) => {
    const variant = variants.find(
      (item) => item.id === variantId
    )

    if (!variant) return

    updateLine(index, {
      variant_id: variant.id,
      unit_cost: Number(variant.cost ?? 0),
    })
  }

  const submit = async () => {
    if (!branchId) {
      setMessage('اختر الفرع أولاً.')
      return
    }

    if (!lines.length) {
      setMessage('أضف صنفاً واحداً على الأقل.')
      return
    }

    const invalidLine = lines.some(
      (line) =>
        !line.variant_id ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0 ||
        !Number.isFinite(line.unit_cost) ||
        line.unit_cost < 0 ||
        !Number.isFinite(line.discount) ||
        line.discount < 0 ||
        line.discount > line.quantity * line.unit_cost
    )

    if (invalidLine || !Number.isFinite(total) || total < 0) {
      setMessage('راجع الكميات والتكاليف والخصومات.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const id = await createPurchase(storeId, {
        branchId,
        supplierId: supplierId || null,
        notes: '',
        items: lines,
      })

      setPurchases((current) => [
        normalizePurchase({
          id,
          status: 'pending',
          total,
          amount_paid: 0,
          notes: null,
          created_at: new Date().toISOString(),
          supplier_id: supplierId || null,
        }),
        ...current,
      ])

      setMessage('تم إنشاء فاتورة الشراء كمسودة.')
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'تعذر حفظ الفاتورة'
      )
    } finally {
      setBusy(false)
    }
  }

  const receive = async (id: string) => {
    setBusy(true)
    setMessage('')

    try {
      await receivePurchase(storeId, id)

      setPurchases((current) =>
        current.map((purchase) =>
          purchase.id === id
            ? { ...purchase, status: 'received' }
            : purchase
        )
      )

      setMessage('تم استلام الفاتورة وتحديث المخزون.')
      router.refresh()
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'تعذر الاستلام'
      )
    } finally {
      setBusy(false)
    }
  }

  const pay = async (purchase: Purchase) => {
    const amount = Number(paymentAmounts[purchase.id])

    const remaining =
      Number(purchase.total) -
      Number(purchase.amount_paid)

    const method = paymentMethods[purchase.id] || 'cash'

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > remaining
    ) {
      setMessage('تحقق من مبلغ الدفعة والمتبقي.')
      return
    }

    setBusy(true)
    setMessage('')

    try {
      const key =
        paymentKeys[purchase.id] ?? crypto.randomUUID()

      setPaymentKeys((current) => ({
        ...current,
        [purchase.id]: key,
      }))

      const result = await recordSupplierPayment(
        storeId,
        purchase.id,
        amount,
        method,
        '',
        key
      )

      if (!result.ok) {
        setMessage(
          `${result.message} (${result.diagnosticId})`
        )
        return
      }

      setPurchases((current) =>
        current.map((item) =>
          item.id === purchase.id
            ? {
                ...item,
                amount_paid:
                  Number(item.amount_paid || 0) + amount,
              }
            : item
        )
      )

      setPaymentAmounts((current) => ({
        ...current,
        [purchase.id]: '',
      }))

      setPaymentKeys((current) => {
        const next = { ...current }
        delete next[purchase.id]
        return next
      })

      setMessage(result.message)
      router.refresh()

      if (details?.id === purchase.id) {
        await openDetails(purchase.id)
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تسجيل الدفعة'
      )
    } finally {
      setBusy(false)
    }
  }

  const openDetails = async (id: string) => {
    setDetails(null)
    setDetailsError('')
    setDetailsLoading(true)

    try {
      const result = await getPurchaseDetailsAction(id)
      setDetails(result as PurchaseDetails)
    } catch (error) {
      setDetailsError(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل تفاصيل الفاتورة'
      )
    } finally {
      setDetailsLoading(false)
    }
  }

  const getSupplierName = (id: string | null) =>
    catalog.suppliers.find(
      (supplier) => supplier.id === id
    )?.name || 'بدون مورد'

  const renderPaymentControls = (purchase: Purchase) => {
    const remaining =
      Number(purchase.total) -
      Number(purchase.amount_paid)

    if (remaining <= 0 || !purchase.supplier_id || purchase.status === 'cancelled') {
      return null
    }

    return (
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <input
          className="min-w-0 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-28"
          type="number"
          min="0.01"
          max={remaining}
          step="0.01"
          value={paymentAmounts[purchase.id] ?? ''}
          onChange={(event) =>
            setPaymentAmounts((current) => ({
              ...current,
              [purchase.id]: event.target.value,
            }))
          }
          placeholder="مبلغ الدفعة"
          aria-label="مبلغ الدفعة"
        />

        <select
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={paymentMethods[purchase.id] || 'cash'}
          onChange={(event) =>
            setPaymentMethods((current) => ({
              ...current,
              [purchase.id]: event.target.value,
            }))
          }
          aria-label="طريقة الدفع"
        >
          <option value="cash">نقدي</option>
          <option value="card">بطاقة</option>
          <option value="transfer">تحويل بنكي</option>
        </select>

        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          disabled={busy || !paymentAmounts[purchase.id]}
          onClick={() => pay(purchase)}
        >
          تسجيل الدفع
        </button>
      </div>
    )
  }

  return (
    <main
      className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 p-3 sm:gap-6 sm:p-5 lg:p-6"
      dir="rtl"
    >
      <header>
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">
          إدارة المشتريات
        </p>

        <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
          فواتير الشراء ومدفوعات الموردين
        </h1>

        <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
          إنشاء فواتير الشراء ومتابعة الاستلام والمدفوعات وتفاصيل كل فاتورة
        </p>
      </header>

      {message && (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
        >
          {message}
        </div>
      )}

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">إجمالي المشتريات</p>
          <p className="mt-2 break-words text-xl font-extrabold">
            {money(purchasesTotal)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">إجمالي المدفوع</p>
          <p className="mt-2 break-words text-xl font-extrabold text-green-700">
            {money(purchasesPaid)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">إجمالي المتبقي للموردين</p>
          <p className="mt-2 break-words text-xl font-extrabold text-orange-600">
            {money(purchasesRemaining)}
          </p>
        </article>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-slate-900">
            فاتورة شراء جديدة
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            اختر الفرع والمورد ثم أضف الأصناف والكميات والتكاليف
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold text-slate-700">
            الفرع
            <select
              className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
            >
              <option value="">اختر الفرع</option>
              {catalog.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 text-sm font-semibold text-slate-700">
            المورد
            <select
              className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
            >
              <option value="">بدون مورد</option>
              {catalog.suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800">أصناف الفاتورة</h3>
            <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
              {lines.length.toLocaleString('ar-EG')} صنف
            </span>
          </div>

          {!variants.length && (
            <div className="rounded-xl border border-dashed border-orange-300 bg-orange-50 p-5 text-center">
              <p className="font-bold text-orange-800">
                لا توجد أصناف متاحة للشراء
              </p>
              <p className="mt-2 text-sm text-orange-700">
                أضف منتجًا ومتغيرًا من قسم المنتجات أولاً.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {lines.map((line, index) => {
              const selectedVariant = variants.find(
                (variant) => variant.id === line.variant_id
              )

              const lineTotal =
                line.quantity * line.unit_cost - line.discount

              return (
                <article
                  key={`${index}-${line.variant_id}`}
                  className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-extrabold text-slate-800">
                      الصنف رقم {index + 1}
                    </p>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeLine(index)}
                      className="rounded-lg px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      حذف الصنف
                    </button>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="min-w-0 text-xs font-semibold text-slate-600 sm:col-span-2">
                      المنتج والمتغير
                      <select
                        className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500"
                        value={line.variant_id}
                        onChange={(event) =>
                          changeVariant(index, event.target.value)
                        }
                      >
                        {variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.productName}
                            {' · '}
                            {variant.size ?? '-'}
                            {' · '}
                            {variant.color ?? '-'}
                            {variant.sku ? ` · ${variant.sku}` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="min-w-0 text-xs font-semibold text-slate-600">
                      الكمية
                      <input
                        className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(index, {
                            quantity: Number(event.target.value),
                          })
                        }
                      />
                    </label>

                    <label className="min-w-0 text-xs font-semibold text-slate-600">
                      تكلفة الوحدة
                      <input
                        className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_cost}
                        onChange={(event) =>
                          updateLine(index, {
                            unit_cost: Number(event.target.value),
                          })
                        }
                      />
                    </label>

                    <label className="min-w-0 text-xs font-semibold text-slate-600">
                      الخصم
                      <input
                        className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(index, {
                            discount: Number(event.target.value),
                          })
                        }
                      />
                    </label>

                    <div className="flex min-w-0 flex-col justify-center rounded-xl bg-white p-3">
                      <span className="text-xs text-slate-500">
                        إجمالي الصنف
                      </span>
                      <strong className={`mt-1 break-words text-base ${lineTotal < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {money(lineTotal)}
                      </strong>
                      {selectedVariant && (
                        <span className="mt-1 break-all text-xs text-slate-400">
                          {selectedVariant.sku || 'بدون باركود / SKU'}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex min-w-0 flex-col gap-4 border-t border-slate-200 pt-5">
          <button
            type="button"
            disabled={!firstVariant || busy}
            onClick={addLine}
            className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 sm:w-fit"
          >
            + إضافة صنف آخر
          </button>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
            <span className="font-bold text-slate-700">
              إجمالي فاتورة الشراء
            </span>
            <strong className="break-words text-xl font-extrabold text-slate-900">
              {money(total)}
            </strong>
          </div>

          <button
            type="button"
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              busy ||
              !branchId ||
              !lines.length ||
              !variants.length
            }
            onClick={submit}
          >
            {busy ? 'جارٍ الحفظ...' : 'حفظ مسودة فاتورة الشراء'}
          </button>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              سجل فواتير الشراء
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              متابعة الاستلام والمدفوعات والمتبقي وتفاصيل كل فاتورة
            </p>
          </div>

          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
            {purchases.length.toLocaleString('ar-EG')} فاتورة
          </span>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1000px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-4">التاريخ</th>
                <th className="p-4">المورد</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">المدفوع</th>
                <th className="p-4">المتبقي</th>
                <th className="p-4">الإجراءات</th>
              </tr>
            </thead>

            <tbody>
              {purchases.map((purchase) => {
                const remaining =
                  Number(purchase.total) -
                  Number(purchase.amount_paid)

                const canReceive =
                  purchase.status === 'pending' ||
                  purchase.status === 'paid' ||
                  purchase.status === 'partially_received'

                return (
                  <tr
                    key={purchase.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 text-xs text-slate-600">
                      {new Date(purchase.created_at).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="p-4 font-semibold">
                      {purchase.supplier?.name || getSupplierName(purchase.supplier_id)}
                    </td>

                    <td className="p-4">
                      <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(purchase.status)}`}>
                        {purchaseStatus(purchase.status)}
                      </span>
                    </td>

                    <td className="p-4 font-bold">
                      {money(purchase.total)}
                    </td>

                    <td className="p-4 font-semibold text-green-700">
                      {money(purchase.amount_paid)}
                    </td>

                    <td className="p-4 font-semibold text-orange-600">
                      {money(remaining)}
                    </td>

                    <td className="p-4">
                      <div className="flex min-w-[270px] flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={detailsLoading}
                          onClick={() => openDetails(purchase.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          التفاصيل
                        </button>

                        {canReceive && (
                          <button
                            type="button"
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 disabled:opacity-50"
                            disabled={busy}
                            onClick={() => receive(purchase.id)}
                          >
                            استلام
                          </button>
                        )}

                        {renderPaymentControls(purchase)}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!purchases.length && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    لا توجد فواتير شراء حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 lg:hidden">
          {purchases.map((purchase) => {
            const remaining =
              Number(purchase.total) -
              Number(purchase.amount_paid)

            const canReceive =
              purchase.status === 'pending' ||
              purchase.status === 'paid' ||
              purchase.status === 'partially_received'

            return (
              <article
                key={purchase.id}
                className="min-w-0 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">
                      {purchase.supplier?.name || getSupplierName(purchase.supplier_id)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(purchase.created_at).toLocaleDateString('ar-EG')}
                    </p>
                  </div>

                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(purchase.status)}`}>
                    {purchaseStatus(purchase.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-slate-500">الإجمالي</p>
                    <p className="mt-1 break-words text-sm font-extrabold">
                      {money(purchase.total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">المدفوع</p>
                    <p className="mt-1 break-words text-sm font-bold text-green-700">
                      {money(purchase.amount_paid)}
                    </p>
                  </div>

                  <div className="col-span-2 border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">المتبقي للمورد</p>
                    <p className="mt-1 break-words text-sm font-extrabold text-orange-600">
                      {money(remaining)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => openDetails(purchase.id)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
                  >
                    عرض تفاصيل الفاتورة والدفعات
                  </button>

                  {canReceive && (
                    <button
                      type="button"
                      className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700 disabled:opacity-50"
                      disabled={busy}
                      onClick={() => receive(purchase.id)}
                    >
                      استلام الفاتورة وتحديث المخزون
                    </button>
                  )}

                  {renderPaymentControls(purchase)}
                </div>
              </article>
            )
          })}

          {!purchases.length && (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="font-bold text-slate-700">
                لا توجد فواتير شراء حتى الآن
              </p>
              <p className="mt-2 text-xs text-slate-500">
                ستظهر الفواتير هنا بعد إنشائها.
              </p>
            </div>
          )}
        </div>
      </section>

      {(detailsLoading || detailsError || details) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !detailsLoading) {
              setDetails(null)
              setDetailsError('')
            }
          }}
        >
          <section className="my-auto max-h-[94dvh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  تفاصيل فاتورة الشراء
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  الأصناف والاستلام والمدفوعات المسجلة
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDetails(null)
                  setDetailsError('')
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600"
              >
                إغلاق
              </button>
            </div>

            {detailsLoading && (
              <p className="py-10 text-center text-sm text-slate-500">
                جارٍ تحميل تفاصيل الفاتورة...
              </p>
            )}

            {detailsError && (
              <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">
                {detailsError}
              </p>
            )}

            {details && (
              <>
                <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">المورد</p>
                    <p className="mt-1 font-bold">
                      {details.supplier?.name || 'بدون مورد'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">الفرع</p>
                    <p className="mt-1 font-bold">
                      {details.branch?.name || '—'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">تاريخ الفاتورة</p>
                    <p className="mt-1 font-bold">
                      {new Date(details.created_at).toLocaleString('ar-EG')}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">الحالة</p>
                    <p className="mt-1 font-bold">
                      {purchaseStatus(details.status)}
                    </p>
                  </div>
                </div>

                <section>
                  <h3 className="mb-3 font-extrabold text-slate-800">
                    أصناف الفاتورة
                  </h3>

                  <div className="space-y-2">
                    {(details.items || []).map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-slate-200 p-3"
                      >
                        <p className="font-bold text-slate-800">
                          {item.variant?.product_name || 'منتج'}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          المقاس: {item.variant?.size || '—'}
                          {' · '}
                          اللون: {item.variant?.color || '—'}
                          {' · '}
                          SKU: {item.variant?.sku || '—'}
                        </p>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <p>
                            الكمية: <strong>{Number(item.quantity || 0).toLocaleString('ar-EG')}</strong>
                          </p>
                          <p>
                            المستلم: <strong>{Number(item.received_quantity || 0).toLocaleString('ar-EG')}</strong>
                          </p>
                          <p>
                            تكلفة الوحدة: <strong>{money(Number(item.unit_cost || 0))}</strong>
                          </p>
                          <p>
                            الخصم: <strong>{money(Number(item.discount || 0))}</strong>
                          </p>
                        </div>
                      </article>
                    ))}

                    {!details.items?.length && (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        لا توجد أصناف مسجلة في هذه الفاتورة.
                      </p>
                    )}
                  </div>
                </section>

                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="font-extrabold text-slate-800">
                      سجل الدفعات
                    </h3>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {(details.payments || []).length} دفعة
                    </span>
                  </div>

                  <div className="space-y-2">
                    {(details.payments || []).map((payment) => (
                      <article
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                      >
                        <div>
                          <p className="font-bold text-green-700">
                            {money(Number(payment.amount || 0))}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {new Date(payment.created_at).toLocaleString('ar-EG')}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            طريقة الدفع: {paymentMethodLabel(payment.payment_method)}
                          </p>
                          {payment.notes && (
                            <p className="mt-1 text-xs text-slate-500">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}

                    {!details.payments?.length && (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        لا توجد دفعات مسجلة على هذه الفاتورة حتى الآن.
                      </p>
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">الإجمالي</p>
                    <p className="mt-1 font-extrabold">
                      {money(Number(details.total || 0))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">المدفوع</p>
                    <p className="mt-1 font-extrabold text-green-700">
                      {money(Number(details.amount_paid || 0))}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">المتبقي</p>
                    <p className="mt-1 font-extrabold text-orange-600">
                      {money(
                        Number(details.total || 0) -
                        Number(details.amount_paid || 0)
                      )}
                    </p>
                  </div>
                </div>

                {details.notes && (
                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    ملاحظات الفاتورة: {details.notes}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
