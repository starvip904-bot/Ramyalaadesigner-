
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createSaleExchange,
  createSaleReturn,
  decideSaleReturn,
} from '@/app/actions/returns'
import {
  RotateCcw,
  Search,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  ArrowLeftRight,
} from 'lucide-react'

type PaymentMethod = 'cash' | 'card' | 'transfer'
type OperationType = 'return' | 'exchange'
type Decision = 'approved' | 'rejected'

type VariantInfo = {
  sku?: string | null
  size?: string | null
  color?: string | null
  dokkan_products?: { name?: string | null } | null
}

type SaleItem = {
  id: string
  product_variant_id: string
  quantity: number
  unit_price: number
  discount: number
  dokkan_product_variants?: VariantInfo | null
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
  dokkan_product_variants?: VariantInfo | null
}

type ExchangeItem = {
  id: string
  product_variant_id: string
  quantity: number
  unit_price: number
  amount?: number
  dokkan_product_variants?: VariantInfo | null
}

type SaleReturn = {
  id: string
  sale_id: string
  branch_id: string
  return_type?: string | null
  refund_amount: number
  applied_to_balance: number
  refund_method: string | null
  exchange_difference?: number | null
  exchange_payment_method?: string | null
  exchange_difference_direction?: string | null
  notes: string | null
  created_at: string
  dokkan_sale_return_items: ReturnItem[]
  dokkan_sale_return_exchange_items?: ExchangeItem[]
  original_sale?: Sale | null
}

type ReturnRequestItem = {
  id: string
  request_id: string
  product_variant_id: string
  quantity: number
  dokkan_product_variants?: VariantInfo | null
}

type SaleReturnRequest = {
  id: string
  sale_id: string
  branch_id: string
  return_type?: string | null
  status: 'pending' | 'approved' | 'rejected'
  requested_refund_method: string | null
  exchange_difference?: number | null
  exchange_payment_method?: string | null
  exchange_difference_direction?: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  decided_by: string | null
  decided_at: string | null
  decision_notes: string | null
  processed_return_id: string | null
  items: ReturnRequestItem[]
  exchangeItems?: ExchangeItem[]
  original_sale?: Sale | null
}

type ExchangeProduct = {
  id: string
  productId: string
  name: string
  sku?: string | null
  barcode?: string | null
  size?: string | null
  color?: string | null
  price: number
  stockByBranch: Record<string, number>
}

type ExchangeSettlement = {
  id: string
  sale_id: string
  branch_id: string
  request_id: string
  return_id: string
  settlement_type: 'collected' | 'refunded' | string
  amount: number
  payment_method: string
  created_at: string
}

type Props = {
  sales: Sale[]
  returns: SaleReturn[]
  requests: SaleReturnRequest[]
  userRole: string | null
  exchangeProducts?: ExchangeProduct[]
  exchangeSettlements?: ExchangeSettlement[]
}

type AttemptItem = {
  variantId: string
  quantity: number
}

type PendingAttempt =
  | {
      type: 'return'
      saleId: string
      branchId: string
      items: AttemptItem[]
      refundMethod: PaymentMethod
      notes: string
      idempotencyKey: string
    }
  | {
      type: 'exchange'
      saleId: string
      branchId: string
      returnItems: AttemptItem[]
      exchangeItems: AttemptItem[]
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

const statusLabel = (status: SaleReturnRequest['status']) => {
  if (status === 'approved') return 'تمت الموافقة'
  if (status === 'rejected') return 'مرفوض'
  return 'بانتظار المراجعة'
}

const operationLabel = (type?: string | null) =>
  type === 'exchange' ? 'استبدال' : 'مرتجع'

const itemName = (variant?: VariantInfo | null) =>
  variant?.dokkan_products?.name || 'منتج'

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

function makeIdempotencyKey() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function DifferenceText({
  direction,
  amount,
}: {
  direction?: string | null
  amount?: number | null
}) {
  const value = Number(amount || 0)

  if (!value || direction === 'even') {
    return <span>لا يوجد فرق سعر</span>
  }

  if (direction === 'customer_pays') {
    return <span>العميل يدفع {money(value)}</span>
  }

  if (direction === 'customer_refund') {
    return <span>يُرد للعميل {money(value)}</span>
  }

  return <span>{money(value)}</span>
}

export default function ReturnsManagementPage({
  sales,
  returns,
  requests,
  userRole,
  exchangeProducts = [],
  exchangeSettlements = [],
}: Props) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [selectedSaleId, setSelectedSaleId] = useState('')
  const [operationType, setOperationType] =
    useState<OperationType>('return')

  const [returnQuantities, setReturnQuantities] =
    useState<Record<string, string>>({})

  const [exchangeQuantities, setExchangeQuantities] =
    useState<Record<string, string>>({})

  const [exchangeSearch, setExchangeSearch] = useState('')
  const [refundMethod, setRefundMethod] =
    useState<PaymentMethod>('cash')

  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState('')

  const [pendingAttempt, setPendingAttempt] =
    useState<PendingAttempt | null>(null)

  const [decisionLoadingId, setDecisionLoadingId] =
    useState<string | null>(null)

  const [decisionMessage, setDecisionMessage] = useState('')

  const [settlementMethods, setSettlementMethods] =
    useState<Record<string, PaymentMethod>>({})

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
      const existing = grouped.get(variantId)

      if (existing) {
        existing.quantity += Number(item.quantity || 0)
        existing.discount += Number(item.discount || 0)
      } else {
        grouped.set(variantId, {
          variantId,
          name: itemName(variant),
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

  const availableExchangeProducts = useMemo(() => {
    if (!selectedSale) return []

    const query = exchangeSearch.trim().toLowerCase()

    return exchangeProducts
      .filter((product) => {
        const stock = Number(
          product.stockByBranch?.[selectedSale.branch_id] || 0
        )

        if (stock <= 0) return false

        if (!query) return true

        return (
          product.name.toLowerCase().includes(query) ||
          String(product.sku || '').toLowerCase().includes(query) ||
          String(product.barcode || '').toLowerCase().includes(query)
        )
      })
      .slice(0, 100)
  }, [exchangeProducts, selectedSale, exchangeSearch])

  const selectedReturns = returns.filter(
    (record) => record.sale_id === selectedSaleId
  )

  const pendingRequests = requests.filter(
    (request) => request.status === 'pending'
  )

  const totalReturnQuantity = saleItems.reduce(
    (sum, item) => sum + item.available,
    0
  )

  const hasReturnQuantities = saleItems.some(
    (item) => Number(returnQuantities[item.variantId] || 0) > 0
  )

  const hasExchangeQuantities = availableExchangeProducts.some(
    (product) => Number(exchangeQuantities[product.id] || 0) > 0
  )

  function resetForm() {
    setReturnQuantities({})
    setExchangeQuantities({})
    setExchangeSearch('')
    setNotes('')
    setMessage('')
    setSuccess('')
    setPendingAttempt(null)
  }

  function selectSale(saleId: string) {
    if (pendingAttempt || loading) return

    setSelectedSaleId(saleId)
    resetForm()
  }

  function changeOperationType(value: OperationType) {
    if (pendingAttempt || loading) return

    setOperationType(value)
    setReturnQuantities({})
    setExchangeQuantities({})
    setMessage('')
    setSuccess('')
  }

  function updateReturnQuantity(
    variantId: string,
    value: string
  ) {
    if (pendingAttempt || loading) return

    setReturnQuantities((current) => ({
      ...current,
      [variantId]: value,
    }))
  }

  function updateExchangeQuantity(
    variantId: string,
    value: string
  ) {
    if (pendingAttempt || loading) return

    setExchangeQuantities((current) => ({
      ...current,
      [variantId]: value,
    }))
  }

  async function submitRequest() {
    if (loading) return

    let attempt = pendingAttempt

    if (!attempt) {
      if (!selectedSale) {
        setMessage('اختر الفاتورة أولًا')
        return
      }

      const returnItems = saleItems
        .map((item) => ({
          variantId: item.variantId,
          quantity: Number(returnQuantities[item.variantId] || 0),
          available: item.available,
        }))
        .filter((item) => item.quantity > 0)

      if (returnItems.length === 0) {
        setMessage('حدد صنفًا واحدًا على الأقل من الفاتورة')
        return
      }

      const invalidReturn = returnItems.some(
        (item) =>
          !Number.isFinite(item.quantity) ||
          item.quantity <= 0 ||
          item.quantity > item.available
      )

      if (invalidReturn) {
        setMessage('راجع كميات الأصناف المرتجعة')
        return
      }

      if (operationType === 'return') {
        attempt = {
          type: 'return',
          saleId: selectedSale.id,
          branchId: selectedSale.branch_id,
          items: returnItems.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
          refundMethod,
          notes,
          idempotencyKey: makeIdempotencyKey(),
        }
      } else {
        const exchangeItems = availableExchangeProducts
          .map((product) => ({
            variantId: product.id,
            quantity: Number(exchangeQuantities[product.id] || 0),
            available: Number(
              product.stockByBranch?.[selectedSale.branch_id] || 0
            ),
          }))
          .filter((item) => item.quantity > 0)

        if (exchangeItems.length === 0) {
          setMessage('حدد صنفًا بديلًا واحدًا على الأقل')
          return
        }

        const invalidExchange = exchangeItems.some(
          (item) =>
            !Number.isFinite(item.quantity) ||
            item.quantity <= 0 ||
            item.quantity > item.available
        )

        if (invalidExchange) {
          setMessage('راجع كميات الأصناف البديلة المتاحة بالمخزون')
          return
        }

        attempt = {
          type: 'exchange',
          saleId: selectedSale.id,
          branchId: selectedSale.branch_id,
          returnItems: returnItems.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
          exchangeItems: exchangeItems.map(({ variantId, quantity }) => ({
            variantId,
            quantity,
          })),
          notes,
          idempotencyKey: makeIdempotencyKey(),
        }
      }

      setPendingAttempt(attempt)
    }

    setLoading(true)
    setMessage('')
    setSuccess('')

    try {
      const result =
        attempt.type === 'return'
          ? await createSaleReturn({
              saleId: attempt.saleId,
              branchId: attempt.branchId,
              items: attempt.items,
              refundMethod: attempt.refundMethod,
              notes: attempt.notes,
              idempotencyKey: attempt.idempotencyKey,
            })
          : await createSaleExchange({
              saleId: attempt.saleId,
              branchId: attempt.branchId,
              returnItems: attempt.returnItems,
              exchangeItems: attempt.exchangeItems,
              notes: attempt.notes,
              idempotencyKey: attempt.idempotencyKey,
            })

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
        `${attempt.type === 'exchange' ? 'تم إرسال طلب الاستبدال' : 'تم إرسال طلب المرتجع'} للمراجعة. رقم الطلب: ${result.requestId}`
      )

      setPendingAttempt(null)
      setReturnQuantities({})
      setExchangeQuantities({})
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

  async function handleDecision(
    request: SaleReturnRequest,
    decision: Decision
  ) {
    if (!canDecideReturns || decisionLoadingId) return

    const isExchange = request.return_type === 'exchange'

    const actionLabel =
      decision === 'approved' ? 'الموافقة على' : 'رفض'

    const confirmed = window.confirm(
      `هل أنت متأكد من ${actionLabel} طلب ${operationLabel(request.return_type)} رقم ${request.id.slice(0, 8)}؟`
    )

    if (!confirmed) return

    const decisionNotes = window.prompt(
      'ملاحظات القرار (اختياري):',
      ''
    )

    if (decisionNotes === null) return

    const settlementMethod =
      settlementMethods[request.id] || 'cash'

    setDecisionLoadingId(request.id)
    setDecisionMessage('')

    try {
      const result = await decideSaleReturn({
        requestId: request.id,
        decision,
        decisionNotes,
        settlementMethod:
          isExchange && decision === 'approved'
            ? settlementMethod
            : null,
      })

      if (!result.ok) {
        setDecisionMessage(result.message)
        return
      }

      setDecisionMessage(
        decision === 'approved'
          ? `تم اعتماد الطلب وتنفيذ العملية. رقم العملية: ${result.returnId}`
          : 'تم رفض الطلب.'
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
      setMessage('تعذر طباعة الإيصال: بيانات الفاتورة الأصلية غير متاحة.')
      return
    }

    const popup = window.open('', '_blank', 'width=900,height=750')

    if (!popup) {
      setMessage('اسمح بفتح النوافذ المنبثقة حتى تتمكن من طباعة الإيصال.')
      return
    }

    const returnedRows = (
      record.dokkan_sale_return_items || []
    ).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(itemName(item.dokkan_product_variants))}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${escapeHtml(money(item.amount))}</td>
      </tr>
    `).join('')

    const exchangeRows = (
      record.dokkan_sale_return_exchange_items || []
    ).map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(itemName(item.dokkan_product_variants))}</td>
        <td>${escapeHtml(item.quantity)}</td>
        <td>${escapeHtml(money(item.amount ?? item.unit_price * item.quantity))}</td>
      </tr>
    `).join('')

    const isExchange = record.return_type === 'exchange'

    const differenceLabel =
      record.exchange_difference_direction === 'customer_pays'
        ? 'المبلغ المستحق من العميل'
        : record.exchange_difference_direction === 'customer_refund'
          ? 'المبلغ المردود للعميل'
          : 'فرق السعر'

    const receiptHtml = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${isExchange ? 'إيصال استبدال' : 'فاتورة مرتجع'}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; padding: 24px; color: #111827; }
          .receipt { max-width: 760px; margin: auto; }
          h1, .center { text-align: center; }
          .notice { background: #eff6ff; color: #1d4ed8; padding: 12px; text-align: center; margin: 18px 0; font-weight: bold; }
          .info { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .info div { border: 1px solid #ddd; padding: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f3f4f6; }
          .total { margin-top: 20px; font-weight: bold; font-size: 18px; }
          button { padding: 10px 20px; margin-bottom: 20px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="center">
            <button onclick="window.print()">طباعة الإيصال</button>
            <h1>${isExchange ? 'إيصال استبدال' : 'فاتورة مرتجع'}</h1>
          </div>

          <div class="notice">
            ${isExchange ? 'إيصال استبدال مرتبط بفاتورة البيع الأصلية' : 'إيصال مرتجع — ليس فاتورة بيع'}
          </div>

          <div class="info">
            <div>رقم العملية: <strong>${escapeHtml(record.id)}</strong></div>
            <div>التاريخ: <strong>${escapeHtml(date(record.created_at))}</strong></div>
            <div>الفاتورة الأصلية: <strong>${escapeHtml(originalSale.id)}</strong></div>
            <div>العميل: <strong>${escapeHtml(originalSale.dokkan_customers?.name || 'عميل نقدي')}</strong></div>
            <div>الهاتف: <strong>${escapeHtml(originalSale.dokkan_customers?.phone || '—')}</strong></div>
            <div>الفرع: <strong>${escapeHtml(originalSale.dokkan_branches?.name || '—')}</strong></div>
          </div>

          <h3>الأصناف المرتجعة</h3>
          <table>
            <thead><tr><th>م</th><th>الصنف</th><th>الكمية</th><th>القيمة</th></tr></thead>
            <tbody>${returnedRows || '<tr><td colspan="4">لا توجد أصناف</td></tr>'}</tbody>
          </table>

          ${
            isExchange
              ? `
                <h3>الأصناف البديلة</h3>
                <table>
                  <thead><tr><th>م</th><th>الصنف</th><th>الكمية</th><th>القيمة</th></tr></thead>
                  <tbody>${exchangeRows || '<tr><td colspan="4">لا توجد أصناف بديلة</td></tr>'}</tbody>
                </table>
                <p class="total">${escapeHtml(differenceLabel)}: ${escapeHtml(money(record.exchange_difference || 0))}</p>
                <p>طريقة التسوية: ${escapeHtml(paymentLabel(record.exchange_payment_method))}</p>
              `
              : `
                <p>المبلغ المردود: <strong>${escapeHtml(money(record.refund_amount))}</strong></p>
                <p>المخصوم من رصيد العميل: <strong>${escapeHtml(money(record.applied_to_balance))}</strong></p>
                <p>طريقة الرد: <strong>${escapeHtml(paymentLabel(record.refund_method))}</strong></p>
              `
          }

          ${record.notes ? `<p>ملاحظات: ${escapeHtml(record.notes)}</p>` : ''}
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
            إدارة طلبات المرتجع والاستبدال ومراجعة فروق الأسعار
          </p>
        </div>

        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
          {returns.length} عملية منفذة
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-extrabold">طلبات المراجعة</h3>
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
            لا توجد طلبات حتى الآن
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const isExchange = request.return_type === 'exchange'
              const originalSale = request.original_sale

              return (
                <div
                  key={request.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-extrabold">
                        {operationLabel(request.return_type)} #{request.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        الفاتورة: {request.sale_id.slice(0, 8)}
                        {' — '}
                        {date(request.created_at)}
                      </p>
                    </div>

                    <span
                      className={`rounded-lg px-3 py-2 text-xs font-bold ${
                        request.status === 'approved'
                          ? 'bg-green-50 text-green-700'
                          : request.status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-orange-50 text-orange-700'
                      }`}
                    >
                      {statusLabel(request.status)}
                    </span>
                  </div>

                  {originalSale && (
                    <p className="mt-2 text-xs text-slate-500">
                      العميل: {originalSale.dokkan_customers?.name || 'عميل نقدي'}
                      {' — '}
                      الفرع: {originalSale.dokkan_branches?.name || '—'}
                    </p>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-bold">
                        الأصناف المرتجعة
                      </p>

                      {(request.items || []).map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-2 border-b border-slate-200 py-2 text-sm last:border-0"
                        >
                          <span>{itemName(item.dokkan_product_variants)}</span>
                          <b>× {item.quantity}</b>
                        </div>
                      ))}
                    </div>

                    {isExchange && (
                      <div className="rounded-lg bg-blue-50 p-3">
                        <p className="mb-2 text-sm font-bold">
                          الأصناف البديلة
                        </p>

                        {(request.exchangeItems || []).map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between gap-2 border-b border-blue-100 py-2 text-sm last:border-0"
                          >
                            <span>{itemName(item.dokkan_product_variants)}</span>
                            <b>× {item.quantity}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {isExchange && request.status === 'approved' && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="font-bold">تسوية فرق السعر</p>
                      <p className="mt-2">
                        <DifferenceText
                          direction={request.exchange_difference_direction}
                          amount={request.exchange_difference}
                        />
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        طريقة التسوية: {paymentLabel(request.exchange_payment_method)}
                      </p>
                    </div>
                  )}

                  {request.notes && (
                    <p className="mt-3 text-xs text-slate-500">
                      ملاحظات الطلب: {request.notes}
                    </p>
                  )}

                  {request.decision_notes && (
                    <p className="mt-2 text-xs text-slate-500">
                      ملاحظات القرار: {request.decision_notes}
                    </p>
                  )}

                  {request.status === 'pending' && canDecideReturns && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      {isExchange && (
                        <div className="mb-3 max-w-sm">
                          <label className="mb-1 block text-xs font-bold text-slate-600">
                            طريقة تسوية فرق السعر عند وجود فرق
                          </label>

                          <select
                            value={settlementMethods[request.id] || 'cash'}
                            onChange={(event) =>
                              setSettlementMethods((current) => ({
                                ...current,
                                [request.id]: event.target.value as PaymentMethod,
                              }))
                            }
                            disabled={decisionLoadingId === request.id}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          >
                            <option value="cash">نقدي</option>
                            <option value="card">بطاقة</option>
                            <option value="transfer">تحويل بنكي</option>
                          </select>

                          <p className="mt-1 text-xs text-slate-500">
                            سيتم تسجيل الفرق كتحصيل من العميل أو رد له حسب قيمة البديل.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDecision(request, 'approved')}
                          disabled={decisionLoadingId === request.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {decisionLoadingId === request.id
                            ? 'جارٍ التنفيذ...'
                            : 'اعتماد وتنفيذ'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDecision(request, 'rejected')}
                          disabled={decisionLoadingId === request.id}
                          className="rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-50"
                        >
                          رفض الطلب
                        </button>
                      </div>
                    </div>
                  )}

                  {request.status === 'approved' && request.processed_return_id && (
                    <p className="mt-3 text-xs text-green-700">
                      رقم العملية المنفذة: {request.processed_return_id}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-extrabold">إنشاء طلب جديد</h3>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => changeOperationType('return')}
            disabled={Boolean(pendingAttempt) || loading}
            className={`rounded-xl border p-4 text-right ${
              operationType === 'return'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <RotateCcw size={18} />
              مرتجع
            </div>
            <p className="mt-1 text-xs text-slate-500">
              إرجاع أصناف من الفاتورة وطلب رد قيمتها
            </p>
          </button>

          <button
            type="button"
            onClick={() => changeOperationType('exchange')}
            disabled={Boolean(pendingAttempt) || loading}
            className={`rounded-xl border p-4 text-right ${
              operationType === 'exchange'
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <ArrowLeftRight size={18} />
              استبدال
            </div>
            <p className="mt-1 text-xs text-slate-500">
              إرجاع أصناف واختيار أصناف بديلة مع تسوية فرق السعر
            </p>
          </button>
        </div>

        <label className="mb-2 block text-sm font-bold">
          البحث عن فاتورة
        </label>

        <div className="relative mb-3">
          <Search
            size={18}
            className="absolute right-3 top-3 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={Boolean(pendingAttempt) || loading}
            placeholder="رقم الفاتورة أو اسم العميل أو الهاتف..."
            className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 outline-none focus:border-blue-500"
          />
        </div>

        <div className="mb-5 max-h-64 space-y-2 overflow-y-auto">
          {visibleSales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => selectSale(sale.id)}
              disabled={Boolean(pendingAttempt) || loading}
              className={`w-full rounded-xl border p-3 text-right transition ${
                selectedSaleId === sale.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-bold">
                  فاتورة #{sale.id.slice(0, 8)}
                </span>
                <span className="text-xs text-slate-500">
                  {date(sale.created_at)}
                </span>
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {sale.dokkan_customers?.name || 'عميل نقدي'}
                {' — '}
                {sale.dokkan_branches?.name || 'الفرع'}
                {' — '}
                {money(Number(sale.total))}
              </div>
            </button>
          ))}

          {visibleSales.length === 0 && (
            <p className="py-4 text-center text-sm text-slate-400">
              لا توجد فواتير مطابقة للبحث
            </p>
          )}
        </div>

        {selectedSale && (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">إجمالي الفاتورة</p>
                <p className="mt-2 font-extrabold">
                  {money(Number(selectedSale.total))}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">المبلغ المدفوع</p>
                <p className="mt-2 font-extrabold">
                  {money(Number(selectedSale.amount_paid))}
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

            <div className="mb-4 flex items-center gap-2">
              <Package className="text-blue-600" />
              <h4 className="font-extrabold">أصناف الفاتورة</h4>
            </div>

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
                    <p className="mt-1 font-extrabold">{item.available}</p>
                  </div>

                  <div className="self-center">
                    <label className="mb-1 block text-xs font-bold text-slate-500">
                      كمية {operationType === 'exchange' ? 'الصنف المرتجع' : 'المرتجع'}
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
                      value={returnQuantities[item.variantId] || ''}
                      onChange={(event) =>
                        updateReturnQuantity(item.variantId, event.target.value)
                      }
                      placeholder="0"
                      className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              ))}
            </div>

            {operationType === 'exchange' && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="mb-3 flex items-center gap-2">
                  <ArrowLeftRight className="text-blue-600" />
                  <h4 className="font-extrabold">اختيار الأصناف البديلة</h4>
                </div>

                <input
                  value={exchangeSearch}
                  onChange={(event) => setExchangeSearch(event.target.value)}
                  disabled={Boolean(pendingAttempt) || loading}
                  placeholder="ابحث باسم المنتج أو الكود أو الباركود..."
                  className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-blue-500"
                />

                {availableExchangeProducts.length === 0 ? (
                  <p className="rounded-xl bg-orange-50 p-4 text-sm text-orange-800">
                    لا توجد أصناف بديلة متاحة في مخزون هذا الفرع حسب البيانات المحملة.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {availableExchangeProducts.map((product) => {
                      const stock = Number(
                        product.stockByBranch?.[selectedSale.branch_id] || 0
                      )

                      return (
                        <div
                          key={product.id}
                          className="grid gap-3 rounded-xl border border-slate-100 p-4 sm:grid-cols-[1fr_auto_auto]"
                        >
                          <div>
                            <p className="font-bold">{product.name}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {[
                                product.sku && `كود: ${product.sku}`,
                                product.size && `المقاس: ${product.size}`,
                                product.color && `اللون: ${product.color}`,
                              ].filter(Boolean).join(' — ') || 'بدون تفاصيل إضافية'}
                            </p>
                            <p className="mt-2 text-sm font-bold text-blue-700">
                              {money(product.price)}
                            </p>
                          </div>

                          <div className="self-center text-sm">
                            <p className="text-slate-500">المتاح بالفرع</p>
                            <p className="mt-1 font-extrabold">{stock}</p>
                          </div>

                          <div className="self-center">
                            <label className="mb-1 block text-xs font-bold text-slate-500">
                              كمية البديل
                            </label>

                            <input
                              type="number"
                              min="0"
                              max={stock}
                              step="0.01"
                              disabled={Boolean(pendingAttempt) || loading}
                              value={exchangeQuantities[product.id] || ''}
                              onChange={(event) =>
                                updateExchangeQuantity(product.id, event.target.value)
                              }
                              placeholder="0"
                              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-center outline-none focus:border-blue-500 disabled:bg-slate-100"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h4 className="mb-4 font-extrabold">بيانات الطلب</h4>

              <div className="grid gap-4 sm:grid-cols-2">
                {operationType === 'return' && (
                  <label className="text-sm font-bold">
                    طريقة رد المبلغ

                    <select
                      value={refundMethod}
                      disabled={Boolean(pendingAttempt) || loading}
                      onChange={(event) =>
                        setRefundMethod(event.target.value as PaymentMethod)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal"
                    >
                      <option value="cash">نقدي</option>
                      <option value="card">بطاقة</option>
                      <option value="transfer">تحويل بنكي</option>
                    </select>
                  </label>
                )}

                <label className="text-sm font-bold">
                  ملاحظات الطلب

                  <input
                    value={pendingAttempt?.notes ?? notes}
                    disabled={Boolean(pendingAttempt) || loading}
                    onChange={(event) => setNotes(event.target.value)}
                    maxLength={1000}
                    placeholder="سبب الإرجاع أو الاستبدال..."
                    className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 font-normal"
                  />
                </label>
              </div>

              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs leading-6 text-blue-800">
                لن يتم تعديل المخزون أو تنفيذ رد المبلغ عند تقديم الطلب.
                يتم التنفيذ بعد اعتماد المالك أو مدير الفرع المختص.
                وفي الاستبدال تتم تسوية فرق السعر وقت الاعتماد.
              </p>

              {pendingAttempt && (
                <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm leading-6 text-orange-800">
                  توجد محاولة طلب لم يتم تأكيد نتيجتها بعد.
                  استخدم إعادة المحاولة بنفس الطلب، ولا تنشئ طلبًا جديدًا.
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
                onClick={submitRequest}
                disabled={
                  loading ||
                  (!pendingAttempt &&
                    (!hasReturnQuantities ||
                      (operationType === 'exchange' && !hasExchangeQuantities)))
                }
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    جارٍ إرسال الطلب...
                  </>
                ) : (
                  <>
                    {operationType === 'exchange'
                      ? <ArrowLeftRight size={18} />
                      : <RotateCcw size={18} />}
                    {pendingAttempt
                      ? 'إعادة محاولة نفس الطلب'
                      : operationType === 'exchange'
                        ? 'إرسال طلب الاستبدال للمراجعة'
                        : 'إرسال طلب المرتجع للمراجعة'}
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </section>

      {selectedReturns.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-extrabold">
            سجل العمليات المرتبطة بالفاتورة
          </h3>

          <div className="space-y-3">
            {selectedReturns.map((record) => {
              const isExchange = record.return_type === 'exchange'

              return (
                <div
                  key={record.id}
                  className="rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-sm font-bold">
                      {operationLabel(record.return_type)} #{record.id.slice(0, 8)}
                    </span>

                    <span className="text-xs text-slate-500">
                      {date(record.created_at)}
                    </span>
                  </div>

                  {isExchange ? (
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <p>
                        فرق السعر:
                        {' '}
                        <b>
                          <DifferenceText
                            direction={record.exchange_difference_direction}
                            amount={record.exchange_difference}
                          />
                        </b>
                      </p>

                      <p>
                        طريقة التسوية:
                        {' '}
                        <b>{paymentLabel(record.exchange_payment_method)}</b>
                      </p>
                    </div>
                  ) : (
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
                  )}

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
                      طباعة الإيصال
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {exchangeSettlements.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 font-extrabold">سجل تسويات فروق أسعار الاستبدال</h3>

          <div className="space-y-3">
            {exchangeSettlements.map((settlement) => (
              <div
                key={settlement.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-bold">
                    {settlement.settlement_type === 'collected'
                      ? 'فرق سعر محصل من العميل'
                      : 'فرق سعر مردود للعميل'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    طلب #{settlement.request_id.slice(0, 8)}
                    {' — '}
                    {date(settlement.created_at)}
                  </p>
                </div>

                <div className="text-left">
                  <p className="font-extrabold">
                    {money(Number(settlement.amount))}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {paymentLabel(settlement.payment_method)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
