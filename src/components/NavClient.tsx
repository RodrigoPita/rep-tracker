'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { supabase } from '@/lib/supabase'
import { LogOut, Sun, Moon, Home, Dumbbell, BarChart2 } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/routines', label: 'Treinos', icon: Dumbbell },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
]

type Props = {
  userEmail: string | null
}

export default function NavClient({ userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
    <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
      <div className="max-w-2xl mx-auto px-4">
        <div className="py-3 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-primary">Rep Tracker</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Alternar tema"
            >
              {mounted && resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {userEmail && (
              <>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
                  {userEmail}
                </span>
                <button
                  onClick={logout}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {/* Top tabs — desktop only */}
        <nav className="hidden md:flex gap-0 -mb-px">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                'px-3 py-2.5 text-sm font-medium border-b-2 transition-colors sm:px-4',
                isActive(href)
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              ].join(' ')}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>

    {/* Bottom nav — mobile only */}
    {userEmail && (
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-card border-t border-border"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {tabs.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={[
                'flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors',
                isActive(href) ? 'text-primary' : 'text-muted-foreground',
              ].join(' ')}
            >
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    )}
    </>
  )
}
