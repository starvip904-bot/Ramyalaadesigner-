import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = { title: 'DOKKAN | إدارة متجرك بذكاء', description: 'DOKKAN منصة SaaS عربية لإدارة المتاجر والفروع والمخزون والمبيعات.', applicationName: 'DOKKAN' }
export const viewport = { themeColor: '#2563eb', colorScheme: 'light', userScalable: false }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar-EG" dir="rtl"><body>{children}<Analytics /></body></html> }
