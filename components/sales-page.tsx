
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

const paymentLabel = (value: string) => ({
  cash: 'نقدي',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
  transfer: 'تحويل بنكي',
}[value] || value)

const statusLabel = (value: string) => ({
  completed: 'مكتملة',
  returned: 'مسترجعة',
  partially_returned: 'مرتجع جزئي',
}[value] || value)

const statusStyle = (value: string) => {
  if (value === 'returned') {
    return 'bg-red-50 text-red-700'
  }

  if (value === 'partially_returned') {
    return 'bg-orange-50 text-orange-700'
  }

  return 'bg-green-50 text-green-700'
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
        {label}
      </p>

      <p className={`mt-2 break-words text-lg font-extrabold sm:text-xl ${color || 'text-slate-900'}`}>
        {value}
      </p>
    </article>
  )
}

export default function SalesPage({
  initialSales,
  storeName,
}: {
  initialSales: DokkanSale[]
  storeName: string
}) {
  const [sales] = useState(initialSales)
  const [selected, setSelected] = useState<DokkanSale | null>(null)
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

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

          .no-print {
            display: none !important;
          }

          .invoice-print table {
            page-break-inside: auto;
          }

          .invoice-print tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* عنوان الصفحة */}
      <header className="no-print flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500 sm:text-sm">
            إدارة المتجر
          </p>

          <h1 className="mt-2 break-words text-xl font-extrabold text-slate-900 sm:text-2xl">
            المبيعات والفواتير
          </h1>

          <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
            سجل فواتير البيع المحفوظة في قاعدة البيانات
          </p>
        </div>

        <span className="w-fit rounded-xl bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700">
          {filtered.length.toLocaleString('ar-EG')} فاتورة
        </span>
      </header>

      {/* ملخص المبيعات */}
      <section className="no-print grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="إجمالي المبيعات المعروضة"
          value={money(totalSales)}
        />

        <StatCard
          label="إجمالي المدفوع"
          value={money(totalPaid)}
          color="text-green-700"
        />

        <StatCard
          label="إجمالي المتبقي"
          value={money(totalRemaining)}
          color="text-orange-600"
        />
      </section>

      {/* البحث والفلاتر */}
      <section className="no-print min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div>
          <label className="mb-2 block text-sm font-bold text-slate-700">
            البحث عن فاتورة
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="رقم الفاتورة أو اسم العميل أو رقم الهاتف..."
            aria-label="البحث عن فاتورة"
            className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="min-w-0 text-sm font-semibold text-slate-600">
            من تاريخ

            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
            />
          </label>

          <label className="min-w-0 text-sm font-semibold text-slate-600">
            إلى تاريخ

            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2 w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
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
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
          >
            مسح البحث والفلاتر
          </button>
        )}
      </section>

      {/* جدول الفواتير للكمبيوتر */}
      <section className="no-print hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-sm">
            <thead className="bg-slate-50 text-slate-500">
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
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="p-4 font-bold text-slate-900">
                      {invoiceNumber(sale.id)}
                    </td>

                    <td className="p-4">
                      {customer?.name || 'عميل نقدي'}
                    </td>

                    <td className="p-4">
                      {branch?.name || '—'}
                    </td>

                    <td className="p-4 text-xs text-slate-600">
                      {new Date(sale.created_at).toLocaleString('ar-EG')}
                    </td>

                    <td className="p-4 font-bold">
                      {money(sale.total)}
                    </td>

                    <td className="p-4 font-semibold text-green-700">
                      {money(sale.amount_paid)}
                    </td>

                    <td className="p-4 font-semibold text-orange-600">
                      {money(sale.remaining)}
                    </td>

                    <td className="p-4">
                      <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(sale.status)}`}>
                        {statusLabel(sale.status)}
                      </span>
                    </td>

                    <td className="p-4">
                      <button
                        type="button"
                        onClick={() => setSelected(sale)}
                        className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 font-bold text-white transition hover:bg-blue-700"
                      >
                        عرض الفاتورة
                      </button>
                    </td>
                  </tr>
                )
              })}

              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500">
                    لا توجد فواتير في نتائج البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* بطاقات الفواتير للموبايل والتابلت */}
      <section className="no-print grid min-w-0 grid-cols-1 gap-3 lg:hidden">
        {filtered.map((sale) => {
          const customer = one(sale.dokkan_customers)
          const branch = one(sale.dokkan_branches)

          return (
            <article
              key={sale.id}
              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-extrabold text-slate-900">
                    {invoiceNumber(sale.id)}
                  </p>

                  <p className="mt-2 break-words text-sm font-semibold text-slate-700">
                    {customer?.name || 'عميل نقدي'}
                  </p>
                </div>

                <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${statusStyle(sale.status)}`}>
                  {statusLabel(sale.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">الإجمالي</p>
                  <p className="mt-1 break-words text-sm font-extrabold text-slate-900">
                    {money(sale.total)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">المدفوع</p>
                  <p className="mt-1 break-words text-sm font-bold text-green-700">
                    {money(sale.amount_paid)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">المتبقي</p>
                  <p className="mt-1 break-words text-sm font-bold text-orange-600">
                    {money(sale.remaining)}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-slate-500">الفرع</p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                    {branch?.name || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">
                  {new Date(sale.created_at).toLocaleString('ar-EG')}
                </p>

                <button
                  type="button"
                  onClick={() => setSelected(sale)}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:w-auto"
                >
                  عرض تفاصيل الفاتورة
                </button>
              </div>
            </article>
          )
        })}

        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-bold text-slate-700">
              لا توجد فواتير في نتائج البحث
            </p>

            <p className="mt-2 text-sm text-slate-500">
              جرّب تغيير البحث أو الفترة الزمنية.
            </p>
          </div>
        )}
      </section>

      {/* تفاصيل الفاتورة */}
      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-2 sm:p-4 md:p-8">
          <section className="invoice-print mx-auto my-2 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-2xl sm:my-4 sm:p-6 md:p-8">
            <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-slate-900">
                تفاصيل الفاتورة
              </h2>

              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 sm:flex-none"
                >
                  طباعة الفاتورة
                </button>

                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
                >
                  إغلاق
                </button>
              </div>
            </div>

            {/* رأس الفاتورة */}
            <div className="border-b border-slate-200 pb-5 text-center">
              <h1 className="break-words text-2xl font-extrabold text-slate-900 sm:text-3xl">
                {storeName || 'اسم المتجر'}
              </h1>

              <h2 className="mt-2 text-lg font-bold sm:text-xl">
                فاتورة بيع
              </h2>

              <p className="mt-3 break-all text-sm font-bold">
                رقم الفاتورة: {invoiceNumber(selected.id)}
              </p>

              <p className="mt-2 text-xs text-slate-600 sm:text-sm">
                التاريخ والوقت:{' '}
                {new Date(selected.created_at).toLocaleString('ar-EG')}
              </p>
            </div>

            {/* بيانات العميل */}
            <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-slate-200 py-5 text-sm sm:grid-cols-2">
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
                طريقة الدفع:{' '}
                <strong>
                  {paymentLabel(selected.payment_method)}
                </strong>
              </p>

              <p className="break-words">
                حالة الفاتورة:{' '}
                <strong>{statusLabel(selected.status)}</strong>
              </p>
            </div>

            {/* أصناف الفاتورة */}
            <div className="overflow-x-auto py-5">
              <table className="w-full min-w-[480px] text-right text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-700">
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
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="p-3">
                          <strong>
                            {product?.name || 'منتج'}
                          </strong>

                          <div className="mt-1 text-xs text-slate-500">
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

            {/* إجماليات الفاتورة */}
            <div className="mr-auto w-full max-w-sm space-y-3 border-t border-slate-200 pt-5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-600">المجموع الفرعي</span>
                <strong>{money(selected.subtotal)}</strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-slate-600">الخصم</span>
                <strong>{money(selected.discount)}</strong>
              </div>

              <div className="flex justify-between gap-3 border-t border-slate-200 pt-3 text-base">
                <span className="font-bold">الإجمالي</span>
                <strong>{money(selected.total)}</strong>
              </div>

              <div className="flex justify-between gap-3 text-green-700">
                <span>المبلغ المدفوع</span>
                <strong>{money(selected.amount_paid)}</strong>
              </div>

              <div className="flex justify-between gap-3 text-orange-600">
                <span>المبلغ المتبقي</span>
                <strong>{money(selected.remaining)}</strong>
              </div>

              <p className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${Number(selected.remaining) > 0 ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'}`}>
                {Number(selected.remaining) > 0
                  ? 'الفاتورة بها مبلغ متبقٍ'
                  : 'الفاتورة مدفوعة بالكامل'}
              </p>
            </div>

            {/* ملاحظات */}
            {selected.notes && (
              <p className="mt-5 break-words border-t border-slate-200 pt-4 text-sm leading-7">
                ملاحظات: {selected.notes}
              </p>
            )}

            {/* QR */}
            <div className="mt-8 flex flex-col items-center border-t border-slate-200 pt-6 text-center">
              <p className="mb-3 text-sm font-bold">
                امسح الكود للتعرف على الفاتورة
              </p>

              <QRCodeSVG
                value={`DOKKAN|SALE|${selected.id}`}
                size={144}
                level="M"
                includeMargin
              />

              <p className="mt-2 text-xs font-semibold text-slate-600">
                {invoiceNumber(selected.id)}
              </p>
            </div>

            {/* تذييل الفاتورة */}
            <div className="mt-6 border-t border-slate-200 pt-5 text-center">
              <p className="text-base font-extrabold">
                شكرًا لزيارتكم
              </p>

              <p className="mt-3 text-sm font-bold">
                سياسة الاستبدال والاسترجاع
              </p>

              <p className="mt-1 text-sm text-slate-600">
                الاستبدال والاسترجاع خلال 14 يومًا
              </p>

              <p className="mt-2 text-xs text-slate-500">
                برجاء الاحتفاظ بالفاتورة
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
