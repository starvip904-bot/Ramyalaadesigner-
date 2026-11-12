
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  CalendarDays,
  Clock3,
  RefreshCw,
  Pencil,
  X,
  Search,
} from 'lucide-react'
import { getEmployeeAttendance } from '@/app/actions/employee-attendance'
import { correctEmployeeAttendance } from '@/app/actions/employee-attendance-corrections'

type Employee = {
  id: string
  name: string
  phone: string | null
  role: 'manager' | 'cashier' | 'stock_manager' | 'viewer'
  status: 'active' | 'inactive'
  branch_id: string | null
  created_at: string
  updated_at: string
}

type Branch = {
  id: string
  name: string
  status: string
}

type AttendanceRecord = {
  id: string
  employee_id: string
  branch_id: string
  work_date: string
  shift_number: number
  scheduled_start_at: string
  scheduled_end_at: string
  grace_minutes: number
  late_minutes: number
  early_leave_minutes: number
  check_in_at: string | null
  check_out_at: string | null
  status: string
  overtime_minutes: number
  overtime_status: string | null
  notes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

type Props = {
  employees: Employee[]
  branches: Branch[]
}

const TIME_ZONE = 'Africa/Cairo'

function getCairoDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function getCairoDateTime(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ar-EG', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function toCairoInput(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`
}

// Convert a Cairo datetime-local value into an exact UTC timestamp.
function cairoInputToIso(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  )

  if (!match) {
    throw new Error('أدخل التاريخ والوقت بشكل صحيح')
  }

  const [, year, month, day, hour, minute] = match

  const target = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  )

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  let guess = target

  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(new Date(guess))
    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    )

    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    )

    guess += target - represented
  }

  return new Date(guess).toISOString()
}

function formatMinutes(value: number | null | undefined) {
  const minutes = Math.max(0, Number(value) || 0)

  if (minutes === 0) return '0 دقيقة'

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  if (hours === 0) return `${remaining} دقيقة`
  if (remaining === 0) return `${hours} ساعة`

  return `${hours} ساعة و${remaining} دقيقة`
}

const statusLabels: Record<string, string> = {
  present: 'حاضر',
  absent: 'غياب',
  absent_approved: 'غياب معتمد',
  leave: 'إجازة',
  late: 'متأخر',
  cancelled: 'ملغاة',
  pending: 'قيد المراجعة',
}

export default function EmployeeAttendancePanel({
  employees,
  branches,
}: Props) {
  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.status === 'active'),
    [branches]
  )

  const [branchId, setBranchId] = useState(
    activeBranches[0]?.id || ''
  )
  const [fromDate, setFromDate] = useState(getCairoDate)
  const [toDate, setToDate] = useState(getCairoDate)
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [checkInValue, setCheckInValue] = useState('')
  const [checkOutValue, setCheckOutValue] = useState('')
  const [reason, setReason] = useState('')

  const employeeNames = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee.name])),
    [employees]
  )

  const loadAttendance = useCallback(async () => {
    if (!branchId) {
      setRecords([])
      return
    }

    if (fromDate > toDate) {
      setError('تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية')
      setRecords([])
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const data = await getEmployeeAttendance(
        branchId,
        fromDate,
        toDate
      )

      setRecords(data as AttendanceRecord[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل سجلات الحضور'
      )
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [branchId, fromDate, toDate])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance, refreshKey])

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return records

    return records.filter((record) => {
      const name = employeeNames.get(record.employee_id) || ''

      return name.toLowerCase().includes(query)
    })
  }, [records, search, employeeNames])

  function openCorrection(record: AttendanceRecord) {
    setEditing(record)
    setCheckInValue(toCairoInput(record.check_in_at))
    setCheckOutValue(toCairoInput(record.check_out_at))
    setReason('')
    setError('')
    setSuccess('')
  }

  function closeCorrection() {
    if (saving) return

    setEditing(null)
    setCheckInValue('')
    setCheckOutValue('')
    setReason('')
  }

  async function saveCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editing) return

    const cleanReason = reason.trim()

    if (cleanReason.length < 3) {
      setError('اكتب سبب التصحيح، ويجب ألا يقل عن 3 أحرف')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const checkInAt = checkInValue
        ? cairoInputToIso(checkInValue)
        : null

      const checkOutAt = checkOutValue
        ? cairoInputToIso(checkOutValue)
        : null

      await correctEmployeeAttendance({
        attendanceId: editing.id,
        branchId: editing.branch_id,
        checkInAt,
        checkOutAt,
        reason: cleanReason,
      })

      setEditing(null)
      setCheckInValue('')
      setCheckOutValue('')
      setReason('')
      setSuccess('تم حفظ تصحيح الحضور بنجاح')
      setRefreshKey((current) => current + 1)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ التصحيح'
      )
    } finally {
      setSaving(false)
    }
  }

  const presentCount = records.filter(
    (record) => record.check_in_at
  ).length

  const lateCount = records.filter(
    (record) => (record.late_minutes || 0) > 0
  ).length

  const overtimeCount = records.filter(
    (record) => (record.overtime_minutes || 0) > 0
  ).length

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold">
            الحضور والانصراف
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            متابعة حضور الموظفين وتصحيح سجلات الدوام
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading || !branchId}
          className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"
        >
          <RefreshCw size={17} />
          تحديث السجلات
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-7 text-blue-800">
        جميع الأوقات المعروضة والمستخدمة في التصحيح بتوقيت القاهرة.
        تصحيح أي سجل يتطلب كتابة سبب، ويتم الاحتفاظ بسجل التغييرات.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
          {success}
        </div>
      )}

      <section className="rounded-2xl border bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="space-y-2 text-sm font-bold">
            الفرع
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-3 font-normal"
            >
              <option value="">اختر الفرع</option>
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-bold">
            من تاريخ
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border px-3 py-3 font-normal"
            />
          </label>

          <label className="space-y-2 text-sm font-bold">
            إلى تاريخ
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border px-3 py-3 font-normal"
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-3 rounded-xl border px-3 py-3">
            <Search size={18} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم الموظف..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <CalendarDays className="mb-2 text-blue-600" size={21} />
          <p className="text-xs text-slate-500">إجمالي السجلات</p>
          <p className="mt-1 text-2xl font-extrabold">
            {records.length}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <Clock3 className="mb-2 text-green-600" size={21} />
          <p className="text-xs text-slate-500">سجلات بها حضور</p>
          <p className="mt-1 text-2xl font-extrabold">
            {presentCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <Clock3 className="mb-2 text-amber-600" size={21} />
          <p className="text-xs text-slate-500">حالات تأخير</p>
          <p className="mt-1 text-2xl font-extrabold">
            {lateCount}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <Clock3 className="mb-2 text-purple-600" size={21} />
          <p className="text-xs text-slate-500">عمل إضافي مسجل</p>
          <p className="mt-1 text-2xl font-extrabold">
            {overtimeCount}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold">سجلات الموظفين</h3>
          <span className="text-xs text-slate-500">
            {filteredRecords.length} سجل
          </span>
        </div>

        {loading ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
            جارٍ تحميل سجلات الحضور...
          </div>
        ) : !branchId ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
            لا يوجد فرع نشط. أضف فرعًا نشطًا أولًا.
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">
            لا توجد سجلات حضور في الفترة المحددة.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((record) => {
              const employeeName =
                employeeNames.get(record.employee_id) ||
                'موظف غير معروف'

              const statusLabel =
                statusLabels[record.status] || record.status || 'غير محدد'

              return (
                <article
                  key={record.id}
                  className="rounded-2xl border bg-white p-4"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h4 className="font-extrabold">
                        {employeeName}
                      </h4>
                      <p className="mt-1 text-xs text-slate-500">
                        {record.work_date} · الوردية {record.shift_number}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {statusLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openCorrection(record)}
                      className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold"
                    >
                      <Pencil size={15} />
                      تصحيح السجل
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 sm:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        وقت الحضور
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {getCairoDateTime(record.check_in_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        وقت الانصراف
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {getCairoDateTime(record.check_out_at)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        التأخير
                      </p>
                      <p className="mt-1 text-sm font-bold text-amber-700">
                        {formatMinutes(record.late_minutes)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500">
                        الانصراف المبكر
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {formatMinutes(record.early_leave_minutes)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs">
                    <span className="text-slate-500">
                      العمل الإضافي:
                      {' '}
                      <strong className="text-purple-700">
                        {formatMinutes(record.overtime_minutes)}
                      </strong>
                    </span>

                    <span className="text-slate-500">
                      حالة الإضافي:
                      {' '}
                      {record.overtime_status === 'pending'
                        ? 'بانتظار الاعتماد'
                        : record.overtime_status === 'approved'
                          ? 'معتمد'
                          : record.overtime_status === 'rejected'
                            ? 'مرفوض'
                            : 'لا يوجد'}
                    </span>
                  </div>

                  {record.notes && (
                    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                      ملاحظات: {record.notes}
                    </p>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-5">
          <form
            onSubmit={saveCorrection}
            className="my-auto w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">
                  تصحيح الحضور والانصراف
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {employeeNames.get(editing.employee_id) ||
                    'موظف غير معروف'}
                  {' · '}
                  {editing.work_date}
                  {' · '}
                  الوردية {editing.shift_number}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCorrection}
                disabled={saving}
                aria-label="إغلاق"
                className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-800">
              اترك وقت الحضور أو الانصراف فارغًا إذا كنت تريد إلغاءه.
              لا يمكن تسجيل انصراف دون حضور.
              جميع الأوقات بتوقيت القاهرة.
            </div>

            <label className="block space-y-2 text-sm font-bold">
              وقت الحضور
              <input
                type="datetime-local"
                value={checkInValue}
                onChange={(event) =>
                  setCheckInValue(event.target.value)
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
              />
            </label>

            <label className="block space-y-2 text-sm font-bold">
              وقت الانصراف
              <input
                type="datetime-local"
                value={checkOutValue}
                onChange={(event) =>
                  setCheckOutValue(event.target.value)
                }
                className="w-full rounded-xl border px-3 py-3 font-normal"
              />
            </label>

            <label className="block space-y-2 text-sm font-bold">
              سبب التصحيح (إلزامي)
              <textarea
                required
                minLength={3}
                maxLength={500}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="مثال: تم تسجيل وقت الحضور بالخطأ..."
                className="w-full rounded-xl border px-3 py-3 font-normal"
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving ? 'جارٍ حفظ التصحيح...' : 'حفظ التصحيح'}
              </button>

              <button
                type="button"
                onClick={closeCorrection}
                disabled={saving}
                className="rounded-xl border px-4 py-3 font-bold disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
