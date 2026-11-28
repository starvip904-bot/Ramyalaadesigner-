
'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Filter,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

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

function inDateRange(value: string, from: string, to: string) {
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
  icon: Icon = Wallet,
}: {
  label: string
  value: string
  description?: string
  accent?: 'slate' | 'blue' | 'red' | 'green' | 'orange'
  icon?: typeof Wallet
}) {
  const accents = {
    slate: {
      icon: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
    blue: {
      icon: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
      border: 'border-blue-100 dark:border-blue-900/60',
    },
    red: {
      icon: 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300',
      border: 'border-red-100 dark:border-red-900/60',
    },
    green: {
      icon: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
      border: 'border-emerald-100 dark:border-emerald-900/60',
    },
    orange: {
      icon: 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300',
      border: 'border-orange-100 dark:border-orange-900/60',
    },
  }

  const style = accents[accent]

  return (
    <article
      className={`min-w-0 rounded-2xl border ${style.border} bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900 sm:p-5`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold leading-6 text-slate-500 dark:text-slate-400 sm:text-sm">
          {label}
        </p>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon size={19} />
        </span>
      </div>

      <p className="mt-3 break-words text-lg font-extrabold leading-8 text-slate-900 dark:text-white sm:text-xl">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </article>
  )
}

function ReportSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white sm:text-lg">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs leading-6 text-slate-500 dark:text-slate-400 sm:text-sm">
            {description}
          </p>
        )}
      </div>

      {children}
    </section>
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
    const selectedSales = sales.filter(
      (sale) =>
        (branchId === 'all' || sale.branch_id === branchId) &&
        inDateRange(sale.created_at, from, to) &&
        !['cancelled', 'canceled', 'void'].includes(
          sale.status.toLowerCase()
        )
    )

    const selectedReturns = returns.filter(
      (item) =>
        (branchId === 'all' || item.branch_id === branchId) &&
        inDateRange(item.created_at, from, to)
    )

    const selectedExpenses = expenses.filter(
      (expense) =>
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

  const selectedBranch =
    branchId === 'all'
      ? 'كل الفروع'
      : branches.find((branch) => branch.id === branchId)?.name ??
        'الفرع المحدد'

  const periodLabel =
    from || to
      ? `${from || 'بداية الفترة'} — ${to || 'حتى الآن'}`
      : 'كل الفترات'

  return (
    <main
      className="mx-auto w-full max-w-7xl min-w-0 space-y-7 p-3 sm:space-y-8 sm:p-5 lg:p-6"
      dir="rtl"
    >
      {/* Page header */}
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              <BarChart3 size={24} />
            </div>

            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                الإدارة المالية
              </p>

              <h1 className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white sm:text-2xl">
                التقارير والأرباح
              </h1>

              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400 sm:text-sm">
                متابعة المبيعات والمرتجعات وتكلفة البضاعة والمصروفات وصافي الربح.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <CalendarDays size={15} />
              {periodLabel}
            </span>

            <span className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Filter size={15} />
              {selectedBranch}
            </span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Filter size={19} />
          </div>

          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-white">
              تحديد فترة التقرير
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              اختر الفرع والفترة التي تريد مراجعة نتائجها.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            الفرع

            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="all">كل الفروع</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            من تاريخ

            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
            إلى تاريخ

            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>
        </div>

        {hasFilters && (
          <div className="mt-4 flex justify-start">
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw size={15} />
              إعادة ضبط الفلاتر
            </button>
          </div>
        )}
      </section>

      {/* Main metrics */}
      <ReportSection
        title="ملخص النتائج المالية"
        description="النتائج محسوبة حسب الفرع والفترة المحددين."
      >
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Metric
            label="إجمالي المبيعات"
            value={money(report.salesTotal)}
            description={`${report.salesCount.toLocaleString('ar-EG')} فاتورة`}
            accent="blue"
            icon={TrendingUp}
          />

          <Metric
            label="قيمة المرتجعات"
            value={money(report.returnsTotal)}
            description={`${report.returnsCount.toLocaleString('ar-EG')} عملية إرجاع`}
            accent="red"
            icon={TrendingDown}
          />

          <Metric
            label="صافي المبيعات"
            value={money(report.netSales)}
            description="المبيعات بعد خصم المرتجعات"
            accent="green"
            icon={Wallet}
          />

          <Metric
            label="تكلفة البضاعة المباعة"
            value={money(report.soldCost)}
            description="حسب التكلفة المحفوظة وقت البيع"
            icon={Wallet}
          />

          <Metric
            label="تكلفة البضاعة المرتجعة"
            value={money(report.returnedCost)}
            description="تُخصم من تكلفة البضاعة المباعة"
            accent="orange"
            icon={TrendingDown}
          />

          <Metric
            label="صافي تكلفة البضاعة"
            value={money(report.netCost)}
            description="بعد خصم تكلفة المرتجعات"
            icon={BarChart3}
          />

          <Metric
            label="المصروفات"
            value={money(report.expensesTotal)}
            description={`${report.expensesCount.toLocaleString('ar-EG')} مصروف`}
            accent="red"
            icon={Wallet}
          />

          <Metric
            label="مجمل الربح المعروف"
            value={money(report.grossProfit)}
            description="صافي المبيعات ناقص صافي تكلفة البضاعة"
            accent="green"
            icon={TrendingUp}
          />

          <Metric
            label="صافي الربح المعروف"
            value={money(report.netProfit)}
            description="مجمل الربح المعروف ناقص المصروفات"
            accent="green"
            icon={BarChart3}
          />
        </div>
      </ReportSection>

      {/* Missing cost warning */}
      {report.missingCostCount > 0 && (
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              <CircleAlert size={21} />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="font-extrabold text-amber-900 dark:text-amber-200">
                تنبيه: حساب الربح غير مكتمل
              </h2>

              <p className="mt-2 text-xs leading-7 text-amber-800 dark:text-amber-300 sm:text-sm">
                يوجد {report.missingCostCount.toLocaleString('ar-EG')} بند بيع أو مرتجع
                لا تتوفر له تكلفة تاريخية محفوظة. الأرقام المعروضة للربح هي
                الربح المعروف من البنود التي تتوفر تكلفتها فقط، وليست صافي
                الربح النهائي المؤكد.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p className="rounded-xl bg-amber-100/80 p-3 text-xs font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                  بنود بيع بلا تكلفة:{' '}
                  {report.missingSaleCostCount.toLocaleString('ar-EG')}
                </p>

                <p className="rounded-xl bg-amber-100/80 p-3 text-xs font-bold text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                  بنود مرتجعات بلا تكلفة:{' '}
                  {report.missingReturnCostCount.toLocaleString('ar-EG')}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {report.missingCostCount === 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <CheckCircle2 size={21} />
            </span>

            <div>
              <h2 className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                بيانات التكلفة مكتملة
              </h2>

              <p className="mt-1 text-xs leading-6 text-emerald-800 dark:text-emerald-300">
                تتوفر التكلفة التاريخية لجميع بنود البيع والمرتجعات في الفترة المحددة.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Calculation details */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <BarChart3 size={19} />
          </div>

          <div>
            <h2 className="font-extrabold text-slate-900 dark:text-white">
              ملخص طريقة الحساب
            </h2>

            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              المعادلات المستخدمة في التقرير.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              صافي المبيعات
            </p>

            <p className="mt-2 text-sm font-extrabold leading-6 text-slate-800 dark:text-slate-100">
              إجمالي المبيعات − قيمة المرتجعات
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              صافي تكلفة البضاعة
            </p>

            <p className="mt-2 text-sm font-extrabold leading-6 text-slate-800 dark:text-slate-100">
              تكلفة المبيعات − تكلفة البضاعة المرتجعة
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              مجمل الربح
            </p>

            <p className="mt-2 text-sm font-extrabold leading-6 text-slate-800 dark:text-slate-100">
              صافي المبيعات − صافي تكلفة البضاعة
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              صافي الربح
            </p>

            <p className="mt-2 text-sm font-extrabold leading-6 text-slate-800 dark:text-slate-100">
              مجمل الربح − المصروفات
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-xl border border-slate-100 bg-white p-3 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
          ملاحظة: الأرقام تعتمد على البيانات المسجلة في النظام والتكلفة التاريخية
          المحفوظة لكل بند بيع أو مرتجع.
        </p>
      </section>
    </main>
  )
}
