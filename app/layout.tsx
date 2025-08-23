import type { Metadata } from 'next'
import Image from 'next/image'
import './globals.css'

export const metadata: Metadata = {
  title: 'AdApprove - Image Approval System',
  description: 'Simple image approval system for client campaigns',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <Image 
            src="/logo.png" 
            alt="MyAi Logo" 
            width={40} 
            height={40} 
            className="logo"
          />
          <span className="logo-text">MyAi</span>
        </header>
        {children}
      </body>
    </html>
  )
} 