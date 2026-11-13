
'use client'

import { useMemo, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  UserCheck,
  UserX,
  Users,
  X,
  Clock3,
  Phone,
  Store,
  UserRound,
  RefreshCw,
} from 'lucide-react'
import EmployeeMonthlyAttendancePanel from '@/components/employee-monthly-attendance-panel'
import {
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
} from '@/app/actions/employees'

type EmployeeRole = 'manager' | 'cashier' | 'stock_manager' | 'viewer'
type EmployeeStatus = 'active' | 'inactive'

type Employee = {
  id: string
  name: string
  phone: string | null
  role: EmployeeRole
  status: EmployeeStatus
  branch_id: string | null
  created_at: string
  updated_at: string
}

type Branch = {
  id: string
  name: string
  status: string
}

type Props = {
  storeId: string
  initialEmployees: Employee[]
  branches: Branch[]
}

const roleLabels: Record<EmployeeRole, string> = {
  manager: 'مدير',
  cashier: 'كاشير',
  stock_manager: 'مسؤول مخزون',
  viewer: 'مشاهد',
}

const emptyForm = {
  name: '',
  phone: '',
  role: 'cashier' as EmployeeRole,
  branchId: '',
}

type ActiveTab = 'employees' | 'attendance'

export default function EmployeesManagementPage({
  initialEmployees,
  branches,
}: Props) {
  const [employees, setEmployees] = useState(initialEmployees)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('employees')

  const activeBranches = branches.filter(
    (branch) => branch.status === 'active'
  )

  const activeCount = employees.filter(
    (item) => item.status === 'active'
  ).length

  const inactiveCount = employees.length - activeCount

  const filteredEmployees = useMemo(() => {
    const search = query.trim().toLowerCase()

    if (!search) return employees

    return employees.filter((employee) => {
      const branchName =
        branches.find((branch) => branch.id === employee.branch_id)?.name || ''

      return `${employee.name} ${employee.phone || ''} ${branchName} ${
        roleLabels[employee.role]
      }`.toLowerCase().includes(search)
    })
  }, [employees, query, branches])

  function openAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
    setModal(true)
  }

  function openEdit(employee: Employee) {
    setEditingId(employee.id)
    setForm({
      name: employee.name,
      phone: employee.phone || '',
      role: employee.role,
      branchId: employee.branch_id || '',
    })
    setError('')
    setModal(true)
  }

  async function saveEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (form.name.trim().length < 2) {
      setError('اكتب اسم الموظف بشكل صحيح')
      return
    }

    setLoading(true)

    try {
      const input = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        branchId: form.branchId || null,
      }

      if (editingId) {
        await updateEmployee(editingId, input)
      } else {
        await createEmployee(input)
      }

      window.location.reload()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الموظف'
      )
      setLoading(false)
    }
  }

  async function toggleStatus(employee: Employee) {
    const nextStatus: EmployeeStatus =
      employee.status === 'active' ? 'inactive' : 'active'

    const confirmed = window.confirm(
      nextStatus === 'inactive'
        ? 'هل تريد إيقاف هذا الموظف؟'
        : 'هل تريد إعادة تفعيل هذا الموظف؟'
    )

    if (!confirmed) return

    setError('')
    setLoading(true)

    try {
      await setEmployeeStatus(employee.id, nextStatus)
      setEmployees((current) =>
        current.map((item) =>
          item.id === employee.id
            ? { ...item, status: nextStatus }
            : item
        )
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحديث حالة الموظف'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6" dir="rtl">
      {/* Page heading */}
      <header className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                إدارة الموظفين
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">
                إدارة بيانات فريق العمل ومتابعة الحضور والانصراف
              </p>
            </div>
          </div>

          {activeTab === 'employees' && (
            <button
              type="button"
              onClick={openAdd}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
            >
              <Plus size={19} />
              إضافة موظف جديد
            </button>
          )}
        </div>
      </header>

      {/* Main tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('employees')}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
            activeTab === 'employees'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Users size={18} />
          إدارة الموظفين
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-bold transition sm:text-sm ${
            activeTab === 'attendance'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:bg-white/60'
          }`}
        >
          <Clock3 size={18} />
          الحضور والانصراف
        </button>
      </div>

      {activeTab === 'attendance' ? (
        <EmployeeMonthlyAttendancePanel
          employees={employees}
          branches={branches}
        />
      ) : (
        <>
          {/* Employee summary */}
          <section className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-10 sm:w-10">
                <Users size={20} />
              </div>
              <p className="text-[11px] leading-5 text-slate-500 sm:text-sm">
                إجمالي الموظفين
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-slate-900 sm:text-2xl">
                {employees.length}
              </p>
            </div>

            <div className="rounded-2xl border border-green-100 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600 sm:h-10 sm:w-10">
                <UserCheck size={20} />
              </div>
              <p className="text-[11px] leading-5 text-slate-500 sm:text-sm">
                موظفون نشطون
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-green-700 sm:text-2xl">
                {activeCount}
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-white p-3 shadow-sm sm:p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 sm:h-10 sm:w-10">
                <UserX size={20} />
              </div>
              <p className="text-[11px] leading-5 text-slate-500 sm:text-sm">
                موظفون متوقفون
              </p>
              <p className="mt-1 text-xl font-extrabold tabular-nums text-red-600 sm:text-2xl">
                {inactiveCount}
              </p>
            </div>
          </section>

          {/* Information note */}
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-6 text-amber-800 sm:p-4 sm:text-sm">
            <div className="mt-0.5 shrink-0">
              <UserRound size={19} />
            </div>
            <p>
              بيانات الموظفين هنا مخصصة لتنظيم فريق العمل والحضور والانصراف.
              إضافة الموظف لا تنشئ له حساب دخول أو صلاحيات دخول فعلية للنظام.
            </p>
          </div>

          {error && !modal && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          {/* Employee list */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-3 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-extrabold text-slate-900">
                    قائمة الموظفين
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {filteredEmployees.length} موظف
                    {query.trim() ? ' مطابق للبحث' : ' مسجل'}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                  <Users size={18} />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={18} className="shrink-0 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث بالاسم أو الهاتف أو الفرع..."
                  className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="مسح البحث"
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200"
                  >
                    <X size={16} />
                  </button>
                )}
              </label>
            </div>

            <div className="space-y-3 p-3 sm:p-5">
              {filteredEmployees.map((employee) => {
                const branch = branches.find(
                  (item) => item.id === employee.branch_id
                )

                return (
                  <article
                    key={employee.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:shadow-sm sm:p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <UserRound size={22} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="break-words font-extrabold text-slate-900">
                            {employee.name}
                          </h4>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              employee.status === 'active'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {employee.status === 'active' ? 'نشط' : 'متوقف'}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Phone size={14} />
                            {employee.phone || 'لا يوجد هاتف'}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Store size={14} />
                            {branch?.name || 'غير محدد'}
                          </span>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                            {roleLabels[employee.role]}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEdit(employee)}
                        disabled={loading}
                        className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 sm:text-sm"
                      >
                        <Pencil size={15} />
                        تعديل البيانات
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleStatus(employee)}
                        disabled={loading}
                        className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:opacity-50 sm:text-sm ${
                          employee.status === 'active'
                            ? 'border-red-100 text-red-600 hover:bg-red-50'
                            : 'border-green-100 text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {employee.status === 'active' ? (
                          <>
                            <UserX size={15} />
                            إيقاف الموظف
                          </>
                        ) : (
                          <>
                            <UserCheck size={15} />
                            إعادة التفعيل
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                )
              })}

              {filteredEmployees.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                    <Search size={22} />
                  </div>
                  <p className="font-bold text-slate-700">
                    لا يوجد موظفون مطابقون
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    جرّب البحث باسم أو رقم هاتف مختلف
                  </p>
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="mt-4 rounded-lg px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      مسح البحث
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Add / Edit modal */}
          {modal && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={(event) => {
                if (event.target === event.currentTarget && !loading) {
                  setModal(false)
                }
              }}
            >
              <form
                onSubmit={saveEmployee}
                className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      {editingId ? <Pencil size={19} /> : <Plus size={21} />}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-900">
                        {editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        أدخل بيانات الموظف الأساسية
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModal(false)}
                    disabled={loading}
                    aria-label="إغلاق"
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X size={19} />
                  </button>
                </div>

                <label className="block space-y-2 text-sm font-bold text-slate-700">
                  اسم الموظف
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    placeholder="اكتب اسم الموظف"
                  />
                </label>

                <label className="block space-y-2 text-sm font-bold text-slate-700">
                  رقم الهاتف
                  <span className="font-normal text-slate-400"> (اختياري)</span>
                  <input
                    maxLength={40}
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                  />
                </label>

                <label className="block space-y-2 text-sm font-bold text-slate-700">
                  طبيعة العمل
                  <select
                    value={form.role}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        role: event.target.value as EmployeeRole,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="cashier">كاشير</option>
                    <option value="stock_manager">مسؤول مخزون</option>
                    <option value="manager">مدير</option>
                    <option value="viewer">مشاهد</option>
                  </select>
                </label>

                <label className="block space-y-2 text-sm font-bold text-slate-700">
                  الفرع
                  <select
                    value={form.branchId}
                    onChange={(event) =>
                      setForm({ ...form, branchId: event.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">غير محدد</option>
                    {activeBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setModal(false)}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        جارٍ الحفظ...
                      </>
                    ) : (
                      'حفظ البيانات'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )
}
