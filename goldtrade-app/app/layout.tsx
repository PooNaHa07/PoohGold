import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pooh Dev Gold Analytics | ระบบวิเคราะห์ทองแบบ Real-time',
  description: 'ระบบ Real-time Gold Trading Decision Support สำหรับทองไทย 96.5% โดย Pooh Dev',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Sarabun:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
