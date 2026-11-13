
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

const invoiceNumber = (id: string) => `INV-${id.slice(0, 8).toUpperCase()}`

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
    <main dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
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
            background: white !important;
            color: black !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <header className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">إدارة المتجر</p>
          <h1 className="mt-1 text-2xl font-extrabold">المبيعات والفواتير</h1>
          <p className="mt-1 text-sm text-slate-500">
            سجل فواتير البيع المحفوظة في قاعدة البيانات
          </p>
        </div>
        <span className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700">
          {filtered.length.toLocaleString('ar-EG')} فاتورة
        </span>
      </header>

      <section className="no-print grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">إجمالي المبيعات المعروضة</p>
          <p className="mt-2 text-xl font-extrabold">{money(totalSales)}</p>
        </article>
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">إجمالي المدفوع</p>
          <p className="mt-2 text-xl font-extrabold text-green-700">{money(totalPaid)}</p>
        </article>
        <article className="rounded-2xl border bg-white p-4">
          <p className="text-sm text-slate-500">إجمالي المتبقي</p>
          <p className="mt-2 text-xl font-extrabold text-orange-600">{money(totalRemaining)}</p>
        </article>
      </section>

      <section className="no-print space-y-3 rounded-2xl border bg-white p-4">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث برقم الفاتورة أو اسم العميل أو رقم الهاتف..."
          className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-600">
            من تاريخ
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            إلى تاريخ
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-2 w-full rounded-xl border p-3"
            />
          </label>
        </div>
      </section>

      <section className="no-print overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-right text-sm">
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
                  <tr key={sale.id} className="border-t hover:bg-slate-50">
                    <td className="p-4 font-bold">{invoiceNumber(sale.id)}</td>
                    <td className="p-4">{customer?.name || 'عميل نقدي'}</td>
                    <td className="p-4">{branch?.name || '—'}</td>
                    <td className="p-4">
                      {new Date(sale.created_at).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-4 font-bold">{money(sale.total)}</td>
                    <td className="p-4 text-green-700">{money(sale.amount_paid)}</td>
                    <td className="p-4 text-orange-600">{money(sale.remaining)}</td>
                    <td className="p-4">{statusLabel(sale.status)}</td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelected(sale)}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white"
                      >
                        عرض الفاتورة
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-500">
                    لا توجد فواتير في نتائج البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-3 md:p-8">
          <section className="invoice-print mx-auto my-4 max-w-3xl rounded-2xl bg-white p-5 shadow-2xl md:p-8">
            <div className="no-print mb-5 flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">تفاصيل الفاتورة</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white"
                >
                  طباعة
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-xl border px-4 py-2 font-bold"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div className="border-b pb-5 text-center">
              <p className="text-sm font-semibold text-slate-500">
                التاريخ والوقت
              </p>
              <p className="mt-1 text-sm font-bold">
                {new Date(selected.created_at).toLocaleString('ar-EG')}
              </p>

              <h1 className="mt-5 text-3xl font-extrabold">
                {storeName || 'اسم المتجر'}
              </h1>

              <h2 className="mt-3 text-xl font-bold">فاتورة بيع</h2>

              <p className="mt-2 font-bold">
                رقم الفاتورة: {invoiceNumber(selected.id)}
              </p>
            </div>

            <div className="grid gap-3 border-b py-5 text-sm sm:grid-cols-2">
              <p>
                العميل: <strong>{one(selected.dokkan_customers)?.name || 'عميل نقدي'}</strong>
              </p>
              <p>
                الهاتف: <strong>{one(selected.dokkan_customers)?.phone || '—'}</strong>
              </p>
              <p>
                الفرع: <strong>{one(selected.dokkan_branches)?.name || '—'}</strong>
              </p>
              <p>
                طريقة الدفع: <strong>{paymentLabel(selected.payment_method)}</strong>
              </p>
            </div>

            <div className="overflow-x-auto py-5">
              <table className="w-full min-w-[500px] text-right text-sm">
                <thead className="bg-slate-50">
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
                      <tr key={item.id} className="border-b">
                        <td className="p-3">
                          <strong>{product?.name || 'منتج'}</strong>
                          <div className="text-xs text-slate-500">
                            {[variant?.size, variant?.color, variant?.sku]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="p-3">{Number(item.quantity)}</td>
                        <td className="p-3">{money(item.unit_price)}</td>
                        <td className="p-3">{money(item.discount)}</td>
                        <td className="p-3 font-bold">{money(lineTotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mr-auto max-w-sm space-y-3 border-t pt-5 text-sm">
              <div className="flex justify-between">
                <span>المجموع الفرعي</span>
                <strong>{money(selected.subtotal)}</strong>
              </div>
              <div className="flex justify-between">
                <span>الخصم</span>
                <strong>{money(selected.discount)}</strong>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg">
                <span>الإجمالي</span>
                <strong>{money(selected.total)}</strong>
              </div>
              <div className="flex justify-between text-green-700">
                <span>المدفوع</span>
                <strong>{money(selected.amount_paid)}</strong>
              </div>
              <div className="flex justify-between text-orange-600">
                <span>المتبقي</span>
                <strong>{money(selected.remaining)}</strong>
              </div>
            </div>

            {selected.notes && (
              <p className="mt-5 border-t pt-4 text-sm">
                ملاحظات: {selected.notes}
              </p>
            )}

            <div className="mt-8 flex flex-col items-center border-t pt-6 text-center">
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

            <p className="mt-6 text-center text-sm text-slate-500">
              شكراً لتعاملكم معنا
            </p>
          </section>
        </div>
      )}
    </main>
  )
}
