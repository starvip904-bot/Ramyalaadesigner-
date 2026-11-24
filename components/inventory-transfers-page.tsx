
'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'

import {
  cancelInventoryTransfer,
  receiveInventoryTransfer,
  requestInventoryTransfer,
} from '@/app/actions/inventory-transfers'

type Branch = {
  id: string
  store_id: string
  name: string
  status: string
}

type Variant = {
  id: string
  product_id: string
  sku: string | null
  barcode: string | null
  size: string | null
  color: string | null
  price: number
  cost: number
}

type Product = {
  id: string
  name: string
  category: string | null
  brand: string | null
  status: string
  dokkan_product_variants: Variant[]
}

type Movement = {
  id: string
  store_id: string
  branch_id: string
  product_variant_id: string
  movement_type: string
  quantity: number
  created_at: string
}

type RelatedBranch = {
  id: string
  name: string
} | null

type RelatedVariant = {
  id: string
  sku: string | null
  barcode: string | null
  size: string | null
  color: string | null
  product:
    | {
        id: string
        name: string
      }
    | null
} | null

type Transfer = {
  id: string
  store_id: string
  source_branch_id: string
  destination_branch_id: string
  product_variant_id: string
  quantity: number
  status: 'requested' | 'received' | 'cancelled'
  requested_by: string | null
  received_by: string | null
  created_at: string
  received_at: string | null
  note: string | null
  source_branch: RelatedBranch
  destination_branch: RelatedBranch
  variant: RelatedVariant
}

type Props = {
  role: string
  branches: Branch[]
  products: Product[]
  movements: Movement[]
  transfers: Transfer[]
}

type TransferForm = {
  sourceBranchId: string
  destinationBranchId: string
  productVariantId: string
  quantity: string
  note: string
}

const positiveMovementTypes = [
  'opening',
  'purchase',
  'return',
  'adjustment',
  'transfer_in',
]

const negativeMovementTypes = [
  'sale',
  'transfer_out',
  'damage',
]

function getBalance(
  movements: Movement[],
  branchId: string,
  variantId: string
) {
  return movements.reduce((total, movement) => {
    if (
      movement.branch_id !== branchId ||
      movement.product_variant_id !== variantId
    ) {
      return total
    }

    const quantity = Number(movement.quantity)

    if (positiveMovementTypes.includes(movement.movement_type)) {
      return total + quantity
    }

    if (negativeMovementTypes.includes(movement.movement_type)) {
      return total - quantity
    }

    return total
  }, 0)
}

function createIdempotencyKey() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function formatDate(value: string | null) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 3,
  }).format(Number(value))
}

function getStatusLabel(status: Transfer['status']) {
  if (status === 'received') return 'تم الاستلام'
  if (status === 'cancelled') return 'ملغي'
  return 'في انتظار الاستلام'
}

function getStatusStyle(status: Transfer['status']) {
  if (status === 'received') {
    return 'bg-emerald-50 text-emerald-700'
  }

  if (status === 'cancelled') {
    return 'bg-red-50 text-red-700'
  }

  return 'bg-amber-50 text-amber-700'
}

function getVariantLabel(variant: RelatedVariant) {
  if (!variant) return 'منتج غير معروف'

  const details = [
    variant.sku ? `كود: ${variant.sku}` : '',
    variant.size ? `المقاس: ${variant.size}` : '',
    variant.color ? `اللون: ${variant.color}` : '',
  ].filter(Boolean)

  return [
    variant.product?.name || 'منتج',
    ...details,
  ].join(' · ')
}

const emptyForm: TransferForm = {
  sourceBranchId: '',
  destinationBranchId: '',
  productVariantId: '',
  quantity: '',
  note: '',
}

export default function InventoryTransfersPage({
  role,
  branches,
  products,
  movements,
  transfers,
}: Props) {
  const [form, setForm] = useState<TransferForm>(emptyForm)
  const [idempotencyKey, setIdempotencyKey] = useState(
    createIdempotencyKey
  )
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, startTransition] = useTransition()

  const canManage = [
    'owner',
    'admin',
    'manager',
    'stock_manager',
  ].includes(role)

  const activeProducts = useMemo(
    () =>
      products
        .filter((product) => product.status === 'active')
        .flatMap((product) =>
          (product.dokkan_product_variants ?? []).map((variant) => ({
            ...variant,
            productName: product.name,
          }))
        ),
    [products]
  )

  const selectedVariant = activeProducts.find(
    (variant) => variant.id === form.productVariantId
  )

  const sourceBalance = useMemo(() => {
    if (!form.sourceBranchId || !form.productVariantId) {
      return 0
    }

    return getBalance(
      movements,
      form.sourceBranchId,
      form.productVariantId
    )
  }, [
    movements,
    form.sourceBranchId,
    form.productVariantId,
  ])

  const filteredTransfers = useMemo(() => {
    const search = query.trim().toLowerCase()

    return transfers.filter((transfer) => {
      const matchesStatus =
        statusFilter === 'all' ||
        transfer.status === statusFilter

      if (!matchesStatus) return false
      if (!search) return true

      const searchable = [
        transfer.id,
        transfer.source_branch?.name,
        transfer.destination_branch?.name,
        getVariantLabel(transfer.variant),
        transfer.note,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchable.includes(search)
    })
  }, [transfers, query, statusFilter])

  const pendingCount = transfers.filter(
    (transfer) => transfer.status === 'requested'
  ).length

  const receivedCount = transfers.filter(
    (transfer) => transfer.status === 'received'
  ).length

  function updateForm(patch: Partial<TransferForm>) {
    setForm((current) => ({
      ...current,
      ...patch,
    }))

    // أي تغيير في بيانات الطلب ينشئ مفتاحًا جديدًا.
    setIdempotencyKey(createIdempotencyKey())
    setError('')
    setMessage('')
  }

  function resetForm() {
    setForm(emptyForm)
    setIdempotencyKey(createIdempotencyKey())
  }

  function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const quantity = Number(form.quantity)

    if (!form.sourceBranchId || !form.destinationBranchId) {
      setError('حدد فرع المصدر وفرع الاستلام')
      return
    }

    if (form.sourceBranchId === form.destinationBranchId) {
      setError('يجب اختيار فرعين مختلفين')
      return
    }

    if (!form.productVariantId) {
      setError('حدد المنتج المطلوب تحويله')
      return
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1000000
    ) {
      setError('اكتب كمية صحيحة أكبر من صفر')
      return
    }

    if (quantity > sourceBalance) {
      setError('الكمية المطلوبة أكبر من الرصيد المتاح في فرع المصدر')
      return
    }

    if (form.note.length > 1000) {
      setError('الملاحظة لا يمكن أن تتجاوز 1000 حرف')
      return
    }

    startTransition(async () => {
      const result = await requestInventoryTransfer({
        sourceBranchId: form.sourceBranchId,
        destinationBranchId: form.destinationBranchId,
        productVariantId: form.productVariantId,
        quantity,
        note: form.note.trim() || undefined,
        idempotencyKey,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      setMessage(
        `تم إنشاء طلب التحويل بنجاح. رقم الطلب: ${result.transferId}`
      )
      resetForm()
      window.location.reload()
    })
  }

  function handleReceive(transfer: Transfer) {
    const confirmed = window.confirm(
      'تأكيد استلام التحويل؟ سيتم خصم الكمية من فرع المصدر وإضافتها إلى فرع الاستلام.'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    startTransition(async () => {
      const result = await receiveInventoryTransfer(transfer.id)

      if (!result.ok) {
        setError(result.message)
        return
      }

      setMessage('تم استلام التحويل وتحديث أرصدة الفرعين')
      window.location.reload()
    })
  }

  function handleCancel(transfer: Transfer) {
    const confirmed = window.confirm(
      'هل تريد إلغاء طلب التحويل؟ الإلغاء لن يغير أرصدة المخزون.'
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    startTransition(async () => {
      const result = await cancelInventoryTransfer(transfer.id)

      if (!result.ok) {
        setError(result.message)
        return
      }

      setMessage('تم إلغاء طلب التحويل')
      window.location.reload()
    })
  }

  if (!canManage) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-slate-200 bg-white p-6 text-center"
      >
        <Package className="mx-auto mb-3 text-slate-400" size={32} />
        <h2 className="font-bold text-slate-800">
          غير مسموح بالوصول
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          ليس لديك صلاحية الوصول إلى إدارة تحويلات المخزون.
        </p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-5">
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand)] text-white">
              <ArrowLeftRight size={24} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-[var(--foreground)] sm:text-2xl">
                تحويلات المخزون
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                نقل المنتجات بين فروع المتجر ومتابعة الاستلام
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--muted)] disabled:opacity-50"
          >
            <RefreshCw size={17} />
            تحديث البيانات
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Clock3 size={17} />
            طلبات معلقة
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--foreground)]">
            {formatQuantity(pendingCount)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <CheckCircle2 size={17} />
            تحويلات مستلمة
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--foreground)]">
            {formatQuantity(receivedCount)}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:col-span-1">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Package size={17} />
            الفروع المتاحة
          </div>
          <p className="mt-3 text-2xl font-extrabold text-[var(--foreground)]">
            {formatQuantity(branches.length)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
        <div className="mb-5">
          <h3 className="text-lg font-extrabold text-[var(--foreground)]">
            إنشاء طلب تحويل جديد
          </h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            إنشاء الطلب لا يخصم المخزون. يتم تحديث الرصيد عند تأكيد الاستلام.
          </p>
        </div>

        {branches.length < 2 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            يلزم توفر فرعين متاحين على الأقل لإنشاء طلب تحويل.
          </div>
        ) : activeProducts.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
            لا توجد متغيرات منتجات نشطة متاحة للتحويل حاليًا.
          </div>
        ) : (
          <form onSubmit={submitRequest} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--foreground)]">
                فرع المصدر
                <select
                  value={form.sourceBranchId}
                  onChange={(event) =>
                    updateForm({
                      sourceBranchId: event.target.value,
                    })
                  }
                  required
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base outline-none focus:border-[var(--brand)]"
                >
                  <option value="">اختر فرع المصدر</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--foreground)]">
                فرع الاستلام
                <select
                  value={form.destinationBranchId}
                  onChange={(event) =>
                    updateForm({
                      destinationBranchId: event.target.value,
                    })
                  }
                  required
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base outline-none focus:border-[var(--brand)]"
                >
                  <option value="">اختر فرع الاستلام</option>
                  {branches
                    .filter(
                      (branch) => branch.id !== form.sourceBranchId
                    )
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--foreground)]">
              المنتج والمتغير
              <select
                value={form.productVariantId}
                onChange={(event) =>
                  updateForm({
                    productVariantId: event.target.value,
                  })
                }
                required
                className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base outline-none focus:border-[var(--brand)]"
              >
                <option value="">اختر المنتج</option>
                {activeProducts.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.productName}
                    {variant.sku ? ` — ${variant.sku}` : ''}
                    {variant.size ? ` — ${variant.size}` : ''}
                    {variant.color ? ` — ${variant.color}` : ''}
                  </option>
                ))}
              </select>
            </label>

            {selectedVariant && (
              <div className="rounded-xl bg-[var(--muted)] p-3 text-sm text-[var(--muted-foreground)]">
                <p>
                  المنتج: {selectedVariant.productName}
                </p>
                {selectedVariant.sku && (
                  <p className="mt-1">
                    كود المنتج: {selectedVariant.sku}
                  </p>
                )}
                {form.sourceBranchId && (
                  <p className="mt-1 font-bold text-[var(--foreground)]">
                    الرصيد المتاح في فرع المصدر: {formatQuantity(sourceBalance)}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--foreground)]">
                الكمية
                <input
                  type="number"
                  min="0.001"
                  max="1000000"
                  step="any"
                  inputMode="decimal"
                  value={form.quantity}
                  onChange={(event) =>
                    updateForm({ quantity: event.target.value })
                  }
                  placeholder="اكتب الكمية"
                  required
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base outline-none focus:border-[var(--brand)]"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--foreground)]">
                ملاحظة (اختياري)
                <input
                  type="text"
                  maxLength={1000}
                  value={form.note}
                  onChange={(event) =>
                    updateForm({ note: event.target.value })
                  }
                  placeholder="سبب التحويل أو أي تفاصيل"
                  className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 text-base outline-none focus:border-[var(--brand)]"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busy || branches.length < 2}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-3 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              <ArrowLeftRight size={18} />
              {busy ? 'جارٍ إنشاء الطلب...' : 'إنشاء طلب التحويل'}
            </button>
          </form>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700"
          >
            {error}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-700"
          >
            {message}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--foreground)]">
              سجل التحويلات
            </h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              متابعة جميع طلبات التحويل المتاحة حسب صلاحياتك
            </p>
          </div>

          <span className="text-sm text-[var(--muted-foreground)]">
            {formatQuantity(filteredTransfers.length)} طلب
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالفرع أو المنتج أو رقم الطلب"
              className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pr-10 pl-3 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="min-h-12 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm outline-none focus:border-[var(--brand)]"
          >
            <option value="all">كل الحالات</option>
            <option value="requested">في انتظار الاستلام</option>
            <option value="received">تم الاستلام</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        {filteredTransfers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <Package
              size={34}
              className="mx-auto mb-3 text-[var(--muted-foreground)]"
            />
            <p className="font-bold text-[var(--foreground)]">
              لا توجد تحويلات مطابقة
            </p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              ستظهر طلبات التحويل هنا بعد إنشائها.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransfers.map((transfer) => (
              <article
                key={transfer.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-[var(--foreground)]">
                        {getVariantLabel(transfer.variant)}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusStyle(
                          transfer.status
                        )}`}
                      >
                        {getStatusLabel(transfer.status)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
                      <span>
                        من: {transfer.source_branch?.name || 'فرع غير معروف'}
                      </span>
                      <ArrowLeftRight size={15} />
                      <span>
                        إلى: {transfer.destination_branch?.name || 'فرع غير معروف'}
                      </span>
                    </div>

                    <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                      الكمية: {formatQuantity(Number(transfer.quantity))}
                    </p>

                    {transfer.note && (
                      <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                        الملاحظة: {transfer.note}
                      </p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-[var(--muted-foreground)]">
                      <p>تاريخ الطلب: {formatDate(transfer.created_at)}</p>
                      {transfer.received_at && (
                        <p>
                          تاريخ الاستلام: {formatDate(transfer.received_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:min-w-36">
                    {transfer.status === 'requested' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReceive(transfer)}
                          disabled={busy}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle2 size={17} />
                          استلام التحويل
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCancel(transfer)}
                          disabled={busy}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <XCircle size={17} />
                          إلغاء الطلب
                        </button>
                      </>
                    )}

                    {transfer.status === 'received' && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-700">
                        <CheckCircle2 size={17} />
                        تم الاستلام
                      </div>
                    )}

                    {transfer.status === 'cancelled' && (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-3 text-sm font-bold text-red-700">
                        <XCircle size={17} />
                        تم الإلغاء
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
