
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DOKKAN | إدارة متجرك بذكاء',
  description:
    'DOKKAN منصة SaaS عربية لإدارة المتاجر والفروع والمخزون والمبيعات.',
  applicationName: 'DOKKAN',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#159B9B' },
    { media: '(prefers-color-scheme: dark)', color: '#142B45' },
  ],
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ar-EG" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
