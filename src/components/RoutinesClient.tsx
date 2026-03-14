'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Routine } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Plus } from 'lucide-react'

type Props = { routines: Routine[] }

export default function RoutinesClient({ routines: initial }: Props) {
  const router = useRouter()
  const [routines, setRoutines] = useState<Routine[]>(initial)

  async function deleteRoutine(id: string) {
    const previous = routines
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    const { error } = await supabase.from('routines').delete().eq('id', id)
    if (error) {
      setRoutines(previous)
      toast.error('Não foi possível excluir o treino. Tente novamente.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Treinos</h1>
        <Button size="sm" className="gap-1.5" onClick={() => router.push('/routines/new')}>
          <Plus className="w-3.5 h-3.5" />
          Novo treino
        </Button>
      </div>

      {routines.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
          <p className="text-muted-foreground text-sm">Nenhum treino ainda.</p>
          <Button size="sm" className="mt-3" onClick={() => router.push('/routines/new')}>
            Criar primeiro treino
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="rounded-xl border bg-card card-elevated px-4 py-3.5 flex items-center gap-3"
            >
              <p className="font-semibold flex-1 truncate">{routine.name}</p>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => router.push(`/routines/${routine.id}/edit`)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteRoutine(routine.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
