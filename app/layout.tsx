import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'دكان | إدارة متجرك بذكاء', description: 'نظام دكان لإدارة المتاجر والفروع والمبيعات والمخزون' }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl"><body>{children}</body></html> }
