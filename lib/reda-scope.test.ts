import { strict as assert } from 'node:assert'

import {
  assertStoreScope,
  requireStoreScope,
} from './reda-scope-guards.ts'

const storeA = '11111111-1111-4111-8111-111111111111'
const storeB = '22222222-2222-4222-8222-222222222222'

assert.equal(
  assertStoreScope(storeA, storeA),
  storeA
)

assert.equal(
  requireStoreScope(storeB, storeB),
  storeB
)

assert.throws(
  () => assertStoreScope(storeA, storeB),
  /STORE_ACCESS_DENIED/
)

assert.throws(
  () => assertStoreScope(storeA, null),
  /STORE_CONTEXT_REQUIRED/
)

assert.throws(
  () => assertStoreScope(null, storeA),
  /STORE_ID_REQUIRED/
)

assert.throws(
  () => requireStoreScope(storeB, storeA),
  /STORE_ACCESS_DENIED/
)

console.log('Tenant scope guard tests passed')