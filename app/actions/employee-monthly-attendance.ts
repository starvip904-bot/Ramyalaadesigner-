
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext, requireRedaBranch } from '@/lib/reda-scope'

export type MonthlyAttendanceStatus =
  | 'present'
  | 'absent'
  | 'leave'
  | 'rest_day'

export type SaveMonthlyAttendanceInput = {
  employeeId: string
  branchId: string
  workDate: string
  status: MonthlyAttendanceStatus
  checkInAt?: string | null
  checkOutAt?: string | null
  notes?: string | null
  changeReason?: string | null
}

const ATTENDANCE_TABLE = 'dokkan_employee_monthly_attendance'
const HISTORY_TABLE = 'dokkan_employee_monthly_attendance_history'

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const date = new Date(`${value}T00:00:00.000Z`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  )
}

function isValidMonth(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false

  return true
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)

  const startDate = `${month}-01`
  const nextMonth = new Date(
    Date.UTC(year, monthNumber, 1)
  )

  const endDate = nextMonth.toISOString().slice(0, 10)

  return { startDate, endDate }
}

function normalizeTimestamp(value?: string | null) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('وقت الحضور أو الانصراف غير صحيح')
  }

  return date.toISOString()
}

function validateAttendanceInput(input: SaveMonthlyAttendanceInput) {
  if (!input.employeeId || !input.branchId) {
    throw new Error('يجب تحديد الموظف والفرع')
  }

  if (!isValidDate(input.workDate)) {
    throw new Error('تاريخ اليوم غير صحيح')
  }

  const allowedStatuses: MonthlyAttendanceStatus[] = [
    'present',
    'absent',
    'leave',
    'rest_day',
  ]

  if (!allowedStatuses.includes(input.status)) {
    throw new Error('حالة الحضور غير صحيحة')
  }

  const notes = input.notes?.trim() || null

  if (notes && notes.length > 1000) {
    throw new Error('الملاحظات أطول من المسموح')
  }

  let checkInAt = normalizeTimestamp(input.checkInAt)
  let checkOutAt = normalizeTimestamp(input.checkOutAt)

  if (input.status !== 'present') {
    checkInAt = null
    checkOutAt = null
  }

  if (checkOutAt && !checkInAt) {
    throw new Error('يجب تسجيل وقت الحضور قبل الانصراف')
  }

  if (
    checkInAt &&
    checkOutAt &&
    new Date(checkOutAt).getTime() <
      new Date(checkInAt).getTime()
  ) {
    throw new Error('وقت الانصراف لا يمكن أن يسبق وقت الحضور')
  }

  return {
    checkInAt,
    checkOutAt,
    notes,
  }
}

/**
 * تحميل سجلات حضور موظفي فرع خلال شهر محدد.
 */
export async function getMonthlyEmployeeAttendance(
  branchId: string,
  month: string
) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  if (!branchId) {
    throw new Error('يجب تحديد الفرع')
  }

  if (!isValidMonth(month)) {
    throw new Error('الشهر المحدد غير صحيح')
  }

  await requireRedaBranch(branchId)

  const { startDate, endDate } = getMonthRange(month)

  const { data: attendance, error } = await context.supabase
    .from(ATTENDANCE_TABLE)
    .select(`
      id,
      store_id,
      branch_id,
      employee_id,
      work_date,
      check_in_at,
      check_out_at,
      status,
      notes,
      change_reason,
      created_by,
      updated_by,
      created_at,
      updated_at
    `)
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .gte('work_date', startDate)
    .lt('work_date', endDate)
    .order('work_date', { ascending: true })

  if (error) {
    console.error(
      '[MonthlyAttendance] Load failed:',
      error.code
    )
    throw new Error('تعذر تحميل سجلات الحضور')
  }

  const records = attendance ?? []
  const attendanceIds = records.map((item) => item.id)

  let history: Record<string, unknown>[] = []

  if (attendanceIds.length > 0) {
    const { data: historyRows, error: historyError } =
      await context.supabase
        .from(HISTORY_TABLE)
        .select(`
          id,
          attendance_id,
          employee_id,
          action_type,
          changed_by,
          change_reason,
          before_snapshot,
          after_snapshot,
          changed_at
        `)
        .eq('store_id', context.storeId)
        .eq('branch_id', branchId)
        .in('attendance_id', attendanceIds)
        .order('changed_at', { ascending: false })

    if (historyError) {
      console.error(
        '[MonthlyAttendance] History load failed:',
        historyError.code
      )
      throw new Error('تعذر تحميل سجل تعديلات الحضور')
    }

    history = (historyRows ?? []) as Record<string, unknown>[]
  }

  return {
    attendance: records,
    history,
  }
}

/**
 * تسجيل حضور يوم أو تعديل سجل سابق.
 * عند التعديل يجب كتابة سبب واضح لا يقل عن 3 أحرف.
 */
export async function saveMonthlyEmployeeAttendance(
  input: SaveMonthlyAttendanceInput
) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const values = validateAttendanceInput(input)

  await requireRedaBranch(input.branchId)

  const { data: employee, error: employeeError } =
    await context.supabase
      .from('dokkan_employees')
      .select('id, branch_id, status')
      .eq('id', input.employeeId)
      .eq('store_id', context.storeId)
      .maybeSingle()

  if (employeeError || !employee) {
    throw new Error('الموظف غير موجود في هذا المتجر')
  }

  if (employee.branch_id !== input.branchId) {
    throw new Error('الموظف غير مربوط بالفرع المحدد')
  }

  const { data: existing, error: existingError } =
    await context.supabase
      .from(ATTENDANCE_TABLE)
      .select('id')
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .eq('employee_id', input.employeeId)
      .eq('work_date', input.workDate)
      .maybeSingle()

  if (existingError) {
    console.error(
      '[MonthlyAttendance] Existing record lookup failed:',
      existingError.code
    )
    throw new Error('تعذر التحقق من سجل اليوم')
  }

  const suppliedReason = input.changeReason?.trim() || ''

  if (existing && suppliedReason.length < 3) {
    throw new Error('سبب تعديل اليوم السابق مطلوب')
  }

  const changeReason =
    suppliedReason || 'تسجيل أولي للحضور'

  const now = new Date().toISOString()

  const record = {
    store_id: context.storeId,
    branch_id: input.branchId,
    employee_id: input.employeeId,
    work_date: input.workDate,
    check_in_at: values.checkInAt,
    check_out_at: values.checkOutAt,
    status: input.status,
    notes: values.notes,
    change_reason: changeReason,
    updated_by: context.user.id,
    updated_at: now,
  }

  if (existing) {
    const { data, error } = await context.supabase
      .from(ATTENDANCE_TABLE)
      .update(record)
      .eq('id', existing.id)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error(
        '[MonthlyAttendance] Update failed:',
        error?.code
      )
      throw new Error(
        'تعذر تعديل سجل الحضور. تأكد من صلاحيات الفرع'
      )
    }

    revalidatePath('/employees')

    return {
      success: true,
      action: 'updated' as const,
      id: data.id,
    }
  }

  const { data, error } = await context.supabase
    .from(ATTENDANCE_TABLE)
    .insert({
      ...record,
      created_by: context.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error(
      '[MonthlyAttendance] Insert failed:',
      error?.code
    )
    throw new Error(
      'تعذر تسجيل الحضور. تأكد من صلاحيات الفرع'
    )
  }

  revalidatePath('/employees')

  return {
    success: true,
    action: 'created' as const,
    id: data.id,
  }
}
