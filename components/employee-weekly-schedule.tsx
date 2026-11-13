
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  Clock3,
  Save,
  RefreshCw,
} from 'lucide-react'
import {
  getEmployeeWeeklyShifts,
  saveEmployeeWeeklyShift,
} from '@/app/actions/employee-schedule'

type Employee = {
  id: string
  name: string
  status: 'active' | 'inactive'
  branch_id: string | null
}

type Branch = {
  id: string
  name: string
  status: string
}

type BreakMode = 'none' | 'fixed' | 'variable'

type Shift = {
  id?: string
  employee_id?: string
  branch_id?: string
  weekday: number
  shift_number: 1 | 2
  starts_at: string
  ends_at: string
  grace_minutes: number
  break_mode: BreakMode
  fixed_break_minutes: number
  is_active: boolean
  change_reason?: string
}

type Props = {
  employees: Employee[]
  branches: Branch[]
}

const DAYS = [
  { value: 6, label: 'السبت' },
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
]

function emptyShift(weekday: number, shiftNumber: 1 | 2): Shift {
  return {
    weekday,
    shift_number: shiftNumber,
    starts_at: shiftNumber === 1 ? '09:00' : '16:00',
    ends_at: shiftNumber === 1 ? '17:00' : '22:00',
    grace_minutes: 10,
    break_mode: 'none',
    fixed_break_minutes: 0,
    is_active: false,
  }
}

export default function EmployeeWeeklySchedule({
  employees,
  branches,
}: Props) {
  const activeEmployees = useMemo(
    () => employees.filter((item) => item.status === 'active'),
    [employees]
  )

  const activeBranches = useMemo(
    () => branches.filter((item) => item.status === 'active'),
    [branches]
  )

  const [branchId, setBranchId] = useState(
    activeBranches[0]?.id || ''
  )
  const [employeeId, setEmployeeId] = useState('')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const branchEmployees = useMemo(
    () =>
      activeEmployees.filter(
        (employee) => employee.branch_id === branchId
      ),
    [activeEmployees, branchId]
  )

  useEffect(() => {
    if (!branchEmployees.some((employee) => employee.id === employeeId)) {
      setEmployeeId(branchEmployees[0]?.id || '')
    }
  }, [branchEmployees, employeeId])

  useEffect(() => {
    let cancelled = false

    async function loadSchedule() {
      if (!employeeId || !branchId) {
        setShifts([])
        return
      }

      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const data = await getEmployeeWeeklyShifts(
          employeeId,
          branchId
        )

        if (cancelled) return

        const loaded = data as Shift[]

        const complete: Shift[] = []

        for (const day of DAYS) {
          for (const number of [1, 2] as const) {
            const existing = loaded.find(
              (item) =>
                item.weekday === day.value &&
                item.shift_number === number
            )

            complete.push(
              existing
                ? {
                    ...existing,
                    starts_at: existing.starts_at.slice(0, 5),
                    ends_at: existing.ends_at.slice(0, 5),
                  }
                : emptyShift(day.value, number)
            )
          }
        }

        setShifts(complete)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'تعذر تحميل مواعيد الموظف'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadSchedule()

    return () => {
      cancelled = true
    }
  }, [employeeId, branchId, refreshKey])

  function updateShift(
    weekday: number,
    shiftNumber: 1 | 2,
    changes: Partial<Shift>
  ) {
    setShifts((current) =>
      current.map((item) =>
        item.weekday === weekday &&
        item.shift_number === shiftNumber
          ? { ...item, ...changes }
          : item
      )
    )
  }

  async function saveSchedule() {
    if (!employeeId || !branchId) {
      setError('اختر الفرع والموظف أولاً')
      return
    }

    if (reason.trim().length < 3) {
      setError('اكتب سبب حفظ أو تعديل الجدول')
      return
    }

    const enabled = shifts.filter((item) => item.is_active)

    if (enabled.length === 0) {
      setError('فعّل وردية واحدة على الأقل قبل الحفظ')
      return
    }

    for (const shift of enabled) {
      if (
        !shift.starts_at ||
        !shift.ends_at ||
        shift.starts_at === shift.ends_at
      ) {
        setError(
          `راجع مواعيد ${DAYS.find((d) => d.value === shift.weekday)?.label || ''} - الوردية ${shift.shift_number}`
        )
        return
      }
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      for (const shift of shifts) {
        const shouldSave =
          shift.is_active || Boolean(shift.id)

        if (!shouldSave) continue

        await saveEmployeeWeeklyShift({
          id: shift.id,
          employeeId,
          branchId,
          weekday: shift.weekday,
          shiftNumber: shift.shift_number,
          startsAt: shift.starts_at,
          endsAt: shift.ends_at,
          graceMinutes: shift.grace_minutes,
          breakMode: shift.break_mode,
          fixedBreakMinutes: shift.fixed_break_minutes,
          isActive: shift.is_active,
          changeReason: reason.trim(),
        })
      }

      setSuccess('تم حفظ جدول الورديات بنجاح')
      setReason('')
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ جدول الورديات'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">
            مواعيد الورديات
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            تحديد جدول العمل الأسبوعي لكل موظف
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((value) => value + 1)}
          disabled={loading || saving || !employeeId}
          className="flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-50"
        >
          <RefreshCw size={17} />
          تحديث
        </button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-7 text-blue-800">
        حدد مواعيد كل يوم. يمكنك تشغيل وردية واحدة أو ورديتين،
        وترك اليوم بدون ورديات ليكون يوم راحة.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700">
          {success}
        </div>
      )}

      <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-2">
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
          الموظف
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            disabled={!branchId || branchEmployees.length === 0}
            className="w-full rounded-xl border bg-white px-3 py-3 font-normal disabled:bg-slate-100"
          >
            <option value="">اختر الموظف</option>
            {branchEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {!branchEmployees.length && branchId && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          لا يوجد موظفون نشطون مرتبطون بهذا الفرع.
        </div>
      )}

      {loading && (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
          جاري تحميل جدول الورديات...
        </div>
      )}

      {employeeId && !loading && (
        <>
          <div className="space-y-4">
            {DAYS.map((day) => (
              <section
                key={day.value}
                className="overflow-hidden rounded-2xl border bg-white"
              >
                <div className="flex items-center gap-2 border-b bg-slate-50 p-4">
                  <CalendarDays size={19} className="text-blue-600" />
                  <h3 className="font-extrabold">{day.label}</h3>

                  <span className="mr-auto text-xs text-slate-500">
                    {shifts.filter(
                      (item) =>
                        item.weekday === day.value &&
                        item.is_active
                    ).length === 0
                      ? 'يوم راحة'
                      : 'يوم عمل'}
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  {([1, 2] as const).map((number) => {
                    const shift = shifts.find(
                      (item) =>
                        item.weekday === day.value &&
                        item.shift_number === number
                    )

                    if (!shift) return null

                    return (
                      <div
                        key={number}
                        className="space-y-4 rounded-xl border p-4"
                      >
                        <label className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={shift.is_active}
                            onChange={(event) =>
                              updateShift(day.value, number, {
                                is_active: event.target.checked,
                              })
                            }
                            className="h-5 w-5 accent-blue-600"
                          />
                          <span className="font-bold">
                            الوردية {number}
                          </span>
                          <span className="text-xs text-slate-500">
                            {shift.is_active ? 'مفعلة' : 'غير مفعلة'}
                          </span>
                        </label>

                        {shift.is_active && (
                          <>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-2 text-sm font-bold">
                                بداية الوردية
                                <input
                                  type="time"
                                  value={shift.starts_at}
                                  onChange={(event) =>
                                    updateShift(day.value, number, {
                                      starts_at: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border px-3 py-3 font-normal"
                                />
                              </label>

                              <label className="space-y-2 text-sm font-bold">
                                نهاية الوردية
                                <input
                                  type="time"
                                  value={shift.ends_at}
                                  onChange={(event) =>
                                    updateShift(day.value, number, {
                                      ends_at: event.target.value,
                                    })
                                  }
                                  className="w-full rounded-xl border px-3 py-3 font-normal"
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="space-y-2 text-sm font-bold">
                                فترة السماح بالدقائق
                                <input
                                  type="number"
                                  min="0"
                                  max="240"
                                  value={shift.grace_minutes}
                                  onChange={(event) =>
                                    updateShift(day.value, number, {
                                      grace_minutes: Number(event.target.value),
                                    })
                                  }
                                  className="w-full rounded-xl border px-3 py-3 font-normal"
                                />
                              </label>

                              <label className="space-y-2 text-sm font-bold">
                                نظام الاستراحة
                                <select
                                  value={shift.break_mode}
                                  onChange={(event) =>
                                    updateShift(day.value, number, {
                                      break_mode: event.target.value as BreakMode,
                                      fixed_break_minutes:
                                        event.target.value === 'fixed'
                                          ? 30
                                          : 0,
                                    })
                                  }
                                  className="w-full rounded-xl border bg-white px-3 py-3 font-normal"
                                >
                                  <option value="none">بدون استراحة</option>
                                  <option value="fixed">استراحة ثابتة</option>
                                  <option value="variable">استراحة متغيرة</option>
                                </select>
                              </label>
                            </div>

                            {shift.break_mode === 'fixed' && (
                              <label className="block space-y-2 text-sm font-bold">
                                مدة الاستراحة بالدقائق
                                <input
                                  type="number"
                                  min="1"
                                  max="600"
                                  value={shift.fixed_break_minutes}
                                  onChange={(event) =>
                                    updateShift(day.value, number, {
                                      fixed_break_minutes: Number(event.target.value),
                                    })
                                  }
                                  className="w-full rounded-xl border px-3 py-3 font-normal"
                                />
                              </label>
                            )}

                            <p className="text-xs leading-6 text-slate-500">
                              يمكن تحديد نهاية الوردية بعد منتصف الليل
                              عند العمل في وردية ليلية.
                            </p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>

          <section className="space-y-3 rounded-2xl border bg-white p-4">
            <label className="block space-y-2 text-sm font-bold">
              سبب إنشاء أو تعديل الجدول
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="مثال: تحديد مواعيد العمل الأسبوعية للموظف"
                className="w-full rounded-xl border px-3 py-3 font-normal"
              />
            </label>

            <button
              type="button"
              onClick={saveSchedule}
              disabled={saving || loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 font-bold text-white disabled:opacity-50"
            >
              <Save size={19} />
              {saving ? 'جاري حفظ الجدول...' : 'حفظ جدول الورديات'}
            </button>
          </section>
        </>
      )}

      {!employeeId && branchId && branchEmployees.length > 0 && (
        <div className="rounded-xl border bg-white p-6 text-center text-sm text-slate-500">
          اختر الموظف لعرض مواعيد وردياته.
        </div>
      )}
    </div>
  )
}
