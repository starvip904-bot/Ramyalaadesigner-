
'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  Search,
  Save,
  XCircle,
} from 'lucide-react'
import { saveInventoryAlertThresholdAction } from '@/app/actions/inventory-thresholds'

type Product = {
  id: string
  name: string
  dokkan_product_variants: {
    id: string
    sku: string
    size: string | null
    color: string | null
  }[]
}

type Branch = {
  id: string
  name: string
  store_id: string
}

type Movement = {
  branch_id: string
  product_variant_id: string
  movement_type: string
  quantity: number
}

type Threshold = {
  branch_id: string
  product_variant_id: string
  minimum_quantity: number
}

type Props = {
  storeId: string
  role: string | null
  products: Product[]
  branches: Branch[]
  movements: Movement[]
  thresholds: Threshold[]
}

function getStock(
  movements: Movement[],
  branchId: string,
  variantId: string
) {
  return movements
    .filter(
      (movement) =>
        movement.branch_id === branchId &&
        movement.product_variant_id === variantId
    )
    .reduce((total, movement) => {
      const positiveTypes = [
        'opening',
        'purchase',
        'return',
        'adjustment',
        'transfer_in',
      ]

      return positiveTypes.includes(movement.movement_type)
        ? total + Number(movement.quantity)
        : total - Number(movement.quantity)
    }, 0)
}

export default function InventoryThresholdsPanel({
  storeId,
  role,
  products,
  branches,
  movements,
  thresholds,
}: Props) {
  const canEdit = role === 'owner' || role === 'admin'

  const [values, setValues] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()

  const savedValues = useMemo(() => {
    const result: Record<string, number> = {}

    for (const item of thresholds) {
      result[`${item.branch_id}:${item.product_variant_id}`] =
        Number(item.minimum_quantity)
    }

    return result
  }, [thresholds])

  const rows = useMemo(() => {
    return products.flatMap((product) =>
      product.dokkan_product_variants.flatMap((variant) =>
        branches
          .filter((branch) => branch.store_id === storeId)
          .map((branch) => {
            const key = `${branch.id}:${variant.id}`

            const quantity = getStock(
              movements,
              branch.id,
              variant.id
            )

            const minimum = savedValues[key] ?? 5

            return {
              key,
              productName: product.name,
              sku: variant.sku,
              size: variant.size,
              color: variant.color,
              branchName: branch.name,
              branchId: branch.id,
              variantId: variant.id,
              quantity,
              minimum,
              isOut: quantity <= 0,
              isLow: minimum > 0 && quantity > 0 && quantity < minimum,
            }
          })
      )
    )
  }, [products, branches, movements, savedValues, storeId])

  const summary = useMemo(() => {
    return {
      total: rows.length,
      out: rows.filter((row) => row.isOut).length,
      low: rows.filter((row) => row.isLow).length,
      available: rows.filter((row) => !row.isOut && !row.isLow).length,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return rows

    return rows.filter((row) =>
      [
        row.productName,
        row.sku,
        row.branchName,
        row.size,
        row.color,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [rows, search])

  function saveThreshold(row: (typeof rows)[number]) {
    const rawValue = values[row.key] ?? String(row.minimum)
    const minimumQuantity = Number(rawValue)

    setError('')
    setNotice('')

    if (
      rawValue.trim() === '' ||
      !Number.isInteger(minimumQuantity) ||
      minimumQuantity < 0
    ) {
      setError('أدخل رقمًا صحيحًا يساوي صفرًا أو أكبر.')
      return
    }

    setBusyKey(row.key)

    startTransition(async () => {
      try {
        await saveInventoryAlertThresholdAction({
          storeId,
          branchId: row.branchId,
          variantId: row.variantId,
          minimumQuantity,
        })

        setNotice('تم حفظ حد التنبيه بنجاح.')
        window.location.reload()
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'تعذر حفظ حد التنبيه.'
        )
      } finally {
        setBusyKey('')
      }
    })
  }

  return (
    <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            <AlertTriangle size={23} />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white sm:text-xl">
              حدود تنبيه المخزون
            </h3>

            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              تابع أرصدة المنتجات واضبط الحد الأدنى للتنبيه في كل فرع.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          إجمالي السجلات: {summary.total.toLocaleString('ar-EG')}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Package size={17} />
            <span className="text-xs font-semibold">إجمالي المنتجات والفروع</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">
            {summary.total.toLocaleString('ar-EG')}
          </p>
        </div>

        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-3 dark:border-red-900/50 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <XCircle size={17} />
            <span className="text-xs font-semibold">نفد المخزون</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-red-700 dark:text-red-300">
            {summary.out.toLocaleString('ar-EG')}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <AlertTriangle size={17} />
            <span className="text-xs font-semibold">مخزون منخفض</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-700 dark:text-amber-300">
            {summary.low.toLocaleString('ar-EG')}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={17} />
            <span className="text-xs font-semibold">المخزون متوفر</span>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
            {summary.available.toLocaleString('ar-EG')}
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 dark:border-teal-900/50 dark:bg-teal-950/20">
        <p className="text-sm leading-7 text-teal-900 dark:text-teal-200">
          <span className="font-extrabold">طريقة الاستخدام:</span>{' '}
          حدد الحد الأدنى لكل منتج في كل فرع. القيمة الافتراضية 5 قطع،
          واختيار صفر يعطل تنبيه انخفاض المخزون لهذا المنتج في هذا الفرع.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {!canEdit && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          يمكنك الاطلاع على حدود التنبيه، لكن تعديلها متاح للمالك والإدارة فقط.
        </p>
      )}

      {/* Search */}
      <div className="relative">
        <Search
          size={19}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث باسم المنتج أو الباركود أو الفرع..."
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-800/50">
          <Package size={32} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            لا توجد منتجات ومتغيرات وفروع لعرض إعدادات التنبيه.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center dark:border-slate-700">
          <Search size={27} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            لا توجد نتائج مطابقة لبحثك.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <article
              key={row.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-teal-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-teal-800"
            >
              <div className="flex flex-col gap-4">
                {/* Product information */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words text-base font-extrabold text-slate-900 dark:text-white">
                      {row.productName}
                    </h4>

                    <p className="mt-2 break-words text-xs leading-6 text-slate-500 dark:text-slate-400">
                      SKU: {row.sku || 'غير محدد'}
                      {row.size ? ` · المقاس: ${row.size}` : ''}
                      {row.color ? ` · اللون: ${row.color}` : ''}
                    </p>

                    <p className="mt-1 text-sm font-bold text-teal-700 dark:text-teal-300">
                      {row.branchName}
                    </p>
                  </div>

                  <div className="min-w-[100px] rounded-xl bg-slate-50 px-3 py-2 text-center dark:bg-slate-900">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      الرصيد الحالي
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">
                      {row.quantity.toLocaleString('ar-EG')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
                  {/* Status */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        row.isOut
                          ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                          : row.isLow
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {row.isOut ? (
                        <XCircle size={14} />
                      ) : row.isLow ? (
                        <AlertTriangle size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}

                      {row.isOut
                        ? 'نفد المخزون'
                        : row.isLow
                          ? 'مخزون منخفض'
                          : 'المخزون متوفر'}
                    </span>

                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      الحد الحالي: {row.minimum.toLocaleString('ar-EG')} قطعة
                    </p>
                  </div>

                  {/* Threshold editor */}
                  <div className="flex w-full items-end gap-2 sm:w-auto">
                    <label className="min-w-0 flex-1 text-xs font-bold text-slate-600 dark:text-slate-300 sm:w-32 sm:flex-none">
                      الحد الأدنى للتنبيه

                      <input
                        type="number"
                        min="0"
                        step="1"
                        disabled={!canEdit || isPending}
                        value={values[row.key] ?? String(row.minimum)}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [row.key]: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:disabled:bg-slate-800"
                      />
                    </label>

                    {canEdit && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => saveThreshold(row)}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Save size={16} />

                        {busyKey === row.key
                          ? 'جارٍ الحفظ...'
                          : 'حفظ'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-slate-400 dark:text-slate-500">
        عرض {filteredRows.length.toLocaleString('ar-EG')} من{' '}
        {rows.length.toLocaleString('ar-EG')} سجل
      </div>
    </section>
  )
}
