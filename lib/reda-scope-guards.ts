export function assertStoreScope(
  requestedStoreId: string | null | undefined,
  currentStoreId: string | null | undefined
) {
  if (!currentStoreId) {
    throw new Error('STORE_CONTEXT_REQUIRED')
  }

  if (!requestedStoreId) {
    throw new Error('STORE_ID_REQUIRED')
  }

  if (requestedStoreId !== currentStoreId) {
    throw new Error('STORE_ACCESS_DENIED')
  }

  return currentStoreId
}

export function requireStoreScope(
  requestedStoreId: string | null | undefined,
  currentStoreId: string | null | undefined
) {
  return assertStoreScope(requestedStoreId, currentStoreId)
}