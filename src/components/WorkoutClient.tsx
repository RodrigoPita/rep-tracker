'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { WorkoutSetWithExercise, WorkoutSessionWithRoutine } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { CheckCircle2, Circle } from 'lucide-react'

type Props = {
  session: WorkoutSessionWithRoutine
  initialSets: WorkoutSetWithExercise[]
}

export default function WorkoutClient({ session, initialSets }: Props) {
  const router = useRouter()
  const [sets, setSets] = useState<WorkoutSetWithExercise[]>(initialSets)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [finishing, setFinishing] = useState(false)

  async function completeSet(setId: string, targetReps: number) {
    const parsed = overrides[setId] ? parseInt(overrides[setId]) : targetReps
    const actualReps = Math.max(1, isNaN(parsed) ? targetReps : parsed)
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, completed: true, actual_reps: actualReps, completed_at: new Date().toISOString() }
          : s
      )
    )
    const { error } = await supabase
      .from('workout_sets')
      .update({ completed: true, actual_reps: actualReps, completed_at: new Date().toISOString() })
      .eq('id', setId)
    if (error) {
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId ? { ...s, completed: false, actual_reps: null, completed_at: null } : s
        )
      )
      toast.error('Não foi possível registrar a série. Tente novamente.')
    }
  }

  async function undoSet(setId: string) {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId ? { ...s, completed: false, actual_reps: null, completed_at: null } : s
      )
    )
    const { error } = await supabase
      .from('workout_sets')
      .update({ completed: false, actual_reps: null, completed_at: null })
      .eq('id', setId)
    if (error) {
      setSets(initialSets)
      toast.error('Não foi possível desfazer a série. Tente novamente.')
    }
  }

  async function finishWorkout() {
    setFinishing(true)
    const { error } = await supabase
      .from('workout_sessions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', session.id)
    if (error) {
      setFinishing(false)
      toast.error('Não foi possível finalizar o treino. Tente novamente.')
      return
    }
    router.push('/')
  }

  const completedCount = sets.filter((s) => s.completed).length
  const totalCount = sets.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const allDone = completedCount === totalCount && totalCount > 0

  const grouped = sets.reduce<Record<string, WorkoutSetWithExercise[]>>((acc, set) => {
    const key = set.routine_exercise_id
    if (!acc[key]) acc[key] = []
    acc[key].push(set)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">Treino em andamento</p>
          <h1 className="text-3xl font-bold tracking-tight">{session.routines?.name}</h1>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-semibold tabular-nums">{completedCount} / {totalCount} séries</span>
          </div>
          <Progress value={progress} className="h-2.5" />
        </div>
      </div>

      {/* Exercise groups */}
      {Object.values(grouped).map((exerciseSets) => {
        const exercise = exerciseSets[0].routine_exercises.exercises
        const groupDone = exerciseSets.every((s) => s.completed)
        const label = exerciseLabel(exercise)
        const [className, variant] = label.split(' — ')

        return (
          <div
            key={exerciseSets[0].routine_exercise_id}
            className={[
              'rounded-xl border bg-card card-elevated overflow-hidden transition-all',
              groupDone ? 'opacity-70' : '',
            ].join(' ')}
          >
            {/* Exercise header */}
            <div className={['px-4 py-3 border-b flex items-center justify-between', groupDone ? 'bg-muted/40' : 'bg-white'].join(' ')}>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{className}</p>
                <p className="font-semibold text-base">{variant ?? className}</p>
              </div>
              {groupDone && (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              )}
            </div>

            {/* Set rows */}
            <div className="divide-y divide-border">
              {exerciseSets.map((set) => (
                <div
                  key={set.id}
                  className={[
                    'flex items-center gap-3 px-4 py-3 transition-colors',
                    set.completed ? 'bg-muted/20' : 'bg-white',
                  ].join(' ')}
                >
                  {set.completed
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    : <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
                  }

                  <span className={['text-sm font-medium w-14 shrink-0', set.completed ? 'text-muted-foreground' : ''].join(' ')}>
                    Série {set.set_number}
                  </span>

                  <Input
                    type="number"
                    placeholder={String(set.target_reps)}
                    value={overrides[set.id] ?? (set.actual_reps != null ? String(set.actual_reps) : '')}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '' || parseInt(val) >= 1) {
                        setOverrides((prev) => ({ ...prev, [set.id]: val }))
                      }
                    }}
                    disabled={set.completed}
                    className={[
                      'w-16 h-9 text-center font-semibold tabular-nums shrink-0',
                      set.completed ? 'text-muted-foreground line-through' : '',
                    ].join(' ')}
                  />

                  <span className="text-sm text-muted-foreground shrink-0">reps</span>

                  <div className="ml-auto">
                    {set.completed ? (
                      <button
                        onClick={() => undoSet(set.id)}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                      >
                        Desfazer
                      </button>
                    ) : (
                      <Button
                        size="sm"
                        className="h-9 px-5 bg-green-600 hover:bg-green-700 text-white font-semibold"
                        onClick={() => completeSet(set.id, set.target_reps)}
                      >
                        Feito
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Finish button */}
      {totalCount > 0 && (
        <Button
          className={[
            'w-full h-12 text-base font-semibold rounded-xl transition-all',
            allDone
              ? 'bg-primary hover:bg-primary/90 text-white shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          ].join(' ')}
          onClick={finishWorkout}
          disabled={finishing}
        >
          {finishing ? 'Finalizando…' : allDone ? '🎉 Finalizar treino' : 'Finalizar treino'}
        </Button>
      )}
    </div>
  )
}
