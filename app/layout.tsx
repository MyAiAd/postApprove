import type { Metadata } from 'next'
import Image from 'next/image'
import './globals.css'

export const metadata: Metadata = {
  title: 'PostApprove - Social Media Post Approval System',
  description: 'Simple social media post approval system for client campaigns',
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