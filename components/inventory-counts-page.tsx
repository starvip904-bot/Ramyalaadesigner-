'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardList,
  Clock3,
  FilePlus2,
  Filter,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react'

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

const STATUS_CLASSES: Record<string, string> = {
  draft: 'dokkan-status-info',
  counting: 'dokkan-status-info',
  review: 'dokkan-status-warning',
  approved: 'dokkan-status-success',
  cancelled: 'dokkan-status-danger',
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

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  helper?: string
  icon: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--success)]'
      : tone === 'warning'
        ? 'text-[var(--warning)]'
        : tone === 'danger'
          ? 'text-[var(--danger)]'
          : 'text-[var(--brand)]'

  return (
    <div className="dokkan-card min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm dokkan-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)]">
            {value}
          </p>
          {helper && (
            <p className="mt-1 text-xs dokkan-text-muted">{helper}</p>
          )}
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)]">
          <Icon className={`h-5 w-5 ${toneClass}`} />
        </span>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
        STATUS_CLASSES[status] || 'dokkan-status-info'
      }`}
    >
      {status === 'approved' ? (
        <BadgeCheck className="h-3.5 w-3.5" />
      ) : status === 'review' ? (
        <ShieldCheck className="h-3.5 w-3.5" />
      ) : status === 'counting' ? (
        <Activity className="h-3.5 w-3.5" />
      ) : (
        <Clock3 className="h-3.5 w-3.5" />
      )}
      {STATUS_LABELS[status] || status}
    </span>
  )
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
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all')

  // Keep the existing store-scoped page contract explicit.
  void storeId

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
    return variants.filter(
      (variant) =>
        !existing.has(variant.id) && variant.productStatus === 'active'
    )
  }, [variants, details])

  const filteredCounts = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase('ar')
    return counts.filter((count) => {
      const matchesSearch =
        !term ||
        count.count_number.toLocaleLowerCase('ar').includes(term) ||
        count.branch_name.toLocaleLowerCase('ar').includes(term)
      const matchesStatus =
        statusFilter === 'all' || count.status === statusFilter
      const matchesBranch =
        branchFilter === 'all' || count.branch_id === branchFilter
      return matchesSearch && matchesStatus && matchesBranch
    })
  }, [counts, searchTerm, statusFilter, branchFilter])

  const countedItems =
    details?.items.filter((item) => item.actual_quantity !== null).length || 0
  const totalItems = details?.items.length || 0
  const totalDifference =
    details?.items.reduce(
      (sum, item) => sum + Number(item.difference || 0),
      0
    ) || 0
  const countProgress =
    totalItems > 0 ? Math.round((countedItems / totalItems) * 100) : 0

  const totalCounts = counts.length
  const activeCounts = counts.filter(
    (count) => count.status === 'draft' || count.status === 'counting'
  ).length
  const reviewCounts = counts.filter((count) => count.status === 'review').length
  const approvedCounts = counts.filter(
    (count) => count.status === 'approved'
  ).length

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
          item.actual_quantity === null ? '' : String(item.actual_quantity)
      }
      setQuantities(nextQuantities)
    } catch (error) {
      setDetails(null)
      setErrorMessage(
        error instanceof Error ? error.message : 'تعذر تحميل تفاصيل الجرد.'
      )
    }
  }

  useEffect(() => {
    if (selectedId) {
      loadDetails(selectedId)
    } else {
      setDetails(null)
    }
    // Load details only when the selected count changes.
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
        if (selectedId) await loadDetails(selectedId)
        router.refresh()
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'حدث خطأ أثناء تنفيذ العملية.'
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
    if (details.count.count_type === 'partial' && details.items.length === 0) {
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-[var(--foreground)]">
                الجرد
              </h1>
              <p className="mt-1 text-sm dokkan-text-muted">
                متابعة عمليات الجرد وتسجيل الكميات ومراجعة فروق المخزون.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openCreateForm()}
          className="dokkan-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
        >
          <FilePlus2 className="h-4 w-4" />
          إنشاء جرد جديد
        </button>
      </header>

      {(message || errorMessage) && (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
            errorMessage
              ? 'border-[var(--danger)]/30 bg-[var(--danger)]/5 text-[var(--danger)]'
              : 'border-[var(--success)]/30 bg-[var(--success)]/5 text-[var(--success)]'
          }`}
        >
          {errorMessage ? (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <span className="flex-1">{errorMessage || message}</span>
          <button
            type="button"
            onClick={clearMessages}
            className="rounded-lg p-1 opacity-70 hover:opacity-100"
            aria-label="إغلاق الرسالة"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="إجمالي عمليات الجرد"
          value={formatNumber(totalCounts)}
          helper="كل العمليات المسجلة"
          icon={ClipboardList}
        />
        <StatCard
          label="عمليات مفتوحة"
          value={formatNumber(activeCounts)}
          helper="مسودة أو جاري العد"
          icon={Activity}
          tone="warning"
        />
        <StatCard
          label="بانتظار المراجعة"
          value={formatNumber(reviewCounts)}
          helper="تحتاج مراجعة واعتماد"
          icon={ShieldCheck}
          tone="warning"
        />
        <StatCard
          label="عمليات معتمدة"
          value={formatNumber(approvedCounts)}
          helper="تم تسجيل التسويات"
          icon={BadgeCheck}
          tone="success"
        />
      </section>

      {showCreateForm && (
        <section className="dokkan-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-bold text-[var(--foreground)]">
                إنشاء جرد جديد
              </h2>
              <p className="mt-1 text-xs dokkan-text-muted">
                أدخل بيانات العملية قبل إضافة الأصناف أو بدء العد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="dokkan-surface rounded-xl p-2 dokkan-text-muted hover:text-[var(--foreground)]"
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="block">
              <span className="dokkan-label mb-2 block">رقم الجرد</span>
              <input
                value={countNumber}
                onChange={(event) => setCountNumber(event.target.value)}
                className="dokkan-input w-full rounded-xl px-3 py-3"
                maxLength={80}
              />
            </label>

            <label className="block">
              <span className="dokkan-label mb-2 block">الفرع</span>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="dokkan-input w-full rounded-xl px-3 py-3"
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
              <span className="dokkan-label mb-2 block">نوع الجرد</span>
              <select
                value={countType}
                onChange={(event) =>
                  setCountType(event.target.value as 'full' | 'partial')
                }
                className="dokkan-input w-full rounded-xl px-3 py-3"
              >
                <option value="full">جرد كامل — كل متغيرات المنتجات</option>
                <option value="partial">جرد جزئي — أصناف تختارها</option>
              </select>
            </label>

            <label className="block sm:col-span-2">
              <span className="dokkan-label mb-2 block">ملاحظات</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="dokkan-input w-full rounded-xl px-3 py-3"
                placeholder="ملاحظات اختيارية عن الجرد..."
              />
            </label>

            <div className="rounded-xl bg-[var(--brand-soft)] p-3 text-sm leading-6 text-[var(--foreground)] sm:col-span-2">
              {countType === 'full'
                ? 'الجرد الكامل سيضيف جميع متغيرات المنتجات تلقائيًا عند بدء الجرد.'
                : 'الجرد الجزئي يحتاج إلى تحديد الأصناف قبل بدء العد.'}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-4 py-4 sm:px-5">
            <button
              type="button"
              disabled={isPending}
              onClick={createCount}
              className="dokkan-primary inline-flex min-h-10 items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
              إنشاء الجرد
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="dokkan-surface min-h-10 rounded-xl px-5 py-2.5 text-sm font-semibold"
            >
              إلغاء
            </button>
          </div>
        </section>
      )}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(290px,0.82fr)_minmax(0,1.8fr)]">
        <aside className="dokkan-card min-w-0 overflow-hidden">
          <div className="border-b border-[var(--line)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-[var(--foreground)]">
                  سجل عمليات الجرد
                </h2>
                <p className="mt-1 text-xs dokkan-text-muted">
                  {formatNumber(filteredCounts.length)} من{' '}
                  {formatNumber(counts.length)} عملية
                </p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--brand)]">
                <SlidersHorizontal className="h-4 w-4" />
              </span>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 dokkan-text-muted" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="dokkan-input w-full rounded-xl py-2.5 pr-9 pl-3 text-sm"
                placeholder="ابحث برقم الجرد أو الفرع..."
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="dokkan-label mb-1.5 block text-xs">الحالة</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="dokkan-input w-full rounded-lg px-2 py-2 text-xs"
                >
                  <option value="all">كل الحالات</option>
                  <option value="draft">مسودة</option>
                  <option value="counting">جاري العد</option>
                  <option value="review">بانتظار المراجعة</option>
                  <option value="approved">معتمد</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="dokkan-label mb-1.5 block text-xs">الفرع</span>
                <select
                  value={branchFilter}
                  onChange={(event) => setBranchFilter(event.target.value)}
                  className="dokkan-input w-full rounded-lg px-2 py-2 text-xs"
                >
                  <option value="all">كل الفروع</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(searchTerm || statusFilter !== 'all' || branchFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setStatusFilter('all')
                  setBranchFilter('all')
                }}
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)]"
              >
                <X className="h-3.5 w-3.5" />
                مسح الفلاتر
              </button>
            )}
          </div>

          <div className="max-h-[760px] space-y-2 overflow-y-auto p-3">
            {filteredCounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-10 text-center">
                <Filter className="mx-auto h-8 w-8 dokkan-text-muted" />
                <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                  لا توجد نتائج
                </p>
                <p className="mt-1 text-xs dokkan-text-muted">
                  جرّب تغيير البحث أو الفلاتر.
                </p>
              </div>
            ) : (
              filteredCounts.map((count) => {
                const isSelected = selectedId === count.count_id
                const progress =
                  count.total_items > 0
                    ? Math.round(
                        (count.counted_items / count.total_items) * 100
                      )
                    : 0

                return (
                  <button
                    key={count.count_id}
                    type="button"
                    onClick={() => {
                      clearMessages()
                      setSelectedId(count.count_id)
                    }}
                    className={`w-full rounded-2xl border p-3.5 text-right transition ${
                      isSelected
                        ? 'border-[var(--brand)] bg-[var(--brand-soft)] shadow-sm'
                        : 'border-[var(--line)] bg-[var(--card)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--foreground)]">
                          {count.count_number}
                        </p>
                        <p className="mt-1 truncate text-xs dokkan-text-muted">
                          {count.branch_name}
                        </p>
                      </div>
                      <StatusBadge status={count.status} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 text-xs dokkan-text-muted">
                      <span>
                        {count.count_type === 'full' ? 'جرد كامل' : 'جرد جزئي'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(count.created_at)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="dokkan-text-muted">
                        {formatNumber(count.counted_items)} من{' '}
                        {formatNumber(count.total_items)} صنف
                      </span>
                      <span className="font-semibold text-[var(--foreground)]">
                        {progress}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {!selectedId || !details ? (
            <div className="dokkan-card flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[var(--brand-soft)] text-[var(--brand)]">
                <ClipboardList className="h-8 w-8" />
              </span>
              <h2 className="mt-4 text-lg font-bold text-[var(--foreground)]">
                اختر عملية جرد
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 dokkan-text-muted">
                اختر عملية من السجل لعرض الأصناف والكميات والفروق ومتابعة
                خطوات الجرد.
              </p>
              {selectedId && (
                <div className="mt-4 inline-flex items-center gap-2 text-sm dokkan-text-muted">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جارٍ تحميل تفاصيل الجرد...
                </div>
              )}
            </div>
          ) : (
            <>
              <section className="dokkan-card overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-all text-xl font-bold text-[var(--foreground)]">
                          {details.count.count_number}
                        </h2>
                        <StatusBadge status={currentStatus || ''} />
                      </div>
                      <p className="mt-2 text-sm text-[var(--foreground)]">
                        {details.branch_name} —{' '}
                        {details.count.count_type === 'full'
                          ? 'جرد كامل'
                          : 'جرد جزئي'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs dokkan-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          الإنشاء: {formatDate(details.count.created_at)}
                        </span>
                        {details.count.started_at && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            بدء العد: {formatDate(details.count.started_at)}
                          </span>
                        )}
                        {details.count.approved_at && (
                          <span className="inline-flex items-center gap-1">
                            <BadgeCheck className="h-3.5 w-3.5" />
                            الاعتماد: {formatDate(details.count.approved_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isApproved && (
                      <button
                        type="button"
                        onClick={() => openCreateForm(details.count.id)}
                        className="dokkan-surface inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--brand)]"
                      >
                        <FilePlus2 className="h-4 w-4" />
                        إنشاء جرد تصحيحي
                      </button>
                    )}
                  </div>

                  {details.count.notes && (
                    <div className="mt-4 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm leading-6 text-[var(--foreground)]">
                      {details.count.notes}
                    </div>
                  )}

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                      <p className="text-xs dokkan-text-muted">إجمالي الأصناف</p>
                      <p className="mt-1 text-xl font-bold text-[var(--foreground)]">
                        {formatNumber(totalItems)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                      <p className="text-xs dokkan-text-muted">تم عدّه</p>
                      <p className="mt-1 text-xl font-bold text-[var(--success)]">
                        {formatNumber(countedItems)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                      <p className="text-xs dokkan-text-muted">لم يتم عدّه</p>
                      <p className="mt-1 text-xl font-bold text-[var(--warning)]">
                        {formatNumber(totalItems - countedItems)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                      <p className="text-xs dokkan-text-muted">صافي الفرق</p>
                      <p
                        className={`mt-1 text-xl font-bold ${
                          totalDifference < 0
                            ? 'text-[var(--danger)]'
                            : totalDifference > 0
                              ? 'text-[var(--success)]'
                              : 'text-[var(--foreground)]'
                        }`}
                      >
                        {formatNumber(totalDifference)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="dokkan-text-muted">تقدم تسجيل الكميات</span>
                      <span className="font-bold text-[var(--foreground)]">
                        {countProgress}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)] transition-all"
                        style={{ width: `${countProgress}%` }}
                      />
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
                      className="dokkan-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      <Activity className="h-4 w-4" />
                      بدء الجرد
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      clearMessages()
                      setShowAddItem((value) => !value)
                    }}
                    className="dokkan-surface inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة صنف
                  </button>

                  {isCounting && (
                    <button
                      type="button"
                      disabled={
                        isPending || countedItems !== totalItems || totalItems === 0
                      }
                      onClick={submitForReview}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--warning)] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      إرسال للمراجعة
                    </button>
                  )}
                </section>
              )}

              {showAddItem && (isDraft || isCounting) && (
                <section className="dokkan-card p-4 sm:p-5">
                  <div className="mb-3">
                    <h3 className="font-bold text-[var(--foreground)]">
                      إضافة صنف إلى الجرد
                    </h3>
                    <p className="mt-1 text-xs dokkan-text-muted">
                      اختر المنتج ومتغيره لإضافته إلى قائمة العد.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      value={variantId}
                      onChange={(event) => setVariantId(event.target.value)}
                      className="dokkan-input min-w-0 flex-1 rounded-xl px-3 py-3 text-sm"
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
                      className="dokkan-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة
                    </button>
                  </div>

                  {availableVariants.length === 0 && (
                    <p className="mt-3 text-xs dokkan-text-muted">
                      لا توجد متغيرات نشطة أخرى متاحة للإضافة.
                    </p>
                  )}
                </section>
              )}

              <section className="dokkan-card min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] p-4 sm:px-5">
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">
                      أصناف الجرد
                    </h3>
                    <p className="mt-1 text-xs dokkan-text-muted">
                      {formatNumber(totalItems)} صنف في هذه العملية
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--brand)]">
                    <Package className="h-5 w-5" />
                  </span>
                </div>

                {details.items.length === 0 ? (
                  <div className="px-5 py-12 text-center">
                    <Package className="mx-auto h-9 w-9 dokkan-text-muted" />
                    <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                      لا توجد أصناف في هذا الجرد
                    </p>
                    <p className="mt-1 text-xs dokkan-text-muted">
                      أضف أصنافًا إلى الجرد الجزئي أو ابدأ الجرد الكامل.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)]">
                    {details.items.map((item) => {
                      const isItemCounted = item.actual_quantity !== null
                      const difference = Number(item.difference || 0)

                      return (
                        <article key={item.id} className="space-y-4 p-4 sm:p-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-[var(--foreground)]">
                                {item.product_name}
                              </h4>
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs dokkan-text-muted">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.barcode && <span>باركود: {item.barcode}</span>}
                                {item.size && <span>المقاس: {item.size}</span>}
                                {item.color && <span>اللون: {item.color}</span>}
                                {item.category && <span>{item.category}</span>}
                                {item.brand && <span>{item.brand}</span>}
                              </div>
                            </div>
                            <span
                              className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                                isItemCounted
                                  ? 'dokkan-status-success'
                                  : 'dokkan-status-warning'
                              }`}
                            >
                              {isItemCounted ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Clock3 className="h-3.5 w-3.5" />
                              )}
                              {isItemCounted ? 'تم العد' : 'لم يتم العد'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                              <p className="text-xs dokkan-text-muted">
                                رصيد بداية الجرد
                              </p>
                              <p className="mt-1 font-bold text-[var(--foreground)]">
                                {formatNumber(item.system_quantity_at_start)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                              <p className="text-xs dokkan-text-muted">
                                رصيد النظام وقت العد
                              </p>
                              <p className="mt-1 font-bold text-[var(--foreground)]">
                                {formatNumber(item.system_quantity_at_count)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-[var(--surface-secondary)] p-3">
                              <p className="text-xs dokkan-text-muted">فرق الجرد</p>
                              <p
                                className={`mt-1 inline-flex items-center gap-1 font-bold ${
                                  difference < 0
                                    ? 'text-[var(--danger)]'
                                    : difference > 0
                                      ? 'text-[var(--success)]'
                                      : 'text-[var(--foreground)]'
                                }`}
                              >
                                {difference < 0 ? (
                                  <ArrowDown className="h-4 w-4" />
                                ) : difference > 0 ? (
                                  <ArrowUp className="h-4 w-4" />
                                ) : null}
                                {formatNumber(item.difference)}
                              </p>
                            </div>
                          </div>

                          {isCounting && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <label className="min-w-0 flex-1">
                                <span className="dokkan-label mb-2 block">
                                  الكمية الفعلية
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  value={
                                    quantities[item.product_variant_id] ?? ''
                                  }
                                  onChange={(event) =>
                                    setQuantities((previous) => ({
                                      ...previous,
                                      [item.product_variant_id]:
                                        event.target.value,
                                    }))
                                  }
                                  className="dokkan-input w-full rounded-xl px-3 py-3"
                                  placeholder="أدخل الكمية الموجودة فعليًا"
                                />
                              </label>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => saveQuantity(item)}
                                className="dokkan-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                                حفظ الكمية
                              </button>
                            </div>
                          )}

                          {!isCounting && isItemCounted && (
                            <div className="rounded-xl bg-[var(--surface-secondary)] p-3 text-sm text-[var(--foreground)]">
                              الكمية الفعلية:{' '}
                              <strong>
                                {formatNumber(item.actual_quantity)}
                              </strong>
                              <span className="mx-2 text-[var(--muted)]">|</span>
                              وقت العد: {formatDate(item.count_at)}
                            </div>
                          )}
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>

              {isReview && (
                <section className="dokkan-card border border-[var(--warning)]/30 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--warning)]/10 text-[var(--warning)]">
                      <ShieldCheck className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[var(--foreground)]">
                        الجرد بانتظار المراجعة والاعتماد
                      </h3>
                      <p className="mt-2 text-sm leading-6 dokkan-text-muted">
                        راجع الكميات والفروق قبل الاعتماد. لن يتم تعديل المخزون
                        إلا بعد تنفيذ الاعتماد.
                      </p>
                    </div>
                  </div>

                  {canApprove ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={approveCount}
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--success)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <BadgeCheck className="h-4 w-4" />
                      اعتماد الجرد وتسجيل الفروق
                    </button>
                  ) : (
                    <p className="mt-4 rounded-xl bg-[var(--surface-secondary)] p-3 text-sm font-semibold text-[var(--foreground)]">
                      الاعتماد متاح للمالك والمدير فقط.
                    </p>
                  )}
                </section>
              )}

              {isApproved && details.adjustments.length > 0 && (
                <section className="dokkan-card overflow-hidden">
                  <div className="border-b border-[var(--line)] p-4">
                    <h3 className="font-bold text-[var(--foreground)]">
                      تسويات المخزون الناتجة عن الجرد
                    </h3>
                    <p className="mt-1 text-xs dokkan-text-muted">
                      الحركات التي تم تسجيلها عند اعتماد الجرد.
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--line)]">
                    {details.adjustments.map((adjustment) => {
                      const item = details.items.find(
                        (entry) => entry.id === adjustment.count_item_id
                      )
                      return (
                        <div
                          key={adjustment.id}
                          className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--foreground)]">
                              {item?.product_name || 'صنف من أصناف الجرد'}
                            </p>
                            <p className="mt-1 text-xs dokkan-text-muted">
                              {formatDate(adjustment.created_at)}
                            </p>
                          </div>
                          <span
                            className={`font-bold ${
                              Number(adjustment.adjustment_quantity) < 0
                                ? 'text-[var(--danger)]'
                                : 'text-[var(--success)]'
                            }`}
                          >
                            {formatNumber(adjustment.adjustment_quantity)}
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
    </div>
  )
}
