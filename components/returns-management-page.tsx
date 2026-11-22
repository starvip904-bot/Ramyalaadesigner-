
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSaleReturn, decideSaleReturn } from '@/app/actions/returns'
import {
  RotateCcw,
  Search,
  ReceiptText,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
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
  store_id?: string
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
  dokkan_product_variants?: {
    sku?: string | null
    size?: string | null
    color?: string | null
    dokkan_products?: { name?: string | null } | null
  } | null
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
  original_sale?: Sale | null
}

type ReturnRequestItem = {
  id: string
  request_id: string
  product_variant_id: string
  quantity: number
  dokkan_product_variants?: {
    sku?: string | null
    size?: string | null
    color?: string | null
    dokkan_products?: { name?: string | null } | null
  } | null
}

type SaleReturnRequest = {
  id: string
  sale_id: string
  branch_id: string
  status: 'pending' | 'approved' | 'rejected'
  requested_refund_method: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  decided_by: string | null
  decided_at: string | null
  decision_notes: string | null
  processed_return_id: string | null
  items: ReturnRequestItem[]
  original_sale?: Sale | null
}

type Props = {
  sales: Sale[]
  returns: SaleReturn[]
  requests: SaleReturnRequest[]
  userRole: string | null
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

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }

    return entities[character]
  })

export default function ReturnsManagementPage({
  sales,
  returns,
  requests,
  userRole,
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

  const [decisionLoadingId, setDecisionLoadingId] =
    useState<string | null>(null)
  const [decisionMessage, setDecisionMessage] = useState('')

  const canDecideReturns =
    userRole === 'owner' || userRole === 'manager'

  const selectedSale = sales.find(
    (sale) => sale.id === selectedSaleId
  )

  const visibleSales = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return sales.slice(0, 30)

    return sales.filter((sale) => {
      const customer = sale.dokkan_customers?.name || 'عميل نقدي'
      const phone = sale.dokkan_customers?.phone || ''

      return (
        customer.toLowerCase().includes(query) ||
        phone.toLowerCase().includes(query) ||
        sale.id.toLowerCase().includes(query)
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

  const pendingReservedQuantities = useMemo(() => {
    const totals: Record<string, number> = {}

    if (!selectedSale) return totals

    for (const request of requests) {
      if (
        request.sale_id !== selectedSale.id ||
        request.status !== 'pending'
      ) {
        continue
      }

      for (const item of request.items || []) {
        totals[item.product_variant_id] =
          (totals[item.product_variant_id] || 0) +
          Number(item.quantity || 0)
      }
    }

    return totals
  }, [requests, selectedSale])

  const saleItems = useMemo(() => {
    if (!selectedSale) return []

    const grouped = new Map<
      string,
      {
        variantId: string
        name: string
        sku: string
        size: string
        color: string
        quantity: number
        unitPrice: number
        discount: number
      }
    >()

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
      alreadyReturned:
        returnedQuantities[item.variantId] || 0,
      pendingRequested:
        pendingReservedQuantities[item.variantId] || 0,
      available: Math.max(
        0,
        item.quantity -
          (returnedQuantities[item.variantId] || 0) -
          (pendingReservedQuantities[item.variantId] || 0)
      ),
    }))
  }, [
    selectedSale,
    returnedQuantities,
    pendingReservedQuantities,
  ])

  const selectedReturns = returns.filter(
    (record) => record.sale_id === selectedSaleId
  )

  const pendingRequests = requests.filter(
    (request) => request.status === 'pending'
  )

  const requestStatusLabel = (
    status: SaleReturnRequest['status']
  ) => {
    if (status === 'approved') return 'تمت الموافقة'
    if (status === 'rejected') return 'مرفوض'
    return 'بانتظار المراجعة'
  }

  const totalReturnQuantity = saleItems.reduce(
    (sum, item) => sum + item.available,
    0
  )

  const hasSelectedQuantities = saleItems.some(
    (item) => Number(quantities[item.variantId] || 0) > 0
  )

  async function handleDecision(
    request: SaleReturnRequest,
    decision: 'approved' | 'rejected'
  ) {
    if (!canDecideReturns || decisionLoadingId) return

    const actionLabel =
      decision === 'approved' ? 'الموافقة على' : 'رفض'

    const confirmed = window.confirm(
      `هل أنت متأكد من ${actionLabel} طلب المرتجع رقم ${request.id.slice(0, 8)}؟`
    )

    if (!confirmed) return

    const decisionNotes = window.prompt(
      'ملاحظات القرار (اختياري):',
      ''
    )

    if (decisionNotes === null) return

    setDecisionLoadingId(request.id)
    setDecisionMessage('')

    try {
      const result = await decideSaleReturn({
        requestId: request.id,
        decision,
        decisionNotes,
      })

      if (!result.ok) {
        setDecisionMessage(result.message)
        return
      }

      setDecisionMessage(
        decision === 'approved'
          ? `تم اعتماد الطلب وتنفيذ المرتجع. رقم العملية: ${result.returnId}`
          : 'تم رفض طلب المرتجع.'
      )

      router.refresh()
    } catch {
      setDecisionMessage(
        'تعذر تأكيد القرار بسبب الاتصال. حدّث الصفحة وتحقق من حالة الطلب قبل إعادة المحاولة.'
      )
    } finally {
      setDecisionLoadingId(null)
    }
  }

  function printReturn(record: SaleReturn) {
    const originalSale = record.original_sale

    if (!originalSale) {
      setMessage(
        'تعذر طباعة الإيصال: بيانات الفاتورة الأصلية غير متاحة.'
      )
      return
    }

    const popup = window.open(
      '',
      '_blank',
      'width=900,height=750'
    )

    if (!popup) {
      setMessage(
        'اسمح بفتح النوافذ المنبثقة حتى تتمكن من طباعة الإيصال.'
      )
      return
    }

    const rows = (
      record.dokkan_sale_return_items || []
    ).map((item, index) => {
      const variant = item.dokkan_product_variants
      const product = variant?.dokkan_products

      const details = [
        variant?.sku ? `الكود: ${variant.sku}` : '',
        variant?.size ? `المقاس: ${variant.size}` : '',
        variant?.color ? `اللون: ${variant.color}` : '',
      ].filter(Boolean).join(' - ')

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <strong>${escapeHtml(product?.name || 'منتج')}</strong>
            <div>${escapeHtml(details)}</div>
          </td>
          <td>${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(money(item.amount))}</td>
        </tr>
      `
    }).join('')

    const returnValue =
      Number(record.refund_amount || 0) +
      Number(record.applied_to_balance || 0)

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>فاتورة مرتجع</title>
        <style>
          body {
            font-family: Tahoma, Arial, sans-serif;
            padding: 24px;
            color: #111827;
          }
          .receipt {
            max-width: 760px;
            margin: auto;
          }
          h1, .center {
            text-align: center;
          }
          .notice {
            background: #fef2f2;
            color: #b91c1c;
            padding: 12px;
            text-align: center;
            margin: 18px 0;
            font-weight: bold;
          }
          .info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .info div {
            border: 1px solid #ddd;
            padding: 10px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: right;
          }
          th {
            background: #f3f4f6;
          }
          .total {
            margin-top: 20px;
            font-weight: bold;
            font-size: 18px;
          }
          .muted {
            color: #64748b;
            font-size: 12px;
          }
          button {
            padding: 10px 20px;
            margin-bottom: 20px;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <button onclick="window.print()">طباعة إيصال المرتجع</button>
            <h1>فاتورة مرتجع</h1>
          </div>

          <div class="notice">
            إيصال مرتجع — ليس فاتورة بيع
          </div>

          <div class="info">
            <div>
              رقم المرتجع:
              <strong>${escapeHtml(record.id)}</strong>
            </div>
            <div>
              تاريخ المرتجع:
              <strong>${escapeHtml(date(record.created_at))}</strong>
            </div>
            <div>
              الفاتورة الأصلية:
              <strong>${escapeHtml(originalSale.id)}</strong>
            </div>
            <div>
              العميل:
              <strong>${escapeHtml(originalSale.dokkan_customers?.name || 'عميل نقدي')}</strong>
            </div>
            <div>
              الهاتف:
              <strong>${escapeHtml(originalSale.dokkan_customers?.phone || '—')}</strong>
            </div>
            <div>
              الفرع:
              <strong>${escapeHtml(originalSale.dokkan_branches?.name || '—')}</strong>
            </div>
            <div>
              طريقة رد المبلغ:
              <strong>${escapeHtml(paymentLabel(record.refund_method))}</strong>
            </div>
          </div>

          <h3>الأصناف المرتجعة</h3>

          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>الصنف</th>
                <th>الكمية</th>
                <th>القيمة</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4">لا توجد أصناف</td></tr>'}
            </tbody>
          </table>

          <p>
            المبلغ المردود:
            <strong>${escapeHtml(money(record.refund_amount))}</strong>
          </p>

          <p>
            المخصوم من رصيد العميل:
            <strong>${escapeHtml(money(record.applied_to_balance))}</strong>
          </p>

          <p class="total">
            إجمالي قيمة المرتجع:
            ${escapeHtml(money(returnValue))}
          </p>

          ${
            record.notes
              ? `<p>ملاحظات: ${escapeHtml(record.notes)}</p>`
              : ''
          }

          <p class="center muted">
            تم إصدار هذا الإيصال لإثبات عملية مرتجع مرتبطة بفاتورة البيع الأصلية.
          </p>
        </div>
      </body>
      </html>
    `

    popup.document.open()
    popup.document.write(receiptHtml)
    popup.document.close()
    popup.focus()
    setMessage('')
  }

  function selectSale(saleId: string) {
    if (pendingAttempt || loading) return

    setSelectedSaleId(saleId)
    setQuantities({})
    setNotes('')
    setMessage('')
    setSuccess('')
  }

  function updateQuantity(
    variantId: string,
    value: string
  ) {
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
        setMessage(
          'أدخل كمية مرتجعة لصنف واحد على الأقل'
        )
        return
      }

      const invalid = items.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > item.available
      )

      if (invalid) {
        setMessage(
          'راجع الكميات؛ يوجد صنف تجاوز الكمية المتاحة للمرتجع'
        )
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
            ? `${result.message}. استخدم إعادة المحاولة بنفس الطلب.`
            : result.message
        )

        if (!result.retryable) {
          setPendingAttempt(null)
        }

        return
      }

      setSuccess(
        `تم إرسال طلب المرتجع للمراجعة بنجاح. رقم الطلب: ${result.requestId}`
      )

      setPendingAttempt(null)
      setQuantities({})
      setNotes('')
      router.refresh()
    } catch {
      setMessage(
        'تعذر تأكيد النتيجة بسبب الاتصال. استخدم إعادة المحاولة بنفس الطلب، ولا تنشئ طلبًا جديدًا.'
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold">
            طلبات المرتجعات
          </h3>

          <span className="rounded-lg bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
            {pendingRequests.length} طلب بانتظار المراجعة
          </span>
        </div>

        {decisionMessage && (
          <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
            {decisionMessage}
          </p>
        )}

        {requests.length === 0 ? (
          <p className="py-5 text-center text-sm text-slate-400">
            لا توجد طلبات مرتجعات حتى الآن
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const isPending =
                request.status === 'pending'

              const busy =
                decisionLoadingId === request.id

              return (
                <article
                  key={request.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <b>
                      طلب #{request.id.slice(0, 8)}
                      {' — '}
                      فاتورة #{request.sale_id.slice(0, 8)}
                    </b>

                    <span className="text-sm font-bold">
                      {requestStatusLabel(request.status)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                    <p>
                      تاريخ الطلب:
                      {' '}
                      <b>{date(request.created_at)}</b>
                    </p>

                    <p>
                      مقدم الطلب (معرّف المستخدم):
                      {' '}
                      <b>{request.created_by || 'غير متاح'}</b>
                    </p>

                    <p>
                      طريقة رد المبلغ:
                      {' '}
                      <b>{paymentLabel(request.requested_refund_method)}</b>
                    </p>

                    {request.decided_at && (
                      <p>
                        تاريخ القرار:
                        {' '}
                        <b>{date(request.decided_at)}</b>
                      </p>
                    )}

                    {request.decided_by && (
                      <p>
                        صاحب القرار:
                        {' '}
                        <b>{request.decided_by}</b>
                      </p>
                    )}

                    {request.processed_return_id && (
                      <p>
                        رقم المرتجع المنفذ:
                        {' '}
                        <b>{request.processed_return_id}</b>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs">
                    <b>الأصناف المطلوبة</b>

                    {(request.items || []).map((item) => (
                      <p key={item.id} className="mt-2">
                        {item.dokkan_product_variants?.dokkan_products?.name || 'منتج'}
                        {' — '}
                        الكمية:
                        {' '}
                        <b>{item.quantity}</b>
                      </p>
                    ))}
                  </div>

                  {request.notes && (
                    <p className="mt-2 text-xs text-slate-600">
                      ملاحظات مقدم الطلب: {request.notes}
                    </p>
                  )}

                  {request.decision_notes && (
                    <p className="mt-2 text-xs text-slate-600">
                      ملاحظات القرار: {request.decision_notes}
                    </p>
                  )}

                  {isPending && canDecideReturns && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleDecision(request, 'approved')
                        }
                        disabled={Boolean(decisionLoadingId)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {busy
                          ? 'جارٍ التنفيذ...'
                          : 'اعتماد وتنفيذ المرتجع'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDecision(request, 'rejected')
                        }
                        disabled={Boolean(decisionLoadingId)}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                      >
                        رفض الطلب
                      </button>
                    </div>
                  )}

                  {isPending && !canDecideReturns && (
                    <p className="mt-3 text-xs text-orange-700">
                      في انتظار اعتماد المالك أو مدير الفرع المختص.
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

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
                        ].filter(Boolean).join(' — ') || 'بدون تفاصيل إضافية'}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        المباع: {item.quantity}
                        {' — '}
                        المرتجع سابقًا: {item.alreadyReturned}
                        {' — '}
                        محجوز بطلبات معلقة: {item.pendingRequested}
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
              بيانات طلب المرتجع
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
                ملاحظات الطلب

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
              سيتم إرسال طلب المرتجع للمراجعة. لن يتم تنفيذ المرتجع أو
              رد المبلغ قبل اعتماد المالك أو مدير الفرع المختص.
            </p>

            {pendingAttempt && (
              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm leading-6 text-orange-800">
                توجد محاولة طلب لم يتم تأكيد نتيجتها بعد.
                استخدم إعادة المحاولة بنفس الطلب، ولا تنشئ طلبًا جديدًا
                قبل التأكد من نتيجتها.
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
                  جارٍ إرسال طلب المرتجع...
                </>
              ) : (
                <>
                  <RotateCcw size={18} />
                  {pendingAttempt
                    ? 'إعادة محاولة نفس الطلب'
                    : 'إرسال طلب للمراجعة'}
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
                        رد نقدي:
                        {' '}
                        <b>{money(Number(record.refund_amount))}</b>
                      </p>

                      <p>
                        خصم من المتبقي:
                        {' '}
                        <b>{money(Number(record.applied_to_balance))}</b>
                      </p>

                      <p>
                        طريقة الرد:
                        {' '}
                        <b>{paymentLabel(record.refund_method)}</b>
                      </p>
                    </div>

                    {record.notes && (
                      <p className="mt-2 text-xs text-slate-500">
                        ملاحظات: {record.notes}
                      </p>
                    )}

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => printReturn(record)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        <Printer size={16} />
                        طباعة فاتورة المرتجع
                      </button>
                    </div>
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
