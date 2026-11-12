
'use client'

import { useState, useTransition, type FormEvent } from 'react'
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
  `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ج.م`

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
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const total = initialExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0
  )

  const visibleExpenses = initialExpenses.filter((expense) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    return [
      expense.title,
      expense.category,
      expense.branchName,
      expense.notes ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setErrorMessage('')

    if (!branchId || !title.trim() || !category || !amount) {
      setErrorMessage('أكمل جميع البيانات المطلوبة')
      return
    }

    const numericAmount = Number(amount)

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage('أدخل مبلغًا صحيحًا أكبر من صفر')
      return
    }

    startTransition(async () => {
      const result = await createExpense({
        branchId,
        title,
        category,
        amount: numericAmount,
        notes,
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
    })
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">
          المصروفات
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          سجل مصروفات متجرك وتابع إجمالي المبالغ المسجلة.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            إجمالي المصروفات المسجلة
          </p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">
            {money(total)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            عدد المصروفات
          </p>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">
            {initialExpenses.length.toLocaleString('ar-EG')}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-extrabold">
          إضافة مصروف جديد
        </h2>

        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">
            الفرع
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              required
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <option value="">اختر الفرع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            اسم المصروف
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={150}
              placeholder="مثال: إيجار المحل"
              className="rounded-xl border border-slate-200 p-3"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            التصنيف
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            المبلغ بالجنيه
            <input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              className="rounded-xl border border-slate-200 p-3"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold md:col-span-2">
            ملاحظات
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="ملاحظات اختيارية عن المصروف"
              className="rounded-xl border border-slate-200 p-3"
            />
          </label>

          {errorMessage && (
            <p role="alert" className="text-sm font-bold text-red-600 md:col-span-2">
              {errorMessage}
            </p>
          )}

          {message && (
            <p role="status" className="text-sm font-bold text-emerald-700 md:col-span-2">
              {message}
            </p>
          )}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={isPending || branches.length === 0}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'جارٍ الحفظ...' : 'حفظ المصروف'}
            </button>
          </div>
        </form>

        {branches.length === 0 && (
          <p className="mt-4 text-sm text-amber-700">
            لا يوجد فرع نشط يمكن تسجيل المصروف عليه.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">
            سجل المصروفات
          </h2>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث في المصروفات..."
            className="w-full rounded-xl border border-slate-200 p-3 text-sm sm:w-72"
          />
        </div>

        {visibleExpenses.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            لا توجد مصروفات مسجلة تطابق البحث.
          </p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="p-3">المصروف</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">الفرع</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المبلغ</th>
                </tr>
              </thead>

              <tbody>
                {visibleExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-slate-100">
                    <td className="p-3 font-bold">
                      {expense.title}
                      {expense.notes && (
                        <p className="mt-1 text-xs font-normal text-slate-500">
                          {expense.notes}
                        </p>
                      )}
                    </td>
                    <td className="p-3">{expense.category}</td>
                    <td className="p-3">{expense.branchName}</td>
                    <td className="p-3">
                      {new Date(expense.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="p-3 font-extrabold">
                      {money(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
