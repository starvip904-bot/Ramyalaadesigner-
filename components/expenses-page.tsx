
'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
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

const categoryStyle = (category: string) => {
  if (category === 'رواتب') return 'bg-blue-50 text-blue-700'
  if (category === 'إيجار') return 'bg-purple-50 text-purple-700'
  if (category === 'كهرباء ومياه') return 'bg-yellow-50 text-yellow-700'
  if (category === 'نقل وشحن') return 'bg-orange-50 text-orange-700'
  if (category === 'صيانة') return 'bg-red-50 text-red-700'
  if (category === 'تسويق') return 'bg-pink-50 text-pink-700'
  return 'bg-slate-100 text-slate-700'
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
          المصروفات
        </h1>

        <p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">
          سجل مصروفات متجرك وتابع إجمالي المبالغ المسجلة لكل فرع.
        </p>
      </header>

      {/* ملخص المصروفات */}
      <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              إجمالي المصروفات المسجلة
            </p>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-lg text-red-600">
              <span aria-hidden="true">−</span>
            </span>
          </div>

          <p className="mt-3 break-words text-xl font-extrabold text-slate-900 sm:text-2xl">
            {money(total)}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            جميع المصروفات المسجلة
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              عدد المصروفات
            </p>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
              #
            </span>
          </div>

          <p className="mt-3 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {initialExpenses.length.toLocaleString('ar-EG')}
          </p>

          <p className="mt-1 text-xs text-slate-400">
            عدد السجلات المسجلة
          </p>
        </article>
      </section>

      {/* إضافة مصروف */}
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-5">
          <h2 className="text-lg font-extrabold text-slate-900">
            إضافة مصروف جديد
          </h2>

          <p className="mt-1 text-xs leading-6 text-slate-500">
            أدخل بيانات المصروف وسيتم تسجيله على الفرع المحدد.
          </p>
        </div>

        <form onSubmit={submit} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700">
            الفرع

            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              required
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none transition focus:border-blue-500"
            >
              <option value="">اختر الفرع</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700">
            اسم المصروف

            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              placeholder="مثال: إيجار المحل"
              className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-base outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700">
            التصنيف

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none transition focus:border-blue-500"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700">
            المبلغ بالجنيه

            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="w-full min-w-0 rounded-xl border border-slate-200 p-3 text-base outline-none transition focus:border-blue-500"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            ملاحظات

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="ملاحظات اختيارية عن المصروف"
              className="w-full min-w-0 resize-y rounded-xl border border-slate-200 p-3 text-base outline-none transition focus:border-blue-500"
            />
          </label>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700 sm:col-span-2"
            >
              {errorMessage}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold leading-6 text-green-700 sm:col-span-2"
            >
              {message}
            </p>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={isPending || branches.length === 0}
              className="w-full rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isPending ? 'جارٍ حفظ المصروف...' : 'حفظ المصروف'}
            </button>
          </div>
        </form>

        {branches.length === 0 && (
          <p className="mt-4 rounded-xl bg-orange-50 p-3 text-sm leading-6 text-orange-700">
            لا يوجد فرع نشط يمكن تسجيل المصروف عليه.
          </p>
        )}
      </section>

      {/* سجل المصروفات */}
      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              سجل المصروفات
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              عرض ومراجعة المصروفات المسجلة
            </p>
          </div>

          <span className="w-fit rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
            {visibleExpenses.length.toLocaleString('ar-EG')} نتيجة
          </span>
        </div>

        {/* البحث والفلاتر */}
        <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600 sm:col-span-2">
            البحث

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم المصروف أو التصنيف أو الفرع أو الملاحظات..."
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-base outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            الفرع

            <select
              value={filterBranch}
              onChange={(event) => setFilterBranch(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
            >
              <option value="">كل الفروع</option>

              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            التصنيف

            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
            >
              <option value="">كل التصنيفات</option>

              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
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
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
            />
          </label>

          <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-600">
            إلى تاريخ

            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-base outline-none focus:border-blue-500"
            />
          </label>
        </div>

        {/* إجمالي النتائج بعد الفلترة */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <span className="text-xs font-semibold text-slate-500">
            إجمالي النتائج المعروضة
          </span>

          <strong className="text-sm font-extrabold text-slate-900">
            {money(filteredTotal)}
          </strong>
        </div>

        {(search || from || to || filterBranch || filterCategory) && (
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 rounded-lg bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
          >
            مسح البحث والفلاتر
          </button>
        )}

        {/* جدول الكمبيوتر */}
        {visibleExpenses.length > 0 && (
          <div className="mt-5 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[750px] text-right text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">المصروف</th>
                  <th className="p-4">التصنيف</th>
                  <th className="p-4">الفرع</th>
                  <th className="p-4">التاريخ</th>
                  <th className="p-4">المبلغ</th>
                </tr>
              </thead>

              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr
                    key={expense.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="max-w-xs p-4">
                      <p className="break-words font-bold text-slate-900">
                        {expense.title}
                      </p>

                      {expense.notes && (
                        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                          {expense.notes}
                        </p>
                      )}
                    </td>

                    <td className="p-4">
                      <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${categoryStyle(expense.category)}`}>
                        {expense.category}
                      </span>
                    </td>

                    <td className="p-4">
                      {expense.branchName}
                    </td>

                    <td className="whitespace-nowrap p-4 text-xs text-slate-600">
                      {new Date(expense.created_at).toLocaleDateString('ar-EG')}
                    </td>

                    <td className="whitespace-nowrap p-4 font-extrabold text-slate-900">
                      {money(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* بطاقات الموبايل والتابلت */}
        {visibleExpenses.length > 0 && (
          <div className="mt-5 grid min-w-0 grid-cols-1 gap-3 lg:hidden">
            {visibleExpenses.map((expense) => (
              <article
                key={expense.id}
                className="min-w-0 rounded-xl border border-slate-200 p-4"
              >
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-extrabold text-slate-900">
                      {expense.title}
                    </h3>

                    <p className="mt-2 text-xs text-slate-500">
                      {expense.branchName}
                    </p>
                  </div>

                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${categoryStyle(expense.category)}`}>
                    {expense.category}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      المبلغ
                    </p>

                    <p className="mt-1 break-words text-base font-extrabold text-slate-900">
                      {money(expense.amount)}
                    </p>
                  </div>

                  <p className="text-xs text-slate-500">
                    {new Date(expense.created_at).toLocaleDateString('ar-EG')}
                  </p>
                </div>

                {expense.notes && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500">
                      ملاحظات
                    </p>

                    <p className="mt-1 break-words text-sm leading-6 text-slate-700">
                      {expense.notes}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {visibleExpenses.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="font-bold text-slate-700">
              لا توجد مصروفات تطابق البحث
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-500">
              جرّب تغيير كلمات البحث أو الفلاتر المحددة.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
