
'use server'

import { clearStoreSectionPinSession } from '@/lib/store-section-pin'

export async function logoutAction(): Promise<{
  success: boolean
}> {
  try {
    await clearStoreSectionPinSession()
    return { success: true }
  } catch {
    return { success: false }
  }
}
