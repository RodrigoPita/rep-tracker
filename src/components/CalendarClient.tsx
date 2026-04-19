'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown, ChevronsDownUp } from 'lucide-react'
import type { CalendarSession } from '@/lib/types'
import { todayBRT } from '@/lib/utils'

type Props = { sessions: CalendarSession[] }

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export default function CalendarClient({ sessions }: Props) {
  const todayStr = todayBRT()
  const [todayYear, todayMonth] = todayStr.split('-').map(Number)
  const [year, setYear] = useState(todayYear)
  const [month, setMonth] = useState(todayMonth - 1)  // month is 0-indexed
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
    setYear(todayYear)
    setMonth(todayMonth - 1)
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

type TrackedSet = CalendarSession['workout_sets'][number] & { routine_exercises: NonNullable<CalendarSession['workout_sets'][number]['routine_exercises']> }

// Used in expanded block rows — lists individual timed values instead of summing
function blockDetailSummary(sets: TrackedSet[]): string {
  const completed = sets.filter(s => s.completed)
  if (completed.length === 0) return '—'
  const isTimed = sets[0].routine_exercises.exercises.exercise_classes.is_timed
  if (isTimed) {
    const vals = completed.map(s => s.actual_reps != null ? `${s.actual_reps}s` : '?')
    return vals.every(v => v === vals[0]) ? `${completed.length} × ${vals[0]}` : vals.join(', ')
  }
  const reps = completed.map(s => s.actual_reps ?? '?')
  if (reps.every(r => r === reps[0])) {
    const weightSuffix = completed[0].weight_kg != null ? ` · ${completed[0].weight_kg} kg` : ''
    return `${completed.length} × ${reps[0]} reps${weightSuffix}`
  }
  return reps.join(', ') + ' reps'
}

function blockSummary(sets: TrackedSet[]): string {
  const completed = sets.filter(s => s.completed)
  if (completed.length === 0) return '—'
  const isTimed = sets[0].routine_exercises.exercises.exercise_classes.is_timed
  if (isTimed) {
    const secs = completed.map(s => s.actual_reps ?? 0)
    if (secs.every(v => v === secs[0])) return `${completed.length} × ${secs[0]}s`
    const total = secs.reduce((a, b) => a + b, 0)
    const m = Math.floor(total / 60), s = total % 60
    return m > 0 ? `${m}m ${s}s` : `${total}s`
  }
  const reps = completed.map(s => s.actual_reps ?? '?')
  if (reps.every(r => r === reps[0])) {
    const weightSuffix = completed[0].weight_kg != null ? ` · ${completed[0].weight_kg} kg` : ''
    return `${completed.length} × ${reps[0]} reps${weightSuffix}`
  }
  return reps.join(', ') + ' reps'
}

function SessionDetail({ session }: { session: CalendarSession }) {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set())

  const trackedSets = session.workout_sets.filter((s): s is TrackedSet => s.routine_exercises != null)

  // Group by class name, preserving first-appearance order (sorted by display_order)
  const classMap = new Map<string, TrackedSet[]>()
  for (const set of trackedSets) {
    const name = set.routine_exercises.exercises.exercise_classes.name
    if (!classMap.has(name)) classMap.set(name, [])
    classMap.get(name)!.push(set)
  }
  const classGroups = [...classMap.entries()].sort(
    ([, a], [, b]) =>
      Math.min(...a.map(s => s.routine_exercises.display_order ?? 0)) -
      Math.min(...b.map(s => s.routine_exercises.display_order ?? 0))
  )

  const completedCount = trackedSets.filter(s => s.completed).length
  const totalCount = trackedSets.length
  const allClassNames = classGroups.map(([name]) => name)
  const allExpanded = allClassNames.length > 0 && allClassNames.every(n => expandedClasses.has(n))

  function toggleClass(name: string) {
    setExpandedClasses(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  function toggleAll() {
    setExpandedClasses(allExpanded ? new Set() : new Set(allClassNames))
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{session.routines.name}</span>
        <div className="flex items-center gap-3">
          <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={allExpanded ? 'Recolher tudo' : 'Expandir tudo'}>
            {allExpanded ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
          </button>
          <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} séries</span>
        </div>
      </div>

      {classGroups.length > 0 && (
        <div className="space-y-0.5 border-t border-border pt-3">
          {classGroups.map(([className, classSets]) => {
            // Group sets within class by block (block_id ?? routine_exercise_id)
            const blockMap = new Map<string, TrackedSet[]>()
            for (const set of classSets) {
              const key = set.routine_exercises.block_id ?? set.routine_exercise_id ?? 'unknown'
              if (!blockMap.has(key)) blockMap.set(key, [])
              blockMap.get(key)!.push(set)
            }
            const blocks = [...blockMap.values()].sort(
              (a, b) => (a[0].routine_exercises.display_order ?? 0) - (b[0].routine_exercises.display_order ?? 0)
            )

            const classSummaryStr = blockSummary(classSets)
            const isExpanded = expandedClasses.has(className)

            return (
              <div key={className}>
                <button
                  onClick={() => toggleClass(className)}
                  className="w-full flex items-center justify-between gap-3 text-sm py-1.5 group"
                >
                  <span className="font-medium text-foreground">{className}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-muted-foreground text-right">{classSummaryStr}</span>
                    <ChevronDown className={['w-3.5 h-3.5 text-muted-foreground/60 transition-transform shrink-0', isExpanded ? 'rotate-180' : ''].join(' ')} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="ml-2 pl-3 border-l border-border space-y-0.5 pb-1">
                    {blocks.map((blockSets, i) => {
                      const variants = [...new Set(blockSets.map(s => s.routine_exercises.exercises.variant).filter(Boolean))]
                      const variantLabel = variants.length > 0 ? variants.join(' / ') : className
                      return (
                        <div key={i} className="flex items-baseline justify-between gap-3 text-sm py-0.5">
                          <span className="text-muted-foreground truncate">{variantLabel}</span>
                          <span className="text-muted-foreground/80 text-right shrink-0">{blockDetailSummary(blockSets)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
