'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Routine } from '@/lib/types'
import { routineMode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Pencil, Archive, RotateCcw, ChevronDown, Plus } from 'lucide-react'

type Props = {
  routines: Routine[]
  archivedRoutines: Routine[]
}

export default function RoutinesClient({ routines: initial, archivedRoutines: initialArchived }: Props) {
  const router = useRouter()
  const [routines, setRoutines] = useState<Routine[]>(initial)
  const [archived, setArchived] = useState<Routine[]>(initialArchived)
  const [showArchived, setShowArchived] = useState(false)

  async function archiveRoutine(id: string) {
    const now = new Date().toISOString()
    const previous = routines
    const routine = routines.find((r) => r.id === id)!
    setRoutines((prev) => prev.filter((r) => r.id !== id))
    setArchived((prev) => [{ ...routine, archived_at: now }, ...prev])
    const { error } = await supabase.from('routines').update({ archived_at: now }).eq('id', id)
    if (error) {
      setRoutines(previous)
      setArchived((prev) => prev.filter((r) => r.id !== id))
      toast.error('Não foi possível arquivar o treino. Tente novamente.')
    }
  }

  async function unarchiveRoutine(id: string) {
    const previous = archived
    const routine = archived.find((r) => r.id === id)!
    setArchived((prev) => prev.filter((r) => r.id !== id))
    setRoutines((prev) => [...prev, { ...routine, archived_at: null }])
    const { error } = await supabase.from('routines').update({ archived_at: null }).eq('id', id)
    if (error) {
      setArchived(previous)
      setRoutines((prev) => prev.filter((r) => r.id !== id))
      toast.error('Não foi possível restaurar o treino. Tente novamente.')
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
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{routine.name}</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">
                  {routineMode(routine.is_circuit)}
                </p>
              </div>
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
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-amber-500"
                  onClick={() => archiveRoutine(routine.id)}
                  title="Arquivar treino"
                >
                  <Archive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
            Arquivados ({archived.length})
          </button>
          {showArchived && (
            <div className="space-y-2">
              {archived.map((routine) => (
                <div
                  key={routine.id}
                  className="rounded-xl border bg-card px-4 py-3.5 flex items-center gap-3 opacity-60"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{routine.name}</p>
                    <p className="text-xs font-medium text-muted-foreground mt-0.5">
                      {routineMode(routine.is_circuit)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => unarchiveRoutine(routine.id)}
                    title="Restaurar treino"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
