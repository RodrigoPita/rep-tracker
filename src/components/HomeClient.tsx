'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { todayBRT } from '@/lib/utils'
import type { Routine, RoutinePeriod, WorkoutSession } from '@/lib/types'
import { routineMode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronRight, Play, Plus } from 'lucide-react'

type Props = {
  routines: Routine[]
  activeSessions: WorkoutSession[]
  periods: RoutinePeriod[]
  sessionCounts: Record<string, number>
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function HomeClient({ routines, activeSessions, periods, sessionCounts }: Props) {
  const router = useRouter()
  const [starting, setStarting] = useState<string | null>(null)

  async function startSession(routineId: string) {
    setStarting(routineId)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ routine_id: routineId, date: todayBRT(), user_id: user?.id })
      .select()
      .single()

    if (error || !data) {
      setStarting(null)
      toast.error('Não foi possível iniciar o treino. Tente novamente.')
      return
    }

    const { data: reData, error: reError } = await supabase
      .from('routine_exercises')
      .select('*')
      .eq('routine_id', routineId)
      .is('deleted_at', null)
      .order('display_order')

    if (reError) {
      await supabase.from('workout_sessions').delete().eq('id', data.id)
      setStarting(null)
      toast.error('Não foi possível carregar os exercícios do treino.')
      return
    }

    if (reData && reData.length > 0) {
      const { error: setsError } = await supabase.from('workout_sets').insert(
        reData.flatMap((re) =>
          Array.from({ length: re.sets }, (_, i) => ({
            session_id: data.id,
            routine_exercise_id: re.id,
            set_number: i + 1,
            target_reps: re.target_reps,
          }))
        )
      )
      if (setsError) {
        await supabase.from('workout_sessions').delete().eq('id', data.id)
        setStarting(null)
        toast.error('Não foi possível criar as séries do treino.')
        return
      }
    }
    router.push(`/workout/${data.id}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{getGreeting()}</h1>
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
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900">Em andamento</Badge>
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
          routines.map((routine) => {
            const period = periods.find((p) => p.routine_id === routine.id)
            const done = period ? (sessionCounts[routine.id] ?? 0) : 0
            const pct = period ? Math.min((done / period.target_sessions) * 100, 100) : null
            return (
              <div
                key={routine.id}
                className="rounded-xl border bg-card card-elevated px-4 py-4 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{routine.name}</p>
                  <p className="text-xs font-medium text-muted-foreground mt-0.5">
                    {routineMode(routine.is_circuit)}
                  </p>
                  {period && (
                    <div className="mt-1.5 space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {done} / {period.target_sessions} treinos
                      </p>
                    </div>
                  )}
                </div>
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
            )
          })
        )}
      </section>
    </div>
  )
}
