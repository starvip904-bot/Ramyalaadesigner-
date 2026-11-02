import { notFound } from 'next/navigation'
import DokkanApp from '@/components/dokkan-app'
const valid=['dashboard','stores','products','inventory','pos','sales','purchases','customers','expenses','reports','employees']
export default async function Page({params}:{params:Promise<{slug:string[]}>}) { const {slug}=await params; const type=slug[0]; if(!valid.includes(type)) notFound(); return <DokkanApp type={type}/> }
