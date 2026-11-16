
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  RefreshCw,
  FileText,
  Wallet,
  TrendingUp,
  Clock,
  Phone,
  MapPin,
  CreditCard,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { getSupplierStatementAction } from '@/app/actions/purchases'

type Payment = {
  id: string
  amount: number
  payment_method: 'cash' | 'card' | 'transfer'
  notes: string | null
  created_at: string
}

type Invoice = {
  id: string
  status: string
  total: number
  amount_paid: number
  remaining: number
  notes: string | null
  created_at: string
  posted_at: string | null
  branch: {
    id: string
    name: string
  } | null
  payments: Payment[]
}

type Statement = {
  supplier: {
    id: string
    name: string
    phone: string | null
    address: string | null
    notes: string | null
  }
  summary: {
    received_invoice_total: number
    total_paid: number
    advance_paid: number
    unreceived_invoice_total: number
    balance: number
  }
  invoices: Invoice[]
}

function money(value: number) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function date(value: string) {
  if (!value) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function paymentMethod(value: string) {
  if (value === 'cash') return 'نقدي'
  if (value === 'card') return 'بطاقة'
  if (value === 'transfer') return 'تحويل بنكي'
  return value
}

function invoiceStatus(value: string) {
  const statuses: Record<string, string> = {
    pending: 'بانتظار الاستلام',
    paid: 'مدفوعة',
    received: 'تم الاستلام',
    partially_received: 'استلام جزئي',
    cancelled: 'ملغاة',
  }

  return statuses[value] || value
}

export default function SupplierStatementPage({
  supplierId,
}: {
  supplierId: string
}) {
  const router = useRouter()

  const [data, setData] = useState<Statement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadStatement() {
    if (!supplierId) {
      setError('المورد غير محدد.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await getSupplierStatementAction(supplierId)
      setData(result as Statement)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل كشف حساب المورد.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadStatement()
  }, [supplierId])

  if (loading) {
    return (
      <section dir="rtl" className="flex min-h-72 items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
          <RefreshCw size={20} className="animate-spin" />
          جارٍ تحميل كشف حساب المورد...
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section dir="rtl" className="space-y-4">
        <button
          type="button"
          onClick={() => router.push('/suppliers')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700"
        >
          <ArrowRight size={17} />
          العودة للموردين
        </button>

        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold leading-7 text-red-700">
          <AlertCircle size={20} className="mt-1 shrink-0" />
          {error || 'لا توجد بيانات لعرضها.'}
        </div>

        <button
          type="button"
          onClick={loadStatement}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
        >
          إعادة المحاولة
        </button>
      </section>
    )
  }

  const summary = data.summary
  const invoices = data.invoices || []

  return (
    <section dir="rtl" className="space-y-5 sm:space-y-6">
      <header className="rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-white p-4 sm:p-6">
        <button
          type="button"
          onClick={() => router.push('/suppliers')}
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-900"
        >
          <ArrowRight size={17} />
          العودة إلى الموردين
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <FileText size={25} />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                كشف حساب المورد
              </h2>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {data.supplier.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadStatement}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            تحديث الكشف
          </button>
        </div>

        <div className="mt-4 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          {data.supplier.phone && (
            <p className="flex items-center gap-2">
              <Phone size={15} />
              {data.supplier.phone}
            </p>
          )}

          {data.supplier.address && (
            <p className="flex items-center gap-2">
              <MapPin size={15} />
              {data.supplier.address}
            </p>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="إجمالي الفواتير المستلمة"
          value={money(summary.received_invoice_total)}
          icon={<FileText size={21} />}
        />

        <SummaryCard
          title="إجمالي الدفعات"
          value={money(summary.total_paid)}
          icon={<Wallet size={21} />}
        />

        <SummaryCard
          title="الرصيد المستحق"
          value={money(summary.balance)}
          icon={<TrendingUp size={21} />}
          emphasis
        />

        <SummaryCard
          title="دفعات مقدمة"
          value={money(summary.advance_paid)}
          icon={<CreditCard size={21} />}
        />

        <SummaryCard
          title="فواتير لم يتم استلامها"
          value={money(summary.unreceived_invoice_total)}
          icon={<Clock size={21} />}
        />

        <SummaryCard
          title="عدد الفواتير"
          value={String(invoices.length)}
          icon={<CheckCircle2 size={21} />}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <h3 className="font-extrabold text-slate-900">
            فواتير المورد والدفعات
          </h3>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            كل دفعة معروضة تحت فاتورة الشراء المرتبطة بها.
          </p>
        </div>

        <div className="space-y-4 p-3 sm:p-5">
          {invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="rounded-2xl border border-slate-200 p-3 sm:p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-slate-900">
                    فاتورة شراء
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {invoice.id}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {date(invoice.created_at)}
                  </p>
                </div>

                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                  {invoiceStatus(invoice.status)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
                <Amount label="إجمالي الفاتورة" value={money(invoice.total)} />
                <Amount label="المدفوع" value={money(invoice.amount_paid)} />
                <Amount label="المتبقي" value={money(invoice.remaining)} />
                <Amount
                  label="الفرع"
                  value={invoice.branch?.name || '—'}
                />
              </div>

              {invoice.notes && (
                <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                  ملاحظات الفاتورة: {invoice.notes}
                </p>
              )}

              <div className="mt-4">
                <h4 className="mb-3 text-sm font-extrabold text-slate-800">
                  سجل الدفعات ({invoice.payments?.length || 0})
                </h4>

                {invoice.payments?.length ? (
                  <div className="space-y-2">
                    {invoice.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {money(payment.amount)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {date(payment.created_at)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {paymentMethod(payment.payment_method)}
                          </p>
                          {payment.notes && (
                            <p className="mt-1 text-xs text-slate-500">
                              {payment.notes}
                            </p>
                          )}
                        </div>

                        <span className="rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                          دفعة مسجلة
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                    لا توجد دفعات مسجلة لهذه الفاتورة.
                  </p>
                )}
              </div>
            </article>
          ))}

          {!invoices.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <FileText size={30} className="mx-auto text-slate-400" />
              <p className="mt-3 font-bold text-slate-700">
                لا توجد فواتير مسجلة لهذا المورد
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
        الرصيد محسوب من فواتير الشراء المستلمة والدفعات المسجلة المرتبطة بالفواتير.
        الدفعات المقدمة على الفواتير غير المستلمة تظهر منفصلة. مرتجعات المشتريات
        غير مدرجة في هذا الكشف حتى يتم إنشاء دورة مرتجعات واعتمادها.
      </p>
    </section>
  )
}

function SummaryCard({
  title,
  value,
  icon,
  emphasis = false,
}: {
  title: string
  value: string
  icon: React.ReactNode
  emphasis?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        emphasis
          ? 'border-blue-200'
          : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-500">{title}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          {icon}
        </div>
      </div>
      <p className={`mt-3 break-words text-lg font-extrabold ${
        emphasis ? 'text-blue-700' : 'text-slate-900'
      }`}>
        {value}
      </p>
    </div>
  )
}

function Amount({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-extrabold text-slate-800">
        {value}
      </p>
    </div>
  )
}
