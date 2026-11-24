
'use client'

import { useMemo, useState, useTransition } from 'react'
import { Save } from 'lucide-react'
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
    <section className="space-y-4 rounded-2xl border border-[#dbe5ec] bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h3 className="text-lg font-extrabold text-[#142B45]">
          حدود تنبيه المخزون
        </h3>
        <p className="mt-2 text-sm leading-6 text-[#64748b]">
          حدد الحد الأدنى لكل منتج في كل فرع. القيمة الافتراضية
          5 قطع، واختيار صفر يعطل تنبيه انخفاض المخزون لهذا المنتج
          في هذا الفرع.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"
        >
          {notice}
        </p>
      )}

      {!canEdit && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          يمكنك الاطلاع على حدود التنبيه، لكن تعديلها متاح للمالك
          والإدارة فقط.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">
          لا توجد منتجات ومتغيرات وفروع لعرض إعدادات التنبيه.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <article
              key={row.key}
              className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="break-words font-bold text-slate-800">
                    {row.productName}
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    SKU: {row.sku || 'غير محدد'}
                    {row.size ? ` · المقاس: ${row.size}` : ''}
                    {row.color ? ` · اللون: ${row.color}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#159B9B]">
                    {row.branchName}
                  </p>
                </div>

                <div className="text-left">
                  <p className="text-xs text-slate-500">
                    الرصيد الحالي
                  </p>
                  <p className="text-lg font-extrabold text-slate-800">
                    {row.quantity.toLocaleString('ar-EG')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      row.isOut
                        ? 'bg-red-100 text-red-700'
                        : row.isLow
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {row.isOut
                      ? 'نفد المخزون'
                      : row.isLow
                        ? 'مخزون منخفض'
                        : 'المخزون متوفر'}
                  </span>
                </div>

                <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
                  <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 sm:w-32 sm:flex-none">
                    الحد الأدنى
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
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-800 outline-none focus:border-[#159B9B] disabled:bg-slate-100"
                    />
                  </label>

                  {canEdit && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => saveThreshold(row)}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#159B9B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#117f7f] disabled:opacity-50"
                    >
                      <Save size={16} />
                      {busyKey === row.key
                        ? 'جارٍ الحفظ...'
                        : 'حفظ'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
