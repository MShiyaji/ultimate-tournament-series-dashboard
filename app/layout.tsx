import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
