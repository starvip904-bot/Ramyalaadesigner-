import { notFound } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
import StoresPage from '@/components/stores-page'
import { listDokkanStores } from '@/lib/dokkan-repository'
const valid=['dashboard','stores','products','inventory','pos','sales','purchases','customers','expenses','reports','employees']
export default async function Page({params}:{params:Promise<{slug:string[]}>}) { const {slug}=await params; const type=slug[0]; if(!valid.includes(type)) notFound(); if (type === 'stores') { const stores = await listDokkanStores(); return <StoresPage initialStores={(stores ?? []).map((store) => ({ ...store, dokkan_branches: Array.isArray(store.dokkan_branches) ? store.dokkan_branches : [] }))} /> } return <DokkanApp type={type}/> }
