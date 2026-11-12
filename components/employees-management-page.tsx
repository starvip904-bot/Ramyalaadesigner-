
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
} from 'lucide-react'
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

  const activeBranches = branches.filter(
    (branch) => branch.status === 'active'
  )

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
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold">الموظفون</h2>
          <p className="mt-1 text-sm text-slate-500">
            سجل موظفي متجرك وتوزيعهم على الفروع
          </p>
        </div>

        <button
          onClick={openAdd}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white"
        >
          <Plus size={18} />
          إضافة موظف
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-800">
        الأدوار المعروضة هنا للتنظيم وتحديد طبيعة عمل الموظف فقط.
        لا يتم إنشاء حساب دخول للموظف ولا تمنحه هذه البيانات صلاحيات
        دخول فعلية للنظام.
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4">
          <Users className="mb-3 text-blue-600" />
          <p className="text-sm text-slate-500">إجمالي الموظفين</p>
          <p className="mt-1 text-2xl font-extrabold">{employees.length}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <UserCheck className="mb-3 text-green-600" />
          <p className="text-sm text-slate-500">موظفون نشطون</p>
          <p className="mt-1 text-2xl font-extrabold">
            {employees.filter((item) => item.status === 'active').length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <UserX className="mb-3 text-red-500" />
          <p className="text-sm text-slate-500">موظفون متوقفون</p>
          <p className="mt-1 text-2xl font-extrabold">
            {employees.filter((item) => item.status === 'inactive').length}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border px-3 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الموظف أو الهاتف أو الفرع..."
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <div className="mt-5 space-y-3">
          {filteredEmployees.map((employee) => {
            const branch = branches.find(
              (item) => item.id === employee.branch_id
            )

            return (
              <div
                key={employee.id}
                className="flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-extrabold">{employee.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {employee.phone || 'لا يوجد هاتف'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-blue-50 px-3 py-1 font-bold text-blue-700">
                      {roleLabels[employee.role]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                      {branch?.name || 'كل الفروع / غير محدد'}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 font-bold ${
                        employee.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {employee.status === 'active' ? 'نشط' : 'متوقف'}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(employee)}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
                  >
                    <Pencil size={16} />
                    تعديل
                  </button>

                  <button
                    onClick={() => toggleStatus(employee)}
                    disabled={loading}
                    className="rounded-lg border px-3 py-2 text-sm font-bold"
                  >
                    {employee.status === 'active' ? 'إيقاف' : 'تفعيل'}
                  </button>
                </div>
              </div>
            )
          })}

          {filteredEmployees.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              لا يوجد موظفون مطابقون للبحث
            </div>
          )}
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveEmployee}
            className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold">
                {editingId ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setModal(false)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>

            <label className="block space-y-2 text-sm font-bold">
              اسم الموظف
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
                placeholder="اسم الموظف"
              />
            </label>

            <label className="block space-y-2 text-sm font-bold">
              رقم الهاتف (اختياري)
              <input
                maxLength={40}
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
                placeholder="رقم الهاتف"
              />
            </label>

            <label className="block space-y-2 text-sm font-bold">
              طبيعة العمل
              <select
                value={form.role}
                onChange={(event) =>
                  setForm({
                    ...form,
                    role: event.target.value as EmployeeRole,
                  })
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
              >
                <option value="cashier">كاشير</option>
                <option value="stock_manager">مسؤول مخزون</option>
                <option value="manager">مدير</option>
                <option value="viewer">مشاهد</option>
              </select>
            </label>

            <label className="block space-y-2 text-sm font-bold">
              الفرع
              <select
                value={form.branchId}
                onChange={(event) =>
                  setForm({ ...form, branchId: event.target.value })
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
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
              <p className="text-sm font-bold text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              {loading ? 'جارٍ الحفظ...' : 'حفظ البيانات'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
