import { notFound } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
import StoresPage from '@/components/stores-page'
import ProductInventoryPage from '@/components/product-inventory-page'
import { listDokkanStores, listDokkanProductInventory } from '@/lib/dokkan-repository'
const valid=['dashboard','stores','products','inventory','pos','sales','purchases','customers','expenses','reports','employees']
export default async function Page({params}:{params:Promise<{slug:string[]}>}) { const {slug}=await params; const type=slug[0]; if(!valid.includes(type)) notFound(); if (type === 'stores') { const stores = await listDokkanStores(); return <StoresPage initialStores={(stores ?? []).map((store) => ({ ...store, dokkan_branches: Array.isArray(store.dokkan_branches) ? store.dokkan_branches : [] }))} /> } if (type === 'products' || type === 'inventory') { const data = await listDokkanProductInventory(); return <ProductInventoryPage mode={type} initialData={data} /> } return <DokkanApp type={type}/> }
