'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LogOut } from 'lucide-react'

const tabs = [
  { href: '/', label: 'Início' },
  { href: '/routines', label: 'Treinos' },
  { href: '/analytics', label: 'Analytics' },
]

type Props = {
  userEmail: string | null
}

export default function NavClient({ userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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
    <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
      <div className="max-w-2xl mx-auto px-4">
        <div className="py-3 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-primary">Rep Tracker</span>
          {userEmail && (
            <div className="flex items-center gap-2">
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
            </div>
          )}
        </div>
        <nav className="flex gap-0 -mb-px">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
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
  )
}
