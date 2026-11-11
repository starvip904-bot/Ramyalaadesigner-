
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

  const firstVariant = catalog.products[0]?.dokkan_product_variants[0]

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
      Number(purchase.total) - Number(purchase.paid_amount)

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

  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6"
      dir="rtl"
    >
      <header>
        <p className="text-sm text-muted-foreground">
          المشتريات
        </p>

        <h1 className="text-3xl font-semibold">
          فواتير الشراء ومدفوعات الموردين
        </h1>
      </header>

      {message && (
        <p className="rounded-md border p-3 text-sm">
          {message}
        </p>
      )}

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-xl font-semibold">
          فاتورة شراء جديدة
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="rounded-md border bg-background p-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">اختر الفرع</option>

            {catalog.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border bg-background p-2"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">بدون مورد</option>

            {catalog.suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {lines.map((line, index) => (
            <div
              className="grid gap-3 rounded-lg border p-3 md:grid-cols-5"
              key={`${index}-${line.variant_id}`}
            >
              <select
                className="rounded-md border bg-background p-2 md:col-span-2"
                value={line.variant_id}
                onChange={(e) =>
                  updateLine(index, {
                    variant_id: e.target.value,
                  })
                }
              >
                {catalog.products
                  .flatMap((product) =>
                    product.dokkan_product_variants.map(
                      (variant) => ({
                        ...variant,
                        productName: product.name,
                      })
                    )
                  )
                  .map((variant) => (
                    <option
                      key={variant.id}
                      value={variant.id}
                    >
                      {variant.productName} ·{' '}
                      {variant.size ?? '-'} ·{' '}
                      {variant.color ?? '-'}
                    </option>
                  ))}
              </select>

              <input
                className="rounded-md border bg-background p-2"
                type="number"
                min="0.01"
                step="0.01"
                value={line.quantity}
                onChange={(e) =>
                  updateLine(index, {
                    quantity: Number(e.target.value),
                  })
                }
                placeholder="الكمية"
              />

              <input
                className="rounded-md border bg-background p-2"
                type="number"
                min="0"
                step="0.01"
                value={line.unit_cost}
                onChange={(e) =>
                  updateLine(index, {
                    unit_cost: Number(e.target.value),
                  })
                }
                placeholder="تكلفة الوحدة"
              />

              <input
                className="rounded-md border bg-background p-2"
                type="number"
                min="0"
                step="0.01"
                value={line.discount}
                onChange={(e) =>
                  updateLine(index, {
                    discount: Number(e.target.value),
                  })
                }
                placeholder="الخصم"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="rounded-md border px-4 py-2"
            disabled={!firstVariant}
            onClick={() =>
              firstVariant &&
              setLines((current) => [
                ...current,
                {
                  variant_id: firstVariant.id,
                  quantity: 1,
                  unit_cost: Number(firstVariant.cost ?? 0),
                  discount: 0,
                },
              ])
            }
          >
            إضافة صنف
          </button>

          <span className="font-semibold">
            الإجمالي: {total.toFixed(2)} EGP
          </span>

          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            disabled={busy || !branchId || lines.length === 0}
            onClick={submit}
          >
            حفظ المسودة
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="mb-4 text-xl font-semibold">
          سجل الفواتير
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">التاريخ</th>
                <th className="p-2">الحالة</th>
                <th className="p-2">الإجمالي</th>
                <th className="p-2">المدفوع</th>
                <th className="p-2">المتبقي</th>
                <th className="p-2">إجراءات</th>
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
                    className="border-b"
                  >
                    <td className="p-2">
                      {new Date(
                        purchase.created_at
                      ).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="p-2">
                      {purchase.status}
                    </td>

                    <td className="p-2">
                      {Number(purchase.total).toFixed(2)} EGP
                    </td>

                    <td className="p-2">
                      {Number(
                        purchase.paid_amount
                      ).toFixed(2)}{' '}
                      EGP
                    </td>

                    <td className="p-2">
                      {remaining.toFixed(2)} EGP
                    </td>

                    <td className="flex flex-wrap gap-2 p-2">
                      {canReceive && (
                        <button
                          className="rounded-md border px-3 py-1"
                          disabled={busy}
                          onClick={() => receive(purchase.id)}
                        >
                          استلام
                        </button>
                      )}

                      {remaining > 0 && (
                        <>
                          <input
                            className="w-24 rounded-md border bg-background px-2 py-1"
                            type="number"
                            min="0.01"
                            max={remaining}
                            step="0.01"
                            value={
                              paymentAmounts[purchase.id] ?? ''
                            }
                            onChange={(e) =>
                              setPaymentAmounts((current) => ({
                                ...current,
                                [purchase.id]: e.target.value,
                              }))
                            }
                            placeholder="دفعة"
                          />

                          <button
                            className="rounded-md border px-3 py-1"
                            disabled={
                              busy ||
                              !paymentAmounts[purchase.id]
                            }
                            onClick={() => pay(purchase)}
                          >
                            دفع
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
