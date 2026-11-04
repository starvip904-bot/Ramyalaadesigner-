import { notFound, redirect } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
import DashboardPage from '@/components/dashboard-page'
import StoresPage from '@/components/stores-page'
import ProductInventoryPage from '@/components/product-inventory-page'
import Phase1ManagementPage from '@/components/phase1-management-page'
import PurchasesPage from '@/components/purchases-page'
import { requireRedaContext } from '@/lib/reda-scope'
import { getDashboardData, getDokkanStoreSettings, listDokkanAuditEvents, listDokkanCustomers, listDokkanProductInventory, listDokkanStores, listDokkanSuppliers, listDokkanPurchases, listDokkanPurchaseCatalog } from '@/lib/dokkan-repository'
const valid=['dashboard','stores','products','inventory','pos','sales','purchases','suppliers','transfers','returns','customers','expenses','reports','employees','audit-log','settings']
export default async function Page({params}:{params:Promise<{slug:string[]}>}) { const {slug}=await params; const type=slug[0]; if(!valid.includes(type)) notFound(); const reda = await requireRedaContext(); const user = { displayName: reda.membership.display_name || reda.user.user_metadata?.display_name || reda.user.email || 'مستخدم', role: reda.membership.role || null, storeName: reda.storeName };
  if (type === 'dashboard') { const data = await getDashboardData(); return <DokkanApp type={type} user={user} content={<DashboardPage data={data} />} /> }
  if (type === 'stores') { const stores = await listDokkanStores(); return <DokkanApp type={type} user={user} content={<StoresPage initialStores={(stores ?? []).map((store) => ({ ...store, dokkan_branches: Array.isArray(store.dokkan_branches) ? store.dokkan_branches : [] }))} />} /> }
  if (type === 'products' || type === 'inventory') { const storeId = reda.storeId; const data = await listDokkanProductInventory(storeId); return <DokkanApp type={type} user={user} content={<ProductInventoryPage mode={type} initialData={data} storeIds={[storeId]} />} /> }
  if (type === 'customers' || type === 'suppliers' || type === 'settings' || type === 'audit-log') { const storeId = reda.storeId; const [customers, suppliers, settings, audit] = await Promise.all([type === 'customers' ? listDokkanCustomers(storeId) : Promise.resolve([]), type === 'suppliers' ? listDokkanSuppliers(storeId) : Promise.resolve([]), type === 'settings' ? getDokkanStoreSettings(storeId) : Promise.resolve(null), type === 'audit-log' ? listDokkanAuditEvents(storeId) : Promise.resolve([])]); return <DokkanApp type={type} user={user} content={<Phase1ManagementPage type={type} storeId={storeId} initialCustomers={customers} initialSuppliers={suppliers} initialSettings={settings} initialAudit={audit} />} /> }
  if (type === 'purchases') { const storeId = reda.storeId; const [purchases, catalog] = await Promise.all([listDokkanPurchases(storeId), listDokkanPurchaseCatalog(storeId)]); return <DokkanApp type={type} user={user} content={<PurchasesPage storeId={storeId} initialPurchases={purchases} catalog={catalog} />} /> }
  return <DokkanApp type={type} user={user} /> }
