import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import NavBar from '@/components/NavBar'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rep Tracker',
  description: 'Acompanhe seus treinos e evolução',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        <NavBar />
        <main className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}
