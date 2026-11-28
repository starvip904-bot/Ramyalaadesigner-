'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wallet,
  ReceiptText,
  Search,
  CalendarDays,
  Filter,
  RotateCcw,
  Plus,
  LoaderCircle,
  CircleDollarSign,
  Hash,
  type LucideIcon,
} from 'lucide-react'
import { createExpense } from '@/app/actions/expenses'

type Branch = {
  id: string
  name: string
}

type Expense = {
  id: string
  branch_id: string
  branchName: string
  title: string
  category: string
  amount: number
  notes: string | null
  created_at: string
}

type Props = {
  branches: Branch[]
  initialExpenses: Expense[]
}

const categories = [
  'إيجار',
  'رواتب',
  'كهرباء ومياه',
  'نقل وشحن',
  'صيانة',
  'تسويق',
  'تشغيل',
  'أخرى',
]

const money = (value: number) =>
  `${Number(value || 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

const categoryTone = (category: string) => {
  const tones: Record<string, { background: string; color: string }> = {
    'رواتب': { background: 'var(--info-soft)', color: 'var(--info)' },
    'إيجار': { background: 'var(--brand-soft)', color: 'var(--brand)' },
    'كهرباء ومياه': { background: 'var(--warning-soft)', color: 'var(--warning)' },
    'نقل وشحن': { background: 'var(--info-soft)', color: 'var(--info)' },
    'صيانة': { background: 'var(--danger-soft)', color: 'var(--danger)' },
    'تسويق': { background: 'var(--brand-soft)', color: 'var(--brand)' },
    'تشغيل': { background: 'var(--surface-secondary)', color: 'var(--muted-strong)' },
    'أخرى': { background: 'var(--surface-secondary)', color: 'var(--muted-strong)' },
  }

  return tones[category] || tones['أخرى']
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string
  icon: LucideIcon
}) {
  return (
    <article className="dokkan-card min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold dokkan-text-muted">{label}</p>
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          <Icon size={21} />
        </span>
      </div>
      <p className="mt-3 break-words text-xl font-extrabold sm:text-2xl">
        {value}
      </p>
    </article>
  )
}

export default function ExpensesPage({
  branches,
  initialExpenses,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [branchId, setBranchId] = useState(branches[0]?.id ?? '')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('تشغيل')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [filterBranch, setFilterBranch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const total = useMemo(
    () =>
      initialExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [initialExpenses]
  )

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase()

    return initialExpenses.filter((expense) => {
      const matchesSearch =
        !query ||
        [
          expense.title,
          expense.category,
          expense.branchName,
          expense.notes ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)

      const date = expense.created_at.slice(0, 10)
      const matchesFrom = !from || date >= from
      const matchesTo = !to || date <= to
      const matchesBranch =
        !filterBranch || expense.branch_id === filterBranch
      const matchesCategory =
        !filterCategory || expense.category === filterCategory

      return (
        matchesSearch &&
        matchesFrom &&
        matchesTo &&
        matchesBranch &&
        matchesCategory
      )
    })
  }, [
    initialExpenses,
    search,
    from,
    to,
    filterBranch,
    filterCategory,
  ])

  const filteredTotal = useMemo(
    () =>
      visibleExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      ),
    [visibleExpenses]
  )

  function resetFilters() {
    setSearch('')
    setFrom('')
    setTo('')
    setFilterBranch('')
    setFilterCategory('')
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')

    if (!branchId || !title.trim() || !category || !amount) {
      setErrorMessage('أكمل جميع البيانات المطلوبة.')
      return
    }

    const numericAmount = Number(amount)

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage('أدخل مبلغًا صحيحًا أكبر من صفر.')
      return
    }

    startTransition(async () => {
      try {
        const result = await createExpense({
          branchId,
          title: title.trim(),
          category,
          amount: numericAmount,
          notes: notes.trim(),
        })

        if (!result.ok) {
          setErrorMessage(result.message)
          return
        }

        setTitle('')
        setAmount('')
        setNotes('')
        setMessage(result.message)
        router.refresh()
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء حفظ المصروف.'
        )
      }
    })
  }

  const hasActiveFilters = Boolean(
    search || from || to || filterBranch || filterCategory
  )

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-7xl min-w-0 space-y-5 p-3 sm:space-y-6 sm:p-5 lg:p-6"
    >
      <header className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold dokkan-text-muted sm:text-sm">
            الإدارة المالية
          </p>
          <h1 className="mt-2 break-words text-xl font-extrabold sm:text-2xl">
            المصروفات
          </h1>
          <p className="mt-2 text-xs leading-6 dokkan-text-muted sm:text-sm">
            سجل مصروفات متجرك وتابع إجمالي المبالغ المسجلة لكل فرع.
          </p>
        </div>

        <span
          className="inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
        >
          <ReceiptText size={17} />
          {initialExpenses.length.toLocaleString('ar-EG')} مصروف
        </span>
      </header>

      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          label="إجمالي المصروفات المسجلة"
          value={money(total)}
          icon={CircleDollarSign}
        />
        <StatCard
          label="عدد المصروفات"
          value={initialExpenses.length.toLocaleString('ar-EG')}
          icon={Hash}
        />
      </section>

      <section className="dokkan-card min-w-0 p-4 sm:p-5">
        <div className="mb-5 flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            <Plus size={21} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold">إضافة مصروف جديد</h2>
            <p className="mt-1 text-xs leading-6 dokkan-text-muted">
              أدخل بيانات المصروف وسيتم تسجيله على الفرع المحدد.
            </p>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <label className="dokkan-label min-w-0 space-y-2">
            <span>الفرع</span>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              required
              className="dokkan-input"
            >
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span>اسم المصروف</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              placeholder="مثال: إيجار المحل"
              className="dokkan-input"
            />
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span>التصنيف</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              className="dokkan-input"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span>المبلغ بالجنيه</span>
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="dokkan-input"
            />
          </label>

          <label className="dokkan-label min-w-0 space-y-2 sm:col-span-2">
            <span>ملاحظات</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="ملاحظات اختيارية عن المصروف"
              className="dokkan-input resize-y"
            />
          </label>

          {errorMessage && (
            <p
              role="alert"
              className="dokkan-status-danger p-3 text-sm font-bold leading-6 sm:col-span-2"
            >
              {errorMessage}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="dokkan-status-success p-3 text-sm font-bold leading-6 sm:col-span-2"
            >
              {message}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending || branches.length === 0}
              className="dokkan-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold shadow-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isPending ? (
                <>
                  <LoaderCircle className="animate-spin" size={18} />
                  جارٍ حفظ المصروف...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  حفظ المصروف
                </>
              )}
            </button>
          </div>
        </form>

        {branches.length === 0 && (
          <p className="dokkan-status-warning mt-4 p-3 text-sm leading-6">
            لا يوجد فرع نشط يمكن تسجيل المصروف عليه.
          </p>
        )}
      </section>

      <section className="dokkan-card min-w-0 p-4 sm:p-5">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold">سجل المصروفات</h2>
            <p className="mt-1 text-xs dokkan-text-muted">
              عرض ومراجعة المصروفات المسجلة
            </p>
          </div>
          <span
            className="w-fit rounded-lg px-3 py-2 text-xs font-bold"
            style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}
          >
            {visibleExpenses.length.toLocaleString('ar-EG')} نتيجة
          </span>
        </div>

        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="dokkan-label min-w-0 space-y-2 sm:col-span-2">
            <span className="inline-flex items-center gap-2">
              <Search size={15} />
              البحث
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم المصروف أو التصنيف أو الفرع أو الملاحظات..."
              className="dokkan-input"
            />
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span className="inline-flex items-center gap-2">
              <Filter size={15} />
              الفرع
            </span>
            <select
              value={filterBranch}
              onChange={(event) => setFilterBranch(event.target.value)}
              className="dokkan-input"
            >
              <option value="">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span>التصنيف</span>
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="dokkan-input"
            >
              <option value="">كل التصنيفات</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={15} />
              من تاريخ
            </span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="dokkan-input"
            />
          </label>

          <label className="dokkan-label min-w-0 space-y-2">
            <span className="inline-flex items-center gap-2">
              <CalendarDays size={15} />
              إلى تاريخ
            </span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="dokkan-input"
            />
          </label>
        </div>

        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
          style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--line)',
          }}
        >
          <span className="text-xs font-semibold dokkan-text-muted">
            إجمالي النتائج المعروضة
          </span>
          <strong className="text-sm font-extrabold">
            {money(filteredTotal)}
          </strong>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold transition"
            style={{
              background: 'var(--surface-secondary)',
              color: 'var(--muted-strong)',
            }}
          >
            <RotateCcw size={14} />
            مسح البحث والفلاتر
          </button>
        )}

        {visibleExpenses.length > 0 && (
          <div className="dokkan-scrollbar mt-5 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[750px] text-right text-sm">
              <thead
                style={{
                  background: 'var(--table-header)',
                  color: 'var(--muted)',
                }}
              >
                <tr>
                  <th className="p-4 font-bold">المصروف</th>
                  <th className="p-4 font-bold">التصنيف</th>
                  <th className="p-4 font-bold">الفرع</th>
                  <th className="p-4 font-bold">التاريخ</th>
                  <th className="p-4 font-bold">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t transition-colors"
                    style={{
                      borderColor: 'var(--line)',
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = 'var(--table-row-hover)'
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <td className="max-w-xs p-4">
                      <p className="break-words font-bold">{expense.title}</p>
                      {expense.notes && (
                        <p className="mt-1 break-words text-xs leading-5 dokkan-text-muted">
                          {expense.notes}
                        </p>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold"
                        style={categoryTone(expense.category)}
                      >
                        {expense.category}
                      </span>
                    </td>
                    <td className="p-4">{expense.branchName}</td>
                    <td className="whitespace-nowrap p-4 text-xs dokkan-text-muted">
                      {new Date(expense.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="whitespace-nowrap p-4 font-extrabold">
                      {money(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleExpenses.length > 0 && (
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 lg:hidden">
            {visibleExpenses.map((expense) => (
              <article
                key={expense.id}
                className="dokkan-surface min-w-0 p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-extrabold">
                      {expense.title}
                    </h3>
                    <p className="mt-2 text-xs dokkan-text-muted">
                      {expense.branchName}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
                    style={categoryTone(expense.category)}
                  >
                    {expense.category}
                  </span>
                </div>

                <div
                  className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <div>
                    <p className="text-xs dokkan-text-muted">المبلغ</p>
                    <p className="mt-1 break-words text-base font-extrabold">
                      {money(expense.amount)}
                    </p>
                  </div>
                  <p className="text-xs dokkan-text-muted">
                    {new Date(expense.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>

                {expense.notes && (
                  <div
                    className="mt-3 rounded-lg p-3"
                    style={{ background: 'var(--surface-secondary)' }}
                  >
                    <p className="text-xs font-semibold dokkan-text-muted">
                      ملاحظات
                    </p>
                    <p className="mt-1 break-words text-sm leading-6">
                      {expense.notes}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {visibleExpenses.length === 0 && (
          <div
            className="mt-5 rounded-xl border border-dashed p-8 text-center"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--surface-secondary)',
            }}
          >
            <Wallet
              size={30}
              className="mx-auto"
              style={{ color: 'var(--muted)' }}
            />
            <p className="mt-3 font-bold">لا توجد مصروفات تطابق البحث</p>
            <p className="mt-2 text-xs leading-6 dokkan-text-muted">
              جرّب تغيير كلمات البحث أو الفلاتر المحددة.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
