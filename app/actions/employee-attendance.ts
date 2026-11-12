'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

type AttendanceInput = {
  employeeId: string
  branchId: string
  workDate: string
  shiftNumber: 1 | 2
}

type BreakType = 'regular' | 'personal' | 'other'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const TIME_ZONE = 'Africa/Cairo'

function validateUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value || '')) {
    throw new Error(`${label} غير صحيح`)
  }
}

function validateDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    throw new Error('تاريخ العمل غير صحيح')
  }

  const date = new Date(`${value}T12:00:00.000Z`)

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error('تاريخ العمل غير صحيح')
  }

  return date
}

function getWeekday(date: Date) {
  return date.getUTCDay()
}

function addOneDay(date: string) {
  const value = new Date(`${date}T12:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + 1)
  return value.toISOString().slice(0, 10)
}

// Convert a Cairo wall-clock time into an exact UTC timestamp.
function cairoTimeToUtc(date: string, time: string) {
  const match = time.match(/^(\d{2}):(\d{2}):(\d{2})$/)

  if (!match) {
    throw new Error('وقت الوردية غير صحيح')
  }

  const [, hour, minute, second] = match

  const target = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hour),
    Number(minute),
    Number(second)
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

async function getAttendanceContext(
  branchId: string,
  employeeId?: string
) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const { data: branch, error: branchError } =
    await context.supabase
      .from('dokkan_branches')
      .select('id')
      .eq('id', branchId)
      .eq('store_id', context.storeId)
      .eq('status', 'active')
      .maybeSingle()

  if (branchError || !branch) {
    throw new Error('الفرع غير صحيح أو غير نشط')
  }

  if (employeeId) {
    const { data: employee, error } =
      await context.supabase
        .from('dokkan_employees')
        .select('id')
        .eq('id', employeeId)
        .eq('store_id', context.storeId)
        .eq('branch_id', branchId)
        .eq('status', 'active')
        .maybeSingle()

    if (error || !employee) {
      throw new Error('الموظف غير موجود في هذا الفرع أو غير نشط')
    }
  }

  return context
}

function validateAttendanceInput(input: AttendanceInput) {
  validateUuid(input.employeeId, 'معرف الموظف')
  validateUuid(input.branchId, 'معرف الفرع')

  if (![1, 2].includes(input.shiftNumber)) {
    throw new Error('رقم الوردية غير صحيح')
  }

  const date = validateDate(input.workDate)

  return {
    date,
    weekday: getWeekday(date),
  }
}

async function getOpenBreak(
  context: Awaited<ReturnType<typeof getAttendanceContext>>,
  attendanceId: string,
  branchId: string
) {
  const { data, error } = await context.supabase
    .from('dokkan_employee_attendance_breaks')
    .select('id')
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .eq('attendance_id', attendanceId)
    .is('ended_at', null)
    .maybeSingle()

  if (error) {
    throw new Error('تعذر التحقق من الاستراحات')
  }

  return data
}

export async function getEmployeeAttendance(
  branchId: string,
  fromDate: string,
  toDate: string,
  employeeId?: string
) {
  validateUuid(branchId, 'معرف الفرع')

  const from = validateDate(fromDate)
  const to = validateDate(toDate)

  if (from.getTime() > to.getTime()) {
    throw new Error('نطاق التواريخ غير صحيح')
  }

  if (employeeId) {
    validateUuid(employeeId, 'معرف الموظف')
  }

  const context = await getAttendanceContext(
    branchId,
    employeeId
  )

  let query = context.supabase
    .from('dokkan_employee_attendance')
    .select(`
      id,
      employee_id,
      branch_id,
      work_date,
      shift_number,
      scheduled_start_at,
      scheduled_end_at,
      grace_minutes,
      late_minutes,
      early_leave_minutes,
      check_in_at,
      check_out_at,
      status,
      overtime_minutes,
      overtime_status,
      notes,
      created_by,
      updated_by,
      created_at,
      updated_at
    `)
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .gte('work_date', fromDate)
    .lte('work_date', toDate)
    .order('work_date', { ascending: false })
    .order('shift_number', { ascending: true })

  if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[EmployeeAttendance] Load failed:', error.code)
    throw new Error('تعذر تحميل سجلات الحضور')
  }

  return data ?? []
}

export async function recordEmployeeCheckIn(
  input: AttendanceInput
) {
  const { weekday } = validateAttendanceInput(input)

  const context = await getAttendanceContext(
    input.branchId,
    input.employeeId
  )

  const { data: shift, error: shiftError } =
    await context.supabase
      .from('dokkan_employee_weekly_shifts')
      .select(`
        starts_at,
        ends_at,
        grace_minutes
      `)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .eq('employee_id', input.employeeId)
      .eq('weekday', weekday)
      .eq('shift_number', input.shiftNumber)
      .eq('is_active', true)
      .maybeSingle()

  if (shiftError || !shift) {
    throw new Error('لا توجد وردية نشطة للموظف في هذا اليوم')
  }

  const { data: existing, error: existingError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .select('id, check_in_at, status')
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .eq('employee_id', input.employeeId)
      .eq('work_date', input.workDate)
      .eq('shift_number', input.shiftNumber)
      .maybeSingle()

  if (existingError) {
    throw new Error('تعذر التحقق من سجل الحضور')
  }

  if (existing?.check_in_at) {
    throw new Error('تم تسجيل الحضور لهذه الوردية بالفعل')
  }

  if (
    existing &&
    ['leave', 'absent_approved', 'cancelled'].includes(existing.status)
  ) {
    throw new Error('لا يمكن تسجيل الحضور على هذه الحالة')
  }

  const startsAt = shift.starts_at
  const endsAt = shift.ends_at

  const endsOn =
    endsAt <= startsAt
      ? addOneDay(input.workDate)
      : input.workDate

  const now = new Date()
  const nowIso = now.toISOString()

  const scheduledStartAt = cairoTimeToUtc(
    input.workDate,
    startsAt
  )

  const scheduledEndAt = cairoTimeToUtc(
    endsOn,
    endsAt
  )

  const graceMinutes = Math.max(
    0,
    Number(shift.grace_minutes) || 0
  )

  const allowedStart =
    new Date(scheduledStartAt).getTime() +
    graceMinutes * 60000

  const lateMinutes = Math.max(
    0,
    Math.floor(
      (now.getTime() - allowedStart) / 60000
    )
  )

  const payload = {
    store_id: context.storeId,
    branch_id: input.branchId,
    employee_id: input.employeeId,
    work_date: input.workDate,
    shift_number: input.shiftNumber,
    scheduled_start_at: scheduledStartAt,
    scheduled_end_at: scheduledEndAt,
    grace_minutes: graceMinutes,
    late_minutes: lateMinutes,
    early_leave_minutes: 0,
    check_in_at: nowIso,
    status: 'present',
    updated_by: context.user.id,
    updated_at: nowIso,
  }

  let attendanceId: string

  if (existing) {
    const { data, error } = await context.supabase
      .from('dokkan_employee_attendance')
      .update(payload)
      .eq('id', existing.id)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .is('check_in_at', null)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      throw new Error('تعذر تسجيل الحضور')
    }

    attendanceId = data.id
  } else {
    const { data, error } = await context.supabase
      .from('dokkan_employee_attendance')
      .insert({
        ...payload,
        created_by: context.user.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[EmployeeAttendance] Check-in failed:', error?.code)
      throw new Error('تعذر تسجيل الحضور')
    }

    attendanceId = data.id
  }

  revalidatePath('/employees')

  return attendanceId
}

export async function recordEmployeeCheckOut(
  attendanceId: string,
  branchId: string
) {
  validateUuid(attendanceId, 'معرف سجل الحضور')
  validateUuid(branchId, 'معرف الفرع')

  const context = await getAttendanceContext(branchId)

  const { data: attendance, error: loadError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .select(`
        id,
        check_in_at,
        check_out_at,
        scheduled_end_at
      `)
      .eq('id', attendanceId)
      .eq('store_id', context.storeId)
      .eq('branch_id', branchId)
      .maybeSingle()

  if (loadError || !attendance) {
    throw new Error('سجل الحضور غير موجود')
  }

  if (!attendance.check_in_at) {
    throw new Error('يجب تسجيل الحضور أولاً')
  }

  if (attendance.check_out_at) {
    throw new Error('تم تسجيل الانصراف بالفعل')
  }

  const openBreak = await getOpenBreak(
    context,
    attendanceId,
    branchId
  )

  if (openBreak) {
    throw new Error('يجب إنهاء الاستراحة المفتوحة قبل تسجيل الانصراف')
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const scheduledEnd = new Date(
    attendance.scheduled_end_at
  ).getTime()

  if (!Number.isFinite(scheduledEnd)) {
    throw new Error('موعد نهاية الوردية غير صحيح')
  }

  // Early departure is calculated independently from overtime.
  const earlyLeaveMinutes = Math.max(
    0,
    Math.floor(
      (scheduledEnd - now.getTime()) / 60000
    )
  )

  // Only break time overlapping the overtime period is deducted.
  let overtimeBreakMinutes = 0

  if (now.getTime() > scheduledEnd) {
    const { data: breaks, error: breaksError } =
      await context.supabase
        .from('dokkan_employee_attendance_breaks')
        .select('started_at, ended_at')
        .eq('store_id', context.storeId)
        .eq('branch_id', branchId)
        .eq('attendance_id', attendanceId)
        .not('ended_at', 'is', null)

    if (breaksError) {
      throw new Error('تعذر حساب وقت الاستراحات')
    }

    for (const item of breaks ?? []) {
      if (!item.ended_at) continue

      const breakStart = new Date(item.started_at).getTime()
      const breakEnd = new Date(item.ended_at).getTime()

      const overlapStart = Math.max(
        breakStart,
        scheduledEnd
      )

      const overlapEnd = Math.min(
        breakEnd,
        now.getTime()
      )

      if (overlapEnd > overlapStart) {
        overtimeBreakMinutes +=
          (overlapEnd - overlapStart) / 60000
      }
    }
  }

  const rawOvertimeMinutes = Math.max(
    0,
    (now.getTime() - scheduledEnd) / 60000
  )

  const overtimeMinutes = Math.max(
    0,
    Math.floor(
      rawOvertimeMinutes - overtimeBreakMinutes
    )
  )

  const { data: updated, error } = await context.supabase
    .from('dokkan_employee_attendance')
    .update({
      check_out_at: nowIso,
      early_leave_minutes: earlyLeaveMinutes,
      overtime_minutes: overtimeMinutes,
      overtime_status:
        overtimeMinutes > 0 ? 'pending' : 'none',
      updated_by: context.user.id,
      updated_at: nowIso,
    })
    .eq('id', attendanceId)
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .is('check_out_at', null)
    .select('id')
    .maybeSingle()

  if (error || !updated) {
    console.error('[EmployeeAttendance] Check-out failed:', error?.code)
    throw new Error('تعذر تسجيل الانصراف، ربما تم تسجيله بالفعل')
  }

  revalidatePath('/employees')

  return attendanceId
}

export async function startEmployeeBreak(
  attendanceId: string,
  branchId: string,
  breakType: BreakType = 'regular',
  notes?: string
) {
  validateUuid(attendanceId, 'معرف سجل الحضور')
  validateUuid(branchId, 'معرف الفرع')

  if (!['regular', 'personal', 'other'].includes(breakType)) {
    throw new Error('نوع الاستراحة غير صحيح')
  }

  if (notes && notes.length > 500) {
    throw new Error('ملاحظات الاستراحة أطول من المسموح')
  }

  const context = await getAttendanceContext(branchId)

  const { data: attendance, error: attendanceError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .select('id, check_in_at, check_out_at')
      .eq('id', attendanceId)
      .eq('store_id', context.storeId)
      .eq('branch_id', branchId)
      .maybeSingle()

  if (attendanceError || !attendance) {
    throw new Error('سجل الحضور غير موجود')
  }

  if (!attendance.check_in_at || attendance.check_out_at) {
    throw new Error('لا يمكن بدء استراحة خارج وقت العمل')
  }

  const openBreak = await getOpenBreak(
    context,
    attendanceId,
    branchId
  )

  if (openBreak) {
    throw new Error('هناك استراحة لم يتم إنهاؤها بعد')
  }

  const { data, error } = await context.supabase
    .from('dokkan_employee_attendance_breaks')
    .insert({
      store_id: context.storeId,
      branch_id: branchId,
      attendance_id: attendanceId,
      started_at: new Date().toISOString(),
      break_type: breakType,
      notes: notes?.trim() || null,
      created_by: context.user.id,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[EmployeeAttendance] Break start failed:', error?.code)
    throw new Error('تعذر تسجيل بداية الاستراحة')
  }

  revalidatePath('/employees')

  return data.id
}

export async function endEmployeeBreak(
  breakId: string,
  attendanceId: string,
  branchId: string
) {
  validateUuid(breakId, 'معرف الاستراحة')
  validateUuid(attendanceId, 'معرف سجل الحضور')
  validateUuid(branchId, 'معرف الفرع')

  const context = await getAttendanceContext(branchId)

  const { data: attendance, error: attendanceError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .select('id, check_in_at, check_out_at')
      .eq('id', attendanceId)
      .eq('store_id', context.storeId)
      .eq('branch_id', branchId)
      .maybeSingle()

  if (attendanceError || !attendance) {
    throw new Error('سجل الحضور غير موجود')
  }

  if (!attendance.check_in_at || attendance.check_out_at) {
    throw new Error('لا يمكن إنهاء استراحة خارج وقت العمل')
  }

  const endedAt = new Date().toISOString()

  const { data, error } = await context.supabase
    .from('dokkan_employee_attendance_breaks')
    .update({
      ended_at: endedAt,
      ended_by: context.user.id,
    })
    .eq('id', breakId)
    .eq('attendance_id', attendanceId)
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .is('ended_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('[EmployeeAttendance] Break end failed:', error?.code)
    throw new Error('تعذر إنهاء الاستراحة أو أنها منتهية بالفعل')
  }

  revalidatePath('/employees')

  return data.id
}