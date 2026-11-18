'use server'

import { redirect } from 'next/navigation'
import { requirePlatformOwner } from '@/lib/tenant-context'

const OLD_OWNER_ID = 'e6e59e14-a3f0-4ec2-80aa-94035993461d'
const OLD_OWNER_EMAIL = 'kamelalaa480@gmail.com'
const NEW_OWNER_EMAIL = 'maxbin060@gmail.com'

export async function grantNewPlatformOwner() {
  const { supabase, user } = await requirePlatformOwner().catch(() => {
    redirect('/login?error=platform')
  })

  // تأكيد هوية المالك القديم فقط
  if (
    user.id !== OLD_OWNER_ID ||
    user.email?.toLowerCase() !== OLD_OWNER_EMAIL ||
    user.app_metadata?.platform_owner !== true
  ) {
    redirect('/platform?owner-grant=forbidden')
  }

  // استدعاء الوظيفة المؤقتة باستخدام جلسة المستخدم الحالية
  const { data, error } = await supabase.functions.invoke(
    'grant-platform-owner-once',
    { body: {} }
  )

  if (
    error ||
    data?.success !== true ||
    data?.email?.toLowerCase() !== NEW_OWNER_EMAIL ||
    data?.platform_owner !== true
  ) {
    redirect('/platform?owner-grant=error')
  }

  redirect('/platform?owner-grant=success')
}