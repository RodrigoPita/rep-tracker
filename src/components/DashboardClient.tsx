'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import type { WorkoutSession } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  type BarShapeProps,
} from 'recharts'

type ChartTooltipProps = {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  valueLabel?: string
}

function ChartTooltip({ active, payload, label, valueLabel = 'Treinos' }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-md text-sm">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-semibold text-foreground">{valueLabel}: {payload[0].value}</p>
    </div>
  )
}

type Summary = {
  totalSessions: number
  mostTrained: string
  streak: number
}

type PeriodProgress = {
  routineName: string
  completed: number
  target: number
} | null

type Props = {
  sessions: WorkoutSession[]
  summary: Summary
  periodProgress: PeriodProgress
  weeklyData: { week: string; count: number }[]
  topExercises: { label: string; count: number }[]
}

export default function DashboardClient({
  sessions, summary, periodProgress, weeklyData, topExercises,
}: Props) {
  // Weekly strip — Sun first, computed client-side for correct local timezone
  const weekStrip = useMemo(() => {
    const now = new Date()
    const dow = now.getDay() // 0 = Sun
    const sunday = new Date(now)
    sunday.setDate(now.getDate() - dow)
    const sessionDates = new Set(sessions.map((s) => s.date))
    const todayStr = now.toISOString().split('T')[0]

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday)
      d.setDate(sunday.getDate() + i)
      const dateStr = d.toISOString().split('T')[0]
      const raw = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      const label = raw.charAt(0).toUpperCase() + raw.slice(1, 3)
      return {
        date: dateStr,
        label,
        hasSession: sessionDates.has(dateStr),
        isToday: dateStr === todayStr,
      }
    })
  }, [sessions])

  const sessionsThisWeek = weekStrip.filter((d) => d.hasSession).length
  const maxWeekly = Math.max(...weeklyData.map((d) => d.count), 1)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* This week */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
          Esta semana · {sessionsThisWeek} treino{sessionsThisWeek !== 1 ? 's' : ''}
        </h2>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex justify-between">
              {weekStrip.map(({ date, label, hasSession, isToday }) => (
                <div key={date} className="flex flex-col items-center gap-1.5">
                  <div className={[
                    'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                    hasSession
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                      ? 'ring-2 ring-primary text-primary'
                      : 'bg-muted/40 text-muted-foreground',
                  ].join(' ')}>
                    {hasSession && <Check className="w-4 h-4" />}
                  </div>
                  <span className={[
                    'text-xs font-medium',
                    isToday ? 'text-primary' : 'text-muted-foreground',
                  ].join(' ')}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active routine period */}
      {periodProgress && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Período atual</h2>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-6">
              <ProgressWheel completed={periodProgress.completed} target={periodProgress.target} />
              <div>
                <p className="font-semibold text-lg leading-tight">{periodProgress.routineName}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {periodProgress.completed} de {periodProgress.target} sessões
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {periodProgress.target - periodProgress.completed > 0
                    ? `Faltam ${periodProgress.target - periodProgress.completed} treinos`
                    : '🎉 Período concluído!'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase text-center">Treinos</CardTitle>
          </CardHeader>
          <CardContent className="text-center"><p className="text-2xl font-bold">{summary.totalSessions}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground uppercase text-center">Sequência</CardTitle>
          </CardHeader>
          <CardContent className="text-center"><p className="text-2xl font-bold">{summary.streak}d</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs text-muted-foreground uppercase text-center">Mais treinado</CardTitle>
        </CardHeader>
        <CardContent className="text-center"><p className="text-sm font-semibold">{summary.mostTrained}</p></CardContent>
      </Card>

      {/* Workouts per week */}
      {weeklyData.some((d) => d.count > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Treinos por semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} width={20} />
                <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} content={<ChartTooltip />} />
                <Bar
                  dataKey="count"
                  shape={(props: BarShapeProps) => {
                    const x = (props.x as number) ?? 0
                    const y = (props.y as number) ?? 0
                    const width = (props.width as number) ?? 0
                    const height = (props.height as number) ?? 0
                    const payload = props.payload as { count: number }
                    if (height <= 0) return <g />
                    return (
                      <rect
                        x={x} y={y} width={width} height={height}
                        fill="var(--primary)"
                        opacity={payload.count === maxWeekly ? 1 : 0.35}
                        rx={3}
                      />
                    )
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top exercises */}
      {topExercises.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Exercícios mais treinados</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={topExercises.length * 40 + 16}>
              <BarChart data={topExercises} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: 'currentColor' }} tickLine={false} axisLine={false} />
                <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} content={<ChartTooltip valueLabel="Séries" />} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function ProgressWheel({ completed, target }: { completed: number; target: number }) {
  const r = 36
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - Math.min(completed / target, 1))

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke="currentColor" className="text-muted/20" />
        <circle
          cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          className="text-primary transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{completed}</span>
        <span className="text-xs text-muted-foreground">/{target}</span>
      </div>
    </div>
  )
}
