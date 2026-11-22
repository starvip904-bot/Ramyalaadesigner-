
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
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-extrabold text-slate-900">
        {value}
      </p>
      {description && (
        <p className="mt-2 text-xs text-slate-500">{description}</p>
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
    branches,
    sales,
    saleItems,
    returns,
    returnItems,
    expenses,
    branchId,
    from,
    to,
  ])

  return (
    <div className="space-y-6" dir="rtl">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">
          التقارير والأرباح
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          متابعة المبيعات والمرتجعات وتكلفة البضاعة والمصروفات وصافي الربح.
        </p>
      </header>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="flex flex-col gap-2 text-sm font-semibold">
          الفرع
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <option value="all">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          من تاريخ
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-xl border border-slate-200 p-3"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm font-semibold">
          إلى تاريخ
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            min={from || undefined}
            className="rounded-xl border border-slate-200 p-3"
          />
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          label="إجمالي المبيعات"
          value={money(report.salesTotal)}
          description={`${report.salesCount.toLocaleString('ar-EG')} فاتورة`}
        />

        <Metric
          label="قيمة المرتجعات"
          value={money(report.returnsTotal)}
          description={`${report.returnsCount.toLocaleString('ar-EG')} عملية إرجاع`}
        />

        <Metric
          label="صافي المبيعات"
          value={money(report.netSales)}
          description="المبيعات بعد خصم المرتجعات"
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
        />

        <Metric
          label="صافي تكلفة البضاعة"
          value={money(report.netCost)}
        />

        <Metric
          label="المصروفات"
          value={money(report.expensesTotal)}
          description={`${report.expensesCount.toLocaleString('ar-EG')} مصروف`}
        />

        <Metric
          label="مجمل الربح المعروف"
          value={money(report.grossProfit)}
          description="صافي المبيعات ناقص صافي تكلفة البضاعة"
        />

        <Metric
          label="صافي الربح المعروف"
          value={money(report.netProfit)}
          description="مجمل الربح المعروف ناقص المصروفات"
        />
      </section>

      {report.missingCostCount > 0 && (
        <section
          role="alert"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-5"
        >
          <h2 className="font-extrabold text-amber-900">
            تنبيه: حساب الربح غير مكتمل
          </h2>

          <p className="mt-2 text-sm leading-7 text-amber-800">
            يوجد {report.missingCostCount.toLocaleString('ar-EG')} بند
            بيع أو مرتجع لا تتوفر له تكلفة تاريخية محفوظة.
            الأرقام المعروضة للربح هي الربح المعروف من البنود التي تتوفر
            تكلفتها فقط، وليست صافي الربح النهائي المؤكد.
          </p>

          <p className="mt-2 text-xs text-amber-800">
            بنود بيع بلا تكلفة: {report.missingSaleCostCount.toLocaleString('ar-EG')}
            {' — '}
            بنود مرتجعات بلا تكلفة: {report.missingReturnCostCount.toLocaleString('ar-EG')}
          </p>
        </section>
      )}

      {report.missingCostCount === 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          تتوفر التكلفة التاريخية لجميع بنود البيع والمرتجعات في الفترة المحددة.
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-extrabold text-slate-900">
          ملخص طريقة الحساب
        </h2>

        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>صافي المبيعات = إجمالي المبيعات − قيمة المرتجعات.</p>
          <p>صافي تكلفة البضاعة = تكلفة المبيعات − تكلفة البضاعة المرتجعة.</p>
          <p>مجمل الربح = صافي المبيعات − صافي تكلفة البضاعة.</p>
          <p>صافي الربح = مجمل الربح − المصروفات.</p>
        </div>
      </section>
    </div>
  )
}
