import { notFound, redirect } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
import DashboardPage from '@/components/dashboard-page'
import StoresPage from '@/components/stores-page'
import ProductInventoryPage from '@/components/product-inventory-page'
import { getCurrentMemberContext, getDashboardData, listDokkanStores, listDokkanProductInventory } from '@/lib/dokkan-repository'
const valid=['dashboard','stores','products','inventory','pos','sales','purchases','suppliers','transfers','returns','customers','expenses','reports','employees','audit-log','settings']
export default async function Page({params}:{params:Promise<{slug:string[]}>}) { const {slug}=await params; const type=slug[0]; if(!valid.includes(type)) notFound(); const context = await getCurrentMemberContext(); if (!context.member) redirect('/onboarding/store'); const user = { displayName: context.member.display_name || context.user.user_metadata?.display_name || context.user.email || 'مستخدم', role: context.member.role || null, storeName: context.storeName };
  if (type === 'dashboard') { const data = await getDashboardData(); return <DokkanApp type={type} user={user} content={<DashboardPage data={data} />} /> }
  if (type === 'stores') { const stores = await listDokkanStores(); return <DokkanApp type={type} user={user} content={<StoresPage initialStores={(stores ?? []).map((store) => ({ ...store, dokkan_branches: Array.isArray(store.dokkan_branches) ? store.dokkan_branches : [] }))} />} /> }
  if (type === 'products' || type === 'inventory') { const storeId = context.member.store_id; const data = await listDokkanProductInventory(storeId); return <DokkanApp type={type} user={user} content={<ProductInventoryPage mode={type} initialData={data} storeIds={[storeId]} />} /> }
  return <DokkanApp type={type} user={user} /> }
