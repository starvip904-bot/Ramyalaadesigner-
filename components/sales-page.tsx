
'use client'

import { useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

type Relation<T> = T | T[] | null

type SaleItem = {
  id: string
  quantity: number
  unit_price: number
  discount: number
  dokkan_product_variants: Relation<{
    sku: string | null
    size: string | null
    color: string | null
    dokkan_products: Relation<{ name: string }>
  }>
}

export type DokkanSale = {
  id: string
  branch_id: string
  subtotal: number
  discount: number
  tax_enabled: boolean
  tax_rate: number
  tax_amount: number
  total: number
  amount_paid: number
  remaining: number
  payment_method: string
  status: string
  notes: string | null
  created_at: string
  dokkan_branches: Relation<{ name: string }>
  dokkan_customers: Relation<{ name: string; phone: string | null }>
  dokkan_sale_items: SaleItem[]
}

type ReturnItem = {
  product_variant_id: string
  quantity: number
  amount: number
  dokkan_product_variants: Relation<{
    sku: string | null
    size: string | null
    color: string | null
    dokkan_products: Relation<{ name: string }>
  }>
}

export type SaleReturn = {
  id: string
  sale_id: string
  branch_id: string
  refund_amount: number
  applied_to_balance: number
  refund_method: string | null
  notes: string | null
  created_at: string
  dokkan_sale_return_items: ReturnItem[]
}

function one<T>(value: Relation<T> | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value as T
}

const money = (value: number) =>
  `${Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const invoiceNumber = (id: string) =>
  `INV-${id.slice(0, 8).toUpperCase()}`

const returnNumber = (id: string) =>
  `RET-${id.slice(0, 8).toUpperCase()}`

const paymentLabel = (value: string | null) => ({
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
  transfer: 'تحويل بنكي',
}[value || ''] || value || 'غير محدد')

const statusLabel = (value: string) => ({
  completed: 'مكتملة',
  returned: 'مسترجعة',
  partially_returned: 'مرتجع جزئي',
}[value] || value)

const statusStyle = (value: string) => {
  if (value === 'returned') {
    return {
      background: 'var(--danger-soft)',
      color: 'var(--danger)',
    }
  }

  if (value === 'partially_returned') {
    return {
      background: 'var(--warning-soft)',
      color: 'var(--warning)',
    }
  }

  return {
    background: 'var(--success-soft)',
    color: 'var(--success)',
  }
}

function StatCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const valueColor = {
    default: 'var(--foreground)',
    success: 'var(--success)',
    warning: 'var(--warning)',
  }[tone]

  return (
    <article className="dokkan-card min-w-0 rounded-2xl p-4 sm:p-5">
      <p className="text-xs font-semibold leading-6 dokkan-text-muted sm:text-sm">
        {label}
      </p>
      <p
        className="mt-2 break-words text-lg font-extrabold sm:text-xl"
        style={{ color: valueColor }}
      >
        {value}
      </p>
    </article>
  )
}

export default function SalesPage({
  initialSales,
  initialReturns,
  storeName,
}: {
  initialSales: DokkanSale[]
  initialReturns: SaleReturn[]
  storeName: string
}) {
  const [sales] = useState(initialSales)
  const [returns] = useState(initialReturns)
  const [selected, setSelected] = useState<DokkanSale | null>(null)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const selectedReturns = useMemo(() => {
    if (!selected) return []
    return returns.filter((record) => record.sale_id === selected.id)
  }, [returns, selected])

  const isFullyReturned = selected?.status === 'returned'

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()

    return sales.filter((sale) => {
      const customer = one(sale.dokkan_customers)
      const number = invoiceNumber(sale.id).toLowerCase()

      const matchesSearch =
        !query ||
        number.includes(query) ||
        sale.id.toLowerCase().includes(query) ||
        (customer?.name || '').toLowerCase().includes(query) ||
        (customer?.phone || '').includes(query)

      const date = sale.created_at.slice(0, 10)
      const matchesFrom = !from || date >= from
      const matchesTo = !to || date <= to

      return matchesSearch && matchesFrom && matchesTo
    })
  }, [sales, search, from, to])

  const totalSales = filtered.reduce(
    (sum, sale) => sum + Number(sale.total || 0),
    0
  )

  const totalPaid = filtered.reduce(
    (sum, sale) => sum + Number(sale.amount_paid || 0),
    0
  )

  const totalRemaining = filtered.reduce(
    (sum, sale) => sum + Number(sale.remaining || 0),
    0
  )

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-7xl min-w-0 space-y-5 p-3 sm:space-y-6 sm:p-5 lg:p-6"
    >
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .invoice-print,
          .invoice-print * {
            visibility: visible !important;
          }

          .invoice-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 12px !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          .no-print,
          .print-hide {
            display: none !important;
          }

          .invoice-print table {
            page-break-inside: auto;
          }

          .invoice-print tr {
            page-break-inside: avoid;
          }

          .invoice-print section,
          .invoice-print article {
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Page heading */}
      <header className="no-print flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold dokkan-text-muted sm:text-sm">
            إدارة المتجر
          </p>

          <h1 className="mt-2 break-words text-xl font-extrabold sm:text-2xl">
            المبيعات والفواتير
          </h1>

          <p className="mt-2 text-xs leading-6 dokkan-text-muted sm:text-sm">
            سجل فواتير البيع والمرتجعات المحفوظة
          </p>
        </div>

        <span
          className="w-fit rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{
            background: 'var(--brand-soft)',
            color: 'var(--brand)',
          }}
        >
          {filtered.length.toLocaleString('ar-EG')} فاتورة
        </span>
      </header>

      {/* Statistics */}
      <section className="no-print grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="إجمالي المبيعات المعروضة"
          value={money(totalSales)}
        />

        <StatCard
          label="إجمالي المدفوع"
          value={money(totalPaid)}
          tone="success"
        />

        <StatCard
          label="إجمالي المتبقي"
          value={money(totalRemaining)}
          tone="warning"
        />
      </section>

      {/* Search and filters */}
      <section className="no-print dokkan-card min-w-0 space-y-4 rounded-2xl p-4 sm:p-5">
        <div>
          <label
            htmlFor="sales-search"
            className="mb-2 block text-sm font-bold"
          >
            البحث عن فاتورة
          </label>

          <input
            id="sales-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="رقم الفاتورة أو اسم العميل أو رقم الهاتف..."
            aria-label="البحث عن فاتورة"
            className="dokkan-input w-full min-w-0 rounded-xl px-4 py-3 text-base"
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold">
            من تاريخ
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="dokkan-input mt-2 w-full min-w-0 rounded-xl p-3 text-base"
            />
          </label>

          <label className="min-w-0 text-sm font-semibold">
            إلى تاريخ
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="dokkan-input mt-2 w-full min-w-0 rounded-xl p-3 text-base"
            />
          </label>
        </div>

        {(search || from || to) && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFrom('')
              setTo('')
            }}
            className="rounded-lg px-4 py-2.5 text-xs font-bold transition"
            style={{
              background: 'var(--surface-secondary)',
              color: 'var(--foreground)',
            }}
          >
            مسح البحث والفلاتر
          </button>
        )}
      </section>

      {/* Desktop table */}
      <section className="no-print dokkan-card hidden overflow-hidden rounded-2xl lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead
              style={{
                background: 'var(--surface-secondary)',
                color: 'var(--muted)',
              }}
            >
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">العميل</th>
                <th className="p-4">الفرع</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">الإجمالي</th>
                <th className="p-4">المدفوع</th>
                <th className="p-4">المتبقي</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">التفاصيل</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((sale) => {
                const customer = one(sale.dokkan_customers)
                const branch = one(sale.dokkan_branches)

                return (
                  <tr
                    key={sale.id}
                    className="border-t transition"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <td className="p-4 font-bold">
                      {invoiceNumber(sale.id)}
                    </td>

                    <td className="p-4">
                      {customer?.name || 'عميل نقدي'}
                    </td>

                    <td className="p-4">
                      {branch?.name || '—'}
                    </td>

                    <td className="p-4 text-xs dokkan-text-muted">
                      {new Date(sale.created_at).toLocaleString('ar-EG')}
                    </td>

                    <td className="p-4 font-bold">
                      {money(sale.total)}
                    </td>

                    <td
                      className="p-4 font-semibold"
                      style={{ color: 'var(--success)' }}
                    >
                      {money(sale.amount_paid)}
                    </td>

                    <td
                      className="p-4 font-semibold"
                      style={{ color: 'var(--warning)' }}
                    >
                      {money(sale.remaining)}
                    </td>

                    <td className="p-4">
                      <span
                        className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold"
                        style={statusStyle(sale.status)}
                      >
                        {statusLabel(sale.status)}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelected(sale)}
                        className="dokkan-primary whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold"
                      >
                        {sale.status === 'returned'
                          ? 'عرض تفاصيل المرتجع'
                          : 'عرض الفاتورة'}
                      </button>
                    </td>
                  </tr>
                )
              })}

              {!filtered.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="p-12 text-center dokkan-text-muted"
                  >
                    لا توجد فواتير في نتائج البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mobile and tablet cards */}
      <section className="no-print grid min-w-0 grid-cols-1 gap-3 lg:hidden">
        {filtered.map((sale) => {
          const customer = one(sale.dokkan_customers)
          const branch = one(sale.dokkan_branches)

          return (
            <article
              key={sale.id}
              className="dokkan-card min-w-0 rounded-2xl p-4"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-extrabold">
                    {invoiceNumber(sale.id)}
                  </p>

                  <p className="mt-2 break-words text-sm font-semibold">
                    {customer?.name || 'عميل نقدي'}
                  </p>
                </div>

                <span
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
                  style={statusStyle(sale.status)}
                >
                  {statusLabel(sale.status)}
                </span>
              </div>

              <div
                className="mt-4 grid grid-cols-2 gap-3 rounded-xl p-3"
                style={{ background: 'var(--surface-secondary)' }}
              >
                <div>
                  <p className="text-xs dokkan-text-muted">الإجمالي</p>
                  <p className="mt-1 text-sm font-extrabold">
                    {money(sale.total)}
                  </p>
                </div>

                <div>
                  <p className="text-xs dokkan-text-muted">المدفوع</p>
                  <p
                    className="mt-1 text-sm font-bold"
                    style={{ color: 'var(--success)' }}
                  >
                    {money(sale.amount_paid)}
                  </p>
                </div>

                <div>
                  <p className="text-xs dokkan-text-muted">المتبقي</p>
                  <p
                    className="mt-1 text-sm font-bold"
                    style={{ color: 'var(--warning)' }}
                  >
                    {money(sale.remaining)}
                  </p>
                </div>

                <div>
                  <p className="text-xs dokkan-text-muted">الفرع</p>
                  <p className="mt-1 text-sm font-semibold">
                    {branch?.name || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 dokkan-text-muted">
                  {new Date(sale.created_at).toLocaleString('ar-EG')}
                </p>

                <button
                  type="button"
                  onClick={() => setSelected(sale)}
                  className="dokkan-primary w-full rounded-xl px-4 py-3 text-sm font-bold"
                >
                  {sale.status === 'returned'
                    ? 'عرض تفاصيل المرتجع'
                    : 'عرض تفاصيل الفاتورة'}
                </button>
              </div>
            </article>
          )
        })}

        {!filtered.length && (
          <div className="dokkan-card rounded-2xl border border-dashed p-8 text-center">
            <p className="font-bold">لا توجد فواتير في نتائج البحث</p>
            <p className="mt-2 text-sm dokkan-text-muted">
              جرّب تغيير البحث أو الفترة الزمنية.
            </p>
          </div>
        )}
      </section>

      {/* Invoice details modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 md:p-8"
          style={{ background: 'rgba(0,0,0,0.55)' }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="تفاصيل الفاتورة"
            className="invoice-print dokkan-card mx-auto my-2 w-full max-w-3xl rounded-2xl p-4 shadow-2xl sm:my-4 sm:p-6 md:p-8"
            style={{
              background: 'var(--card)',
              color: 'var(--foreground)',
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">
                {isFullyReturned
                  ? 'تفاصيل فاتورة المرتجع'
                  : 'تفاصيل الفاتورة'}
              </h2>

              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="dokkan-primary flex-1 rounded-xl px-4 py-3 text-sm font-bold sm:flex-none"
                >
                  {isFullyReturned ? 'طباعة المرتجع' : 'طباعة الفاتورة'}
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold transition sm:flex-none"
                  style={{ borderColor: 'var(--line)' }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* Invoice header */}
            <div
              className="border-b pb-5 text-center"
              style={{ borderColor: 'var(--line)' }}
            >
              <h1 className="break-words text-2xl font-extrabold sm:text-3xl">
                {storeName || 'اسم المتجر'}
              </h1>

              <h2
                className="mt-2 text-lg font-bold sm:text-xl"
                style={
                  isFullyReturned
                    ? { color: 'var(--danger)' }
                    : { color: 'var(--brand)' }
                }
              >
                {isFullyReturned ? 'فاتورة مرتجع' : 'فاتورة بيع'}
              </h2>

              <p className="mt-3 break-all text-sm font-bold">
                رقم فاتورة البيع الأصلية: {invoiceNumber(selected.id)}
              </p>

              <p className="mt-2 text-xs dokkan-text-muted sm:text-sm">
                تاريخ فاتورة البيع:{' '}
                {new Date(selected.created_at).toLocaleString('ar-EG')}
              </p>
            </div>

            {/* Customer and sale information */}
            <div
              className="grid min-w-0 grid-cols-1 gap-3 border-b py-5 text-sm sm:grid-cols-2"
              style={{ borderColor: 'var(--line)' }}
            >
              <p className="break-words">
                العميل:{' '}
                <strong>
                  {one(selected.dokkan_customers)?.name || 'عميل نقدي'}
                </strong>
              </p>

              <p className="break-words">
                الهاتف:{' '}
                <strong>
                  {one(selected.dokkan_customers)?.phone || '—'}
                </strong>
              </p>

              <p className="break-words">
                الفرع:{' '}
                <strong>
                  {one(selected.dokkan_branches)?.name || '—'}
                </strong>
              </p>

              <p className="break-words">
                طريقة الدفع الأصلية:{' '}
                <strong>{paymentLabel(selected.payment_method)}</strong>
              </p>

              <p className="break-words">
                حالة الفاتورة:{' '}
                <strong>{statusLabel(selected.status)}</strong>
              </p>
            </div>

            {/* Original sale items */}
            {!isFullyReturned && (
              <>
                <h3 className="pt-5 font-extrabold">
                  أصناف فاتورة البيع الأصلية
                </h3>

                <div className="overflow-x-auto py-4">
                  <table className="w-full min-w-[480px] text-right text-xs sm:text-sm">
                    <thead
                      style={{
                        background: 'var(--surface-secondary)',
                      }}
                    >
                      <tr>
                        <th className="p-3">الصنف</th>
                        <th className="p-3">الكمية</th>
                        <th className="p-3">سعر الوحدة</th>
                        <th className="p-3">الخصم</th>
                        <th className="p-3">الإجمالي</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selected.dokkan_sale_items.map((item) => {
                        const variant = one(item.dokkan_product_variants)
                        const product = one(variant?.dokkan_products)

                        const lineTotal =
                          Number(item.quantity) * Number(item.unit_price) -
                          Number(item.discount)

                        return (
                          <tr
                            key={item.id}
                            className="border-b"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            <td className="p-3">
                              <strong>{product?.name || 'منتج'}</strong>

                              <div className="mt-1 text-xs dokkan-text-muted">
                                {[
                                  variant?.size,
                                  variant?.color,
                                  variant?.sku,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </td>

                            <td className="p-3">
                              {Number(item.quantity).toLocaleString('ar-EG')}
                            </td>

                            <td className="p-3">
                              {money(item.unit_price)}
                            </td>

                            <td className="p-3">
                              {money(item.discount)}
                            </td>

                            <td className="p-3 font-bold">
                              {money(lineTotal)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial summary */}
                <div className="mr-auto w-full max-w-sm space-y-3 border-t pt-5 text-sm"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div className="flex justify-between gap-3">
                    <span className="dokkan-text-muted">المجموع الفرعي</span>
                    <strong>{money(selected.subtotal)}</strong>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="dokkan-text-muted">الخصم</span>
                    <strong>{money(selected.discount)}</strong>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="dokkan-text-muted">المبلغ بعد الخصم</span>
                    <strong>
                      {money(
                        Math.max(
                          0,
                          Number(selected.subtotal) -
                            Number(selected.discount)
                        )
                      )}
                    </strong>
                  </div>

                  <div className="flex justify-between gap-3">
                    <span className="dokkan-text-muted">
                      الضريبة{' '}
                      {selected.tax_enabled
                        ? `(${Number(selected.tax_rate || 0).toLocaleString('ar-EG')}%)`
                        : '(غير مفعلة)'}
                    </span>
                    <strong>{money(selected.tax_amount)}</strong>
                  </div>

                  <div
                    className="flex justify-between gap-3 border-t pt-3 text-base"
                    style={{ borderColor: 'var(--line)' }}
                  >
                    <span className="font-bold">
                      الإجمالي شامل الضريبة
                    </span>
                    <strong>{money(selected.total)}</strong>
                  </div>

                  <div
                    className="flex justify-between gap-3"
                    style={{ color: 'var(--success)' }}
                  >
                    <span>المبلغ المدفوع</span>
                    <strong>{money(selected.amount_paid)}</strong>
                  </div>

                  <div
                    className="print-hide flex justify-between gap-3"
                    style={{ color: 'var(--warning)' }}
                  >
                    <span>المبلغ المتبقي</span>
                    <strong>{money(selected.remaining)}</strong>
                  </div>
                </div>
              </>
            )}

            {/* Returns information */}
            {selectedReturns.length > 0 ? (
              <section
                className="mt-6 border-t-2 pt-5"
                style={{ borderColor: 'var(--danger-soft)' }}
              >
                <h3
                  className="text-lg font-extrabold"
                  style={{ color: 'var(--danger)' }}
                >
                  {isFullyReturned
                    ? 'تفاصيل المرتجع'
                    : 'المرتجعات المسجلة على الفاتورة'}
                </h3>

                {selectedReturns.map((record) => {
                  const returnValue =
                    record.dokkan_sale_return_items.reduce(
                      (sum, item) => sum + Number(item.amount || 0),
                      0
                    )

                  return (
                    <article
                      key={record.id}
                      className="mt-4 rounded-xl border p-4"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <div className="grid gap-3 text-sm sm:grid-cols-2">
                        <p>
                          رقم المرتجع:{' '}
                          <strong>{returnNumber(record.id)}</strong>
                        </p>

                        <p>
                          تاريخ المرتجع:{' '}
                          <strong>
                            {new Date(record.created_at).toLocaleString('ar-EG')}
                          </strong>
                        </p>

                        <p>
                          فاتورة البيع الأصلية:{' '}
                          <strong>{invoiceNumber(record.sale_id)}</strong>
                        </p>

                        <p>
                          طريقة رد المبلغ:{' '}
                          <strong>{paymentLabel(record.refund_method)}</strong>
                        </p>
                      </div>

                      <h4 className="mt-5 font-bold">الأصناف المرتجعة</h4>

                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[380px] text-right text-xs sm:text-sm">
                          <thead
                            style={{
                              background: 'var(--surface-secondary)',
                            }}
                          >
                            <tr>
                              <th className="p-3">الصنف</th>
                              <th className="p-3">الكمية المرتجعة</th>
                              <th className="p-3">القيمة</th>
                            </tr>
                          </thead>

                          <tbody>
                            {record.dokkan_sale_return_items.map(
                              (item, index) => {
                                const variant = one(
                                  item.dokkan_product_variants
                                )
                                const product = one(
                                  variant?.dokkan_products
                                )

                                return (
                                  <tr
                                    key={`${record.id}-${item.product_variant_id}-${index}`}
                                    className="border-b"
                                    style={{ borderColor: 'var(--line)' }}
                                  >
                                    <td className="p-3">
                                      <strong>
                                        {product?.name || 'منتج'}
                                      </strong>

                                      <div className="mt-1 text-xs dokkan-text-muted">
                                        {[
                                          variant?.size,
                                          variant?.color,
                                          variant?.sku,
                                        ]
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </div>
                                    </td>

                                    <td className="p-3">
                                      {Number(item.quantity).toLocaleString('ar-EG')}
                                    </td>

                                    <td className="p-3 font-bold">
                                      {money(item.amount)}
                                    </td>
                                  </tr>
                                )
                              }
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div
                        className="mt-4 space-y-2 border-t pt-4 text-sm"
                        style={{ borderColor: 'var(--line)' }}
                      >
                        <div className="flex justify-between gap-3">
                          <span className="dokkan-text-muted">
                            إجمالي قيمة الأصناف المرتجعة
                          </span>
                          <strong>{money(returnValue)}</strong>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="dokkan-text-muted">
                            المبلغ المردود للعميل
                          </span>
                          <strong>{money(record.refund_amount)}</strong>
                        </div>

                        <div className="flex justify-between gap-3">
                          <span className="dokkan-text-muted">
                            المخصوم من رصيد العميل
                          </span>
                          <strong>{money(record.applied_to_balance)}</strong>
                        </div>

                        <div
                          className="flex justify-between gap-3 border-t pt-3 text-base font-extrabold"
                          style={{
                            borderColor: 'var(--line)',
                            color: 'var(--danger)',
                          }}
                        >
                          <span>قيمة المرتجع</span>
                          <strong>{money(returnValue)}</strong>
                        </div>
                      </div>

                      {record.notes && (
                        <p className="mt-3 text-sm leading-6">
                          ملاحظات المرتجع: {record.notes}
                        </p>
                      )}

                      <p
                        className="mt-3 text-center text-xs font-bold"
                        style={{ color: 'var(--danger)' }}
                      >
                        إيصال مرتجع مرتبط بفاتورة البيع الأصلية
                      </p>
                    </article>
                  )
                })}
              </section>
            ) : (
              isFullyReturned && (
                <p
                  className="mt-6 rounded-xl p-4 text-center font-bold"
                  style={{
                    background: 'var(--danger-soft)',
                    color: 'var(--danger)',
                  }}
                >
                  حالة الفاتورة مسترجعة، لكن لم يتم العثور على سجل مرتجع
                  مرتبط بها. يرجى مراجعة بيانات المرتجع.
                </p>
              )
            )}

            {selected.notes && (
              <p
                className="mt-5 break-words border-t pt-4 text-sm leading-7"
                style={{ borderColor: 'var(--line)' }}
              >
                ملاحظات الفاتورة: {selected.notes}
              </p>
            )}

            {/* QR code */}
            <div
              className="mt-8 flex flex-col items-center border-t pt-6 text-center"
              style={{ borderColor: 'var(--line)' }}
            >
              <p className="mb-3 text-sm font-bold">
                {isFullyReturned ? 'كود عملية المرتجع' : 'كود الفاتورة'}
              </p>

              <QRCodeSVG
                value={
                  isFullyReturned
                    ? `DOKKAN|RETURN|${selectedReturns.map((record) => record.id).join(',')}`
                    : `DOKKAN|SALE|${selected.id}`
                }
                size={144}
                level="M"
                includeMargin
              />

              <p className="mt-2 text-xs font-semibold dokkan-text-muted">
                {isFullyReturned
                  ? selectedReturns
                      .map((record) => returnNumber(record.id))
                      .join(' - ')
                  : invoiceNumber(selected.id)}
              </p>
            </div>

            {/* Receipt footer */}
            <div
              className="mt-6 border-t pt-5 text-center"
              style={{ borderColor: 'var(--line)' }}
            >
              <p className="text-base font-extrabold">
                {isFullyReturned
                  ? 'تم تسجيل عملية المرتجع'
                  : 'شكرًا لزيارتكم'}
              </p>

              <p className="mt-3 text-sm font-bold">
                سياسة الاستبدال والاسترجاع
              </p>

              <p className="mt-1 text-sm dokkan-text-muted">
                الاستبدال والاسترجاع خلال 14 يومًا
              </p>

              <p className="mt-2 text-xs dokkan-text-muted">
                برجاء الاحتفاظ بالإيصال
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
