'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ExerciseWithClass, WorkoutSet } from '@/lib/types'
import { exerciseLabel } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

type SessionStat = {
  date: string
  totalVolume: number
  avgReps: number
  bestReps: number
}

type Summary = {
  totalSessions: number
  mostTrained: string
  streak: number
}

type Props = {
  exercises: ExerciseWithClass[]
  summary: Summary
}

export default function AnalyticsClient({ exercises, summary }: Props) {
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('all')
  const [stats, setStats] = useState<SessionStat[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  // Unique classes derived from exercises list
  const classes = Array.from(
    new Map(exercises.map((e) => [e.class_id, e.exercise_classes])).entries()
  ).map(([id, cls]) => ({ id, name: cls.name }))

  const variantsForClass = exercises.filter((e) => e.class_id === selectedClassId)

  // When class changes, reset exercise selection
  useEffect(() => {
    setSelectedExerciseId('all')
  }, [selectedClassId])

  useEffect(() => {
    if (!selectedClassId) return
    setLoadingStats(true)

    async function loadStats() {
      // Collect exercise IDs to query
      const exerciseIds =
        selectedExerciseId === 'all'
          ? variantsForClass.map((e) => e.id)
          : [selectedExerciseId]

      if (exerciseIds.length === 0) { setStats([]); setLoadingStats(false); return }

      const { data, error } = await supabase
        .from('workout_sets')
        .select('*, routine_exercises(exercise_id), workout_sessions(date)')
        .in('routine_exercises.exercise_id', exerciseIds)
        .eq('completed', true)

      if (error) {
        toast.error('Não foi possível carregar os dados. Tente novamente.')
        setLoadingStats(false)
        return
      }

      const sets: (WorkoutSet & {
        routine_exercises: { exercise_id: string }
        workout_sessions: { date: string }
      })[] = (data ?? []).filter((s: { routine_exercises: { exercise_id: string } }) =>
        exerciseIds.includes(s.routine_exercises?.exercise_id)
      )

      const byDate: Record<string, number[]> = {}
      for (const set of sets) {
        const date = set.workout_sessions?.date
        if (!date || set.actual_reps == null) continue
        if (!byDate[date]) byDate[date] = []
        byDate[date].push(set.actual_reps)
      }

      const result: SessionStat[] = Object.entries(byDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, reps]) => ({
          date,
          totalVolume: reps.reduce((s, r) => s + r, 0),
          avgReps: Math.round(reps.reduce((s, r) => s + r, 0) / reps.length),
          bestReps: Math.max(...reps),
        }))

      setStats(result)
      setLoadingStats(false)
    }

    loadStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedExerciseId])

  const personalBest = stats.length > 0 ? Math.max(...stats.map((s) => s.bestReps)) : 0

  const selectedLabel =
    selectedExerciseId === 'all'
      ? classes.find((c) => c.id === selectedClassId)?.name ?? ''
      : exerciseLabel(exercises.find((e) => e.id === selectedExerciseId)!)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase">Treinos</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.totalSessions}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase">Mais treinado</CardTitle>
          </CardHeader>
          <CardContent><p className="text-sm font-semibold truncate">{summary.mostTrained}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase">Sequência</CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{summary.streak}d</p></CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Classe de exercício</label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="">Selecionar…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedClassId && variantsForClass.length > 1 && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Variante</label>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={selectedExerciseId}
              onChange={(e) => setSelectedExerciseId(e.target.value)}
            >
              <option value="all">Todas as variantes</option>
              {variantsForClass.map((e) => (
                <option key={e.id} value={e.id}>{e.variant}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!selectedClassId ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Selecione uma classe de exercício para ver os gráficos.
          </CardContent>
        </Card>
      ) : loadingStats ? (
        <p className="text-sm text-muted-foreground">Carregando dados…</p>
      ) : stats.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma série concluída para {selectedLabel} ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Volume total por treino — {selectedLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="totalVolume" strokeWidth={2} dot={false} stroke="hsl(var(--primary))" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Média de reps por série</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avgReps" strokeWidth={2} dot={false} stroke="hsl(var(--primary))" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Recorde pessoal — {selectedLabel}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {personalBest}{' '}
                <span className="text-sm font-normal text-muted-foreground">reps em uma única série</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
