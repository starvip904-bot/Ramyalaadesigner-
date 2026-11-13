
'use client'

import { useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
  status: string
}

type Sale = {
  id: string
  branch_id: string
  subtotal: number | string
  discount: number | string
  total: number | string
  status: string
  created_at: string
}

type SaleItem = {
  id: string
  sale_id: string
  product_variant_id: string
  quantity: number | string
  unit_price: number | string
  discount: number | string
  unit_cost: number | string | null
}

type SaleReturn = {
  id: string
  sale_id: string
  branch_id: string
  refund_amount: number | string
  created_at: string
}

type ReturnItem = {
  id: string
  return_id: string
  product_variant_id: string
  quantity: number | string
  amount: number | string
}

type Expense = {
  id: string
  branch_id: string
  title: string
  category: string
  amount: number | string
  created_at: string
}

type Props = {
  branches: Branch[]
  sales: Sale[]
  saleItems: SaleItem[]
  returns: SaleReturn[]
  returnItems: ReturnItem[]
  expenses: Expense[]
}

const number = (value: number | string | null | undefined) =>
  Number(value ?? 0)

const money = (value: number) =>
  `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

function cairoDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function inDateRange(
  value: string,
  from: string,
  to: string
) {
  const date = cairoDate(value)

  if (!date) return false
  if (from && date < from) return false
  if (to && date > to) return false

  return true
}

function Metric({
  label,
  value,
  description,
  accent = 'slate',
}: {
  label: string
  value: string
  description?: string
  accent?: 'slate' | 'blue' | 'red' | 'green' | 'orange'
}) {
  const accents = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
    orange: 'bg-orange-50 text-orange-700',
  }

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold leading-6 text-slate-500 sm:text-sm">
          {label}
        </p>

        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${accents[accent]}`} />
      </div>

      <p className="mt-3 break-words text-lg font-extrabold leading-8 text-slate-900 sm:text-xl">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
      )}
    </article>
  )
}

export default function ReportsPage({
  branches,
  sales,
  saleItems,
  returns,
  returnItems,
  expenses,
}: Props) {
  const [branchId, setBranchId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const report = useMemo(() => {
    const selectedSales = sales.filter((sale) =>
      (branchId === 'all' || sale.branch_id === branchId) &&
      inDateRange(sale.created_at, from, to) &&
      !['cancelled', 'canceled', 'void'].includes(
        sale.status.toLowerCase()
      )
    )

    const selectedReturns = returns.filter((item) =>
      (branchId === 'all' || item.branch_id === branchId) &&
      inDateRange(item.created_at, from, to)
    )

    const selectedExpenses = expenses.filter((expense) =>
      (branchId === 'all' || expense.branch_id === branchId) &&
      inDateRange(expense.created_at, from, to)
    )

    const selectedSaleIds = new Set(
      selectedSales.map((sale) => sale.id)
    )

    const selectedReturnIds = new Set(
      selectedReturns.map((item) => item.id)
    )

    const selectedSaleItems = saleItems.filter((item) =>
      selectedSaleIds.has(item.sale_id)
    )

    const selectedReturnItems = returnItems.filter((item) =>
      selectedReturnIds.has(item.return_id)
    )

    const saleItemsBySaleAndVariant = new Map<string, SaleItem>()

    for (const item of saleItems) {
      saleItemsBySaleAndVariant.set(
        `${item.sale_id}:${item.product_variant_id}`,
        item
      )
    }

    const returnsById = new Map(
      selectedReturns.map((item) => [item.id, item])
    )

    let soldCost = 0
    let missingSaleCostCount = 0

    for (const item of selectedSaleItems) {
      if (item.unit_cost === null || item.unit_cost === undefined) {
        missingSaleCostCount += 1
        continue
      }

      soldCost += number(item.quantity) * number(item.unit_cost)
    }

    let returnedCost = 0
    let missingReturnCostCount = 0

    for (const item of selectedReturnItems) {
      const parentReturn = returnsById.get(item.return_id)

      if (!parentReturn) continue

      const originalItem = saleItemsBySaleAndVariant.get(
        `${parentReturn.sale_id}:${item.product_variant_id}`
      )

      if (
        !originalItem ||
        originalItem.unit_cost === null ||
        originalItem.unit_cost === undefined
      ) {
        missingReturnCostCount += 1
        continue
      }

      returnedCost +=
        number(item.quantity) * number(originalItem.unit_cost)
    }

    const salesTotal = selectedSales.reduce(
      (sum, sale) => sum + number(sale.total),
      0
    )

    const returnsTotal = selectedReturns.reduce(
      (sum, item) => sum + number(item.refund_amount),
      0
    )

    const netSales = salesTotal - returnsTotal
    const netCost = soldCost - returnedCost

    const expensesTotal = selectedExpenses.reduce(
      (sum, item) => sum + number(item.amount),
      0
    )

    const grossProfit = netSales - netCost
    const netProfit = grossProfit - expensesTotal

    const missingCostCount =
      missingSaleCostCount + missingReturnCostCount

    return {
      salesTotal,
      returnsTotal,
      netSales,
      soldCost,
      returnedCost,
      netCost,
      expensesTotal,
      grossProfit,
      netProfit,
      salesCount: selectedSales.length,
      returnsCount: selectedReturns.length,
      expensesCount: selectedExpenses.length,
      missingCostCount,
      missingSaleCostCount,
      missingReturnCostCount,
    }
  }, [
    sales,
    saleItems,
    returns,
    returnItems,
    expenses,
    branchId,
    from,
    to,
  ])

  function resetFilters() {
    setBranchId('all')
    setFrom('')
    setTo('')
  }

  const hasFilters = branchId !== 'all' || from !== '' || to !== ''

  return (
    <main
      className="mx-auto w-full max-w-7xl min-w-0 space-y-5 p-3 sm:space-y-6 sm:p-5 lg:p-6"
      dir="rtl"
    >
      {/* عنوان الصفحة */}
      <header>
        <p className="text-xs font-semibold text-slate-500 sm:text-sm">
          الإدارة المالية
        </p>

        <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-2xl">
          التقارير والأرباح
        </h1>

        <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
          متابعة المبيعات والمرتجعات وتكلفة البضاعة والمصروفات وصافي الربح.
        </p>
      </header>

      {/* الفلاتر */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4">
          <h2 className="font-extrabold text-slate-900">
            تحديد فترة التقرير
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            اختر الفرع والفترة التي تريد مراجعة نتائجها.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            الفرع

            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none transition focus:border-blue-500"
            >
              <option value="all">كل الفروع</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            من تاريخ

            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-base outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            إلى تاريخ

            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-base outline-none transition focus:border-blue-500"
            />
          </label>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-4 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
          >
            إعادة ضبط الفلاتر
          </button>
        )}
      </section>

      {/* أهم النتائج */}
      <section>
        <div className="mb-3">
          <h2 className="font-extrabold text-slate-900">
            ملخص النتائج المالية
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            النتائج حسب الفرع والفترة المحددين.
          </p>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="إجمالي المبيعات"
            value={money(report.salesTotal)}
            description={`${report.salesCount.toLocaleString('ar-EG')} فاتورة`}
            accent="blue"
          />

          <Metric
            label="قيمة المرتجعات"
            value={money(report.returnsTotal)}
            description={`${report.returnsCount.toLocaleString('ar-EG')} عملية إرجاع`}
            accent="red"
          />

          <Metric
            label="صافي المبيعات"
            value={money(report.netSales)}
            description="المبيعات بعد خصم المرتجعات"
            accent="green"
          />

          <Metric
            label="تكلفة البضاعة المباعة"
            value={money(report.soldCost)}
            description="حسب التكلفة المحفوظة وقت البيع"
          />

          <Metric
            label="تكلفة البضاعة المرتجعة"
            value={money(report.returnedCost)}
            description="تُخصم من تكلفة البضاعة المباعة"
            accent="orange"
          />

          <Metric
            label="صافي تكلفة البضاعة"
            value={money(report.netCost)}
          />

          <Metric
            label="المصروفات"
            value={money(report.expensesTotal)}
            description={`${report.expensesCount.toLocaleString('ar-EG')} مصروف`}
            accent="red"
          />

          <Metric
            label="مجمل الربح المعروف"
            value={money(report.grossProfit)}
            description="صافي المبيعات ناقص صافي تكلفة البضاعة"
            accent="green"
          />

          <Metric
            label="صافي الربح المعروف"
            value={money(report.netProfit)}
            description="مجمل الربح المعروف ناقص المصروفات"
            accent="green"
          />
        </div>
      </section>

      {/* تنبيه التكلفة */}
      {report.missingCostCount > 0 && (
        <section
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg text-amber-800">
              !
            </span>

            <div className="min-w-0">
              <h2 className="font-extrabold text-amber-900">
                تنبيه: حساب الربح غير مكتمل
              </h2>

              <p className="mt-2 text-xs leading-7 text-amber-800 sm:text-sm">
                يوجد {report.missingCostCount.toLocaleString('ar-EG')} بند بيع أو مرتجع
                لا تتوفر له تكلفة تاريخية محفوظة.
                الأرقام المعروضة للربح هي الربح المعروف من البنود التي تتوفر
                تكلفتها فقط، وليست صافي الربح النهائي المؤكد.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 text-xs font-semibold text-amber-900 sm:grid-cols-2">
                <p className="rounded-lg bg-amber-100/70 p-3">
                  بنود بيع بلا تكلفة:
                  {' '}
                  {report.missingSaleCostCount.toLocaleString('ar-EG')}
                </p>

                <p className="rounded-lg bg-amber-100/70 p-3">
                  بنود مرتجعات بلا تكلفة:
                  {' '}
                  {report.missingReturnCostCount.toLocaleString('ar-EG')}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {report.missingCostCount === 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-bold text-emerald-700">
              ✓
            </span>

            <div>
              <h2 className="text-sm font-extrabold text-emerald-900">
                بيانات التكلفة مكتملة
              </h2>

              <p className="mt-1 text-xs leading-6 text-emerald-800">
                تتوفر التكلفة التاريخية لجميع بنود البيع والمرتجعات في الفترة المحددة.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* طريقة الحساب */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-extrabold text-slate-900">
          ملخص طريقة الحساب
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          المعادلات المستخدمة في التقرير.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">
              صافي المبيعات
            </p>

            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
              إجمالي المبيعات − قيمة المرتجعات
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">
              صافي تكلفة البضاعة
            </p>

            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
              تكلفة المبيعات − تكلفة البضاعة المرتجعة
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">
              مجمل الربح
            </p>

            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
              صافي المبيعات − صافي تكلفة البضاعة
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-500">
              صافي الربح
            </p>

            <p className="mt-2 text-sm font-bold leading-6 text-slate-800">
              مجمل الربح − المصروفات
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-lg border border-slate-100 p-3 text-xs leading-6 text-slate-500">
          ملاحظة: الأرقام تعتمد على البيانات المسجلة في النظام والتكلفة التاريخية
          المحفوظة لكل بند بيع أو مرتجع.
        </p>
      </section>
    </main>
  )
}
