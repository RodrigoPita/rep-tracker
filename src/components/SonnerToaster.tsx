'use client'

import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

export default function SonnerToaster() {
  const { resolvedTheme } = useTheme()
  return (
    <Toaster
      richColors
      position="top-center"
      theme={resolvedTheme as 'light' | 'dark' | 'system'}
    />
  )
}
