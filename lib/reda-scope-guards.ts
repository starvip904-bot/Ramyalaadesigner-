export const REDA_STORE_ID = '737055df-14f0-40c2-8e6a-98fc9e4f68e3' as const

export function assertRedaStoreId(storeId: string | null | undefined) {
  if (storeId !== REDA_STORE_ID) throw new Error('REDA_SCOPE_VIOLATION')
  return REDA_STORE_ID
}

export function requireRedaStoreId(candidate?: string | null) {
  return assertRedaStoreId(candidate ?? REDA_STORE_ID)
}
