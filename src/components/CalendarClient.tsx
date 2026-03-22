'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarSession } from '@/lib/types'

type Props = { sessions: CalendarSession[] }

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function CalendarClient({ sessions }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const sessionsByDate = useMemo(() => {
    const map: Record<string, CalendarSession[]> = {}
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return map
  }, [sessions])

  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = today.toISOString().split('T')[0]

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  function handleDayClick(dateStr: string) {
    if (!sessionsByDate[dateStr]) return
    setSelectedDate(prev => prev === dateStr ? null : dateStr)
  }

  function goToToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setSelectedDate(null)
  }

  const selectedSessions = selectedDate ? (sessionsByDate[selectedDate] ?? []) : []

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Month navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goToToday}
          className="text-sm font-medium border border-border rounded-full px-3 py-1 hover:bg-accent transition-colors text-foreground"
        >
          Hoje
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-lg font-semibold">{MONTHS_PT[month]} {year}</h2>
      </div>

      {/* Calendar grid */}
      <div>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_PT.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const hasSessions = !!sessionsByDate[dateStr]
            const isToday = dateStr === todayStr
            const isSelected = dateStr === selectedDate

            return (
              <button
                key={day}
                onClick={() => handleDayClick(dateStr)}
                disabled={!hasSessions}
                className={[
                  'relative flex flex-col items-center justify-center aspect-square rounded-lg text-sm font-medium transition-colors',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : hasSessions
                    ? 'bg-primary/10 hover:bg-primary/20 text-foreground'
                    : isToday
                    ? 'ring-1 ring-border text-foreground'
                    : 'text-muted-foreground',
                ].join(' ')}
              >
                {day}
                {hasSessions && !isSelected && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Day detail */}
      {selectedDate && selectedSessions.length > 0 && (
        <DayDetail date={selectedDate} sessions={selectedSessions} />
      )}
    </main>
  )
}

function DayDetail({ date, sessions }: { date: string; sessions: CalendarSession[] }) {
  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground capitalize">{formatted}</h3>
      {sessions.map(session => (
        <SessionDetail key={session.id} session={session} />
      ))}
    </div>
  )
}

function SessionDetail({ session }: { session: CalendarSession }) {
  // Group sets by routine_exercise_id to show one row per exercise
  const byRoutineExercise: Record<string, typeof session.workout_sets> = {}
  for (const set of session.workout_sets) {
    const key = set.routine_exercise_id
    if (!byRoutineExercise[key]) byRoutineExercise[key] = []
    byRoutineExercise[key].push(set)
  }

  // Sort by set_number within each group, then sort groups by display_order
  const exerciseGroups = Object.values(byRoutineExercise).sort(
    (a, b) =>
      (a[0].routine_exercises.display_order ?? 0) -
      (b[0].routine_exercises.display_order ?? 0)
  )

  const completedCount = session.workout_sets.filter(s => s.completed).length
  const totalCount = session.workout_sets.length

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{session.routines.name}</span>
        <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} séries</span>
      </div>

      {exerciseGroups.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-3">
          {exerciseGroups.map(sets => {
            const ex = sets[0].routine_exercises.exercises
            const label = ex.variant
              ? `${ex.exercise_classes.name} — ${ex.variant}`
              : ex.exercise_classes.name
            const completed = sets.filter(s => s.completed)
            const hasWeight = completed.some(s => s.weight_kg != null)

            const repsSummary = (() => {
              if (completed.length === 0) return null
              const allReps = completed.map(s => s.actual_reps ?? '?')
              const allSame = allReps.every(r => r === allReps[0])
              if (allSame) {
                const suffix = hasWeight && completed[0].weight_kg != null
                  ? ` · ${completed[0].weight_kg} kg`
                  : ''
                return `${completed.length} × ${allReps[0]} reps${suffix}`
              }
              return allReps.join(', ') + ' reps'
            })()

            return (
              <div key={sets[0].routine_exercise_id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-foreground">{label}</span>
                <span className="text-muted-foreground text-right shrink-0">
                  {repsSummary ?? (
                    <span className="text-muted-foreground/50 italic text-xs">não feito</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
