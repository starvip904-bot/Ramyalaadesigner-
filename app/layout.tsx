import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'DOKKAN | رضا شوب', description: 'نظام DOKKAN لإدارة محلات رضا شوب وفروع الأحذية والشنط في مصر', applicationName: 'DOKKAN' }
export const viewport = { themeColor: '#0b5c52', colorScheme: 'light' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar-EG" dir="rtl"><body>{children}</body></html> }
