'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Routine, WorkoutSession } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Play, Plus } from 'lucide-react'

type Props = {
  routines: Routine[]
  activeSessions: WorkoutSession[]
}

export default function HomeClient({ routines, activeSessions }: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)

  async function startSession(routineId: string) {
    setStarting(routineId)
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ routine_id: routineId, date: new Date().toISOString().split('T')[0] })
      .select()
      .single()

    if (error || !data) { setStarting(null); return }

    const { data: reData } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('routine_id', routineId)
      .order('display_order')

    if (reData && reData.length > 0) {
      await supabase.from('workout_sets').insert(
        reData.flatMap((re) =>
          Array.from({ length: re.sets }, (_, i) => ({
            session_id: data.id,
            routine_exercise_id: re.id,
            set_number: i + 1,
            target_reps: re.target_reps,
          }))
        )
      )
    }
    router.push(`/workout/${data.id}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bom treino</h1>
        <p className="text-muted-foreground mt-1">Escolha um treino para começar</p>
      </div>

      {activeSessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Retomar</h2>
          {activeSessions.map((session) => {
            const routine = routines.find((r) => r.id === session.routine_id)
            return (
              <button
                key={session.id}
                onClick={() => router.push(`/workout/${session.id}`)}
                className="w-full text-left rounded-xl border bg-card card-elevated px-4 py-4 flex items-center justify-between gap-3 hover:bg-accent/40 transition-colors"
              >
                <div>
                  <p className="font-semibold">{routine?.name ?? 'Treino'}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{session.date}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">Em andamento</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            )
          })}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Treinos</h2>
          <button
            onClick={() => router.push('/routines/new')}
            className="flex items-center gap-1 text-xs text-primary font-medium hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo treino
          </button>
        </div>

        {routines.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma rotina ainda.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => router.push('/routines/new')}
            >
              Criar primeiro treino
            </Button>
          </div>
        ) : (
          routines.map((routine) => (
            <div
              key={routine.id}
              className="rounded-xl border bg-card card-elevated px-4 py-4 flex items-center justify-between gap-3"
            >
              <p className="font-semibold truncate">{routine.name}</p>
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => startSession(routine.id)}
                disabled={starting === routine.id}
              >
                <Play className="w-3.5 h-3.5" />
                {starting === routine.id ? 'Iniciando…' : 'Iniciar'}
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
