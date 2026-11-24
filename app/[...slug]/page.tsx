
import SalesPage from '@/components/sales-page'
import ReturnsManagementPage from '@/components/returns-management-page'
import InventoryCountsPage from '@/components/inventory-counts-page'
import SupplierStatementPage from '@/components/supplier-statement-page'
import { notFound } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
import DashboardPage from '@/components/dashboard-page'
import StoresPage from '@/components/stores-page'
import ProductInventoryPage from '@/components/product-inventory-page'
import Phase1ManagementPage from '@/components/phase1-management-page'
import PurchasesPage from '@/components/purchases-page'
import PosPage from '@/components/pos-page'
import EmployeesManagementPage from '@/components/employees-management-page'
import ExpensesPage from '@/components/expenses-page'
import ReportsPage from '@/components/reports-page'

import { requireRedaContext } from '@/lib/reda-scope'
import { getEmployeesPageData } from '@/lib/employees-repository'
import { getExpensesPageData } from '@/lib/expenses-repository'
import { getReportsPageData } from '@/lib/reports-repository'
import { getReturnsPageData } from '@/lib/returns-repository'
import { getInventoryCountsPageData } from '@/lib/inventory-counts-repository'

import {
  getDashboardData,
  getDokkanStoreSettings,
  listDokkanAuditEvents,
  listDokkanCustomers,
  listDokkanProductInventory,
  listDokkanStores,
  listDokkanSuppliers,
  listDokkanPurchases,
  listDokkanPurchaseCatalog,
} from '@/lib/dokkan-repository'

const valid = [
  'dashboard',
  'stores',
  'products',
  'inventory',
  'inventory-counts',
  'pos',
  'sales',
  'purchases',
  'suppliers',
  'transfers',
  'returns',
  'customers',
  'expenses',
  'reports',
  'employees',
  'audit-log',
  'settings',
]

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const type = slug?.[0]

  if (!type || !valid.includes(type)) {
    notFound()
  }

  const reda = await requireRedaContext()

  const user = {
    displayName:
      reda.membership.display_name ||
      reda.user.user_metadata?.display_name ||
      reda.user.email ||
      'مستخدم',
    role: reda.membership.role || null,
    storeName: reda.storeName,
  }

  // Supplier statement
  if (type === 'suppliers' && slug[1]) {
    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <SupplierStatementPage supplierId={slug[1]} />
        }
      />
    )
  }

  // Dashboard
  if (type === 'dashboard') {
    const data = await getDashboardData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={<DashboardPage data={data} />}
      />
    )
  }

  // Returns
  if (type === 'returns') {
    const data = await getReturnsPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <ReturnsManagementPage
            sales={data.sales}
            returns={data.returns}
            requests={data.requests}
            userRole={reda.membership.role ?? null}
          />
        }
      />
    )
  }

  // Stores
  if (type === 'stores') {
    const stores = await listDokkanStores()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <StoresPage
            initialStores={(stores ?? []).map((store) => ({
              ...store,
              dokkan_branches: Array.isArray(store.dokkan_branches)
                ? store.dokkan_branches
                : [],
            }))}
          />
        }
      />
    )
  }

  // Employees
  if (type === 'employees') {
    const data = await getEmployeesPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <EmployeesManagementPage
            storeId={data.storeId}
            initialEmployees={data.employees}
            branches={data.branches}
            isManager={reda.membership.role === 'manager'}
          />
        }
      />
    )
  }

  // Expenses
  if (type === 'expenses') {
    const data = await getExpensesPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <ExpensesPage
            branches={data.branches}
            initialExpenses={data.expenses}
          />
        }
      />
    )
  }

  // Reports
  if (type === 'reports') {
    const data = await getReportsPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={<ReportsPage {...data} />}
      />
    )
  }

  // Products and Inventory
  if (type === 'products' || type === 'inventory') {
    const storeId = reda.storeId
    const data = await listDokkanProductInventory(storeId)

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <ProductInventoryPage
            mode={type}
            initialData={data}
            storeIds={[storeId]}
          />
        }
      />
    )
  }

  // Inventory Counts
  if (type === 'inventory-counts') {
    const data = await getInventoryCountsPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <InventoryCountsPage
            storeId={data.storeId}
            counts={data.counts}
            branches={data.branches}
            products={data.products}
            canApprove={data.canApprove}
          />
        }
      />
    )
  }

  // POS
  if (type === 'pos') {
    const storeId = reda.storeId

    const [data, customers, settings] = await Promise.all([
      listDokkanProductInventory(storeId),
      listDokkanCustomers(storeId),
      getDokkanStoreSettings(storeId),
    ])

    const taxEnabled = Boolean(settings?.tax_enabled)
    const taxRate = Number(settings?.tax_rate ?? 0)

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <PosPage
            initialData={{
              ...data,
              customers,
            }}
            taxEnabled={taxEnabled}
            taxRate={taxRate}
          />
        }
      />
    )
  }

  // Customers, Suppliers, Settings and Audit Log
  if (
    type === 'customers' ||
    type === 'suppliers' ||
    type === 'settings' ||
    type === 'audit-log'
  ) {
    const storeId = reda.storeId

    const [
      customers,
      suppliers,
      settings,
      audit,
    ] = await Promise.all([
      type === 'customers'
        ? listDokkanCustomers(storeId)
        : Promise.resolve([]),

      type === 'suppliers'
        ? listDokkanSuppliers(storeId)
        : Promise.resolve([]),

      type === 'settings'
        ? getDokkanStoreSettings(storeId)
        : Promise.resolve(null),

      type === 'audit-log'
        ? listDokkanAuditEvents(storeId)
        : Promise.resolve([]),
    ])

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <Phase1ManagementPage
            type={type}
            storeId={storeId}
            initialCustomers={customers}
            initialSuppliers={suppliers}
            initialSettings={settings}
            initialAudit={audit}
          />
        }
      />
    )
  }

  // Sales and linked returns
  if (type === 'sales') {
    const data = await getReturnsPageData()

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <SalesPage
            initialSales={data.sales}
            initialReturns={data.returns}
            storeName={reda.storeName}
          />
        }
      />
    )
  }

  // Purchases
  if (type === 'purchases') {
    const storeId = reda.storeId

    const [purchases, catalog] = await Promise.all([
      listDokkanPurchases(storeId),
      listDokkanPurchaseCatalog(storeId),
    ])

    return (
      <DokkanApp
        type={type}
        user={user}
        content={
          <PurchasesPage
            storeId={storeId}
            initialPurchases={purchases}
            catalog={catalog}
          />
        }
      />
    )
  }

  // Other sections
  return (
    <DokkanApp
      type={type}
      user={user}
    />
  )
}
