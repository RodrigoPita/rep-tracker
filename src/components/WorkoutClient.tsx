'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { WorkoutSetWithExercise, WorkoutSessionWithRoutine } from '@/lib/types'
import { exerciseLabel, setUnit } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle2, Circle, Timer, Trophy } from 'lucide-react'
import { checkAndUnlockAchievements } from '@/app/actions/achievements'

// ── Audio ─────────────────────────────────────────────────────────────────────
let audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function playBeep() {
  const ctx = getAudioCtx()
  if (!ctx) return
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    const t = ctx.currentTime + i * 0.35
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.start(t)
    osc.stop(t + 0.25)
  }
}

type Props = {
  session: WorkoutSessionWithRoutine
  initialSets: WorkoutSetWithExercise[]
}

function formatDuration(startIso: string, endIso: string): string {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime()
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatSeconds(s: number): string {
  const m = Math.floor(Math.abs(s) / 60)
  const sec = Math.abs(s) % 60
  if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`
  return `${Math.abs(s)}s`
}

type Summary = {
  setsCompleted: number
  totalReps: number
  duration: string
  activeTime: string | null
}

// Live countdown shown between a completed set and the next
function RestTimer({
  restSeconds,
  startedAt,
  onEnd,
}: {
  restSeconds: number
  startedAt: Date
  onEnd: () => void
}) {
  const [elapsed, setElapsed] = useState(0)
  const hasBeepedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const remaining = restSeconds - elapsed

  useEffect(() => {
    if (remaining <= 0 && !hasBeepedRef.current) {
      hasBeepedRef.current = true
      playBeep()
    }
  }, [remaining])

  const overtime = remaining < 0

  return (
    <div className={[
      'flex items-center justify-between px-4 py-2.5 text-sm transition-colors',
      overtime
        ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
        : 'bg-muted/40 text-muted-foreground',
    ].join(' ')}>
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 shrink-0" />
        <span>
          {overtime ? 'Além do tempo: +' : 'Descanso: '}
          <span className="font-mono font-semibold tabular-nums">{formatSeconds(remaining)}</span>
        </span>
      </div>
      <button
        onClick={onEnd}
        className="text-xs font-semibold px-3 py-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Pronto
      </button>
    </div>
  )
}

// Live elapsed timer shown on an active (started) rep-based set
function SetTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return (
    <span className="text-xs font-mono text-primary tabular-nums">
      {formatSeconds(elapsed)}
    </span>
  )
}

// Countdown shown on an active timed set; goes red when overtime
function TimedSetCountdown({ targetSeconds, startedAt }: { targetSeconds: number; startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0)
  const hasBeepedRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  const remaining = targetSeconds - elapsed

  useEffect(() => {
    if (remaining <= 0 && !hasBeepedRef.current) {
      hasBeepedRef.current = true
      playBeep()
    }
  }, [remaining])

  const overtime = remaining < 0

  return (
    <span className={['font-mono font-semibold tabular-nums text-sm', overtime ? 'text-red-500' : 'text-primary'].join(' ')}>
      {overtime ? `+${formatSeconds(remaining)}` : formatSeconds(remaining)}
    </span>
  )
}

export default function WorkoutClient({ session, initialSets }: Props) {
  const router = useRouter()
  const [sets, setSets] = useState<WorkoutSetWithExercise[]>(initialSets)
  const [repOverrides, setRepOverrides] = useState<Record<string, string>>({})
  const [weightOverrides, setWeightOverrides] = useState<Record<string, string>>({})
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)

  // Track which sets are "active" (started but not yet completed) and their start time
  const [activeSetTimes, setActiveSetTimes] = useState<Record<string, Date>>({})
  // Rest state: which set was just completed + when rest started
  const [restState, setRestState] = useState<{ afterSetId: string; startedAt: Date } | null>(null)

  // Unlock AudioContext on first user interaction (required on iOS)
  useEffect(() => {
    const unlock = () => getAudioCtx()
    window.addEventListener('touchstart', unlock, { once: true })
    window.addEventListener('click', unlock, { once: true })
    return () => {
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('click', unlock)
    }
  }, [])

  const [weightExpanded, setWeightExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.entries(
        initialSets.reduce<Record<string, boolean>>((acc, s) => {
          if (s.weight_kg != null && s.routine_exercise_id) acc[s.routine_exercise_id] = true
          return acc
        }, {})
      )
    )
  )

  async function startSet(setId: string) {
    const now = new Date()
    const nowIso = now.toISOString()

    // If rest is active, end it first
    if (restState) {
      const restEndedAt = nowIso
      setSets((prev) =>
        prev.map((s) => s.id === restState.afterSetId ? { ...s, rest_ended_at: restEndedAt } : s)
      )
      await supabase.from('workout_sets').update({ rest_ended_at: restEndedAt }).eq('id', restState.afterSetId)
      setRestState(null)
    }

    setActiveSetTimes((prev) => ({ ...prev, [setId]: now }))
    setSets((prev) => prev.map((s) => s.id === setId ? { ...s, started_at: nowIso } : s))
    await supabase.from('workout_sets').update({ started_at: nowIso }).eq('id', setId)
  }

  async function completeSet(setId: string, targetReps: number) {
    const set = sets.find((s) => s.id === setId)
    const isTimed = set?.routine_exercises?.exercises?.exercise_classes?.is_timed
    const activeStart = activeSetTimes[setId]
    const parsed = repOverrides[setId] ? parseInt(repOverrides[setId]) : targetReps
    const actualReps = isTimed && activeStart
      ? Math.max(1, Math.floor((Date.now() - activeStart.getTime()) / 1000))
      : Math.max(1, isNaN(parsed) ? targetReps : parsed)
    const weightStr = weightOverrides[setId]
    const weight_kg = weightStr ? parseFloat(weightStr) || null : null
    const completedAt = new Date().toISOString()

    setActiveSetTimes((prev) => { const next = { ...prev }; delete next[setId]; return next })
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, completed: true, actual_reps: actualReps, weight_kg, completed_at: completedAt }
          : s
      )
    )

    const { error } = await supabase
      .from('workout_sets')
      .update({ completed: true, actual_reps: actualReps, weight_kg, completed_at: completedAt })
      .eq('id', setId)

    if (error) {
      setSets((prev) =>
        prev.map((s) =>
          s.id === setId ? { ...s, completed: false, actual_reps: null, weight_kg: null, completed_at: null } : s
        )
      )
      toast.error('Não foi possível registrar a série. Tente novamente.')
      return
    }

    // Start rest timer if this exercise has rest_seconds configured,
    // but not after the very last set of the workout
    const restSeconds = set?.routine_exercises?.rest_seconds
    if (restSeconds && restSeconds > 0) {
      let isLastSet: boolean
      if (isCircuit) {
        const maxRound = Math.max(...sets.map((s) => s.set_number))
        const lastRoundSets = sets
          .filter((s) => s.set_number === maxRound)
          .sort((a, b) => b.routine_exercises.display_order - a.routine_exercises.display_order)
        isLastSet = lastRoundSets[0]?.id === setId
      } else {
        const maxOrder = Math.max(...sets.map((s) => s.routine_exercises.display_order))
        const lastExerciseSets = sets.filter((s) => s.routine_exercises.display_order === maxOrder)
        const lastSetNumber = Math.max(...lastExerciseSets.map((s) => s.set_number))
        isLastSet = lastExerciseSets.find((s) => s.set_number === lastSetNumber)?.id === setId
      }
      if (!isLastSet) {
        setRestState({ afterSetId: setId, startedAt: new Date() })
      }
    }
  }

  async function endRest(afterSetId: string) {
    const now = new Date()
    const nowIso = now.toISOString()

    setRestState(null)
    setSets((prev) =>
      prev.map((s) => s.id === afterSetId ? { ...s, rest_ended_at: nowIso } : s)
    )
    await supabase.from('workout_sets').update({ rest_ended_at: nowIso }).eq('id', afterSetId)

    // Auto-start the next set
    const afterSet = sets.find((s) => s.id === afterSetId)
    if (!afterSet) return

    let nextSet: WorkoutSetWithExercise | null

    if (isCircuit) {
      // Circuit: next exercise in the same round → first exercise of the next round
      const currentRound = afterSet.set_number
      const currentOrder = afterSet.routine_exercises.display_order
      nextSet =
        sets
          .filter((s) => s.set_number === currentRound && s.routine_exercises.display_order > currentOrder && !s.completed)
          .sort((a, b) => a.routine_exercises.display_order - b.routine_exercises.display_order)[0] ??
        sets
          .filter((s) => s.set_number > currentRound && !s.completed)
          .sort((a, b) => a.set_number - b.set_number || a.routine_exercises.display_order - b.routine_exercises.display_order)[0] ??
        null
    } else {
      // Standard: next set of same exercise → first incomplete set of next exercise
      nextSet =
        sets.find(
          (s) =>
            s.routine_exercise_id === afterSet.routine_exercise_id &&
            s.set_number === afterSet.set_number + 1 &&
            !s.completed,
        ) ??
        sets
          .filter((s) => s.routine_exercises.display_order > afterSet.routine_exercises.display_order && !s.completed)
          .sort((a, b) => a.routine_exercises.display_order - b.routine_exercises.display_order || a.set_number - b.set_number)[0] ??
        null
    }

    if (!nextSet) return

    setActiveSetTimes((prev) => ({ ...prev, [nextSet.id]: now }))
    setSets((prev) => prev.map((s) => s.id === nextSet.id ? { ...s, started_at: nowIso } : s))
    await supabase.from('workout_sets').update({ started_at: nowIso }).eq('id', nextSet.id)
  }

  async function undoSet(setId: string) {
    // Cancel rest if it was triggered by this set
    if (restState?.afterSetId === setId) setRestState(null)

    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? { ...s, completed: false, actual_reps: null, weight_kg: null, completed_at: null, started_at: null, rest_ended_at: null }
          : s
      )
    )
    const { error } = await supabase
      .from('workout_sets')
      .update({ completed: false, actual_reps: null, weight_kg: null, completed_at: null, started_at: null, rest_ended_at: null })
      .eq('id', setId)
    if (error) {
      setSets(initialSets)
      toast.error('Não foi possível desfazer a série. Tente novamente.')
    }
  }

  async function finishWorkout() {
    setFinishing(true)
    const completedAt = new Date().toISOString()
    const { error } = await supabase
      .from('workout_sessions')
      .update({ completed_at: completedAt })
      .eq('id', session.id)
    if (error) {
      setFinishing(false)
      toast.error('Não foi possível finalizar o treino. Tente novamente.')
      return
    }

    const { data: period } = await supabase
      .from('routine_periods')
      .select('*')
      .eq('routine_id', session.routine_id)
      .is('completed_at', null)
      .maybeSingle()

    if (period) {
      const { count } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('routine_id', session.routine_id)
        .not('completed_at', 'is', null)
        .gte('completed_at', period.started_at)

      if (count !== null && count >= period.target_sessions) {
        await supabase
          .from('routine_periods')
          .update({ completed_at: completedAt })
          .eq('id', period.id)
        toast.success(`Ciclo concluído! ${period.target_sessions} treinos completados.`)
      }
    }

    const completedSets = sets.filter((s) => s.completed)

    // Calculate total active set time (sum of completed_at - started_at)
    let totalActiveMs = 0
    for (const s of completedSets) {
      if (s.started_at && s.completed_at) {
        totalActiveMs += new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()
      }
    }
    const activeTime = totalActiveMs > 0 ? formatDuration(
      new Date(Date.now() - totalActiveMs).toISOString(),
      new Date().toISOString()
    ) : null

    const firstStartedAt = completedSets.reduce<string | null>(
      (min, s) => (s.started_at && (min === null || s.started_at < min) ? s.started_at : min),
      null,
    )

    setSummary({
      setsCompleted: completedSets.length,
      totalReps: completedSets.reduce((acc, s) => acc + (s.actual_reps ?? 0), 0),
      duration: formatDuration(firstStartedAt ?? session.created_at, completedAt),
      activeTime,
    })
    setFinishing(false)

    const unlocked = await checkAndUnlockAchievements()
    for (const achievement of unlocked) {
      toast.success(`Conquista desbloqueada: ${achievement.title}`, {
        description: achievement.description(achievement.metadata),
        duration: 6000,
      })
    }
  }

  const isCircuit = !!session.routines?.is_circuit

  const completedCount = sets.filter((s) => s.completed).length
  const totalCount = sets.length
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
  const allDone = completedCount === totalCount && totalCount > 0

  const grouped = sets.reduce<Record<string, WorkoutSetWithExercise[]>>((acc, set) => {
    const key = set.routine_exercise_id ?? 'unknown'
    if (!acc[key]) acc[key] = []
    acc[key].push(set)
    return acc
  }, {})

  const exerciseGroups = Object.values(grouped)
  const totalExercises = exerciseGroups.length
  const totalPlannedSets = sets.length

  // Circuit mode: group sets by round (set_number), sort each round by display_order
  const roundGroups = isCircuit
    ? sets.reduce<Record<number, WorkoutSetWithExercise[]>>((acc, set) => {
        if (!acc[set.set_number]) acc[set.set_number] = []
        acc[set.set_number].push(set)
        return acc
      }, {})
    : {}
  if (isCircuit) {
    for (const round in roundGroups) {
      roundGroups[Number(round)].sort(
        (a, b) => a.routine_exercises.display_order - b.routine_exercises.display_order
      )
    }
  }
  const roundKeys = Object.keys(roundGroups).map(Number).sort((a, b) => a - b)
  const totalRounds = roundKeys.length

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-1">
              Treino em andamento
            </p>
            <h1 className="text-3xl font-bold tracking-tight">{session.routines?.name}</h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
              {formatDate(session.date)} · {totalExercises} exercício{totalExercises !== 1 ? 's' : ''} · {isCircuit ? `${totalRounds} rodada${totalRounds !== 1 ? 's' : ''}` : `${totalPlannedSets} série${totalPlannedSets !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-semibold tabular-nums">{completedCount} / {totalCount} séries</span>
            </div>
            <Progress value={progress} className="h-2.5" />
          </div>
        </div>

        {/* Exercise preview strip */}
        {exerciseGroups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {exerciseGroups.map((exerciseSets) => {
              const exercise = exerciseSets[0].routine_exercises.exercises
              const label = exerciseLabel(exercise)
              const [, variant] = label.split(' — ')
              const done = exerciseSets.every((s) => s.completed)
              return (
                <span
                  key={exerciseSets[0].routine_exercise_id}
                  className={[
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                    done
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-400 dark:border-green-900'
                      : 'bg-muted/50 text-muted-foreground border-transparent',
                  ].join(' ')}
                >
                  {done && <CheckCircle2 className="w-3 h-3" />}
                  {variant}
                </span>
              )
            })}
          </div>
        )}

        {/* Exercise / round groups */}
        {isCircuit ? (
          // ── Circuit mode: one card per round, one row per exercise ──────────
          roundKeys.map((round) => {
            const roundSets = roundGroups[round]
            const roundDone = roundSets.every((s) => s.completed)

            return (
              <div
                key={round}
                className={[
                  'rounded-xl border bg-card card-elevated overflow-hidden transition-all',
                  roundDone ? 'border-green-300' : '',
                ].join(' ')}
              >
                <div className={['px-4 py-3 border-b flex items-center justify-between', roundDone ? 'bg-green-50 dark:bg-green-950/30' : 'bg-card'].join(' ')}>
                  <p className="font-semibold">Rodada {round} / {totalRounds}</p>
                  {roundDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </div>

                <div className="divide-y divide-border">
                  {roundSets.map((set, setIndexInRound) => {
                    const exercise = set.routine_exercises.exercises
                    const label = exerciseLabel(exercise)
                    const [className, variant] = label.split(' — ')
                    const isActive = !!activeSetTimes[set.id]
                    const activeStart = activeSetTimes[set.id]
                    const hasActiveSet = Object.keys(activeSetTimes).length > 0
                    const prevInRoundIncomplete = roundSets.slice(0, setIndexInRound).some((s) => !s.completed)
                    const isBlocked = !set.completed && !isActive && (hasActiveSet || prevInRoundIncomplete)
                    const weightKey = set.routine_exercise_id ?? 'unknown'

                    return (
                      <div key={set.id}>
                        <div className={[
                          'flex items-center gap-2 px-3 py-3 transition-colors sm:gap-3 sm:px-4',
                          set.completed ? 'bg-green-50/60 dark:bg-green-950/20'
                            : isActive ? 'bg-primary/5'
                            : 'bg-card',
                        ].join(' ')}>
                          <button
                            disabled={isBlocked}
                            onClick={() => {
                              if (set.completed) {
                                undoSet(set.id)
                              } else if (isActive) {
                                completeSet(set.id, set.target_reps)
                              } else {
                                startSet(set.id)
                              }
                            }}
                            className={[
                              'shrink-0 transition-transform active:scale-90',
                              isBlocked ? 'opacity-30 cursor-not-allowed' : '',
                            ].join(' ')}
                            aria-label={set.completed ? 'Desfazer série' : isActive ? 'Completar série' : 'Iniciar série'}
                          >
                            {set.completed ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : isActive ? (
                              <CheckCircle2 className="w-6 h-6 text-primary" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground/30" />
                            )}
                          </button>

                          {/* Exercise name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold truncate">{className}</p>
                            <p className={['text-sm font-medium truncate', set.completed ? 'text-muted-foreground' : ''].join(' ')}>{variant ?? className}</p>
                          </div>

                          {/* Weight toggle + input */}
                          {!set.completed && (
                            <button
                              onClick={() => setWeightExpanded((prev) => ({ ...prev, [weightKey]: !prev[weightKey] }))}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            >
                              {weightExpanded[weightKey] ? '− kg' : '＋ kg'}
                            </button>
                          )}
                          {weightExpanded[weightKey] && (
                            <>
                              <Input
                                type="number"
                                placeholder="kg"
                                value={weightOverrides[set.id] ?? (set.weight_kg != null ? String(set.weight_kg) : '')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '' || parseFloat(val) >= 0) {
                                    setWeightOverrides((prev) => ({ ...prev, [set.id]: val }))
                                  }
                                }}
                                disabled={set.completed}
                                className={[
                                  'w-14 h-9 text-center font-semibold tabular-nums shrink-0 sm:w-16',
                                  set.completed ? 'text-muted-foreground' : '',
                                ].join(' ')}
                              />
                              <span className="text-xs text-muted-foreground shrink-0">kg</span>
                            </>
                          )}

                          {/* Reps / timed */}
                          {set.routine_exercises.exercises.exercise_classes.is_timed ? (
                            <div className="flex items-center gap-1.5">
                              {isActive && activeStart ? (
                                <TimedSetCountdown
                                  targetSeconds={set.routine_exercises.target_seconds ?? 30}
                                  startedAt={activeStart}
                                />
                              ) : set.completed ? (
                                <span className="text-sm font-mono font-semibold tabular-nums text-muted-foreground">
                                  {formatSeconds(set.actual_reps ?? 0)}
                                </span>
                              ) : (
                                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                                  {formatSeconds(set.routine_exercises.target_seconds ?? 30)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                placeholder={String(set.target_reps)}
                                value={repOverrides[set.id] ?? (set.actual_reps != null ? String(set.actual_reps) : '')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '' || parseInt(val) >= 1) {
                                    setRepOverrides((prev) => ({ ...prev, [set.id]: val }))
                                  }
                                }}
                                disabled={set.completed}
                                className={[
                                  'w-14 h-9 text-center font-semibold tabular-nums shrink-0 sm:w-16',
                                  set.completed ? 'text-muted-foreground line-through' : '',
                                ].join(' ')}
                              />
                              <span className="text-sm text-muted-foreground shrink-0">{setUnit(false)}</span>
                            </>
                          )}

                          {/* Live elapsed timer on active rep-based set */}
                          {isActive && activeStart && !set.routine_exercises.exercises.exercise_classes.is_timed && (
                            <span className="ml-auto">
                              <SetTimer startedAt={activeStart} />
                            </span>
                          )}
                        </div>

                        {/* Rest timer row */}
                        {restState?.afterSetId === set.id && (
                          <RestTimer
                            restSeconds={set.routine_exercises.rest_seconds ?? 60}
                            startedAt={restState.startedAt}
                            onEnd={() => endRest(set.id)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        ) : (
          // ── Standard mode: one card per exercise, sets inside ───────────────
          exerciseGroups.map((exerciseSets) => {
            const exercise = exerciseSets[0].routine_exercises.exercises
            const groupDone = exerciseSets.every((s) => s.completed)
            const label = exerciseLabel(exercise)
            const [className, variant] = label.split(' — ')

            return (
              <div
                key={exerciseSets[0].routine_exercise_id}
                className={[
                  'rounded-xl border bg-card card-elevated overflow-hidden transition-all',
                  groupDone ? 'border-green-300' : '',
                ].join(' ')}
              >
                <div className={['px-4 py-3 border-b flex items-center justify-between', groupDone ? 'bg-green-50 dark:bg-green-950/30' : 'bg-card'].join(' ')}>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{className}</p>
                    <p className="font-semibold text-base">{variant ?? className}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!groupDone && (
                      <button
                        onClick={() => { const k = exerciseSets[0].routine_exercise_id ?? 'unknown'; setWeightExpanded((prev) => ({ ...prev, [k]: !prev[k] })) }}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {weightExpanded[exerciseSets[0].routine_exercise_id ?? 'unknown'] ? '− carga' : '＋ carga'}
                      </button>
                    )}
                    {groupDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {exerciseSets.map((set, setIndex) => {
                    const isActive = !!activeSetTimes[set.id]
                    const activeStart = activeSetTimes[set.id]
                    const hasActiveSet = Object.keys(activeSetTimes).length > 0
                    const prevIncomplete = exerciseSets.slice(0, setIndex).some(s => !s.completed)
                    const isBlocked = !set.completed && !isActive && (hasActiveSet || prevIncomplete)

                    return (
                      <div key={set.id}>
                        <div className={[
                          'flex items-center gap-2 px-3 py-3 transition-colors sm:gap-3 sm:px-4',
                          set.completed ? 'bg-green-50/60 dark:bg-green-950/20'
                            : isActive ? 'bg-primary/5'
                            : 'bg-card',
                        ].join(' ')}>
                          <button
                            disabled={isBlocked}
                            onClick={() => {
                              if (set.completed) {
                                undoSet(set.id)
                              } else if (isActive) {
                                completeSet(set.id, set.target_reps)
                              } else {
                                startSet(set.id)
                              }
                            }}
                            className={[
                              'shrink-0 transition-transform active:scale-90',
                              isBlocked ? 'opacity-30 cursor-not-allowed' : '',
                            ].join(' ')}
                            aria-label={set.completed ? 'Desfazer série' : isActive ? 'Completar série' : 'Iniciar série'}
                          >
                            {set.completed ? (
                              <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : isActive ? (
                              <CheckCircle2 className="w-6 h-6 text-primary" />
                            ) : (
                              <Circle className="w-6 h-6 text-muted-foreground/30" />
                            )}
                          </button>

                          <span className={['text-xs font-medium w-10 shrink-0 sm:text-sm sm:w-14', set.completed ? 'text-muted-foreground' : ''].join(' ')}>
                            S{set.set_number}
                          </span>

                          {weightExpanded[set.routine_exercise_id ?? 'unknown'] && (
                            <>
                              <Input
                                type="number"
                                placeholder="kg"
                                value={weightOverrides[set.id] ?? (set.weight_kg != null ? String(set.weight_kg) : '')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '' || parseFloat(val) >= 0) {
                                    setWeightOverrides((prev) => ({ ...prev, [set.id]: val }))
                                  }
                                }}
                                disabled={set.completed}
                                className={[
                                  'w-14 h-9 text-center font-semibold tabular-nums shrink-0 sm:w-16',
                                  set.completed ? 'text-muted-foreground' : '',
                                ].join(' ')}
                              />
                              <span className="text-xs text-muted-foreground shrink-0 sm:text-sm">kg</span>
                            </>
                          )}

                          {set.routine_exercises.exercises.exercise_classes.is_timed ? (
                            // Timed exercise: show countdown while active, elapsed when done, target when pending
                            <div className="flex items-center gap-1.5 ml-1">
                              {isActive && activeStart ? (
                                <TimedSetCountdown
                                  targetSeconds={set.routine_exercises.target_seconds ?? 30}
                                  startedAt={activeStart}
                                />
                              ) : set.completed ? (
                                <span className="text-sm font-mono font-semibold tabular-nums text-muted-foreground">
                                  {formatSeconds(set.actual_reps ?? 0)}
                                </span>
                              ) : (
                                <span className="text-sm font-mono tabular-nums text-muted-foreground">
                                  {formatSeconds(set.routine_exercises.target_seconds ?? 30)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <Input
                                type="number"
                                placeholder={String(set.target_reps)}
                                value={repOverrides[set.id] ?? (set.actual_reps != null ? String(set.actual_reps) : '')}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (val === '' || parseInt(val) >= 1) {
                                    setRepOverrides((prev) => ({ ...prev, [set.id]: val }))
                                  }
                                }}
                                disabled={set.completed}
                                className={[
                                  'w-14 h-9 text-center font-semibold tabular-nums shrink-0 sm:w-16',
                                  set.completed ? 'text-muted-foreground line-through' : '',
                                ].join(' ')}
                              />
                              <span className="text-sm text-muted-foreground shrink-0">{setUnit(false)}</span>
                            </>
                          )}

                          {/* Live elapsed timer on active rep-based set */}
                          {isActive && activeStart && !set.routine_exercises.exercises.exercise_classes.is_timed && (
                            <span className="ml-auto">
                              <SetTimer startedAt={activeStart} />
                            </span>
                          )}
                        </div>

                        {/* Rest timer row shown after a completed set */}
                        {restState?.afterSetId === set.id && (
                          <RestTimer
                            restSeconds={set.routine_exercises.rest_seconds ?? 60}
                            startedAt={restState.startedAt}
                            onEnd={() => endRest(set.id)}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}

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
            {finishing ? 'Finalizando…' : 'Finalizar treino'}
          </Button>
        )}
      </div>

      {/* Completion summary dialog */}
      <Dialog open={summary !== null} onOpenChange={(open) => { if (!open) router.push('/') }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-2xl">Treino concluído!</DialogTitle>
          </DialogHeader>

          {summary && (
            <div className={['grid gap-3 mt-2', summary.activeTime ? 'grid-cols-2' : 'grid-cols-3'].join(' ')}>
              <div className="rounded-xl border bg-muted/40 px-3 py-4">
                <p className="text-2xl font-bold tabular-nums">{summary.setsCompleted}</p>
                <p className="text-xs text-muted-foreground mt-0.5">séries</p>
              </div>
              <div className="rounded-xl border bg-muted/40 px-3 py-4">
                <p className="text-2xl font-bold tabular-nums">{summary.totalReps}</p>
                <p className="text-xs text-muted-foreground mt-0.5">reps</p>
              </div>
              <div className="rounded-xl border bg-muted/40 px-3 py-4">
                <p className="text-2xl font-bold tabular-nums">{summary.duration}</p>
                <p className="text-xs text-muted-foreground mt-0.5">duração</p>
              </div>
              {summary.activeTime && (
                <div className="rounded-xl border bg-muted/40 px-3 py-4">
                  <p className="text-2xl font-bold tabular-nums">{summary.activeTime}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">tempo ativo</p>
                </div>
              )}
            </div>
          )}

          <Button className="w-full mt-2" onClick={() => router.push('/')}>
            Voltar ao início
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
