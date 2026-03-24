import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import NavBar from '@/components/NavBar'
import ThemeProvider from '@/components/ThemeProvider'
import SonnerToaster from '@/components/SonnerToaster'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rep Tracker',
  description: 'Acompanhe seus treinos e evolução',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rep Tracker',
  },
}

export const preferredRegion = 'gru1'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${geist.className} bg-background text-foreground min-h-screen overflow-x-hidden`}>
        <ThemeProvider>
          <NavBar />
          <main className="max-w-2xl mx-auto px-4 py-6 min-w-0 pb-24 md:pb-6">
            {children}
          </main>
          <SonnerToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
