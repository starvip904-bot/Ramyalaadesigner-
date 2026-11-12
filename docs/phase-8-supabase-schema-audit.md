# Phase 8 — Read-Only Supabase Schema Audit

## Audit scope

- Repository branch: `v0/core-management-pages`
- Application baseline: commit `489d40b`
- Supabase resource inspected: `supabase-green-village`
- Resource/project identifier supplied to the read-only MCP: `olungwnvndxkfdtgcued`
- Audit mode: read-only
- Frontend integration: unchanged
- Database writes: none

This audit records only evidence returned by the connected Supabase resource. Missing objects are marked **UNKNOWN / NOT PRESENT IN INSPECTED RESOURCE**, not inferred from frontend code or earlier expectations.

## Exact read-only checks performed

1. `supabase_list_tables` for the `public` schema with verbose metadata.
2. `information_schema.tables` for all non-system schemas.
3. `pg_proc` / `pg_namespace` lookup for all public functions whose names begin with `dokkan_`.
4. `pg_proc` lookup for all public function definitions and signatures.
5. `pg_class` / `pg_namespace` lookup for application relations, relation kinds, and RLS flags.
6. `pg_policies` lookup for public and non-system policies.
7. `pg_type` / `pg_enum` lookup for custom enum values.
8. `supabase_list_migrations`.

No row-level business data, auth secrets, password hashes, service-role keys, or production records were selected.

## Observed database state

| Audit item | Observed result | Compatibility consequence |
| --- | --- | --- |
| Public table count | `0` | No `dokkan_*` table can be mapped in `public`. |
| Public `dokkan_*` function count | `0` | No `dokkan_post_sale`, `dokkan_post_purchase`, or other Dokkan RPC is available in the inspected resource. |
| Public RLS policy count | `0` | No public business-table RLS policy exists to inspect. |
| Public custom enum values | `0` | No public business enums or role enum values are present. |
| Migration history | `[]` | No migrations are visible through the connected project. |
| Non-system application relations | No verified application relations returned | Table columns, keys, foreign keys, indexes, and RLS flags cannot be audited because the application schema is absent from this resource. |
| Dokkan function definitions | `[]` | Full function behavior is unavailable. |
| Storage enum result | `storage.buckettype = STANDARD, ANALYTICS, VECTOR` | This is managed Storage metadata, not Dokkan business schema. |

### Important discrepancy

Earlier project context stated that Dokkan RPCs such as `dokkan_post_sale` and `dokkan_post_purchase` exist. The connected resource audited in this turn returned zero public `dokkan_*` functions and zero public tables. This is a blocking environment/resource mismatch. It must be resolved before treating any frontend-to-database mapping as verified.

Possible explanations are intentionally not chosen as fact: the connected resource may differ from the intended project, the schema may be in another schema not exposed by the current read-only context, or the stated database state may not have been applied to this resource.

## `dokkan_*` tables and schema objects

### Tables and columns

**Status: UNKNOWN / NOT PRESENT IN INSPECTED RESOURCE.**

No public relations were returned. Therefore the following cannot be verified:

- `dokkan_*` table names.
- Columns and data types.
- Primary keys.
- Foreign keys and delete behavior.
- Unique constraints.
- Check constraints.
- Generated columns and defaults.
- Indexes.
- Partitioning.
- Views or materialized views used for reports/statements.

No legacy tables were used as substitutes.

### RLS and policies

**Status: UNKNOWN for Dokkan tables; no public policies were returned.**

Because no public business relations were returned, there is no verified RLS enabled/forced state or policy definition for stores, branches, products, sales, purchases, inventory, payments, returns, employees, or audit events.

The audit cannot safely conclude that RLS is absent from the intended database; it can only conclude that no public policies were visible in the connected resource.

### Enums

No public custom enum values were returned. The only enum result observed was managed Storage metadata (`storage.buckettype`). Therefore database values for membership roles, payment methods, statuses, return types, and transfer states are **UNKNOWN**.

## RPC audit

### `dokkan_post_sale`

- Existence: **NOT FOUND in inspected public schema**.
- Argument names/types: **UNKNOWN**.
- Return type: **UNKNOWN**.
- Function definition: **UNKNOWN**.
- Stock update behavior: **UNKNOWN**.
- Audit logging: **UNKNOWN**.
- Customer balance behavior: **UNKNOWN**.
- Duplicate-posting protection: **UNKNOWN**.

The previously supplied claimed signature — store ID, branch ID, JSON items, discount, paid amount, payment method, customer ID, notes, returning a UUID — could not be confirmed against the connected resource.

### Other expected RPCs

| RPC | Existence in inspected resource | Arguments | Return | Behavior |
| --- | --- | --- | --- | --- |
| `dokkan_post_purchase` | Not found | Unknown | Unknown | Unknown |
| `dokkan_create_store` | Not found | Unknown | Unknown | Unknown |
| `dokkan_create_branch` | Not found | Unknown | Unknown | Unknown |
| `dokkan_create_product` | Not found | Unknown | Unknown | Unknown |
| `dokkan_record_expense` | Not found | Unknown | Unknown | Unknown |

No RPC behavior can be tested safely because none of these functions is visible in the inspected resource.

## Domain compatibility matrix

| Frontend model/operation | Expected Dokkan target | Audit result | Status |
| --- | --- | --- | --- |
| `Store` / store CRUD | `dokkan_*` store relation and create RPC | No relation or RPC found | Blocked |
| `Branch` / branch CRUD | `dokkan_*` branch relation and create RPC | No relation or RPC found | Blocked |
| Employee identity and roles | Auth/profile/membership relations | No public mapping visible | Blocked |
| Employee multi-branch assignment | Membership join relation | No relation visible | Unsupported in inspected resource |
| `Product` / variants | Dokkan product relations and create RPC | No relation or RPC found | Blocked |
| Inventory balances | Dokkan inventory/balance relation | No relation visible | Blocked |
| Stock movements | Dokkan movement relation/RPC | No relation visible | Blocked |
| Sales / POS posting | `dokkan_post_sale` | Function not found | Blocked |
| Purchase creation/receiving | `dokkan_post_purchase` or related RPC | Function not found | Blocked |
| Expenses | `dokkan_record_expense` | Function not found | Blocked |
| Supplier payments | Dokkan payment relation/RPC | Not found | Unsupported / unknown |
| Customer payments | Dokkan payment relation/RPC | Not found | Unsupported / unknown |
| Returns/exchanges | Dokkan return relation/RPC | Not found | Unsupported / unknown |
| Inventory transfers | Dokkan transfer relation/RPC | Not found | Unsupported / unknown |
| Customer statements | Dokkan ledger/view/RPC | Not found | Unsupported / unknown |
| Supplier statements | Dokkan ledger/view/RPC | Not found | Unsupported / unknown |
| Reports | Dokkan report view/RPC | Not found | Unsupported / unknown |
| Audit history | Dokkan audit relation/trigger/RPC | Not found | Unsupported / unknown |

## Frontend assumptions that cannot be accepted as database facts

The current mock application continues to use these local assumptions, but none is verified against the audited resource:

- `store-1`, `branch-1`, and `employee-1` are mock identifiers only.
- `Employee.branchIds` and `Branch.employeeIds` imply many-to-many employee assignment, but no database relationship was found.
- Frontend roles `owner`, `manager`, `cashier`, `stock_manager`, and `viewer` are not verified database enum values.
- Mock audit entries use a hardcoded employee identity rather than `auth.uid()`.
- Mock reports and statements derive totals from in-memory arrays.
- Mock POS behavior is not evidence of `dokkan_post_sale` stock, balance, audit, or idempotency behavior.
- Direct table writes must not be assumed safe or permitted under RLS.

## Blockers before integration

1. Resolve the resource mismatch: verify that `supabase-green-village` / `olungwnvndxkfdtgcued` is the intended project for the Dokkan schema.
2. Re-run read-only inspection against the correct resource or schema until the actual `dokkan_*` relations and RPCs are visible.
3. Obtain exact table columns, primary/foreign keys, indexes, constraints, defaults, and RLS policies.
4. Obtain exact signatures and definitions for `dokkan_post_sale`, `dokkan_post_purchase`, store/branch/product creation, and expense recording.
5. Verify whether `dokkan_post_sale` atomically handles stock, customer balances, payments, audit events, and duplicate protection.
6. Verify employee identity mapping from `auth.uid()` to a Dokkan employee/profile and store membership.
7. Verify database role values and inventory-related permissions before mapping frontend roles.
8. Verify support for returns, exchanges, supplier/customer payments, transfers, statements, and reports.
9. Do not add an adapter, migrations, RLS changes, or frontend Supabase calls until the above evidence exists.

## Recommended safe integration sequence

1. Confirm the correct Supabase resource and schema visibility using read-only metadata queries.
2. Export a schema contract containing exact Dokkan table/RPC definitions and RLS policies.
3. Map authenticated users to store membership and database permissions.
4. Implement a server-only adapter matching the existing repository interface.
5. Start with read-only product, branch, and inventory queries.
6. Add sale posting only after verifying and contract-testing `dokkan_post_sale`; prevent duplicate local inventory mutation.
7. Add purchase, expense, payment, return, transfer, statement, and report operations only when their database contracts are confirmed.
8. Run RLS tests for each role and branch/store boundary in a disposable environment.
9. Reconcile mock opening balances against database balances before enabling writes.

## Safety confirmation

- No database object was created, altered, or deleted.
- No function, policy, trigger, user, auth setting, or data row was modified.
- No Supabase package or frontend integration was added.
- No secrets or service-role keys were exposed.
- No deployment was performed.
