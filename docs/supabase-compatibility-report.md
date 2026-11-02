# DOKKAN Supabase Compatibility Mapping — Phase 7

## Scope and evidence

This is a code-grounded mapping for commit `489d40b` on branch `v0/core-management-pages`. The frontend currently uses an in-memory repository and contains no Supabase client, package, query, schema file, or RPC wrapper. The `dokkan_*` direction and RPC names below are based on the verified database facts supplied for this phase; table columns, foreign keys, RLS policies, and non-sale RPC signatures remain unverified because no Supabase connection or schema inspection was performed.

Legacy table names such as `stores`, `products`, and `store_members` are deliberately excluded as implementation targets. They must not be used as substitutes for the Dokkan schema.

## Files inspected

- `data/models.ts` — all current domain types and enums.
- `data/mock-repository.ts` — seed data, repository operations, validation, inventory mutations, audit events, and mock role matrix.
- `components/dokkan-app.tsx` — route dispatch and management surface selection.
- `components/management-page.tsx` — product, inventory, expense, and legacy management UI.
- `components/workflow-page.tsx` — branch, transfer, employee, statement, purchase, returns, and report UI.
- `components/pos-page.tsx` — POS validation and sale posting behavior.
- `lib/pos.ts` — sale totals, remaining balance, stock validation, and payment methods.
- `lib/pos.test.ts` — POS calculation and stock tests.
- `lib/workflows.test.ts` — purchase receiving, supplier payment, returns, transfers, and negative-stock tests.
- `docs/supabase-compatibility-report.md` — previous compatibility assumptions and migration checklist.

## Current model-to-Dokkan mapping

The table names in the `dokkan_*` column are target candidates, not claims that the columns exist exactly as shown. They require confirmation against the existing schema before any adapter is written.

| Type | Current fields | Intended Dokkan target | Status | Required verification |
| --- | --- | --- | --- | --- |
| `Store` | `id`, `name`, `phone`, `status`, `branchIds` | `dokkan_stores` | Partial | Confirm primary key type, status enum, and whether branch membership is derived or stored. |
| `Branch` | `storeId`, `name`, `address`, `status`, `employeeIds` | `dokkan_branches` | Partial | Confirm `store_id`, active flag/status, and whether a branch belongs to one store. |
| `Product` | `name`, `category`, `brand`, `status`, `variants` | `dokkan_products` plus category relation | Partial | Confirm category storage and whether product status is an enum. |
| `ProductVariant` | SKU, barcode, size, color, price, cost | `dokkan_product_variants` or variant columns on `dokkan_products` | Unsupported until schema inspection | Confirm whether variants are normalized and which table owns SKU/barcode uniqueness. |
| `InventoryItem` | branch, variant, quantity, reorder level | `dokkan_inventory` / `dokkan_stock_balances` candidate | Unsupported until schema inspection | Confirm exact table and whether quantity is derived from movements. |
| `StockMovement` | branch, variant, type, quantity, reference | `dokkan_stock_movements` candidate | Partial | Confirm movement types, signed quantity convention, and source reference columns. |
| `InventoryTransfer` | source, destination, variant, quantity, status | `dokkan_inventory_transfers` candidate | Unsupported | No confirmed multi-branch transfer model is available. |
| `Customer` | name, phone, totals, balance | `dokkan_customers` candidate | Partial | Confirm balance derivation versus stored balance and store scope. |
| `Supplier` | name, phone, category, balance | `dokkan_suppliers` candidate | Partial | Confirm supplier ledger and balance ownership. |
| `Sale` / `SaleItem` | branch, customer, items, totals, payment | `dokkan_sales` and sale-line relation, posted through `dokkan_post_sale` | Partial / supported for posting shape | RPC signature is verified; table return shape and line persistence are not. |
| `Purchase` / `PurchaseItem` | supplier, branch, items, receiving status | `dokkan_purchases` and purchase-line relation, posted through `dokkan_post_purchase` | Partial | RPC exists, but exact parameters, receiving semantics, and return shape are unverified. |
| `SupplierPayment` | supplier, purchase, amount, method | `dokkan_supplier_payments` candidate | Unsupported | No verified payment table or RPC. |
| `CustomerPayment` | customer, amount, method | `dokkan_customer_payments` candidate | Unsupported | No verified payment table or RPC. |
| `SaleReturn` | sale, returned lines, refund, type | `dokkan_sale_returns` and return lines candidate | Unsupported | No verified return operation or idempotency model. |
| `Expense` | branch, title, category, amount, status | `dokkan_expenses`, posted through `dokkan_record_expense` | Partial / supported for RPC existence | Confirm exact RPC arguments and whether it creates a ledger entry. |
| `Employee` | name, phone, role, `branchIds` | Auth user/profile plus Dokkan membership/role tables | Partial | Database roles are owner, manager, cashier, and inventory-related permissions; no confirmed multi-branch employee assignment model exists. |
| `PermissionSet` | frontend role and permission labels | Dokkan role/permission policies | Partial | Must map to database permissions, not frontend role strings. |
| `AuditEntry` | actor, action, reference, timestamp | Dokkan audit/event table candidate | Unsupported | No confirmed audit table or append RPC. |

## Verified RPCs and current operation compatibility

Only RPC existence and the stated sale signature are verified here. The other argument lists must not be guessed.

### `dokkan_post_sale`

Verified inputs: store ID, branch ID, JSON items, discount, paid amount, payment method, customer ID, and notes. Verified return: UUID.

Current caller: `components/pos-page.tsx` currently calls `mockRepository.createSale` with branch, item lines, subtotal, discount, total, payment method, paid amount, and remaining balance. The future adapter must:

1. Resolve the active store ID and authenticated actor outside the POS component.
2. Transform `SaleItem[]` into the RPC's exact JSON item contract.
3. Pass discount as the database expects, distinguishing percentage from amount.
4. Preserve customer ID and notes when the POS flow adds them.
5. Treat the returned UUID as the canonical sale ID.
6. Stop manually decrementing inventory after RPC success if the RPC already posts stock movements; otherwise duplicate stock reduction is possible.

Status: **Partially supported**. The business intent matches, but the current mock POS does not call the RPC and does not yet model store ID or notes.

### `dokkan_post_purchase`

The RPC is verified to exist. Its exact parameters, whether it posts receiving or only creates a purchase, whether it updates supplier balances, and whether it is idempotent are not verified.

Current callers: `workflow-page.tsx` creates/edits mock purchases and calls `receivePurchase` separately. The adapter must not assume that this is equivalent to `dokkan_post_purchase`; it needs an explicit create-versus-receive mapping.

Status: **Partial**.

### `dokkan_create_store`

The RPC is verified to exist. Exact arguments and return shape are not verified.

Current caller: `mockRepository.createBranch` creates only a branch under hardcoded `store-1`; there is no store creation UI in the current workflow screen.

Status: **Partial**.

### `dokkan_create_branch`

The RPC is verified to exist. Exact arguments, authorization, and employee membership behavior are not verified.

Current caller: `mockRepository.createBranch` accepts `storeId`, name, address, status, and employee IDs.

Status: **Partial**.

### `dokkan_create_product`

The RPC is verified to exist. Exact variant/category argument structure is not verified.

Current caller: product creation is handled by `mockRepository.createProduct` with nested variants.

Status: **Partial**.

### `dokkan_record_expense`

The RPC is verified to exist. Exact amount, category, branch, reference, and actor arguments are not verified.

Current caller: `mockRepository.createExpense` stores branch, title, category, amount, status, and timestamp.

Status: **Partial**.

## Repository operation mapping

| Mock operation | Current behavior | Supabase adapter target | Status |
| --- | --- | --- | --- |
| `listProducts`, `createProduct`, `updateProduct`, `deleteProduct` | In-memory nested product/variant mutation | Dokkan product reads plus `dokkan_create_product`; update/delete RPCs or authorized table mutations | Partial |
| `listInventory`, `adjustStock` | Direct balance mutation with negative-stock rejection | Dokkan balance view plus locked stock-movement RPC | Unsupported until exact schema/RPC is known |
| `requestTransfer`, `receiveTransfer` | Creates request then updates both balances on receipt | Transfer table/RPC pair; no confirmed database model | Unsupported |
| `createSale` | Creates sale only; POS manually decrements inventory | `dokkan_post_sale` | Partial |
| `createPurchase`, `updatePurchase`, `receivePurchase` | Pending order, edit-before-receive, idempotent mock receive | `dokkan_post_purchase` plus receiving operation if separate | Partial |
| `paySupplier` | Reduces mock supplier balance and appends payment | Supplier payment RPC/ledger | Unsupported |
| `payCustomer` | Reduces mock customer balance and appends payment | Customer payment RPC/ledger | Unsupported |
| `returnSale` | Validates quantities and restores mock inventory | Return/refund RPC with idempotency key | Unsupported |
| `createBranch`, `updateBranch` | Mutates branch and employee IDs in memory | `dokkan_create_branch` and verified branch update mechanism | Partial |
| `updateEmployeeRole`, `updateEmployeeBranches` | Frontend employee object mutation | Auth/profile + Dokkan membership/permission model | Partial / branch assignment unsupported |
| `createExpense`, `deleteExpense` | In-memory expense mutation | `dokkan_record_expense` plus authorized reversal/delete behavior | Partial |
| `listAudit` | In-memory append-only array | Confirmed audit table or server-side event trigger | Unsupported |
| reports/statements | Client-side array filtering and calculation | SQL views/RPCs scoped to store and branch | Unsupported until schema verification |

## Missing database operations

The existing verified RPC list does not cover these operations. They need an existing equivalent discovered or a future approved database design; this phase does not create either.

- Sale returns and exchanges, including line-level quantity validation, refund ledger, stock restoration, and duplicate return keys.
- Customer payments, customer account statements, and customer return credits.
- Supplier payments, supplier account statements, and supplier return/debit handling.
- Purchase receiving confirmation separate from purchase creation, if `dokkan_post_purchase` does not receive stock.
- Inventory transfer request and destination receipt with atomic source/destination updates.
- Employee create/update/deactivate and employee-to-multiple-branch assignment.
- Permission lookup for the database's owner, manager, cashier, and inventory-related permissions.
- Audit event append and query operations with authenticated actor identity.
- Server-side report and statement queries with date and branch filters.

## Secure role mapping proposal — do not implement yet

Frontend roles must be treated as product-level labels, not database authorization values:

- **Owner** → database store owner role; all store-scoped operations, including membership and financial corrections.
- **Manager** → database manager role; operational management and reports, but no owner/membership transfer unless the schema explicitly grants it.
- **Cashier** → database cashier role; `dokkan_post_sale`, sale lookup, customer selection, and permitted returns only.
- **Stock Manager** → map to the database's inventory-related permission set, not a new role string. Allow inventory reads, adjustments, purchase receiving, and transfers only if RLS/RPC policies grant them.
- **Viewer** → read-only application role implemented by the adapter/UI only if the database provides a read-only policy; never infer it from hidden buttons.

The adapter must resolve permissions from the authenticated Supabase session and store membership. It must reject unauthorized operations server-side even when the UI hides the action.

## UI assumptions that are not supported by the verified database facts

- `components/dokkan-app.tsx` renders a single hardcoded store context and the mock workflow uses `store-1`.
- `data/mock-repository.ts` uses employee IDs such as `employee-1` as authenticated actors and audit users.
- `Branch.employeeIds` and `Employee.branchIds` assume an employee can be assigned to multiple branches; this is explicitly unconfirmed in the database.
- `mockRepository.can` uses frontend `owner`, `manager`, `cashier`, `stock_manager`, and `viewer` strings, while the database has owner, manager, cashier, and inventory-related permissions rather than a confirmed matching enum.
- `components/pos-page.tsx` hardcodes `branch-1`, creates the sale locally, then decrements inventory locally; this must be replaced by one authoritative `dokkan_post_sale` adapter transaction.
- Reports and statements assume direct client-readable arrays and derive balances locally.
- Audit entries use a hardcoded mock employee instead of `auth.uid()` and a database employee/profile lookup.
- The UI assumes a branch can be activated/deactivated and edited with direct writes; the corresponding Dokkan authorization and RPC behavior is unverified.

## Proposed adapter interface

```ts
interface DokkanRepository {
  getContext(): Promise<{ storeId: string; employeeId: string; permissions: string[] }>
  listProducts(input: { storeId: string }): Promise<Product[]>
  createProduct(input: CreateProductInput): Promise<{ id: string }>
  listBranches(input: { storeId: string }): Promise<Branch[]>
  createBranch(input: CreateBranchInput): Promise<{ id: string }>
  listInventory(input: { storeId: string; branchId?: string }): Promise<InventoryItem[]>
  postSale(input: PostSaleInput): Promise<{ saleId: string }>
  postPurchase(input: PostPurchaseInput): Promise<{ purchaseId: string }>
  receivePurchase(input: ReceivePurchaseInput): Promise<void>
  recordExpense(input: RecordExpenseInput): Promise<{ expenseId: string }>
  recordSupplierPayment(input: SupplierPaymentInput): Promise<void>
  recordCustomerPayment(input: CustomerPaymentInput): Promise<void>
  returnSale(input: ReturnSaleInput): Promise<void>
  requestTransfer(input: TransferInput): Promise<{ transferId: string }>
  receiveTransfer(input: { transferId: string }): Promise<void>
  getCustomerStatement(input: StatementFilter): Promise<CustomerStatement>
  getSupplierStatement(input: StatementFilter): Promise<SupplierStatement>
  getReport(input: ReportFilter): Promise<ReportSummary>
}
```

The adapter should be server-side, validate all inputs with the same domain rules as the mock repository, use the exact Dokkan RPC signatures, and return normalized domain models. It must not expose service-role credentials to the browser.

## Implementation plan after schema inspection

1. Inspect the live `dokkan_*` table definitions, RPC arguments/returns, enum values, RLS policies, and existing `dokkan_post_sale` implementation.
2. Build a schema contract document from actual definitions, not frontend names.
3. Implement a server-only adapter behind the existing repository surface; keep the mock adapter for tests and demo mode.
4. Map authenticated `auth.uid()` to an employee/profile and store membership before any query.
5. Route sale posting exclusively through `dokkan_post_sale` and remove the client-side inventory decrement after adapter integration.
6. Map purchase/expense creation to `dokkan_post_purchase`, `dokkan_create_*`, and `dokkan_record_expense` only after parameter verification.
7. Add or consume approved RPCs for returns, payments, transfers, statements, and reports; require idempotency and transaction locking.
8. Add contract tests against a disposable Supabase project, including RLS tests for every proposed role and branch scope.
9. Reconcile opening balances and inventory before enabling the adapter in production.

## Validation performed for Phase 7

No application code or database integration was changed in this phase. The required validation should still be run against the unchanged application:

- `npm run lint`
- `npm run test:pos`
- `npm run test:workflows`
- `npm run build`

## Unresolved blockers

- Exact `dokkan_*` table names, columns, foreign keys, enums, and RLS policies are not present in this repository and were not queried.
- Exact signatures/return contracts for `dokkan_post_purchase`, `dokkan_create_store`, `dokkan_create_branch`, `dokkan_create_product`, and `dokkan_record_expense` remain unknown.
- `dokkan_post_sale` behavior for inventory, balances, refunds, idempotency, and audit side effects needs verification despite its input/output signature being known.
- No confirmed employee-to-multiple-branch assignment model exists.
- No confirmed customer/supplier payment, return, transfer, statement, or audit RPC is available in the inspected project.
- The existing mock UI is not evidence that direct table mutations are allowed under production RLS.
- No Supabase package, environment variable, migration, auth change, or database object was added or modified.
