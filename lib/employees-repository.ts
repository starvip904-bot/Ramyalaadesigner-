
import 'server-only'

import { requireRedaContext } from '@/lib/reda-scope'
import { createAdminClient } from '@/lib/supabase/admin'

type InvitationStatus =
  | 'none'
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'expired'
  | 'cancelled'
  | 'unavailable'

export async function getEmployeesPageData() {
  const context = await requireRedaContext([
    'owner',
    'admin',
    'manager',
  ])

  const [employeesResult, branchesResult] = await Promise.all([
    context.supabase
      .from('dokkan_employees')
      .select(`
        id,
        name,
        phone,
        email,
        role,
        status,
        branch_id,
        created_at,
        updated_at
      `)
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: false }),

    context.supabase
      .from('dokkan_branches')
      .select('id, name, status')
      .eq('store_id', context.storeId)
      .order('created_at', { ascending: true }),
  ])

  if (employeesResult.error) {
    console.error('[Employees] Load failed:', employeesResult.error.code)
    throw new Error('تعذر تحميل الموظفين')
  }

  if (branchesResult.error) {
    console.error('[Employees] Branches load failed:', branchesResult.error.code)
    throw new Error('تعذر تحميل الفروع')
  }

  const employees = employeesResult.data ?? []
  const branchIdsByEmployee = new Map<string, string[]>()

  const invitationByEmployee = new Map<
    string,
    { email: string; status: InvitationStatus }
  >()

  let invitationStatusAvailable = false

  if (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SECRET_KEY) {
    try {
      const admin = createAdminClient()

      if (employees.length > 0) {
        const employeeIds = employees.map((employee) => employee.id)

        const { data: assignments, error: assignmentsError } =
          await admin
            .from('dokkan_employee_branches')
            .select('employee_id, branch_id')
            .eq('store_id', context.storeId)
            .in('employee_id', employeeIds)

        if (assignmentsError) {
          console.error(
            '[Employees] Branch assignments load failed:',
            assignmentsError.code
          )
          throw new Error('EMPLOYEE_BRANCHES_LOAD_FAILED')
        }

        for (const assignment of assignments ?? []) {
          const current =
            branchIdsByEmployee.get(assignment.employee_id) ?? []

          current.push(assignment.branch_id)
          branchIdsByEmployee.set(assignment.employee_id, current)
        }

        const { data: invitations, error: invitationsError } =
          await admin
            .from('dokkan_employee_invitations')
            .select('employee_id, email, status, created_at')
            .eq('store_id', context.storeId)
            .order('created_at', { ascending: false })

        if (invitationsError) {
          console.error(
            '[Employees] Invitations load failed:',
            invitationsError.code
          )
          throw new Error('INVITATIONS_LOAD_FAILED')
        }

        for (const invitation of invitations ?? []) {
          if (!invitationByEmployee.has(invitation.employee_id)) {
            invitationByEmployee.set(invitation.employee_id, {
              email: invitation.email,
              status: invitation.status as InvitationStatus,
            })
          }
        }
      }

      invitationStatusAvailable = true
    } catch {
      branchIdsByEmployee.clear()
      invitationByEmployee.clear()
      invitationStatusAvailable = false
    }
  }

  const employeesWithAssignments = employees.map((employee) => {
    const invitation = invitationByEmployee.get(employee.id)

    const assignedBranchIds =
      branchIdsByEmployee.get(employee.id) ??
      (employee.branch_id ? [employee.branch_id] : [])

    return {
      ...employee,
      email: employee.email ?? invitation?.email ?? null,
      invitation_status: invitationStatusAvailable
        ? invitation?.status ?? 'none'
        : 'unavailable',
      branch_ids: assignedBranchIds,
    }
  })

  return {
    storeId: context.storeId,
    employees: employeesWithAssignments,
    branches: branchesResult.data ?? [],
  }
}
