import type { Metadata } from 'next'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: 'Tournament Dashboard',
  description: 'Dashboard for an individual tournament',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
