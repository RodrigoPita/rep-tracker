'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Check, Medal, Star, Trophy, Crown, Target, Dumbbell, Flame, Lock, ChevronRight, type LucideProps } from 'lucide-react'
import type { WorkoutSession } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { UserAchievement } from '@/lib/achievements'
import { ACHIEVEMENT_DEFS } from '@/lib/achievements'

type IconComponent = React.FC<LucideProps>
const ICON_MAP: Record<string, IconComponent> = {
  Medal, Star, Trophy, Crown, Target, Dumbbell, Flame,
}
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, type BarShapeProps,
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
  timeStats: { avgDuration: string; avgActive: string | null } | null
  achievements: UserAchievement[]
}

export default function DashboardClient({
  sessions, summary, periodProgress, weeklyData, topExercises, timeStats, achievements,
}: Props) {
  const weekStrip = useMemo(() => {
    const now = new Date()
    const dow = now.getDay()
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
      return { date: dateStr, label, hasSession: sessionDates.has(dateStr), isToday: dateStr === todayStr }
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
                    hasSession ? 'bg-primary text-primary-foreground'
                      : isToday ? 'ring-2 ring-primary text-primary'
                      : 'bg-muted/40 text-muted-foreground',
                  ].join(' ')}>
                    {hasSession && <Check className="w-4 h-4" />}
                  </div>
                  <span className={['text-xs font-medium', isToday ? 'text-primary' : 'text-muted-foreground'].join(' ')}>
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

      {/* Time stats */}
      {timeStats && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-muted-foreground uppercase text-center">Duração média</CardTitle>
            </CardHeader>
            <CardContent className="text-center"><p className="text-2xl font-bold">{timeStats.avgDuration}</p></CardContent>
          </Card>
          {timeStats.avgActive && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground uppercase text-center">Tempo ativo médio</CardTitle>
              </CardHeader>
              <CardContent className="text-center"><p className="text-2xl font-bold">{timeStats.avgActive}</p></CardContent>
            </Card>
          )}
        </div>
      )}

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
                      <rect x={x} y={y} width={width} height={height}
                        fill="var(--primary)" opacity={payload.count === maxWeekly ? 1 : 0.35} rx={3} />
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

      {/* Achievements */}
      <AchievementsShelf achievements={achievements} />
    </main>
  )
}

function AchievementsShelf({ achievements }: { achievements: UserAchievement[] }) {
  const earnedById = new Map(achievements.map((a) => [a.achievement_id, a]))

  // Global locked achievements to always show when not yet earned
  const globalLocked = (['streak_5', 'first_period_completed', 'weight_logged_10'] as const)
    .filter((key) => !earnedById.has(key))

  if (achievements.length === 0 && globalLocked.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Conquistas</h2>
        <Link href="/achievements" className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          Ver todas <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {/* Earned achievements — newest first */}
        {achievements.map((a) => {
          const def = ACHIEVEMENT_DEFS[a.achievement_key]
          if (!def) return null
          const Icon = ICON_MAP[def.icon] ?? Medal
          const dateStr = new Date(a.earned_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
          return (
            <Card key={a.id} className="border-primary/20">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{def.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{def.description(a.metadata)}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
              </CardContent>
            </Card>
          )
        })}

        {/* Locked global achievements */}
        {globalLocked.map((key) => {
          const def = ACHIEVEMENT_DEFS[key]
          const Icon = ICON_MAP[def.icon] ?? Medal
          return (
            <Card key={key} className="opacity-50">
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-muted/40 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{def.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug mt-0.5">{def.description({})}</p>
                </div>
                <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
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
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="10" stroke="currentColor"
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
