# DOKKAN Supabase Compatibility Report

## Scope
This report maps the current typed mock repository to a future Supabase implementation. No Supabase connection, migration, RPC, authentication, or database object was changed in Phase 5.

## Repository functions requiring Supabase implementations

| Repository operation | Required persistence | Transaction boundary |
| --- | --- | --- |
| `listProducts`, product CRUD | `products`, `product_variants`, categories | product + variants |
| `listInventory`, `adjustStock` | `inventory_balances`, `stock_movements` | stock movement + balance |
| `requestTransfer`, `receiveTransfer` | `inventory_transfers`, `stock_movements` | transfer state + both balances |
| purchase creation/receiving | `purchases`, `purchase_items`, `stock_movements` | idempotent receiving transaction |
| supplier/customer payments | `supplier_payments`, `customer_payments`, ledger entries | payment + balance update |
| `returnSale` | `sale_returns`, `sale_return_items`, `stock_movements`, refund ledger | return idempotency key |
| branch and employee updates | `branches`, `employees`, `employee_branches` | membership replacement |
| expenses | `expenses` | expense row + audit |
| audit history | `audit_events` | append-only event |
| reports/statements | views or RPCs over the above tables | consistent date/branch snapshot |

## Proposed model mapping

- `Store` → `stores`
- `Branch` → `branches` with `store_id`, `status`, address fields
- `Product` → `products`; `ProductVariant` → `product_variants`
- `InventoryItem` → `inventory_balances` keyed by `(branch_id, product_variant_id)`
- `StockMovement` → `stock_movements`
- `InventoryTransfer` → `inventory_transfers` and transfer lines if multi-line transfers are introduced
- `Purchase` / `PurchaseItem` → `purchases` / `purchase_items`
- `SupplierPayment` → `supplier_payments`; `Supplier` → `suppliers`
- `CustomerPayment` / `Customer` → `customer_payments` / `customers`
- `Sale` / `SaleItem` → existing sales and sale item tables, names to be verified before migration
- `SaleReturn` → `sale_returns` / `sale_return_items`
- `Expense` → `expenses`
- `Employee` → existing auth-linked employee/profile table plus `employee_branches`
- `PermissionSet` → role enum plus `role_permissions` or a checked server-side policy matrix
- `AuditEntry` → `audit_events`

## Required constraints and enums to verify

1. Unique `(store_id, branch_name)` and unique `(product_id, sku)` / barcode.
2. Unique `(branch_id, product_variant_id)` inventory balance.
3. Check constraints for non-negative stock, positive quantities, and non-negative money.
4. Enums for branch status, purchase status, transfer status, payment methods, return type, and employee role.
5. Foreign keys from every movement/payment/return line to its source record.
6. Idempotency keys or unique source references for purchase receiving, payments, returns, and transfer receipt.
7. Decimal/numeric money columns rather than floating point.
8. Created/updated timestamps and actor IDs on all mutable business records.
9. Row-level authorization scoped by store and branch.

## RPCs/functions recommended before integration

- `receive_purchase_once(p_purchase_id, p_lines, p_actor_id)`
- `request_inventory_transfer(p_from_branch, p_to_branch, p_lines, p_actor_id)`
- `receive_inventory_transfer_once(p_transfer_id, p_actor_id)`
- `record_supplier_payment(p_supplier_id, p_amount, p_reference, p_actor_id)`
- `record_customer_payment(p_customer_id, p_amount, p_reference, p_actor_id)`
- `return_sale_once(p_sale_id, p_lines, p_refund_amount, p_actor_id)`
- `report_summary(p_from, p_to, p_branch_id)`
- `customer_statement(p_customer_id, p_from, p_to)`
- `supplier_statement(p_supplier_id, p_from, p_to)`

## Migration sequence

1. Inspect existing Supabase schema and RPC definitions; do not assume frontend names.
2. Create an explicit adapter implementing the current repository interface.
3. Add/verify enums, foreign keys, unique constraints, numeric money types, and indexes.
4. Implement receiving, transfers, returns, and payment RPCs with idempotency and row locks.
5. Add RLS for store/branch scope and role checks.
6. Backfill or reconcile opening inventory and balances.
7. Run repository contract tests against a disposable Supabase schema.
8. Switch repository wiring behind a feature flag; keep the mock adapter for local/demo mode.

## Current blockers before real integration

- Existing database table and RPC names are unknown and must be inspected first.
- Authentication-to-employee identity mapping is not defined for audit actors.
- Store tenancy and branch ownership rules need confirmation.
- Existing sale and payment schemas may not support return/payment idempotency keys.
- Existing schema may use different enum values or numeric precision.
- No Supabase environment or integration was requested by design in this phase.
