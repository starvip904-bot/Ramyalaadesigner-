
'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  addInventoryCountItemAction,
  approveInventoryCountAction,
  createInventoryCountAction,
  recordInventoryCountItemAction,
  startInventoryCountAction,
  submitInventoryCountForReviewAction,
} from '@/app/actions/inventory-counts'

import { getInventoryCountDetailsAction } from '@/app/actions/inventory-counts-read'

import type {
  InventoryCountBranch,
  InventoryCountDetails,
  InventoryCountItem,
  InventoryCountProduct,
  InventoryCountSummary,
} from '@/lib/inventory-counts-repository'

type Props = {
  storeId: string
  counts: InventoryCountSummary[]
  branches: InventoryCountBranch[]
  products: InventoryCountProduct[]
  canApprove: boolean
}

type VariantOption = {
  id: string
  productName: string
  sku: string
  barcode: string | null
  size: string | null
  color: string | null
  category: string | null
  productStatus: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  counting: 'جاري العد',
  review: 'بانتظار المراجعة',
  approved: 'معتمد',
  cancelled: 'ملغي',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  counting: 'bg-blue-100 text-blue-700',
  review: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return '—'

  return new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 3,
  }).format(Number(value))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  return new Date(value).toLocaleString('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getVariantLabel(variant: VariantOption) {
  const details = [
    variant.size ? `المقاس ${variant.size}` : null,
    variant.color ? `اللون ${variant.color}` : null,
    variant.sku ? `SKU: ${variant.sku}` : null,
  ].filter(Boolean)

  return `${variant.productName} ${
    details.length ? `— ${details.join(' — ')}` : ''
  }`
}

export default function InventoryCountsPage({
  storeId,
  counts,
  branches,
  products,
  canApprove,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedId, setSelectedId] = useState('')
  const [details, setDetails] = useState<InventoryCountDetails | null>(null)

  const [branchId, setBranchId] = useState('')
  const [countType, setCountType] = useState<'full' | 'partial'>('full')
  const [countNumber, setCountNumber] = useState('')
  const [notes, setNotes] = useState('')

  const [variantId, setVariantId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})

  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)

  const selectedSummary = useMemo(
    () => counts.find((item) => item.count_id === selectedId) || null,
    [counts, selectedId]
  )

  const variants = useMemo<VariantOption[]>(() => {
    return products.flatMap((product) =>
      (product.dokkan_product_variants || []).map((variant) => ({
        id: variant.id,
        productName: product.name,
        sku: variant.sku || '',
        barcode: variant.barcode,
        size: variant.size,
        color: variant.color,
        category: product.category,
        productStatus: product.status,
      }))
    )
  }, [products])

  const availableVariants = useMemo(() => {
    const existing = new Set(
      (details?.items || []).map((item) => item.product_variant_id)
    )

    return variants.filter((variant) => !existing.has(variant.id))
  }, [variants, details])

  const countedItems = details?.items.filter(
    (item) => item.actual_quantity !== null
  ).length || 0

  const totalItems = details?.items.length || 0

  const totalDifference = details?.items.reduce(
    (sum, item) => sum + Number(item.difference || 0),
    0
  ) || 0

  async function loadDetails(id: string) {
    if (!id) {
      setDetails(null)
      return
    }

    try {
      const result = await getInventoryCountDetailsAction(id)
      setDetails(result)

      const nextQuantities: Record<string, string> = {}

      for (const item of result.items || []) {
        nextQuantities[item.product_variant_id] =
          item.actual_quantity === null
            ? ''
            : String(item.actual_quantity)
      }

      setQuantities(nextQuantities)
    } catch (error) {
      setDetails(null)
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'تعذر تحميل تفاصيل الجرد.'
      )
    }
  }

  useEffect(() => {
    if (selectedId) {
      loadDetails(selectedId)
    } else {
      setDetails(null)
    }
    // تحميل التفاصيل عند تغيير الجرد المختار فقط.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  function clearMessages() {
    setMessage('')
    setErrorMessage('')
  }

  function runAction(action: () => Promise<void>) {
    clearMessages()

    startTransition(async () => {
      try {
        await action()

        if (selectedId) {
          await loadDetails(selectedId)
        }

        router.refresh()
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء تنفيذ العملية.'
        )
      }
    })
  }

  function generateCountNumber() {
    const now = new Date()
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('')

    return `JRD-${stamp}`
  }

  function openCreateForm(originalCountId?: string) {
    clearMessages()
    setCountNumber(generateCountNumber())
    setNotes('')

    if (originalCountId) {
      const original = counts.find(
        (item) => item.count_id === originalCountId
      )

      if (original) {
        setBranchId(original.branch_id)
        setCountType('partial')
        setNotes(`جرد تصحيحي للجرد رقم ${original.count_number}`)
      }
    } else {
      setBranchId(
        branches.find((branch) => branch.status === 'active')?.id || ''
      )
      setCountType('full')
    }

    setShowCreateForm(true)
  }

  function createCount() {
    if (!branchId || !countNumber.trim()) {
      setErrorMessage('اختر الفرع وأدخل رقم الجرد.')
      return
    }

    const originalCountId =
      details?.count.status === 'approved' &&
      showCreateForm &&
      notes.startsWith('جرد تصحيحي')
        ? details.count.id
        : undefined

    runAction(async () => {
      const newId = await createInventoryCountAction({
        branchId,
        countNumber,
        countType,
        notes,
        originalCountId,
      })

      setShowCreateForm(false)
      setSelectedId(newId)
      setMessage('تم إنشاء الجرد بنجاح.')
    })
  }

  function addItem() {
    if (!selectedId || !details || !variantId) {
      setErrorMessage('اختر متغير المنتج أولًا.')
      return
    }

    runAction(async () => {
      await addInventoryCountItemAction({
        countId: selectedId,
        branchId: details.count.branch_id,
        variantId,
      })

      setVariantId('')
      setShowAddItem(false)
      setMessage('تمت إضافة الصنف إلى الجرد.')
    })
  }

  function startCount() {
    if (!selectedId || !details) return

    if (
      details.count.count_type === 'partial' &&
      details.items.length === 0
    ) {
      setErrorMessage('أضف صنفًا واحدًا على الأقل قبل بدء الجرد.')
      return
    }

    runAction(async () => {
      await startInventoryCountAction({
        countId: selectedId,
        branchId: details.count.branch_id,
      })

      setMessage('بدأ الجرد. يمكنك الآن تسجيل الكميات الفعلية.')
    })
  }

  function saveQuantity(item: InventoryCountItem) {
    if (!selectedId || !details) return

    const raw = quantities[item.product_variant_id]

    if (raw === '' || raw === undefined) {
      setErrorMessage('أدخل الكمية الفعلية أولًا.')
      return
    }

    const quantity = Number(raw)

    if (
      !Number.isFinite(quantity) ||
      quantity < 0 ||
      !/^\d+(\.\d{1,3})?$/.test(raw.trim())
    ) {
      setErrorMessage('أدخل كمية صحيحة، بحد أقصى 3 خانات عشرية.')
      return
    }

    runAction(async () => {
      await recordInventoryCountItemAction({
        countId: selectedId,
        branchId: details.count.branch_id,
        variantId: item.product_variant_id,
        actualQuantity: quantity,
      })

      setMessage('تم حفظ الكمية الفعلية.')
    })
  }

  function submitForReview() {
    if (!selectedId || !details) return

    if (countedItems !== totalItems || totalItems === 0) {
      setErrorMessage('يجب تسجيل الكمية الفعلية لكل الأصناف أولًا.')
      return
    }

    runAction(async () => {
      await submitInventoryCountForReviewAction({
        countId: selectedId,
        branchId: details.count.branch_id,
      })

      setMessage('تم إرسال الجرد للمراجعة.')
    })
  }

  function approveCount() {
    if (!selectedId || !details) return

    if (
      !window.confirm(
        'هل أنت متأكد من اعتماد الجرد؟ سيتم تسجيل فروق الجرد في حركة المخزون، ولا يمكن تعديل الجرد بعد الاعتماد.'
      )
    ) {
      return
    }

    runAction(async () => {
      await approveInventoryCountAction({
        countId: selectedId,
        branchId: details.count.branch_id,
      })

      setMessage('تم اعتماد الجرد وتسجيل التسويات.')
    })
  }

  const currentStatus = details?.count.status
  const isDraft = currentStatus === 'draft'
  const isCounting = currentStatus === 'counting'
  const isReview = currentStatus === 'review'
  const isApproved = currentStatus === 'approved'

  return (
    <div dir="rtl" className="space-y-6 pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الجرد</h1>
          <p className="mt-1 text-sm text-gray-500">
            إنشاء جرد للمخزون، تسجيل الكميات، ومراجعة الفروق قبل الاعتماد.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openCreateForm()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + إنشاء جرد جديد
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {showCreateForm && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">إنشاء جرد جديد</h2>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              إغلاق
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">رقم الجرد</span>
              <input
                value={countNumber}
                onChange={(event) => setCountNumber(event.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                maxLength={80}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">الفرع</span>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3"
              >
                <option value="">اختر الفرع</option>
                {branches.map((branch) => (
                  <option
                    key={branch.id}
                    value={branch.id}
                    disabled={branch.status !== 'active'}
                  >
                    {branch.name}
                    {branch.status !== 'active' ? ' — غير نشط' : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">نوع الجرد</span>
              <select
                value={countType}
                onChange={(event) =>
                  setCountType(event.target.value as 'full' | 'partial')
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-3"
              >
                <option value="full">جرد كامل — كل متغيرات المنتجات</option>
                <option value="partial">جرد جزئي — أصناف تختارها</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-sm font-medium">ملاحظات</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full rounded-xl border border-gray-300 px-3 py-3"
                placeholder="ملاحظات اختيارية عن الجرد..."
              />
            </label>
          </div>

          <p className="mt-3 text-xs leading-6 text-gray-500">
            {countType === 'full'
              ? 'الجرد الكامل سيضيف جميع متغيرات المنتجات تلقائيًا عند بدء الجرد.'
              : 'الجرد الجزئي يحتاج إلى تحديد الأصناف قبل بدء العد.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={createCount}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              إنشاء الجرد
            </button>

            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl border border-gray-300 px-5 py-3 text-sm"
            >
              إلغاء
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">سجل عمليات الجرد</h2>
            <span className="text-xs text-gray-500">
              {counts.length} عملية
            </span>
          </div>

          {counts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              لا توجد عمليات جرد حتى الآن.
            </div>
          ) : (
            counts.map((count) => (
              <button
                key={count.count_id}
                type="button"
                onClick={() => {
                  clearMessages()
                  setSelectedId(count.count_id)
                }}
                className={`w-full rounded-2xl border p-4 text-right transition ${
                  selectedId === count.count_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-gray-900">
                    {count.count_number}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      STATUS_STYLES[count.status] || 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {STATUS_LABELS[count.status] || count.status}
                  </span>
                </div>

                <div className="mt-2 text-sm text-gray-600">
                  {count.branch_name}
                </div>

                <div className="mt-2 flex justify-between text-xs text-gray-500">
                  <span>
                    {count.count_type === 'full' ? 'جرد كامل' : 'جرد جزئي'}
                  </span>
                  <span>{formatDate(count.created_at)}</span>
                </div>

                <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-xs">
                  <span className="text-gray-500">
                    {formatNumber(count.counted_items)} من{' '}
                    {formatNumber(count.total_items)} صنف
                  </span>
                  <span className="font-semibold text-gray-700">
                    الفرق: {formatNumber(count.total_difference)}
                  </span>
                </div>
              </button>
            ))
          )}
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedId || !details ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
              <div>
                <div className="text-4xl">📋</div>
                <h2 className="mt-3 font-bold text-gray-800">
                  اختر عملية جرد
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  اختر عملية من السجل لعرض الأصناف والكميات والفروق.
                </p>
              </div>
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {details.count.count_number}
                      </h2>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_STYLES[currentStatus || ''] ||
                          'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {STATUS_LABELS[currentStatus || ''] || currentStatus}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-gray-600">
                      {details.branch_name} —{' '}
                      {details.count.count_type === 'full'
                        ? 'جرد كامل'
                        : 'جرد جزئي'}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      تاريخ الإنشاء: {formatDate(details.count.created_at)}
                    </p>

                    {details.count.started_at && (
                      <p className="mt-1 text-xs text-gray-500">
                        تاريخ بدء العد: {formatDate(details.count.started_at)}
                      </p>
                    )}

                    {details.count.approved_at && (
                      <p className="mt-1 text-xs text-gray-500">
                        تاريخ الاعتماد: {formatDate(details.count.approved_at)}
                      </p>
                    )}
                  </div>

                  {isApproved && (
                    <button
                      type="button"
                      onClick={() => openCreateForm(details.count.id)}
                      className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      إنشاء جرد تصحيحي
                    </button>
                  )}
                </div>

                {details.count.notes && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                    {details.count.notes}
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">إجمالي الأصناف</div>
                    <div className="mt-1 text-xl font-bold">
                      {formatNumber(totalItems)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">تم عدّه</div>
                    <div className="mt-1 text-xl font-bold">
                      {formatNumber(countedItems)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">لم يتم عدّه</div>
                    <div className="mt-1 text-xl font-bold">
                      {formatNumber(totalItems - countedItems)}
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">صافي الفرق</div>
                    <div className="mt-1 text-xl font-bold">
                      {formatNumber(totalDifference)}
                    </div>
                  </div>
                </div>
              </section>

              {(isDraft || isCounting) && (
                <section className="flex flex-wrap gap-2">
                  {isDraft && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={startCount}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      بدء الجرد
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      clearMessages()
                      setShowAddItem((value) => !value)
                    }}
                    className="rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    + إضافة صنف
                  </button>

                  {isCounting && (
                    <button
                      type="button"
                      disabled={isPending || countedItems !== totalItems || totalItems === 0}
                      onClick={submitForReview}
                      className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      إرسال للمراجعة
                    </button>
                  )}
                </section>
              )}

              {showAddItem && (isDraft || isCounting) && (
                <section className="rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-bold">إضافة صنف إلى الجرد</h3>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={variantId}
                      onChange={(event) => setVariantId(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm"
                    >
                      <option value="">اختر المنتج والمقاس واللون</option>
                      {availableVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {getVariantLabel(variant)}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isPending || !variantId}
                      onClick={addItem}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      إضافة
                    </button>
                  </div>

                  {availableVariants.length === 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      لا توجد متغيرات أخرى متاحة للإضافة.
                    </p>
                  )}
                </section>
              )}

              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                  <h3 className="font-bold">أصناف الجرد</h3>
                  <span className="text-xs text-gray-500">
                    {totalItems} صنف
                  </span>
                </div>

                {details.items.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-500">
                    لا توجد أصناف في هذا الجرد.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {details.items.map((item) => {
                      const isItemCounted = item.actual_quantity !== null

                      return (
                        <div key={item.id} className="space-y-3 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {item.product_name}
                              </h4>

                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.size && <span>المقاس: {item.size}</span>}
                                {item.color && <span>اللون: {item.color}</span>}
                                {item.category && <span>{item.category}</span>}
                              </div>
                            </div>

                            {isItemCounted ? (
                              <span className="w-fit rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                تم العد
                              </span>
                            ) : (
                              <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                                لم يتم العد
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs text-gray-500">
                                رصيد بداية الجرد
                              </div>
                              <div className="mt-1 font-bold">
                                {formatNumber(item.system_quantity_at_start)}
                              </div>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs text-gray-500">
                                رصيد النظام وقت العد
                              </div>
                              <div className="mt-1 font-bold">
                                {formatNumber(item.system_quantity_at_count)}
                              </div>
                            </div>

                            <div className="rounded-lg bg-gray-50 p-3">
                              <div className="text-xs text-gray-500">
                                فرق الجرد
                              </div>
                              <div
                                className={`mt-1 font-bold ${
                                  Number(item.difference || 0) < 0
                                    ? 'text-red-600'
                                    : Number(item.difference || 0) > 0
                                      ? 'text-green-700'
                                      : 'text-gray-900'
                                }`}
                              >
                                {formatNumber(item.difference)}
                              </div>
                            </div>
                          </div>

                          {isCounting && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <label className="flex-1">
                                <span className="mb-1 block text-xs font-medium text-gray-600">
                                  الكمية الفعلية
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={quantities[item.product_variant_id] ?? ''}
                                  onChange={(event) =>
                                    setQuantities((previous) => ({
                                      ...previous,
                                      [item.product_variant_id]: event.target.value,
                                    }))
                                  }
                                  className="w-full rounded-xl border border-gray-300 px-3 py-3"
                                  placeholder="أدخل الكمية الموجودة فعليًا"
                                />
                              </label>

                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => saveQuantity(item)}
                                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                              >
                                حفظ الكمية
                              </button>
                            </div>
                          )}

                          {!isCounting && isItemCounted && (
                            <div className="text-sm text-gray-600">
                              الكمية الفعلية:{' '}
                              <strong>
                                {formatNumber(item.actual_quantity)}
                              </strong>
                              <span className="mx-2 text-gray-300">|</span>
                              وقت العد: {formatDate(item.count_at)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {isReview && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-bold text-amber-900">
                    الجرد بانتظار المراجعة والاعتماد
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    راجع الكميات والفروق قبل الاعتماد. لن يتم تعديل المخزون
                    إلا بعد تنفيذ الاعتماد.
                  </p>

                  {canApprove ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={approveCount}
                      className="mt-4 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      اعتماد الجرد وتسجيل الفروق
                    </button>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-amber-900">
                      الاعتماد متاح للمالك والمدير فقط.
                    </p>
                  )}
                </section>
              )}

              {isApproved && (
                <section className="rounded-2xl border border-green-200 bg-green-50 p-5">
                  <h3 className="font-bold text-green-900">
                    تم اعتماد هذا الجرد
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-green-800">
                    الجرد معتمد ولا يمكن تعديله أو اعتماده مرة أخرى.
                    إذا احتجت تصحيحًا، أنشئ جردًا تصحيحيًا مرتبطًا به.
                  </p>

                  {details.adjustments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-sm font-bold text-green-900">
                        تسويات المخزون المسجلة
                      </h4>

                      {details.adjustments.map((adjustment) => {
                        const item = details.items.find(
                          (entry) => entry.id === adjustment.count_item_id
                        )

                        return (
                          <div
                            key={adjustment.id}
                            className="flex justify-between rounded-lg bg-white p-3 text-sm"
                          >
                            <span className="text-gray-700">
                              {item?.product_name || 'صنف'}
                              {item?.size ? ` — ${item.size}` : ''}
                              {item?.color ? ` — ${item.color}` : ''}
                            </span>

                            <strong
                              className={
                                adjustment.adjustment_quantity < 0
                                  ? 'text-red-600'
                                  : 'text-green-700'
                              }
                            >
                              {formatNumber(adjustment.adjustment_quantity)}
                            </strong>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-green-800">
                      لا توجد فروق تحتاج إلى تسوية في هذا الجرد.
                    </p>
                  )}
                </section>
              )}

              {details.events.length > 0 && (
                <section className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h3 className="mb-3 font-bold">سجل أحداث الجرد</h3>

                  <div className="space-y-3">
                    {details.events.map((event) => {
                      const labels: Record<string, string> = {
                        created: 'إنشاء الجرد',
                        started: 'بدء العد',
                        item_added: 'إضافة صنف',
                        item_counted: 'تسجيل كمية',
                        submitted_for_review: 'إرسال للمراجعة',
                        approved: 'اعتماد الجرد',
                        cancelled: 'إلغاء الجرد',
                        correction_created: 'إنشاء جرد تصحيحي',
                      }

                      return (
                        <div
                          key={event.id}
                          className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                        >
                          <span className="text-sm text-gray-700">
                            {labels[event.event_type] || event.event_type}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(event.created_at)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {isPending && (
        <div className="fixed bottom-4 left-4 z-50 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg">
          جاري تنفيذ العملية...
        </div>
      )}
    </div>
  )
}
