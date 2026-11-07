'use server'

export async function createMerchantStore(_input: { name: string; phone?: string }) {
  return { error: 'REDA_STORE_CREATION_DISABLED' }
}
