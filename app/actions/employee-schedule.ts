
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

type BreakMode = 'none' | 'fixed' | 'variable'

type SaveWeeklyShiftInput = {
  id?: string
  employeeId: string
  branchId: string
  weekday: number
  shiftNumber: 1 | 2
  startsAt: string
  endsAt: string
  graceMinutes?: number
  breakMode: BreakMode
  fixedBreakMinutes?: number
  isActive?: boolean
  changeReason: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value || '')) {
    throw new Error(`${label} غير صحيح`)
  }
}

function normalizeTime(value: string) {
  const time = value?.trim()

  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return `${time}:00`
  }

  if (/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time)) {
    return time
  }

  throw new Error('وقت الوردية غير صحيح')
}

function validateShiftInput(input: SaveWeeklyShiftInput) {
  validateUuid(input.employeeId, 'معرف الموظف')
  validateUuid(input.branchId, 'معرف الفرع')

  if (input.id) {
    validateUuid(input.id, 'معرف الوردية')
  }

  if (
    !Number.isInteger(input.weekday) ||
    input.weekday < 0 ||
    input.weekday > 6
  ) {
    throw new Error('يوم الأسبوع غير صحيح')
  }

  if (![1, 2].includes(input.shiftNumber)) {
    throw new Error('رقم الوردية غير صحيح')
  }

  const startsAt = normalizeTime(input.startsAt)
  const endsAt = normalizeTime(input.endsAt)

  const graceMinutes = input.graceMinutes ?? 0
  const fixedBreakMinutes = input.fixedBreakMinutes ?? 0

  if (
    !Number.isInteger(graceMinutes) ||
    graceMinutes < 0 ||
    graceMinutes > 240
  ) {
    throw new Error('فترة السماح يجب أن تكون بين صفر و240 دقيقة')
  }

  if (
    !Number.isInteger(fixedBreakMinutes) ||
    fixedBreakMinutes < 0 ||
    fixedBreakMinutes > 600
  ) {
    throw new Error('مدة الاستراحة غير صحيحة')
  }

  if (!['none', 'fixed', 'variable'].includes(input.breakMode)) {
    throw new Error('نوع الاستراحة غير صحيح')
  }

  if (
    input.breakMode === 'none' &&
    fixedBreakMinutes !== 0
  ) {
    throw new Error('لا يمكن تحديد مدة استراحة عند اختيار بدون استراحة')
  }

  if (
    input.breakMode === 'fixed' &&
    fixedBreakMinutes <= 0
  ) {
    throw new Error('يجب تحديد مدة الاستراحة الثابتة')
  }

  const changeReason = input.changeReason?.trim()

  if (!changeReason || changeReason.length < 3) {
    throw new Error('سبب تعديل الوردية مطلوب')
  }

  if (changeReason.length > 500) {
    throw new Error('سبب التعديل أطول من المسموح')
  }

  return {
    startsAt,
    endsAt,
    graceMinutes,
    fixedBreakMinutes,
    changeReason,
  }
}

async function getScheduleContext(branchId: string, employeeId: string) {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const { data: branch, error: branchError } = await context.supabase
    .from('dokkan_branches')
    .select('id')
    .eq('id', branchId)
    .eq('store_id', context.storeId)
    .eq('status', 'active')
    .maybeSingle()

  if (branchError || !branch) {
    throw new Error('الفرع غير صحيح أو غير نشط')
  }

  const { data: employee, error: employeeError } =
    await context.supabase
      .from('dokkan_employees')
      .select('id')
      .eq('id', employeeId)
      .eq('store_id', context.storeId)
      .eq('branch_id', branchId)
      .eq('status', 'active')
      .maybeSingle()

  if (employeeError || !employee) {
    throw new Error('الموظف غير موجود في هذا الفرع أو غير نشط')
  }

  return context
}

export async function getEmployeeWeeklyShifts(
  employeeId: string,
  branchId: string
) {
  validateUuid(employeeId, 'معرف الموظف')
  validateUuid(branchId, 'معرف الفرع')

  const context = await getScheduleContext(branchId, employeeId)

  const { data, error } = await context.supabase
    .from('dokkan_employee_weekly_shifts')
    .select(`
      id,
      employee_id,
      branch_id,
      weekday,
      shift_number,
      starts_at,
      ends_at,
      grace_minutes,
      break_mode,
      fixed_break_minutes,
      is_active,
      change_reason,
      created_at,
      updated_at
    `)
    .eq('store_id', context.storeId)
    .eq('branch_id', branchId)
    .eq('employee_id', employeeId)
    .order('weekday', { ascending: true })
    .order('shift_number', { ascending: true })

  if (error) {
    console.error('[EmployeeSchedule] Load failed:', error.code)
    throw new Error('تعذر تحميل جدول الورديات')
  }

  return data ?? []
}

export async function saveEmployeeWeeklyShift(
  input: SaveWeeklyShiftInput
) {
  const values = validateShiftInput(input)

  const context = await getScheduleContext(
    input.branchId,
    input.employeeId
  )

  const payload = {
    store_id: context.storeId,
    branch_id: input.branchId,
    employee_id: input.employeeId,
    weekday: input.weekday,
    shift_number: input.shiftNumber,
    starts_at: values.startsAt,
    ends_at: values.endsAt,
    grace_minutes: values.graceMinutes,
    break_mode: input.breakMode,
    fixed_break_minutes: values.fixedBreakMinutes,
    is_active: input.isActive ?? true,
    change_reason: values.changeReason,
    updated_at: new Date().toISOString(),
  }

  let shiftId = input.id

  // If no ID was supplied, look for the existing slot.
  if (!shiftId) {
    const { data: existing, error: lookupError } =
      await context.supabase
        .from('dokkan_employee_weekly_shifts')
        .select('id')
        .eq('store_id', context.storeId)
        .eq('branch_id', input.branchId)
        .eq('employee_id', input.employeeId)
        .eq('weekday', input.weekday)
        .eq('shift_number', input.shiftNumber)
        .maybeSingle()

    if (lookupError) {
      console.error(
        '[EmployeeSchedule] Existing shift lookup failed:',
        lookupError.code
      )
      throw new Error('تعذر التحقق من الوردية الحالية')
    }

    shiftId = existing?.id
  }

  if (shiftId) {
    const { data, error } = await context.supabase
      .from('dokkan_employee_weekly_shifts')
      .update(payload)
      .eq('id', shiftId)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .eq('employee_id', input.employeeId)
      .select('id')
      .maybeSingle()

    if (error || !data) {
      console.error(
        '[EmployeeSchedule] Update failed:',
        error?.code
      )
      throw new Error('تعذر تعديل الوردية')
    }

    shiftId = data.id
  } else {
    const { data, error } = await context.supabase
      .from('dokkan_employee_weekly_shifts')
      .insert({
        ...payload,
        created_by: context.user.id,
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error(
        '[EmployeeSchedule] Create failed:',
        error?.code
      )
      throw new Error('تعذر إضافة الوردية')
    }

    shiftId = data.id
  }

  revalidatePath('/employees')

  return shiftId
}
