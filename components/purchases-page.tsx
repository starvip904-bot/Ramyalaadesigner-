
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPurchase,
  receivePurchase,
  recordSupplierPayment,
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
  paid_amount: number
  notes: string | null
  created_at: string
  supplier_id: string | null
}

const money = (value: number) =>
  `${Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const purchaseStatus = (status: string) => ({
  pending: 'مسودة / بانتظار الاستلام',
  paid: 'مدفوعة',
  received: 'تم الاستلام',
}[status] || status)

const statusStyle = (status: string) => {
  if (status === 'received') {
    return 'bg-green-50 text-green-700'
  }

  if (status === 'paid') {
    return 'bg-blue-50 text-blue-700'
  }

  return 'bg-orange-50 text-orange-700'
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

  const [purchases, setPurchases] = useState(initialPurchases)

  const [branchId, setBranchId] = useState(
    catalog.branches[0]?.id ?? ''
  )

  const [supplierId, setSupplierId] = useState('')

  const [lines, setLines] = useState<Line[]>(
    firstVariant
      ? [
          {
            variant_id: firstVariant.id,
            quantity: 1,
            unit_cost: Number(firstVariant.cost ?? 0),
            discount: 0,
          },
        ]
      : []
  )

  const [paymentAmounts, setPaymentAmounts] = useState<
    Record<string, string>
  >({})

  const [paymentKeys, setPaymentKeys] = useState<
    Record<string, string>
  >({})

  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setPurchases(initialPurchases)
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
    (sum, purchase) => sum + Number(purchase.total || 0),
    0
  )

  const purchasesPaid = purchases.reduce(
    (sum, purchase) => sum + Number(purchase.paid_amount || 0),
    0
  )

  const purchasesRemaining = purchases.reduce(
    (sum, purchase) =>
      sum +
      Math.max(
        0,
        Number(purchase.total || 0) -
        Number(purchase.paid_amount || 0)
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

    if (lines.length === 0) {
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
        {
          id,
          status: 'pending',
          total,
          paid_amount: 0,
          notes: null,
          created_at: new Date().toISOString(),
          supplier_id: supplierId || null,
        },
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
      Number(purchase.paid_amount)

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
        'cash',
        '',
        key
      )

      if (!result.ok) {
        setMessage(
          `${result.message} (${result.diagnosticId})`
        )
        return
      }

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

  const getSupplierName = (supplierId: string | null) =>
    catalog.suppliers.find(
      (supplier) => supplier.id === supplierId
    )?.name || 'بدون مورد'

  return (
    <main
      className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 p-3 sm:gap-6 sm:p-5 lg:p-6"
      dir="rtl"
    >
      {/* العنوان */}
      <header>
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">
          إدارة المشتريات
        </p>

        <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
          فواتير الشراء ومدفوعات الموردين
        </h1>

        <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
          إنشاء فواتير الشراء ومتابعة الاستلام والمدفوعات
        </p>
      </header>

      {/* رسائل النظام */}
      {message && (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
        >
          {message}
        </div>
      )}

      {/* ملخص المشتريات */}
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">
            إجمالي المشتريات
          </p>

          <p className="mt-2 break-words text-xl font-extrabold">
            {money(purchasesTotal)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">
            إجمالي المدفوع
          </p>

          <p className="mt-2 break-words text-xl font-extrabold text-green-700">
            {money(purchasesPaid)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">
            إجمالي المتبقي للموردين
          </p>

          <p className="mt-2 break-words text-xl font-extrabold text-orange-600">
            {money(purchasesRemaining)}
          </p>
        </article>
      </section>

      {/* إنشاء فاتورة شراء */}
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

        {/* الأصناف */}
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-bold text-slate-800">
              أصناف الفاتورة
            </h3>

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
                          <option
                            key={variant.id}
                            value={variant.id}
                          >
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

        {/* إجمالي وحفظ */}
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
              lines.length === 0 ||
              !variants.length
            }
            onClick={submit}
          >
            {busy ? 'جارٍ الحفظ...' : 'حفظ مسودة فاتورة الشراء'}
          </button>
        </div>
      </section>

      {/* سجل الفواتير */}
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              سجل فواتير الشراء
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              متابعة الاستلام والمدفوعات والمتبقي
            </p>
          </div>

          <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">
            {purchases.length.toLocaleString('ar-EG')} فاتورة
          </span>
        </div>

        {/* عرض الكمبيوتر */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[850px] text-right text-sm">
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
                  Number(purchase.paid_amount)

                const canReceive =
                  purchase.status === 'pending' ||
                  purchase.status === 'paid'

                return (
                  <tr
                    key={purchase.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="p-4 text-xs text-slate-600">
                      {new Date(
                        purchase.created_at
                      ).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="p-4 font-semibold">
                      {getSupplierName(purchase.supplier_id)}
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
                      {money(purchase.paid_amount)}
                    </td>

                    <td className="p-4 font-semibold text-orange-600">
                      {money(remaining)}
                    </td>

                    <td className="p-4">
                      <div className="flex min-w-[230px] flex-wrap items-center gap-2">
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

                        {remaining > 0 && (
                          <>
                            <input
                              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
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

                            <button
                              type="button"
                              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                              disabled={
                                busy ||
                                !paymentAmounts[purchase.id]
                              }
                              onClick={() => pay(purchase)}
                            >
                              تسجيل الدفع
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!purchases.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-12 text-center text-slate-500"
                  >
                    لا توجد فواتير شراء حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* عرض الموبايل والتابلت */}
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:hidden">
          {purchases.map((purchase) => {
            const remaining =
              Number(purchase.total) -
              Number(purchase.paid_amount)

            const canReceive =
              purchase.status === 'pending' ||
              purchase.status === 'paid'

            return (
              <article
                key={purchase.id}
                className="min-w-0 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-slate-900">
                      {getSupplierName(purchase.supplier_id)}
                    </p>

                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(
                        purchase.created_at
                      ).toLocaleDateString('ar-EG')}
                    </p>
                  </div>

                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(purchase.status)}`}>
                    {purchaseStatus(purchase.status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      الإجمالي
                    </p>

                    <p className="mt-1 break-words text-sm font-extrabold">
                      {money(purchase.total)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">
                      المدفوع
                    </p>

                    <p className="mt-1 break-words text-sm font-bold text-green-700">
                      {money(purchase.paid_amount)}
                    </p>
                  </div>

                  <div className="col-span-2 border-t border-slate-200 pt-3">
                    <p className="text-xs text-slate-500">
                      المتبقي للمورد
                    </p>

                    <p className="mt-1 break-words text-sm font-extrabold text-orange-600">
                      {money(remaining)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3">
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

                  {remaining > 0 && (
                    <div className="flex min-w-0 gap-2">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3 text-base"
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

                      <button
                        type="button"
                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        disabled={
                          busy ||
                          !paymentAmounts[purchase.id]
                        }
                        onClick={() => pay(purchase)}
                      >
                        دفع
                      </button>
                    </div>
                  )}
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
    </main>
  )
}
