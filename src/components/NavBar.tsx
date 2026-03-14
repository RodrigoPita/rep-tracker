'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Início' },
  { href: '/routines', label: 'Treinos' },
  { href: '/analytics', label: 'Analytics' },
]

export default function NavBar() {
  const pathname = usePathname()

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="bg-white border-b border-border sticky top-0 z-10 shadow-sm">
      <div className="max-w-2xl mx-auto px-4">
        <div className="py-3">
          <span className="text-xl font-bold tracking-tight text-primary">Rep Tracker</span>
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
