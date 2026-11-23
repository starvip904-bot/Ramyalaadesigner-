
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
    console.error(
      '[Employees] Load failed:',
      employeesResult.error.code
    )
    throw new Error('تعذر تحميل الموظفين')
  }

  if (branchesResult.error) {
    console.error(
      '[Employees] Branches load failed:',
      branchesResult.error.code
    )
    throw new Error('تعذر تحميل الفروع')
  }

  const employees = employeesResult.data ?? []
  const hasAdminKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  )

  const invitationByEmployee = new Map<
    string,
    {
      id: string
      email: string
      status: InvitationStatus
    }
  >()

  const branchIdsByInvitation = new Map<string, string[]>()

  let invitationStatusAvailable = hasAdminKey

  if (hasAdminKey && employees.length > 0) {
    try {
      const admin = createAdminClient()

      const { data: invitations, error: invitationsError } =
        await admin
          .from('dokkan_employee_invitations')
          .select('id, employee_id, email, status, created_at')
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
            id: invitation.id,
            email: invitation.email,
            status: invitation.status as InvitationStatus,
          })
        }
      }

      const invitationIds = Array.from(
        invitationByEmployee.values()
      ).map((item) => item.id)

      if (invitationIds.length > 0) {
        const { data: invitationBranches, error: branchesError } =
          await admin
            .from('dokkan_employee_invitation_branches')
            .select('invitation_id, branch_id')
            .eq('store_id', context.storeId)
            .in('invitation_id', invitationIds)

        if (branchesError) {
          console.error(
            '[Employees] Invitation branches load failed:',
            branchesError.code
          )
          throw new Error('INVITATION_BRANCHES_LOAD_FAILED')
        }

        for (const item of invitationBranches ?? []) {
          const current =
            branchIdsByInvitation.get(item.invitation_id) ?? []

          current.push(item.branch_id)
          branchIdsByInvitation.set(item.invitation_id, current)
        }
      }
    } catch {
      invitationStatusAvailable = false
      invitationByEmployee.clear()
      branchIdsByInvitation.clear()
    }
  }

  const employeesWithInvitation = employees.map((employee) => {
    const invitation = invitationByEmployee.get(employee.id)

    const assignedBranchIds = invitation
      ? branchIdsByInvitation.get(invitation.id) ?? []
      : employee.branch_id
        ? [employee.branch_id]
        : []

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
    employees: employeesWithInvitation,
    branches: branchesResult.data ?? [],
  }
}
