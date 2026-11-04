import { strict as assert } from 'node:assert'
import { assertRedaStoreId, REDA_STORE_ID, requireRedaStoreId } from './reda-scope-guards.ts'

assert.equal(assertRedaStoreId(REDA_STORE_ID), REDA_STORE_ID)
assert.equal(requireRedaStoreId(), REDA_STORE_ID)
assert.throws(() => assertRedaStoreId('hix-store'), /REDA_SCOPE_VIOLATION/)
assert.throws(() => assertRedaStoreId('gege-store'), /REDA_SCOPE_VIOLATION/)
assert.throws(() => requireRedaStoreId('other-store'), /REDA_SCOPE_VIOLATION/)
