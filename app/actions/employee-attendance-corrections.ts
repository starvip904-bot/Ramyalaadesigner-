
'use server'

import { revalidatePath } from 'next/cache'
import { requireRedaContext } from '@/lib/reda-scope'

type CorrectAttendanceInput = {
  attendanceId: string
  branchId: string
  checkInAt: string | null
  checkOutAt: string | null
  reason: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function validateUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value || '')) {
    throw new Error(`${label} غير صحيح`)
  }
}

function normalizeTimestamp(value: string | null, label: string) {
  if (value === null) return null

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} غير صحيح`)
  }

  const timestamp = new Date(value)

  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error(`${label} غير صحيح`)
  }

  return timestamp.toISOString()
}

function validateReason(value: string) {
  const reason = value?.trim()

  if (!reason || reason.length < 3) {
    throw new Error('سبب التصحيح مطلوب ويجب ألا يقل عن 3 أحرف')
  }

  if (reason.length > 500) {
    throw new Error('سبب التصحيح أطول من المسموح')
  }

  return reason
}

export async function correctEmployeeAttendance(
  input: CorrectAttendanceInput
) {
  validateUuid(input.attendanceId, 'معرف سجل الحضور')
  validateUuid(input.branchId, 'معرف الفرع')

  const reason = validateReason(input.reason)
  const checkInAt = normalizeTimestamp(
    input.checkInAt,
    'وقت الحضور'
  )
  const checkOutAt = normalizeTimestamp(
    input.checkOutAt,
    'وقت الانصراف'
  )

  if (!checkInAt && checkOutAt) {
    throw new Error('لا يمكن تسجيل الانصراف دون وجود وقت حضور')
  }

  if (
    checkInAt &&
    checkOutAt &&
    new Date(checkOutAt).getTime() < new Date(checkInAt).getTime()
  ) {
    throw new Error('وقت الانصراف لا يمكن أن يسبق وقت الحضور')
  }

  if (!checkInAt && !checkOutAt) {
    // مسموح بإلغاء توقيتي الحضور والانصراف معًا عند تصحيح سجل خاطئ.
  }

  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const { data: branch, error: branchError } =
    await context.supabase
      .from('dokkan_branches')
      .select('id')
      .eq('id', input.branchId)
      .eq('store_id', context.storeId)
      .eq('status', 'active')
      .maybeSingle()

  if (branchError || !branch) {
    throw new Error('الفرع غير صحيح أو غير نشط')
  }

  const { data: attendance, error: loadError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .select(`
        id,
        employee_id,
        check_in_at,
        check_out_at,
        scheduled_start_at,
        scheduled_end_at,
        grace_minutes
      `)
      .eq('id', input.attendanceId)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .maybeSingle()

  if (loadError || !attendance) {
    throw new Error('سجل الحضور غير موجود في هذا الفرع')
  }

  const oldCheckIn = attendance.check_in_at
    ? new Date(attendance.check_in_at).toISOString()
    : null

  const oldCheckOut = attendance.check_out_at
    ? new Date(attendance.check_out_at).toISOString()
    : null

  if (
    oldCheckIn === checkInAt &&
    oldCheckOut === checkOutAt
  ) {
    throw new Error('لم يتم إدخال أي تغيير على أوقات الحضور والانصراف')
  }

  const scheduledStart = new Date(
    attendance.scheduled_start_at
  ).getTime()

  const scheduledEnd = new Date(
    attendance.scheduled_end_at
  ).getTime()

  if (
    !Number.isFinite(scheduledStart) ||
    !Number.isFinite(scheduledEnd) ||
    scheduledEnd <= scheduledStart
  ) {
    throw new Error('مواعيد الوردية المسجلة غير صحيحة')
  }

  const graceMinutes = Math.max(
    0,
    Number(attendance.grace_minutes) || 0
  )

  let lateMinutes = 0
  let earlyLeaveMinutes = 0
  let overtimeMinutes = 0

  if (checkInAt) {
    const actualCheckIn = new Date(checkInAt).getTime()

    lateMinutes = Math.max(
      0,
      Math.floor(
        (
          actualCheckIn -
          (scheduledStart + graceMinutes * 60000)
        ) / 60000
      )
    )
  }

  if (checkInAt && checkOutAt) {
    const actualCheckOut = new Date(checkOutAt).getTime()

    earlyLeaveMinutes = Math.max(
      0,
      Math.floor(
        (scheduledEnd - actualCheckOut) / 60000
      )
    )

    if (actualCheckOut > scheduledEnd) {
      const { data: breaks, error: breaksError } =
        await context.supabase
          .from('dokkan_employee_attendance_breaks')
          .select('started_at, ended_at')
          .eq('store_id', context.storeId)
          .eq('branch_id', input.branchId)
          .eq('attendance_id', input.attendanceId)
          .not('ended_at', 'is', null)

      if (breaksError) {
        throw new Error('تعذر تحميل الاستراحات لحساب العمل الإضافي')
      }

      let overtimeBreakMinutes = 0

      for (const item of breaks ?? []) {
        if (!item.ended_at) continue

        const breakStart = new Date(item.started_at).getTime()
        const breakEnd = new Date(item.ended_at).getTime()

        if (
          !Number.isFinite(breakStart) ||
          !Number.isFinite(breakEnd)
        ) {
          continue
        }

        const overlapStart = Math.max(
          breakStart,
          scheduledEnd
        )

        const overlapEnd = Math.min(
          breakEnd,
          actualCheckOut
        )

        if (overlapEnd > overlapStart) {
          overtimeBreakMinutes +=
            (overlapEnd - overlapStart) / 60000
        }
      }

      const rawOvertimeMinutes =
        (actualCheckOut - scheduledEnd) / 60000

      overtimeMinutes = Math.max(
        0,
        Math.floor(
          rawOvertimeMinutes - overtimeBreakMinutes
        )
      )
    }
  }

  if (checkOutAt) {
    const { data: openBreak, error: openBreakError } =
      await context.supabase
        .from('dokkan_employee_attendance_breaks')
        .select('id')
        .eq('store_id', context.storeId)
        .eq('branch_id', input.branchId)
        .eq('attendance_id', input.attendanceId)
        .is('ended_at', null)
        .maybeSingle()

    if (openBreakError) {
      throw new Error('تعذر التحقق من الاستراحات المفتوحة')
    }

    if (openBreak) {
      throw new Error('يجب إنهاء الاستراحة المفتوحة قبل تصحيح الانصراف')
    }
  }

  const now = new Date().toISOString()

  const { data: updated, error: updateError } =
    await context.supabase
      .from('dokkan_employee_attendance')
      .update({
        check_in_at: checkInAt,
        check_out_at: checkOutAt,
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
        overtime_minutes: overtimeMinutes,
        overtime_status:
          overtimeMinutes > 0 ? 'pending' : 'none',
        change_reason: reason,
        updated_by: context.user.id,
        updated_at: now,
      })
      .eq('id', input.attendanceId)
      .eq('store_id', context.storeId)
      .eq('branch_id', input.branchId)
      .select('id')
      .maybeSingle()

  if (updateError || !updated) {
    console.error(
      '[EmployeeAttendanceCorrection] Update failed:',
      updateError?.code
    )

    throw new Error('تعذر حفظ تصحيح الحضور والانصراف')
  }

  revalidatePath('/employees')

  return updated.id
}
