
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  Printer,
  RefreshCw,
  Save,
  History,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  Palmtree,
  Coffee,
  X,
} from 'lucide-react'
import {
  getMonthlyEmployeeAttendance,
  saveMonthlyEmployeeAttendance,
  type MonthlyAttendanceStatus,
} from '@/app/actions/employee-monthly-attendance'

type Employee = {
  id: string
  name: string
  phone: string | null
  role: string
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
  check_in_at: string | null
  check_out_at: string | null
  status: MonthlyAttendanceStatus
  notes: string | null
  change_reason: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

type HistoryRecord = {
  id: string
  attendance_id: string
  employee_id: string
  action_type: 'created' | 'updated'
  changed_by: string | null
  change_reason: string
  before_snapshot: Record<string, unknown> | null
  after_snapshot: Record<string, unknown> | null
  changed_at: string
}

type Props = {
  employees: Employee[]
  branches: Branch[]
}

type EditorState = {
  employeeId: string
  employeeName: string
  workDate: string
  record: AttendanceRecord | null
}

const statusOptions: {
  value: MonthlyAttendanceStatus
  label: string
  shortLabel: string
  className: string
  icon: typeof UserCheck
}[] = [
  {
    value: 'present',
    label: 'حاضر',
    shortLabel: 'حاضر',
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: UserCheck,
  },
  {
    value: 'absent',
    label: 'غائب',
    shortLabel: 'غائب',
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: UserX,
  },
  {
    value: 'leave',
    label: 'إجازة',
    shortLabel: 'إجازة',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Palmtree,
  },
  {
    value: 'rest_day',
    label: 'راحة',
    shortLabel: 'راحة',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Coffee,
  },
]

function getLocalDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getLocalDateTime(value: string | null) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function formatTime(value: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleTimeString('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDaysInMonth(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const count = new Date(year, monthNumber, 0).getDate()

  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return `${month}-${day}`
  })
}

function getStatusInfo(status: MonthlyAttendanceStatus) {
  return statusOptions.find((item) => item.value === status) ?? statusOptions[0]
}

function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)

  return new Date(year, monthNumber - 1, 1).toLocaleDateString('ar-EG', {
    month: 'long',
    year: 'numeric',
  })
}

export default function EmployeeMonthlyAttendancePanel({
  employees,
  branches,
}: Props) {
  const today = getLocalDateString(new Date())

  const [branchId, setBranchId] = useState('')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [status, setStatus] = useState<MonthlyAttendanceStatus>('present')
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [notes, setNotes] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [expandedEmployees, setExpandedEmployees] = useState<string[]>([])

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.status === 'active'),
    [branches]
  )

  const branchEmployees = useMemo(
    () =>
      employees.filter(
        (employee) =>
          employee.branch_id === branchId &&
          employee.status === 'active'
      ),
    [employees, branchId]
  )

  const days = useMemo(() => getDaysInMonth(month), [month])

  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>()

    attendance.forEach((record) => {
      map.set(`${record.employee_id}_${record.work_date}`, record)
    })

    return map
  }, [attendance])

  const historyByAttendance = useMemo(() => {
    const map = new Map<string, HistoryRecord[]>()

    history.forEach((item) => {
      const current = map.get(item.attendance_id) ?? []
      current.push(item)
      map.set(item.attendance_id, current)
    })

    return map
  }, [history])

  const loadAttendance = useCallback(async () => {
    if (!branchId || !month) {
      setAttendance([])
      setHistory([])
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await getMonthlyEmployeeAttendance(branchId, month)

      setAttendance(result.attendance as AttendanceRecord[])
      setHistory(result.history as HistoryRecord[])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر تحميل سجلات الحضور'
      )
      setAttendance([])
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [branchId, month])

  useEffect(() => {
    void loadAttendance()
  }, [loadAttendance])

  function toggleEmployee(employeeId: string) {
    setExpandedEmployees((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId]
    )
  }

  function openEditor(employee: Employee, workDate: string) {
    const record =
      attendanceMap.get(`${employee.id}_${workDate}`) ?? null

    setEditor({
      employeeId: employee.id,
      employeeName: employee.name,
      workDate,
      record,
    })

    setStatus(record?.status ?? 'present')
    setCheckIn(getLocalDateTime(record?.check_in_at ?? null))
    setCheckOut(getLocalDateTime(record?.check_out_at ?? null))
    setNotes(record?.notes ?? '')
    setChangeReason('')
    setError('')
    setSuccess('')
  }

  function closeEditor() {
    if (saving) return
    setEditor(null)
  }

  async function saveAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editor) return

    if (editor.record && changeReason.trim().length < 3) {
      setError('اكتب سبب تعديل اليوم السابق (3 أحرف على الأقل)')
      return
    }

    if (notes.trim().length > 1000) {
      setError('الملاحظات أطول من المسموح')
      return
    }

    if (status === 'present' && checkOut && !checkIn) {
      setError('يجب تسجيل وقت الحضور قبل الانصراف')
      return
    }

    if (status === 'present' && checkIn && checkOut) {
      if (new Date(checkOut).getTime() < new Date(checkIn).getTime()) {
        setError('وقت الانصراف لا يمكن أن يسبق وقت الحضور')
        return
      }
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await saveMonthlyEmployeeAttendance({
        employeeId: editor.employeeId,
        branchId,
        workDate: editor.workDate,
        status,
        checkInAt:
          status === 'present' && checkIn
            ? new Date(checkIn).toISOString()
            : null,
        checkOutAt:
          status === 'present' && checkOut
            ? new Date(checkOut).toISOString()
            : null,
        notes: notes.trim() || null,
        changeReason: editor.record ? changeReason.trim() : null,
      })

      setEditor(null)
      setSuccess('تم حفظ سجل الحضور بنجاح')
      await loadAttendance()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'تعذر حفظ سجل الحضور'
      )
    } finally {
      setSaving(false)
    }
  }

  function getEmployeeSummary(employeeId: string) {
    const summary = {
      present: 0,
      absent: 0,
      leave: 0,
      rest_day: 0,
    }

    days.forEach((day) => {
      const record = attendanceMap.get(`${employeeId}_${day}`)
      if (record) summary[record.status] += 1
    })

    return summary
  }

  function printReport() {
    window.print()
  }

  const totalSummary = useMemo(() => {
    return branchEmployees.reduce(
      (total, employee) => {
        const summary = getEmployeeSummary(employee.id)

        total.present += summary.present
        total.absent += summary.absent
        total.leave += summary.leave
        total.rest_day += summary.rest_day

        return total
      },
      {
        present: 0,
        absent: 0,
        leave: 0,
        rest_day: 0,
      }
    )
  }, [branchEmployees, days, attendanceMap])

  return (
    <div className="space-y-5" dir="rtl">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          #employee-monthly-attendance-print,
          #employee-monthly-attendance-print * {
            visibility: visible !important;
          }

          #employee-monthly-attendance-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            padding: 12px !important;
            background: white !important;
            color: black !important;
          }

          .attendance-no-print {
            display: none !important;
          }

          .attendance-print-card {
            break-inside: avoid;
            border: 1px solid #999 !important;
          }

          .attendance-print-grid {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          }

          .attendance-print-day {
            border: 1px solid #ddd !important;
            min-height: 55px !important;
          }
        }
      `}</style>

      <div className="attendance-no-print flex flex-col gap-3 rounded-2xl border bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-bold">
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

          <label className="block space-y-2 text-sm font-bold">
            الشهر
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full rounded-xl border bg-white px-3 py-3 font-normal"
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadAttendance()}
            disabled={!branchId || loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={!branchId || branchEmployees.length === 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <Printer size={17} />
            طباعة
          </button>
        </div>
      </div>

      {error && !editor && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {success && !editor && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-700">
          {success}
        </div>
      )}

      {!branchId ? (
        <div className="rounded-2xl border bg-white p-10 text-center">
          <CalendarDays className="mx-auto mb-3 text-slate-400" size={36} />
          <p className="font-bold">اختر الفرع لعرض سجل الحضور</p>
          <p className="mt-2 text-sm text-slate-500">
            يجب أن يكون الموظف مربوطًا بفرع قبل تسجيل حضوره
          </p>
        </div>
      ) : (
        <div id="employee-monthly-attendance-print" className="space-y-5">
          <div className="flex flex-col gap-2 rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-extrabold">
                كشف الحضور والانصراف الشهري
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {activeBranches.find((branch) => branch.id === branchId)?.name}
                {' — '}
                {getMonthLabel(month)}
              </p>
            </div>

            <div className="text-sm text-slate-500">
              عدد الموظفين: {branchEmployees.length}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statusOptions.map((item) => {
              const Icon = item.icon
              const count = totalSummary[item.value]

              return (
                <div
                  key={item.value}
                  className="rounded-xl border bg-white p-3"
                >
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Icon size={17} />
                    {item.label}
                  </div>
                  <p className="mt-2 text-2xl font-extrabold">{count}</p>
                  <p className="text-xs text-slate-400">إجمالي الأيام المسجلة</p>
                </div>
              )
            })}
          </div>

          {loading ? (
            <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
              جارٍ تحميل سجلات الحضور...
            </div>
          ) : branchEmployees.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
              لا يوجد موظفون نشطون مربوطون بهذا الفرع
            </div>
          ) : (
            <div className="space-y-4">
              {branchEmployees.map((employee) => {
                const summary = getEmployeeSummary(employee.id)
                const expanded = expandedEmployees.includes(employee.id)

                return (
                  <section
                    key={employee.id}
                    className="attendance-print-card overflow-hidden rounded-2xl border bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => toggleEmployee(employee.id)}
                      className="attendance-no-print flex w-full flex-col gap-3 p-4 text-right sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="font-extrabold">{employee.name}</h4>
                          <p className="mt-1 text-xs text-slate-500">
                            {employee.phone || 'لا يوجد رقم هاتف'}
                          </p>
                        </div>
                        {expanded ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-green-700">
                          حاضر: {summary.present}
                        </span>
                        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
                          غائب: {summary.absent}
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
                          إجازة: {summary.leave}
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                          راحة: {summary.rest_day}
                        </span>
                      </div>
                    </button>

                    <div className="hidden print:block border-b p-3">
                      <h4 className="font-extrabold">{employee.name}</h4>
                      <p className="mt-1 text-xs">
                        حاضر: {summary.present} | غائب: {summary.absent}
                        {' | '}إجازة: {summary.leave} | راحة: {summary.rest_day}
                      </p>
                    </div>

                    <div className={`${expanded ? 'block' : 'hidden'} print:block border-t p-3`}>
                      <div className="attendance-print-grid grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                        {days.map((day) => {
                          const record =
                            attendanceMap.get(`${employee.id}_${day}`) ?? null

                          const info = record
                            ? getStatusInfo(record.status)
                            : null

                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => openEditor(employee, day)}
                              className={`attendance-print-day min-h-24 rounded-xl border p-2 text-right transition hover:border-blue-400 hover:bg-blue-50 ${
                                info
                                  ? info.className
                                  : 'border-dashed border-slate-200 bg-slate-50'
                              }`}
                            >
                              <div className="text-xs font-bold">
                                {formatDate(day)}
                              </div>

                              <div className="mt-2 text-sm font-extrabold">
                                {info?.shortLabel ?? 'غير مسجل'}
                              </div>

                              {record?.check_in_at && (
                                <div className="mt-1 text-[11px]">
                                  حضور: {formatTime(record.check_in_at)}
                                </div>
                              )}

                              {record?.check_out_at && (
                                <div className="mt-1 text-[11px]">
                                  انصراف: {formatTime(record.check_out_at)}
                                </div>
                              )}

                              {record?.notes && (
                                <div className="mt-1 truncate text-[10px]">
                                  {record.notes}
                                </div>
                              )}

                              <div className="attendance-no-print mt-2 text-[10px] opacity-70">
                                اضغط للتسجيل أو التعديل
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="attendance-no-print border-t bg-slate-50 px-4 py-2 text-xs text-slate-500">
                      {days.length} يومًا في الشهر — اضغط على الموظف لعرض الأيام
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          <div className="attendance-no-print rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-extrabold">
              <History size={18} />
              سجل تعديلات الحضور
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-slate-500">
                لا توجد تعديلات مسجلة لهذا الشهر
              </p>
            ) : (
              <div className="space-y-3">
                {history.slice(0, 30).map((item) => {
                  const employee = employees.find(
                    (entry) => entry.id === item.employee_id
                  )

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold">
                          {employee?.name || 'موظف'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDateTime(item.changed_at)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-600">
                        {item.action_type === 'created'
                          ? 'تسجيل جديد'
                          : 'تعديل سجل سابق'}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        السبب: {item.change_reason}
                      </p>

                      <p className="mt-1 text-[11px] text-slate-400">
                        سجل التعديل محفوظ للمراجعة
                      </p>

                      {historyByAttendance.get(item.attendance_id)?.length ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs font-bold text-blue-700">
                            عرض تفاصيل السجل
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-2 text-[10px]">
                            {JSON.stringify(
                              {
                                قبل: item.before_snapshot,
                                بعد: item.after_snapshot,
                              },
                              null,
                              2
                            )}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {editor && (
        <div className="attendance-no-print fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3">
          <form
            onSubmit={saveAttendance}
            className="my-auto w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">
                  تسجيل الحضور والانصراف
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editor.employeeName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDate(editor.workDate)}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                aria-label="إغلاق"
                className="rounded-lg border p-2"
              >
                <X size={18} />
              </button>
            </div>

            {editor.record && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800">
                أنت تعدل سجلًا محفوظًا. يجب كتابة سبب التعديل لحفظ التغيير،
                وسيتم تسجيل العملية في سجل المراجعة.
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-bold">حالة اليوم</label>
              <div className="grid grid-cols-2 gap-2">
                {statusOptions.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatus(item.value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold ${
                      status === item.value
                        ? item.className + ' ring-2 ring-blue-500'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {status === 'present' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-2 text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Clock3 size={16} />
                    وقت الحضور
                  </span>
                  <input
                    type="datetime-local"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                    className="w-full rounded-xl border px-3 py-3 font-normal"
                  />
                </label>

                <label className="block space-y-2 text-sm font-bold">
                  <span className="flex items-center gap-2">
                    <Clock3 size={16} />
                    وقت الانصراف
                  </span>
                  <input
                    type="datetime-local"
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                    className="w-full rounded-xl border px-3 py-3 font-normal"
                  />
                </label>
              </div>
            )}

            <label className="block space-y-2 text-sm font-bold">
              ملاحظات (اختياري)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={1000}
                rows={3}
                className="w-full rounded-xl border px-3 py-3 font-normal"
                placeholder="اكتب أي ملاحظات عن اليوم..."
              />
            </label>

            {editor.record && (
              <label className="block space-y-2 text-sm font-bold">
                سبب تعديل السجل (إلزامي)
                <textarea
                  value={changeReason}
                  onChange={(event) => setChangeReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  required
                  rows={2}
                  className="w-full rounded-xl border px-3 py-3 font-normal"
                  placeholder="اكتب سبب تعديل هذا اليوم..."
                />
              </label>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <Save size={17} />
                {saving ? 'جارٍ الحفظ...' : 'حفظ السجل'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
