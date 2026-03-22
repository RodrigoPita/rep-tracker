'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-muted-foreground text-sm">Algo deu errado ao carregar o calendário.</p>
      <Button variant="outline" onClick={reset}>Tentar novamente</Button>
    </div>
  )
}
